import type { GoodsBucket } from "../schemas.js";
import { inferGoodsBucketForShipment } from "./inferGoodsBucketForShipment.js";
import { classifyGoodsBucketWithLlm } from "../ai/classifyGoodsBucket.js";
import {
  goodsBucketLlmCacheGet,
  goodsBucketLlmCacheKey,
  goodsBucketLlmCacheSet,
} from "../ai/goodsBucketLlmCache.js";

export type GoodsLlmMeta = {
  /** Bucket from code/description heuristics before any LLM call. */
  heuristicBucket: GoodsBucket;
  /** An LLM call was made (or served from cache). */
  llmUsed: boolean;
  /** Result came from the goods-bucket LLM cache. */
  llmCacheHit?: boolean;
};

function triageGoodsLlmMode(): "fallback" | "always" {
  const m = (process.env.SHIPMENT_TRIAGE_LLM_GOODS_MODE ?? "fallback").toLowerCase();
  return m === "always" ? "always" : "fallback";
}

function triageGoodsLlmEnabled(): boolean {
  if (process.env.SHIPMENT_TRIAGE_LLM_GOODS === "0" || process.env.SHIPMENT_TRIAGE_LLM_GOODS === "false") {
    return false;
  }
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

/**
 * Heuristic first (code beats description). Optionally refine with LLM when enabled.
 */
export async function resolveGoodsBucketWithLlm(input: {
  goodsCode?: string | undefined;
  goodsDescription?: string | undefined;
}): Promise<{ goodsBucket: GoodsBucket; goodsLlm: GoodsLlmMeta }> {
  const heuristicBucket = inferGoodsBucketForShipment(input);
  const code = input.goodsCode?.trim() ?? "";
  const desc = input.goodsDescription?.trim() ?? "";
  const hasGoodsSignal = Boolean(code || desc);

  const baseMeta: GoodsLlmMeta = {
    heuristicBucket,
    llmUsed: false,
  };

  if (!triageGoodsLlmEnabled() || !hasGoodsSignal) {
    return { goodsBucket: heuristicBucket, goodsLlm: baseMeta };
  }

  const mode = triageGoodsLlmMode();
  const shouldCallLlm =
    mode === "always" ||
    heuristicBucket === "unknown" ||
    (heuristicBucket === "general" && desc.length > 0);

  if (!shouldCallLlm) {
    return { goodsBucket: heuristicBucket, goodsLlm: baseMeta };
  }

  const apiKey = process.env.OPENAI_API_KEY!.trim();
  const baseUrl = process.env.OPENAI_BASE_URL;
  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

  const cacheKey = goodsBucketLlmCacheKey({
    code: code || null,
    desc: desc || null,
    heuristic: heuristicBucket,
    mode,
    model,
    baseUrl: baseUrl ?? "https://api.openai.com/v1",
  });

  const cached = goodsBucketLlmCacheGet(cacheKey);
  if (cached !== undefined) {
    return {
      goodsBucket: cached,
      goodsLlm: { heuristicBucket, llmUsed: true, llmCacheHit: true },
    };
  }

  const llmBucket = await classifyGoodsBucketWithLlm(
    { apiKey, baseUrl, model },
    {
      goodsCode: code || null,
      goodsDescription: desc || null,
      heuristicBucket,
      mode,
    },
  );

  if (llmBucket === null) {
    console.warn("[shipment-triage] goods LLM classification failed; keeping heuristic bucket.");
    return { goodsBucket: heuristicBucket, goodsLlm: baseMeta };
  }

  goodsBucketLlmCacheSet(cacheKey, llmBucket);
  return {
    goodsBucket: llmBucket,
    goodsLlm: { heuristicBucket, llmUsed: true, llmCacheHit: false },
  };
}
