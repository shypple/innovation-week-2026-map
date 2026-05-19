import OpenAI from "openai";
import { goodsBucketSchema, type GoodsBucket } from "../schemas.js";
import { chatCompletionJson, parseModelJson } from "./llmJsonUtils.js";

const SYSTEM_PROMPT = `You classify cargo for EU sanctions triage into exactly one goodsBucket.
Return ONLY JSON: {"goodsBucket":"<enum>"}
Allowed values: general, dual_use, defense, energy_oil_gas, financial, luxury_consumer, tech_software, unknown
- dual_use: dual-use / export-control-sensitive items
- defense: military, arms, ammunition, defense articles
- energy_oil_gas: oil, gas, refined products, energy-sector equipment where relevant
- tech_software: semiconductors, advanced electronics, software, ICT hardware
- financial: financial services, payments, crypto-asset related
- luxury_consumer: luxury goods where sanctions lists target such trade
- general: ordinary consumer/industrial goods with no clear sanctions-sensitive signal
- unknown: not enough information to choose

Prefer the most specific applicable bucket. If both a commodity code and description are given, weight the code for HS-like signals but use the description to disambiguate.`;

export async function classifyGoodsBucketWithLlm(
  env: { apiKey: string; baseUrl?: string; model?: string },
  input: {
    goodsCode: string | null;
    goodsDescription: string | null;
    heuristicBucket: GoodsBucket;
    mode: "fallback" | "always";
  },
): Promise<GoodsBucket | null> {
  const client = new OpenAI({
    apiKey: env.apiKey,
    baseURL: env.baseUrl ?? "https://api.openai.com/v1",
  });

  const model = env.model ?? "gpt-4o-mini";
  const userPayload = {
    goodsCode: input.goodsCode,
    goodsDescription: input.goodsDescription,
    heuristicClassification: input.heuristicBucket,
    instruction:
      input.mode === "always"
        ? "Produce the best goodsBucket given all fields; heuristicClassification is advisory only."
        : "Heuristic could not classify confidently (often unknown); infer goodsBucket from code and/or description.",
  };

  const raw = await chatCompletionJson(client, {
    model,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: JSON.stringify(userPayload) },
    ],
    useJsonObjectFormat: true,
  });

  if (!raw) return null;

  try {
    const parsed = parseModelJson(raw) as { goodsBucket?: unknown };
    const bucket = goodsBucketSchema.safeParse(parsed.goodsBucket);
    return bucket.success ? bucket.data : null;
  } catch {
    return null;
  }
}
