import { fetchSanctionsMapBundles } from "./cache.js";
import { buildSanctionsMapIndex } from "./buildIndex.js";
import type { SanctionsMapIndex } from "./types.js";

let memoryIndex: SanctionsMapIndex | null = null;
let memoryIndexAt = 0;
let inflightIndex: Promise<SanctionsMapIndex | null> | null = null;

const INDEX_TTL_MS = 6 * 60 * 60 * 1000;

export async function getSanctionsMapIndex(options?: { forceRefresh?: boolean }): Promise<SanctionsMapIndex | null> {
  if (!options?.forceRefresh && memoryIndex && Date.now() - memoryIndexAt < INDEX_TTL_MS) {
    return memoryIndex;
  }

  if (inflightIndex && !options?.forceRefresh) return inflightIndex;

  inflightIndex = (async () => {
    try {
      const { regime, data, fetchedAt } = await fetchSanctionsMapBundles();
      memoryIndex = buildSanctionsMapIndex(regime, data, fetchedAt);
      memoryIndexAt = Date.now();
      return memoryIndex;
    } catch (err) {
      console.warn("[euSanctionsMap] Failed to load index:", err);
      if (memoryIndex) return memoryIndex;
      return null;
    } finally {
      inflightIndex = null;
    }
  })();

  return inflightIndex;
}

export { evaluateLaneWithFallback, evaluateLaneWithSanctionsMap, hitsToProblematicGoods } from "./evaluate.js";
export { buildUserFriendlyTriageMessage, formatList } from "./userMessages.js";
export { dedupeMeasureHits } from "./buildIndex.js";
export type { SanctionsMapIndex, EuSanctionsLaneEvaluation, CountryMeasureHit } from "./types.js";
