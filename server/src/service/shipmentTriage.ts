import type { GoodsBucket, RiskTier } from "../schemas.js";
import { evaluateShipment } from "../riskEngine.js";
import { locationToIso2 } from "./locationToIso2.js";
import type { ShipmentTriageRequest } from "../schemas.js";
import { UNKNOWN_GOODS_EU_HINTS } from "../data/euSanctionsGoodsHints.js";
import { resolveGoodsBucketWithLlm } from "./resolveGoodsBucketWithLlm.js";

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
  /**
   * When goods code/description were not enough to classify the shipment,
   * high-level categories that frequently appear in EU restrictive measures (cross-check on EU Sanctions Map).
   */
  problematicGoods?: ProblematicGoodsHint[];
  /** Optional diagnostics for integrators (same machine or trusted clients). */
  meta?: {
    tier: RiskTier;
    goodsBucket: string;
    goodsBucketHeuristic: GoodsBucket;
    goodsLlm?: { used: boolean; cacheHit?: boolean };
    polIso2: string;
    podIso2: string;
    ruleIds: string[];
    summary: string;
  };
};

export function tierToShipmentStatus(tier: RiskTier): ShipmentTriageStatus {
  if (tier === "high") return "danger";
  if (tier === "elevated") return "warning";
  if (tier === "unknown") return "warning";
  return "success";
}

/** Short user-facing line only (headline + lane). Details live in `meta` / `problematicGoods`. */
function buildMessage(status: ShipmentTriageStatus, polIso: string, podIso: string): string {
  const headline =
    status === "danger"
      ? "Elevated sanctions context: compliance review recommended before proceeding."
      : status === "warning"
        ? "Sanctions context warrants a closer look; confirm classification and lists."
        : "No high-severity seeded hit for this lane and goods signal; routine checks still apply.";

  return `${headline} Lane POL ${polIso} → POD ${podIso}.`;
}

function problematicGoodsForUnknownBucket(
  goodsBucket: GoodsBucket,
): ProblematicGoodsHint[] | undefined {
  if (goodsBucket !== "unknown") return undefined;
  return UNKNOWN_GOODS_EU_HINTS.map(({ id, label, note, sanctionsMapUrl }) => ({
    id,
    label,
    note,
    sanctionsMapUrl,
  }));
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

  const evaluate = evaluateShipment({
    destinationIso2: pod.iso2,
    originIso2: pol.iso2,
    goodsBucket,
    parties: input.parties?.length ? input.parties : undefined,
  });

  const status = tierToShipmentStatus(evaluate.tier);
  const message = buildMessage(status, pol.iso2, pod.iso2);
  const problematicGoods = problematicGoodsForUnknownBucket(goodsBucket);

  const goodsLlmMeta = goodsLlm.llmUsed
    ? { used: true, ...(goodsLlm.llmCacheHit ? { cacheHit: true as const } : {}) }
    : undefined;

  return {
    ok: true,
    body: {
      status,
      message,
      ...(problematicGoods ? { problematicGoods } : {}),
      meta: {
        tier: evaluate.tier,
        goodsBucket,
        goodsBucketHeuristic: goodsLlm.heuristicBucket,
        ...(goodsLlmMeta ? { goodsLlm: goodsLlmMeta } : {}),
        polIso2: pol.iso2,
        podIso2: pod.iso2,
        ruleIds: evaluate.ruleIds,
        summary: evaluate.summary,
      },
    },
  };
}
