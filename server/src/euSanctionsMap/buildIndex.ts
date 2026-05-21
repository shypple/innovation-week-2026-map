import type { RiskTier } from "../schemas.js";
import type { CountryMeasureHit, MeasureTypeNode, SanctionsMapIndex } from "./types.js";

/** Measure types that relate to physical goods / technology trade (not e.g. asset freeze alone). */
export const CARGO_MEASURE_ROOT_IDS = new Set([
  2, // Arms embargo
  7, // Embargo on dual-use goods
  12, // Flights, airports, aircrafts
  16, // Ports and vessels
  19, // Internal repression equipment
  20, // Restrictions on goods (parent)
  40, // Military training
]);

const HIGH_SIGNAL_MEASURE_IDS = new Set([
  2, 3, 4, 5, 7, 8, 9, 10, 20, 41, 26, 42, 56, 62,
]);

type RawMeasureType = { id?: number; title?: string; parent_id?: number | null };

function asArray<T>(node: unknown, key: string): T[] {
  if (!node || typeof node !== "object") return [];
  const container = (node as Record<string, unknown>)[key];
  if (Array.isArray(container)) return container as T[];
  if (container && typeof container === "object" && Array.isArray((container as { data?: unknown }).data)) {
    return (container as { data: T[] }).data;
  }
  return [];
}

function parseMeasureTypes(dataPayload: unknown): Map<number, MeasureTypeNode> {
  const out = new Map<number, MeasureTypeNode>();
  const filters = (dataPayload as { data?: { filters?: { data?: { measure_types?: { data?: RawMeasureType[] } } } } })
    ?.data?.filters?.data?.measure_types?.data;
  if (!Array.isArray(filters)) return out;

  for (const row of filters) {
    if (typeof row?.id !== "number" || !row.title) continue;
    out.set(row.id, {
      id: row.id,
      title: row.title,
      parentId: typeof row.parent_id === "number" ? row.parent_id : null,
    });
  }
  return out;
}

function isCargoMeasure(id: number, measureTypes: Map<number, MeasureTypeNode>): boolean {
  if (CARGO_MEASURE_ROOT_IDS.has(id)) return true;
  let cur = measureTypes.get(id);
  while (cur?.parentId) {
    if (CARGO_MEASURE_ROOT_IDS.has(cur.parentId)) return true;
    cur = measureTypes.get(cur.parentId);
  }
  return false;
}

function tierForMeasureIds(ids: Set<number>): RiskTier {
  for (const id of ids) {
    if (HIGH_SIGNAL_MEASURE_IDS.has(id)) return "high";
  }
  return "elevated";
}

export function buildSanctionsMapIndex(regimePayload: unknown, dataPayload: unknown, fetchedAt: number): SanctionsMapIndex {
  const measureTypes = parseMeasureTypes(dataPayload);
  const countryMeasures = new Map<string, Set<number>>();
  const countryMeasureHits = new Map<string, CountryMeasureHit[]>();
  const regimes = asArray<Record<string, unknown>>(regimePayload, "data");

  for (const regime of regimes) {
    const country = (regime.country as { data?: { code?: string; title?: string } })?.data;
    const iso2 = country?.code?.toUpperCase();
    if (!iso2) continue;

    const regimeId = typeof regime.id === "number" ? regime.id : 0;
    const regimeTitle =
      (typeof regime.specification === "string" && regime.specification) ||
      (typeof regime.acronym === "string" && regime.acronym) ||
      `Regime ${regimeId}`;

    const measures = asArray<{ type?: { data?: RawMeasureType } }>(regime, "measures");
    for (const m of measures) {
      const t = m.type?.data;
      if (typeof t?.id !== "number" || !t.title) continue;
      if (!isCargoMeasure(t.id, measureTypes)) continue;

      if (!countryMeasures.has(iso2)) countryMeasures.set(iso2, new Set());
      countryMeasures.get(iso2)!.add(t.id);
      if (typeof t.parent_id === "number") countryMeasures.get(iso2)!.add(t.parent_id);

      const hits = countryMeasureHits.get(iso2) ?? [];
      hits.push({
        measureTypeId: t.id,
        title: t.title,
        parentId: typeof t.parent_id === "number" ? t.parent_id : null,
        regimeId,
        regimeTitle,
      });
      countryMeasureHits.set(iso2, hits);
    }
  }

  const countryTiers: Record<string, RiskTier> = {};
  for (const [iso2, ids] of countryMeasures) {
    countryTiers[iso2] = tierForMeasureIds(ids);
  }

  return {
    fetchedAt,
    measureTypes,
    countryMeasures,
    countryTiers,
    countryMeasureHits,
  };
}

export function dedupeMeasureHits(hits: CountryMeasureHit[]): CountryMeasureHit[] {
  const seen = new Set<number>();
  const out: CountryMeasureHit[] = [];
  for (const h of hits) {
    if (seen.has(h.measureTypeId)) continue;
    seen.add(h.measureTypeId);
    out.push(h);
  }
  return out.sort((a, b) => a.title.localeCompare(b.title));
}
