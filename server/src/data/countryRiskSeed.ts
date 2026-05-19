import type { RiskTier } from "../schemas.js";

/** Demo-only jurisdiction tiers. Replace with ingested EU sanctions map data. */
export const COUNTRY_TIER: Record<string, RiskTier> = {
  RU: "high",
  BY: "high",
  IR: "high",
  KP: "high",
  SY: "high",
  CU: "elevated",
  VE: "elevated",
  MM: "elevated",
  UA: "elevated",
  CN: "elevated",
};
