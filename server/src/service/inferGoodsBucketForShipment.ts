import { goodsBucketFromCommodityCode, goodsBucketFromDescription } from "../goodsBucketHeuristics.js";
import type { GoodsBucket } from "../schemas.js";

/**
 * Priority: non-empty `goodsCode` wins over `goodsDescription`.
 */
export function inferGoodsBucketForShipment(input: {
  goodsCode?: string | undefined;
  goodsDescription?: string | undefined;
}): GoodsBucket {
  const code = input.goodsCode?.trim();
  if (code) return goodsBucketFromCommodityCode(code);

  const desc = input.goodsDescription?.trim();
  if (desc) return goodsBucketFromDescription(desc);

  return "unknown";
}
