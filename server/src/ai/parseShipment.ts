import OpenAI from "openai";
import type { ParseRequest, ParsedShipment } from "../schemas.js";
import { parsedShipmentSchema } from "../schemas.js";
import {
  parseLlmCacheGet,
  parseLlmCacheKey,
  parseLlmCacheSet,
} from "./parseLlmCache.js";
import { goodsBucketFromDescription } from "../goodsBucketHeuristics.js";
import { chatCompletionJson, parseModelJson } from "./llmJsonUtils.js";
import { extractLaneFromText, extractParties } from "./countryExtraction.js";

const SYSTEM_PROMPT = `You extract structured shipping/sanctions triage fields from user text.
Return ONLY valid JSON matching the schema. Use ISO 3166-1 alpha-2 country codes in uppercase when you can infer a country.
If multiple destination countries are listed (e.g. "Russia or Belarus"), set destinationIso2 to the plausible discharge country and explain ambiguity in notes.
If the text says "from DE to ???" treat DE as originIso2 and infer destination from other lines (e.g. a Destination bullet).
Extract organization names into parties (max 10). Skip vague phrases like "a person on the B/L".
confidence is 0..1.`;

function heuristicParse(text: string): ParsedShipment {
  const lane = extractLaneFromText(text);
  const parties = extractParties(text);
  const goodsBucket = goodsBucketFromDescription(text);

  return parsedShipmentSchema.parse({
    destinationIso2: lane.destinationIso2,
    originIso2: lane.originIso2,
    goodsBucket,
    parties,
    confidence: lane.destinationIso2 ? 0.55 : 0.35,
    notes:
      lane.notes.length > 0
        ? lane.notes.join(" ")
        : "Heuristic parse (no LLM). Prefer confirming ISO country codes manually.",
  });
}

function enrichParsedShipment(parsed: ParsedShipment, text: string): ParsedShipment {
  const lane = extractLaneFromText(text);
  const parties = extractParties(text);
  const goodsBucket =
    parsed.goodsBucket === "unknown" ? goodsBucketFromDescription(text) : parsed.goodsBucket;

  const mergedNotes = [...new Set([parsed.notes, ...lane.notes].filter(Boolean))].join(" ") || undefined;

  let confidence = parsed.confidence;
  if (parsed.destinationIso2) confidence = Math.max(confidence, 0.75);
  else if (lane.destinationIso2) confidence = Math.max(confidence, 0.65);

  return parsedShipmentSchema.parse({
    destinationIso2: parsed.destinationIso2 ?? lane.destinationIso2,
    originIso2: parsed.originIso2 ?? lane.originIso2,
    goodsBucket,
    parties: parsed.parties.length ? parsed.parties : parties,
    confidence,
    notes: mergedNotes,
  });
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
  llmError?: string;
  llmCacheHit?: boolean;
};

export async function parseShipmentText(
  env: {
    apiKey?: string;
    baseUrl?: string;
    model?: string;
  },
  body: ParseRequest,
): Promise<ParseShipmentResult> {
  const applyHints = (parsed: ParsedShipment): ParsedShipment => {
    if (body.hint?.destinationIso2) {
      parsed.destinationIso2 = body.hint.destinationIso2.toUpperCase();
      parsed.confidence = Math.max(parsed.confidence, 0.55);
    }
    if (body.hint?.goodsBucket) {
      parsed.goodsBucket = body.hint.goodsBucket;
    }
    return parsed;
  };

  if (!env.apiKey?.trim()) {
    return { parsed: applyHints(heuristicParse(body.text)), usedLlm: false };
  }

  const model = env.model ?? "gpt-4o-mini";
  const baseUrl = env.baseUrl ?? "https://api.openai.com/v1";
  const cacheKey = parseLlmCacheKey(body, model, baseUrl);
  const cached = parseLlmCacheGet(cacheKey);
  if (cached) {
    return { parsed: applyHints(enrichParsedShipment(cached.parsed, body.text)), usedLlm: true, llmCacheHit: true };
  }

  const client = new OpenAI({
    apiKey: env.apiKey.trim(),
    baseURL: baseUrl,
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
      model,
      messages,
      useJsonObjectFormat: true,
    });
    if (!raw) {
      console.warn("[parse] Empty LLM message content; falling back to heuristic.");
      return {
        parsed: applyHints(heuristicParse(body.text)),
        usedLlm: false,
        llmError: "Empty message content from model (check model id and API response shape).",
      };
    }

    const parsed = enrichParsedShipment(
      parsedShipmentSchema.parse(parseModelJson(raw)),
      body.text,
    );
    parseLlmCacheSet(cacheKey, parsed);
    return { parsed: applyHints(parsed), usedLlm: true };
  } catch (err) {
    const llmError = formatLlmError(err);
    console.warn("[parse] LLM path failed; falling back to heuristic:", err);
    return { parsed: applyHints(heuristicParse(body.text)), usedLlm: false, llmError };
  }
}
