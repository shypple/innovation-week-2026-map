import type { EvaluateRequest } from "./schemas.js";
import type { RiskTier } from "./schemas.js";
import { COUNTRY_TIER } from "./data/countryRiskSeed.js";

export type Citation = {
  id: string;
  label: string;
  sourceUrl: string;
};

export type EvaluateResult = {
  tier: RiskTier;
  ruleIds: string[];
  citations: Citation[];
  checklist: string[];
  summary: string;
};

function baseTierForCountry(iso2: string): RiskTier {
  return COUNTRY_TIER[iso2] ?? "unknown";
}

export function evaluateShipment(input: EvaluateRequest): EvaluateResult {
  const dest = baseTierForCountry(input.destinationIso2);
  const citations: Citation[] = [];
  const ruleIds: string[] = [];
  const checklist: string[] = [
    "Verify HS / customs classification and any dual-use / military end-use.",
    "Screen counterparties against EU financial sanctions lists (not covered by this demo seed).",
    "Confirm financing, insurance, and sanctions clauses in contracts.",
  ];

  if (dest === "high") {
    ruleIds.push("DEST_HIGH_CONTEXT");
    citations.push({
      id: "EU-SANCTIONS-MAP",
      label: "EU Sanctions Map (official context)",
      sourceUrl: "https://www.sanctionsmap.eu/",
    });
  } else if (dest === "elevated") {
    ruleIds.push("DEST_ELEVATED_CONTEXT");
    citations.push({
      id: "EU-SANCTIONS-MAP",
      label: "EU Sanctions Map (official context)",
      sourceUrl: "https://www.sanctionsmap.eu/",
    });
  } else {
    ruleIds.push("DEST_NO_SEED_HIT");
  }

  let tier: RiskTier = dest;

  if (
    (input.goodsBucket === "dual_use" || input.goodsBucket === "defense") &&
    (dest === "elevated" || dest === "high")
  ) {
    if (tier === "elevated" || tier === "unknown") tier = "high";
    ruleIds.push("GOODS_SENSITIVE_DESTINATION");
    citations.push({
      id: "DUAL-USE-PORTAL",
      label: "EU dual-use controls (context)",
      sourceUrl: "https://policy.trade.ec.europa.eu/strategy-and-policy/dual-use-trade_en",
    });
  }

  const summaryParts = [
    `Destination ${input.destinationIso2}: seeded context tier is **${dest}**.`,
    `Goods bucket: **${input.goodsBucket}**.`,
    `Resulting triage tier: **${tier}**.`,
  ];

  return {
    tier,
    ruleIds,
    citations,
    checklist,
    summary: summaryParts.join(" "),
  };
}
