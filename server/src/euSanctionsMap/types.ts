import type { GoodsBucket, RiskTier } from "../schemas.js";

export type MeasureTypeNode = {
  id: number;
  title: string;
  parentId: number | null;
};

export type CountryMeasureHit = {
  measureTypeId: number;
  title: string;
  parentId: number | null;
  regimeId: number;
  regimeTitle: string;
};

export type SanctionsMapIndex = {
  fetchedAt: number;
  measureTypes: Map<number, MeasureTypeNode>;
  /** ISO2 → cargo-relevant measure type ids active for that country. */
  countryMeasures: Map<string, Set<number>>;
  /** ISO2 → display tier for map highlighting. */
  countryTiers: Record<string, RiskTier>;
  /** ISO2 → full measure hits (for country tooltip). */
  countryMeasureHits: Map<string, CountryMeasureHit[]>;
  /** ISO2 → English country name from EU Sanctions Map data API. */
  countryNames: Map<string, string>;
};

export type CargoMeasureClassification = {
  goodsBucket: GoodsBucket;
  measureTypeIds: number[];
  labels: string[];
};

export type MatchedMeasure = {
  measureTypeId: number;
  title: string;
  parentTitle: string | null;
};

export type EuSanctionsLaneEvaluation = {
  tier: RiskTier;
  ruleIds: string[];
  summary: string;
  matchedMeasures: MatchedMeasure[];
  cargoClassification: CargoMeasureClassification;
  podGoodsMeasures: CountryMeasureHit[];
  mapSource: "eu-sanctions-map" | "fallback-seed";
};
