import type { FastifyInstance } from "fastify";
import { evaluateRequestSchema, parseRequestSchema } from "./schemas.js";
import { evaluateShipment } from "./riskEngine.js";
import { parseShipmentText } from "./ai/parseShipment.js";
import { COUNTRY_TIER } from "./data/countryRiskSeed.js";
import { SERVER_DOTENV_PATH, dotenvLoadResult } from "./loadEnv.js";
import { parseLlmCacheStats } from "./ai/parseLlmCache.js";

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  app.get("/health", async () => ({ ok: true }));

  /** Safe diagnostics: no secrets. Use when `usedLlm` is unexpectedly false. */
  app.get("/api/llm-status", async () => {
    const key = process.env.OPENAI_API_KEY;
    const err = dotenvLoadResult.error;
    return {
      dotenvPath: SERVER_DOTENV_PATH,
      dotenvReadOk: err == null,
      dotenvError: err ? String((err as NodeJS.ErrnoException).code ?? err.message) : null,
      openAiKeyPresent: Boolean(key && key.length > 0),
      openAiKeyLength: key?.length ?? 0,
      openAiBaseUrl: process.env.OPENAI_BASE_URL ?? null,
      openAiModel: process.env.OPENAI_MODEL ?? null,
      parseLlmCache: parseLlmCacheStats(),
    };
  });

  app.get("/api/map-risk", async () => ({
    /** ISO2 → tier for seeded countries only. Others should render as unknown on the client. */
    tiers: COUNTRY_TIER,
  }));

  app.post("/api/evaluate", async (request, reply) => {
    const parsed = evaluateRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const result = evaluateShipment(parsed.data);
    return { input: parsed.data, result };
  });

  app.post("/api/parse", async (request, reply) => {
    const parsed = parseRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const env = {
      apiKey: process.env.OPENAI_API_KEY,
      baseUrl: process.env.OPENAI_BASE_URL,
      model: process.env.OPENAI_MODEL,
    };
    const { parsed: shipment, usedLlm, llmError, llmCacheHit } = await parseShipmentText(env, parsed.data);
    return {
      parsed: shipment,
      usedLlm,
      ...(llmCacheHit ? { llmCacheHit } : {}),
      ...(llmError ? { llmError } : {}),
    };
  });

  app.post("/api/parse-and-evaluate", async (request, reply) => {
    const parsed = parseRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const env = {
      apiKey: process.env.OPENAI_API_KEY,
      baseUrl: process.env.OPENAI_BASE_URL,
      model: process.env.OPENAI_MODEL,
    };
    const { parsed: shipment, usedLlm, llmError, llmCacheHit } = await parseShipmentText(env, parsed.data);

    if (!shipment.destinationIso2) {
      return {
        usedLlm,
        parsed: shipment,
        evaluate: null,
        message:
          "Destination country not detected. Pick a country on the map or set ISO2 manually, then evaluate.",
        ...(llmCacheHit ? { llmCacheHit } : {}),
        ...(llmError ? { llmError } : {}),
      };
    }

    const evaluateInput = {
      destinationIso2: shipment.destinationIso2,
      originIso2: shipment.originIso2 ?? undefined,
      goodsBucket: shipment.goodsBucket,
      parties: shipment.parties.length ? shipment.parties : undefined,
    };

    const evaluated = evaluateRequestSchema.safeParse(evaluateInput);
    if (!evaluated.success) {
      return reply
        .status(400)
        .send({ error: evaluated.error.flatten(), parsed: shipment, usedLlm, ...(llmCacheHit ? { llmCacheHit } : {}) });
    }

    const result = evaluateShipment(evaluated.data);
    return {
      usedLlm,
      parsed: shipment,
      evaluate: { input: evaluated.data, result },
      ...(llmCacheHit ? { llmCacheHit } : {}),
      ...(llmError ? { llmError } : {}),
    };
  });
}
