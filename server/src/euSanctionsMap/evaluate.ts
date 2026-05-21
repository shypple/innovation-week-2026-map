import type { RiskTier } from "../schemas.js";
import type { GoodsBucket } from "../schemas.js";
import { COUNTRY_TIER } from "../data/countryRiskSeed.js";
import { dedupeMeasureHits } from "./buildIndex.js";
import { classifyCargoMeasures } from "./cargoMeasures.js";
import type {
  CountryMeasureHit,
  EuSanctionsLaneEvaluation,
  MatchedMeasure,
  SanctionsMapIndex,
} from "./types.js";

function measureTitle(index: SanctionsMapIndex, id: number): string {
  return index.measureTypes.get(id)?.title ?? `Measure ${id}`;
}

function childrenOf(index: SanctionsMapIndex, parentId: number): number[] {
  const out: number[] = [];
  for (const [id, node] of index.measureTypes) {
    if (node.parentId === parentId) out.push(id);
  }
  return out;
}

function resolveCountryMeasureForCargo(
  cargoMeasureId: number,
  countryIds: Set<number>,
  index: SanctionsMapIndex,
): number | null {
  if (countryIds.has(cargoMeasureId)) return cargoMeasureId;

  const node = index.measureTypes.get(cargoMeasureId);
  const parentId = node?.parentId;
  if (parentId == null || !countryIds.has(parentId)) return null;

  const listedChildren = childrenOf(index, parentId).filter((id) => countryIds.has(id));
  if (listedChildren.length === 0) return parentId;
  return countryIds.has(cargoMeasureId) ? cargoMeasureId : null;
}

function findMatches(
  cargoMeasureIds: number[],
  countryIds: Set<number>,
  index: SanctionsMapIndex,
): MatchedMeasure[] {
  const matched: MatchedMeasure[] = [];
  const seenCountryMeasure = new Set<number>();

  for (const cargoId of cargoMeasureIds) {
    const countryMeasureId = resolveCountryMeasureForCargo(cargoId, countryIds, index);
    if (countryMeasureId == null || seenCountryMeasure.has(countryMeasureId)) continue;
    seenCountryMeasure.add(countryMeasureId);

    const node = index.measureTypes.get(countryMeasureId);
    const parentTitle =
      node?.parentId != null ? measureTitle(index, node.parentId) : null;
    matched.push({
      measureTypeId: countryMeasureId,
      title: node?.title ?? measureTitle(index, countryMeasureId),
      parentTitle,
    });
  }
  return matched;
}

function tierFromMatches(matched: MatchedMeasure[], countryTier: RiskTier | undefined): RiskTier {
  if (!matched.length) return "low";
  const highCargo = matched.some((m) =>
    [2, 3, 4, 5, 7, 8, 9, 10, 41, 26, 42, 56, 62].includes(m.measureTypeId),
  );
  if (highCargo || countryTier === "high") return "high";
  if (countryTier === "elevated") return "elevated";
  return "elevated";
}

function fallbackEvaluate(input: {
  podIso2: string;
  goodsBucket: GoodsBucket;
}): EuSanctionsLaneEvaluation {
  const dest = COUNTRY_TIER[input.podIso2] ?? "unknown";
  let tier: RiskTier = dest === "unknown" ? "low" : dest;
  const ruleIds: string[] = [];
  if (dest === "high") ruleIds.push("DEST_HIGH_CONTEXT");
  else if (dest === "elevated") ruleIds.push("DEST_ELEVATED_CONTEXT");
  else ruleIds.push("DEST_NO_SEED_HIT");

  if (
    (input.goodsBucket === "dual_use" || input.goodsBucket === "defense") &&
    (dest === "elevated" || dest === "high")
  ) {
    tier = "high";
    ruleIds.push("GOODS_SENSITIVE_DESTINATION");
  }

  return {
    tier,
    ruleIds,
    summary: `Fallback demo seed (EU Sanctions Map unavailable). Destination ${input.podIso2}: **${dest}**. Goods: **${input.goodsBucket}**. Tier: **${tier}**.`,
    matchedMeasures: [],
    cargoClassification: {
      goodsBucket: input.goodsBucket,
      measureTypeIds: [],
      labels: [],
    },
    podGoodsMeasures: [],
    mapSource: "fallback-seed",
  };
}

