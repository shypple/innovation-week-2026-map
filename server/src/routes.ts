import type { FastifyInstance } from "fastify";
import { evaluateRequestSchema, parseRequestSchema, shipmentTriageRequestSchema } from "./schemas.js";
import { evaluateShipment } from "./riskEngine.js";
import { parseShipmentText } from "./ai/parseShipment.js";
import { COUNTRY_TIER } from "./data/countryRiskSeed.js";
import { EU_SANCTIONS_MAP_HOME } from "./data/euSanctionsGoodsHints.js";
import { SERVER_DOTENV_PATH, dotenvLoadResult } from "./loadEnv.js";
import { goodsBucketLlmCacheStats } from "./ai/goodsBucketLlmCache.js";
import { parseLlmCacheStats } from "./ai/parseLlmCache.js";
import { runShipmentTriage } from "./service/shipmentTriage.js";
import { dedupeMeasureHits, getSanctionsMapIndex, hitsToProblematicGoods } from "./euSanctionsMap/index.js";

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
      goodsBucketLlmCache: goodsBucketLlmCacheStats(),
    };
  });

  app.get("/api/map-risk", async () => {
    const index = await getSanctionsMapIndex();
    if (index) {
      return {
        tiers: index.countryTiers,
        source: "eu-sanctions-map",
        fetchedAt: index.fetchedAt,
      };
    }
    return {
      tiers: COUNTRY_TIER,
      source: "fallback-seed",
    };
  });

  app.get<{ Querystring: { country?: string } }>("/api/sanctions-goods-hints", async (request) => {
    const iso2 = request.query.country?.trim().toUpperCase().slice(0, 2);
    const index = await getSanctionsMapIndex();

    if (index && iso2) {
      const hits = dedupeMeasureHits(index.countryMeasureHits.get(iso2) ?? []);
      return {
        sanctionsMapUrl: EU_SANCTIONS_MAP_HOME,
        country: iso2,
        source: "eu-sanctions-map",
        fetchedAt: index.fetchedAt,
        hints: hitsToProblematicGoods(hits, hits),
      };
    }

    if (index) {
      return {
        sanctionsMapUrl: EU_SANCTIONS_MAP_HOME,
        source: "eu-sanctions-map",
        fetchedAt: index.fetchedAt,
        hints: [],
      };
    }

    return {
      sanctionsMapUrl: EU_SANCTIONS_MAP_HOME,
      source: "fallback-seed",
      hints: [],
    };
  });

  /**
   * Cross-app shipment triage (e.g. shypple-dashboard on localhost:3000).
   * POL/POD: ISO2 country (NL) or UN/LOCODE (NLRTM). Goods: code OR description; code wins if both set.
   */
  app.post("/api/v1/shipment-triage", async (request, reply) => {
    const parsed = shipmentTriageRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid request", details: parsed.error.flatten() });
    }
    const out = await runShipmentTriage(parsed.data);
    if (!out.ok) {
      return reply.status(400).send({ error: out.error, field: out.field });
    }
    return out.body;
  });

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
      const hint =
        shipment.notes?.trim() ||
        "Could not infer a single destination ISO2. Click a country on the map or shorten the text.";
      return {
        usedLlm,
        parsed: shipment,
        evaluate: null,
        message: `Destination country not detected. ${hint}`,
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
