import type { GoodsBucket } from "../schemas.js";
import { goodsBucketFromCommodityCode, goodsBucketFromDescription } from "../goodsBucketHeuristics.js";
import type { CargoMeasureClassification } from "./types.js";

/** goodsBucket → EU Sanctions Map measure type ids (see /api/v1/data measure_types). */
const BUCKET_TO_MEASURE_IDS: Record<GoodsBucket, number[]> = {
  defense: [2, 3, 4, 5, 40, 56],
  dual_use: [7, 8, 9, 10, 62],
  energy_oil_gas: [41, 26, 42, 49, 51, 54, 63],
  luxury_consumer: [24, 23, 61, 55],
  tech_software: [27, 34, 50, 62, 8, 9],
  financial: [11],
  general: [],
  unknown: [],
};

const HS_CHAPTER_TO_MEASURE_IDS: Record<number, number[]> = {
  93: [2, 56, 40],
  27: [41, 26, 42, 49, 51],
  71: [24, 23, 61, 55],
  84: [34, 7, 8, 62],
  85: [34, 27, 7, 8, 62],
  88: [12, 50],
  89: [16, 43],
};

function hsChapterMeasureIds(goodsCode?: string): number[] {
  if (!goodsCode?.trim()) return [];
  const digits = goodsCode.replace(/\D/g, "");
  if (digits.length < 2) return [];
  const chapter = parseInt(digits.slice(0, 2), 10);
  if (Number.isNaN(chapter)) return [];
  return HS_CHAPTER_TO_MEASURE_IDS[chapter] ?? [];
}

export function classifyCargoMeasures(input: {
  goodsBucket: GoodsBucket;
  goodsCode?: string;
  goodsDescription?: string;
  measureTitles: Map<number, string>;
}): CargoMeasureClassification {
  const desc = input.goodsDescription?.trim() ?? "";
  const code = input.goodsCode?.trim() ?? "";
  const heuristicBucket =
    code && !desc ? goodsBucketFromCommodityCode(code) : goodsBucketFromDescription(desc || code);
  const goodsBucket =
    input.goodsBucket !== "unknown" ? input.goodsBucket : heuristicBucket;

  const ids = new Set<number>([
    ...BUCKET_TO_MEASURE_IDS[goodsBucket],
    ...hsChapterMeasureIds(code),
  ]);

  if (goodsBucket === "general" && ids.size === 0) {
    // No sanctions-map cargo category inferred.
  }

  const measureTypeIds = [...ids];
  const labels = measureTypeIds
    .map((id) => input.measureTitles.get(id))
    .filter((t): t is string => Boolean(t));

  return { goodsBucket, measureTypeIds, labels };
}
