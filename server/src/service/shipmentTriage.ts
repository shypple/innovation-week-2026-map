import type { RiskTier } from "../schemas.js";
import { evaluateShipment, type EvaluateResult } from "../riskEngine.js";
import { locationToIso2 } from "./locationToIso2.js";
import { inferGoodsBucketForShipment } from "./inferGoodsBucketForShipment.js";
import type { ShipmentTriageRequest } from "../schemas.js";

export type ShipmentTriageStatus = "success" | "warning" | "danger";

export type ShipmentTriageResponse = {
  status: ShipmentTriageStatus;
  message: string;
  /** Optional diagnostics for integrators (same machine or trusted clients). */
  meta?: {
    tier: RiskTier;
    goodsBucket: string;
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

function stripMarkdownBold(s: string): string {
  return s.replace(/\*\*/g, "");
}

function buildMessage(
  status: ShipmentTriageStatus,
  polIso: string,
  podIso: string,
  goodsBucket: string,
  evaluate: EvaluateResult,
  partiesCount: number,
): string {
  const partiesNote =
    partiesCount > 0
      ? ` ${partiesCount} part${partiesCount === 1 ? "y" : "ies"} noted; screen against sanctions lists separately.`
      : "";

  const headline =
    status === "danger"
      ? "Elevated sanctions context: compliance review recommended before proceeding."
      : status === "warning"
        ? "Sanctions context warrants a closer look; confirm classification and lists."
        : "No high-severity seeded hit for this lane and goods signal; routine checks still apply.";

  return [
    headline,
    `Lane POL ${polIso} → POD ${podIso}; goods signal: ${goodsBucket}.`,
    stripMarkdownBold(evaluate.summary),
    partiesNote,
    "Indicative demo only — not legal clearance.",
  ]
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

export function runShipmentTriage(
  input: ShipmentTriageRequest,
):
  | { ok: true; body: ShipmentTriageResponse }
  | { ok: false; field: "pol" | "pod"; error: string } {
  const pol = locationToIso2(input.pol);
  if (!pol.ok) return { ok: false, field: "pol", error: pol.reason };

  const pod = locationToIso2(input.pod);
  if (!pod.ok) return { ok: false, field: "pod", error: pod.reason };

  const goodsBucket = inferGoodsBucketForShipment({
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
  const message = buildMessage(
    status,
    pol.iso2,
    pod.iso2,
    goodsBucket,
    evaluate,
    input.parties?.length ?? 0,
  );

  return {
    ok: true,
    body: {
      status,
      message,
      meta: {
        tier: evaluate.tier,
        goodsBucket,
        polIso2: pol.iso2,
        podIso2: pod.iso2,
        ruleIds: evaluate.ruleIds,
        summary: evaluate.summary,
      },
    },
  };
}
