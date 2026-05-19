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

function isSensitiveDestination(dest: RiskTier): boolean {
  return dest === "elevated" || dest === "high";
}

function bumpToHigh(tier: RiskTier): RiskTier {
  if (tier === "elevated" || tier === "unknown") return "high";
  return tier;
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
  const sensitiveDest = isSensitiveDestination(dest);

  if (
    (input.goodsBucket === "dual_use" || input.goodsBucket === "defense") &&
    sensitiveDest
  ) {
    tier = bumpToHigh(tier);
    ruleIds.push("GOODS_SENSITIVE_DESTINATION");
    citations.push({
      id: "DUAL-USE-PORTAL",
      label: "EU dual-use controls (context)",
      sourceUrl: "https://policy.trade.ec.europa.eu/strategy-and-policy/dual-use-trade_en",
    });
    checklist.push(
      "Confirm whether the item is listed or controlled under EU dual-use / military export rules for this destination.",
    );
  } else if (input.goodsBucket === "energy_oil_gas" && sensitiveDest) {
    tier = bumpToHigh(tier);
    ruleIds.push("GOODS_ENERGY_SECTOR_DEST");
    citations.push({
      id: "EU-SANCTIONS-ENERGY",
      label: "EU sanctions — energy sector (context)",
      sourceUrl: "https://www.sanctionsmap.eu/",
    });
    checklist.push(
      "Check petroleum / refined-product sectoral measures for the destination (including sample shipments without HS yet).",
      "Document end-use and end-user; energy-sector trade to listed jurisdictions often needs licensing.",
    );
  } else if (input.goodsBucket === "luxury_consumer" && sensitiveDest) {
    ruleIds.push("GOODS_LUXURY_ELEVATED_DEST");
    citations.push({
      id: "EU-SANCTIONS-LUXURY",
      label: "EU sanctions — luxury / listed goods (context)",
      sourceUrl: "https://www.sanctionsmap.eu/",
    });
    checklist.push(
      "Verify whether watches, jewellery or other luxury items fall under destination-specific trade restrictions.",
      "Treat VIP / private-client routing as higher reputational and compliance exposure — document the commercial rationale.",
    );
  } else if (input.goodsBucket === "tech_software" && sensitiveDest) {
    tier = bumpToHigh(tier);
    ruleIds.push("GOODS_TECH_SECTOR_DEST");
    citations.push({
      id: "EU-SANCTIONS-TECH",
      label: "EU sanctions — advanced technology (context)",
      sourceUrl: "https://www.sanctionsmap.eu/",
    });
    checklist.push(
      "Screen electronics / software for dual-use or advanced-tech controls toward this destination.",
    );
  }

  const summaryParts = [
    `Destination ${input.destinationIso2}: seeded context tier is **${dest}**.`,
    `Goods bucket: **${input.goodsBucket}**.`,
    `Resulting triage tier: **${tier}**.`,
  ];
  if (ruleIds.some((id) => id.startsWith("GOODS_"))) {
    summaryParts.push("Sector-specific goods rules applied on top of destination context.");
  }

  return {
    tier,
    ruleIds,
    citations,
    checklist,
    summary: summaryParts.join(" "),
  };
}
