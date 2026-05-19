import OpenAI from "openai";
import type { ParseRequest, ParsedShipment } from "../schemas.js";
import { parsedShipmentSchema } from "../schemas.js";

function heuristicParse(text: string): ParsedShipment {
  const upper = text.toUpperCase();
  const matches = [...upper.matchAll(/\b([A-Z]{2})\b/g)].map((m) => m[1]);
  const noise = new Set([
    "EU",
    "UN",
    "US",
    "UK",
    "AI",
    "IT",
    "HR",
    "PR",
    "QC",
    "OF",
    "TO",
    "OR",
    "IN",
    "IS",
    "AT",
    "BE",
    "NO",
    "OK",
  ]);
  const isoCandidates = matches.filter((c) => !noise.has(c));

  let goodsBucket: ParsedShipment["goodsBucket"] = "unknown";
  if (/\bDUAL[\s-]?USE\b|\bEXPORT CONTROL/i.test(text)) goodsBucket = "dual_use";
  else if (/\bMILITARY|\bDEFENSE|\bARMAMENT/i.test(text)) goodsBucket = "defense";
  else if (/\bOIL|\bGAS|\bENERGY/i.test(text)) goodsBucket = "energy_oil_gas";
  else if (/\bCHIP|\bSEMICONDUCTOR|\bSOFTWARE|\bTECH\b/i.test(text))
    goodsBucket = "tech_software";

  const destinationIso2 = isoCandidates.at(-1) ?? null;

  return parsedShipmentSchema.parse({
    destinationIso2,
    originIso2: isoCandidates.length > 1 ? isoCandidates[0] : null,
    goodsBucket,
    parties: [],
    confidence: 0.35,
    notes: "Heuristic parse (no LLM). Prefer confirming ISO country codes manually.",
  });
}

const SYSTEM_PROMPT = `You extract structured shipping/sanctions triage fields from user text.
Return ONLY valid JSON matching the schema. Use ISO 3166-1 alpha-2 country codes in uppercase when you can infer a country.
If unclear, use null for country fields and goodsBucket "unknown".
confidence is 0..1. parties: organization or person names explicitly mentioned (max 10 short strings).`;

/** Many models wrap JSON in markdown fences; some return prose before/after. */
function parseModelJson(raw: string): unknown {
  const trimmed = raw.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)\s*```$/m.exec(trimmed);
  const candidate = fence ? fence[1].trim() : trimmed;
  const objectStart = candidate.indexOf("{");
  const objectEnd = candidate.lastIndexOf("}");
  if (objectStart === -1 || objectEnd === -1 || objectEnd <= objectStart) {
    throw new SyntaxError("No JSON object found in model output");
  }
  return JSON.parse(candidate.slice(objectStart, objectEnd + 1));
}

async function chatCompletionJson(
  client: OpenAI,
  params: {
    model: string;
    messages: OpenAI.Chat.ChatCompletionMessageParam[];
    useJsonObjectFormat: boolean;
  },
): Promise<string | null> {
  const base = {
    model: params.model,
    temperature: 0.1,
    messages: params.messages,
  } as const;

  try {
    const completion = await client.chat.completions.create({
      ...base,
      ...(params.useJsonObjectFormat ? { response_format: { type: "json_object" as const } } : {}),
    });
    return completion.choices[0]?.message?.content ?? null;
  } catch (err) {
    if (!params.useJsonObjectFormat) {
      throw err;
    }
    // Gemini / some OpenAI-compatible servers reject or ignore json_object; retry without it.
    console.warn("[parse] chat.completions with response_format failed, retrying without:", err);
    const completion = await client.chat.completions.create(base);
    return completion.choices[0]?.message?.content ?? null;
  }
}

function truncate(msg: string, max = 480): string {
  return msg.length <= max ? msg : `${msg.slice(0, max)}…`;
}

function formatLlmError(err: unknown): string {
  if (err && typeof err === "object" && "status" in err) {
    const e = err as { status?: number; message?: unknown; error?: unknown };
    const msg =
      typeof e.message === "string"
        ? e.message
        : typeof e.error === "object" && e.error && "message" in (e.error as object)
          ? String((e.error as { message?: string }).message)
          : JSON.stringify(e.error ?? e);
    return truncate(`HTTP ${String(e.status)}: ${msg}`);
  }
  if (err instanceof Error) return truncate(err.message);
  return truncate(String(err));
}

export type ParseShipmentResult = {
  parsed: ParsedShipment;
  usedLlm: boolean;
  /** Present when an API key was configured but the LLM path did not produce a valid parse. */
  llmError?: string;
};

export async function parseShipmentText(
  env: {
    apiKey?: string;
    baseUrl?: string;
    model?: string;
  },
  body: ParseRequest,
): Promise<ParseShipmentResult> {
  const apiKey = env.apiKey?.trim();
  if (!apiKey) {
    const parsed = heuristicParse(body.text);
    if (body.hint?.destinationIso2) {
      parsed.destinationIso2 = body.hint.destinationIso2.toUpperCase();
      parsed.confidence = Math.max(parsed.confidence, 0.55);
    }
    if (body.hint?.goodsBucket) {
      parsed.goodsBucket = body.hint.goodsBucket;
    }
    return { parsed, usedLlm: false };
  }

  const client = new OpenAI({
    apiKey,
    baseURL: env.baseUrl ?? "https://api.openai.com/v1",
  });

  const userPayload = {
    text: body.text,
    hint: body.hint ?? null,
    schema: {
      destinationIso2: "string|null",
      originIso2: "string|null",
      goodsBucket:
        "general|dual_use|defense|energy_oil_gas|financial|luxury_consumer|tech_software|unknown",
      parties: "string[]",
      confidence: "number",
      notes: "string optional",
    },
  };

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: JSON.stringify(userPayload) },
  ];

  try {
    const raw = await chatCompletionJson(client, {
      model: env.model ?? "gpt-4o-mini",
      messages,
      useJsonObjectFormat: true,
    });
    if (!raw) {
      console.warn("[parse] Empty LLM message content; falling back to heuristic.");
      return {
        parsed: heuristicParse(body.text),
        usedLlm: false,
        llmError: "Empty message content from model (check model id and API response shape).",
      };
    }

    const parsed = parsedShipmentSchema.parse(parseModelJson(raw));
    return { parsed, usedLlm: true };
  } catch (err) {
    const llmError = formatLlmError(err);
    console.warn("[parse] LLM path failed; falling back to heuristic:", err);
    return { parsed: heuristicParse(body.text), usedLlm: false, llmError };
  }
}
