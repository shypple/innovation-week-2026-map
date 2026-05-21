import type { GoodsBucket, RiskTier } from "../schemas.js";
import { locationToIso2 } from "./locationToIso2.js";
import type { ShipmentTriageRequest } from "../schemas.js";
import { resolveGoodsBucketWithLlm } from "./resolveGoodsBucketWithLlm.js";
import {
  evaluateLaneWithFallback,
  getSanctionsMapIndex,
  hitsToProblematicGoods,
} from "../euSanctionsMap/index.js";
import { buildUserFriendlyTriageMessage } from "../euSanctionsMap/userMessages.js";

export type ShipmentTriageStatus = "success" | "warning" | "danger";

export type ProblematicGoodsHint = {
  id: string;
  label: string;
  note: string;
  sanctionsMapUrl: string;
};

export type ShipmentTriageResponse = {
  status: ShipmentTriageStatus;
  message: string;
  problematicGoods?: ProblematicGoodsHint[];
  meta?: {
    tier: RiskTier;
    goodsBucket: string;
    goodsBucketHeuristic: GoodsBucket;
    goodsLlm?: { used: boolean; cacheHit?: boolean };
    polIso2: string;
    podIso2: string;
    ruleIds: string[];
    summary: string;
    mapSource?: "eu-sanctions-map" | "fallback-seed";
    cargoMeasureLabels?: string[];
    matchedMeasureCount?: number;
  };
};

export function tierToShipmentStatus(tier: RiskTier): ShipmentTriageStatus {
  if (tier === "high") return "danger";
  if (tier === "elevated" || tier === "unknown") return "warning";
  return "success";
}

export async function runShipmentTriage(
  input: ShipmentTriageRequest,
): Promise<
  | { ok: true; body: ShipmentTriageResponse }
  | { ok: false; field: "pol" | "pod"; error: string }
> {
  const pol = locationToIso2(input.pol);
  if (!pol.ok) return { ok: false, field: "pol", error: pol.reason };

  const pod = locationToIso2(input.pod);
  if (!pod.ok) return { ok: false, field: "pod", error: pod.reason };

  const { goodsBucket, goodsLlm } = await resolveGoodsBucketWithLlm({
    goodsCode: input.goodsCode,
    goodsDescription: input.goodsDescription,
  });

  const mapIndex = await getSanctionsMapIndex();
  const evaluation = evaluateLaneWithFallback(mapIndex, {
    polIso2: pol.iso2,
    podIso2: pod.iso2,
    goodsBucket,
    goodsCode: input.goodsCode,
    goodsDescription: input.goodsDescription,
  });

  const status = tierToShipmentStatus(evaluation.tier);
  const message = buildUserFriendlyTriageMessage({
    status,
    polIso2: pol.iso2,
    podIso2: pod.iso2,
    evaluation,
    mapIndex,
  });

  let problematicGoods: ProblematicGoodsHint[] | undefined;
  if (status !== "success") {
    if (evaluation.matchedMeasures.length > 0) {
      problematicGoods = hitsToProblematicGoods(evaluation.podGoodsMeasures, evaluation.matchedMeasures);
    } else if (evaluation.podGoodsMeasures.length > 0) {
      problematicGoods = hitsToProblematicGoods(evaluation.podGoodsMeasures, evaluation.podGoodsMeasures);
    }
  }

  const goodsLlmMeta = goodsLlm.llmUsed
    ? { used: true, ...(goodsLlm.llmCacheHit ? { cacheHit: true as const } : {}) }
    : undefined;

  return {
    ok: true,
    body: {
      status,
      message,
      ...(problematicGoods?.length ? { problematicGoods } : {}),
      meta: {
        tier: evaluation.tier,
        goodsBucket,
        goodsBucketHeuristic: goodsLlm.heuristicBucket,
        ...(goodsLlmMeta ? { goodsLlm: goodsLlmMeta } : {}),
        polIso2: pol.iso2,
        podIso2: pod.iso2,
        ruleIds: evaluation.ruleIds,
        summary: evaluation.summary,
        mapSource: evaluation.mapSource,
        cargoMeasureLabels: evaluation.cargoClassification.labels,
        matchedMeasureCount: evaluation.matchedMeasures.length,
      },
    },
  };
}