export function evaluateLaneWithSanctionsMap(
  index: SanctionsMapIndex,
  input: {
    polIso2: string;
    podIso2: string;
    goodsBucket: GoodsBucket;
    goodsCode?: string;
    goodsDescription?: string;
  },
): EuSanctionsLaneEvaluation {
  const measureTitles = new Map<number, string>();
  for (const [id, node] of index.measureTypes) measureTitles.set(id, node.title);

  const cargoClassification = classifyCargoMeasures({
    goodsBucket: input.goodsBucket,
    goodsCode: input.goodsCode,
    goodsDescription: input.goodsDescription,
    measureTitles,
  });

  const podIds = index.countryMeasures.get(input.podIso2) ?? new Set<number>();
  const podHits = dedupeMeasureHits(index.countryMeasureHits.get(input.podIso2) ?? []);
  const countryTier = index.countryTiers[input.podIso2];

  if (podIds.size === 0) {
    return {
      tier: "low",
      ruleIds: ["EU_MAP_NO_POD_MEASURES"],
      summary: `Destination ${input.podIso2} has no cargo-related EU Sanctions Map measures. Goods: **${cargoClassification.goodsBucket}**.`,
      matchedMeasures: [],
      cargoClassification,
      podGoodsMeasures: [],
      mapSource: "eu-sanctions-map",
    };
  }

  if (cargoClassification.measureTypeIds.length === 0) {
    return {
      tier: input.goodsBucket === "unknown" ? "elevated" : "low",
      ruleIds: input.goodsBucket === "unknown" ? ["EU_MAP_POD_MEASURES_UNKNOWN_CARGO"] : ["EU_MAP_NO_CARGO_CATEGORY_MATCH"],
      summary:
        input.goodsBucket === "unknown"
          ? `Destination ${input.podIso2} has EU restrictive measures on goods, but cargo category is **unknown**. Confirm HS / description against the map.`
          : `Destination ${input.podIso2} has EU measures, but classified cargo (**${cargoClassification.goodsBucket}**) does not match listed goods categories for that country.`,
      matchedMeasures: [],
      cargoClassification,
      podGoodsMeasures: podHits,
      mapSource: "eu-sanctions-map",
    };
  }

  const matched = findMatches(cargoClassification.measureTypeIds, podIds, index);

  if (!matched.length) {
    return {
      tier: "low",
      ruleIds: ["EU_MAP_CARGO_NOT_LISTED_FOR_POD"],
      summary: `Destination ${input.podIso2} has EU sanctions, but the classified cargo (${matchedLabels(cargoClassification.labels)}) is not among the **goods restrictions listed** for that country on the EU Sanctions Map.`,
      matchedMeasures: [],
      cargoClassification,
      podGoodsMeasures: podHits,
      mapSource: "eu-sanctions-map",
    };
  }

  const tier = tierFromMatches(matched, countryTier);
  const ruleIds = ["EU_MAP_CARGO_MEASURE_MATCH", ...matched.map((m) => `EU_MAP_MEASURE_${m.measureTypeId}`)];

  return {
    tier,
    ruleIds,
    summary: `Destination ${input.podIso2}: cargo matches **${matched.length}** EU Sanctions Map goods restriction(s): ${matched.map((m) => m.title).join(", ")}.`,
    matchedMeasures: matched,
    cargoClassification,
    podGoodsMeasures: podHits,
    mapSource: "eu-sanctions-map",
  };
}

function matchedLabels(labels: string[]): string {
  return labels.length ? labels.join(", ") : "unclassified";
}

export function evaluateLaneWithFallback(
  index: SanctionsMapIndex | null,
  input: {
    polIso2: string;
    podIso2: string;
    goodsBucket: GoodsBucket;
    goodsCode?: string;
    goodsDescription?: string;
  },
): EuSanctionsLaneEvaluation {
  if (!index) return fallbackEvaluate({ podIso2: input.podIso2, goodsBucket: input.goodsBucket });
  return evaluateLaneWithSanctionsMap(index, input);
}

export function hitsToProblematicGoods(
  hits: CountryMeasureHit[],
  matchedOnly: CountryMeasureHit[] | MatchedMeasure[],
): { id: string; label: string; note: string; sanctionsMapUrl: string }[] {
  const EU = "https://www.sanctionsmap.eu/";
  const source = matchedOnly.length ? matchedOnly : hits;
  return source.map((h) => {
    const measureTypeId = "measureTypeId" in h ? h.measureTypeId : (h as MatchedMeasure).measureTypeId;
    const title = "title" in h ? h.title : (h as MatchedMeasure).title;
    const regimeTitle = "regimeTitle" in h ? h.regimeTitle : "EU restrictive measures";
    return {
      id: String(measureTypeId),
      label: title,
      note: `Listed under EU Sanctions Map regime: ${regimeTitle}. Assistive match only; verify on the official map.`,
      sanctionsMapUrl: EU,
    };
  });
}
