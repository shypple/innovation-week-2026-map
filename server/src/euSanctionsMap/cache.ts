const REGIME_URL = "https://www.sanctionsmap.eu/api/v1/regime";
const DATA_URL = "https://www.sanctionsmap.eu/api/v1/data";

const DEFAULT_TTL_MS = 6 * 60 * 60 * 1000;

type CacheEntry<T> = { body: T; storedAt: number };

let regimeCache: CacheEntry<unknown> | null = null;
let dataCache: CacheEntry<unknown> | null = null;
let inflight: Promise<{ regime: unknown; data: unknown }> | null = null;

function cacheTtlMs(): number {
  const raw = process.env.EU_SANCTIONS_MAP_CACHE_TTL_MS;
  if (!raw) return DEFAULT_TTL_MS;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_TTL_MS;
}

function isFresh(entry: CacheEntry<unknown> | null): boolean {
  if (!entry) return false;
  return Date.now() - entry.storedAt < cacheTtlMs();
}

function mapDisabled(): boolean {
  const v = (process.env.EU_SANCTIONS_MAP_DISABLE ?? "").toLowerCase();
  return v === "1" || v === "true";
}

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`${url} HTTP ${res.status}`);
  return res.json();
}

export async function fetchSanctionsMapBundles(): Promise<{ regime: unknown; data: unknown; fetchedAt: number }> {
  if (mapDisabled()) {
    throw new Error("EU Sanctions Map fetch disabled (EU_SANCTIONS_MAP_DISABLE=1)");
  }

  if (isFresh(regimeCache) && isFresh(dataCache)) {
    return {
      regime: regimeCache!.body,
      data: dataCache!.body,
      fetchedAt: regimeCache!.storedAt,
    };
  }

  if (inflight) {
    const r = await inflight;
    return { ...r, fetchedAt: regimeCache?.storedAt ?? Date.now() };
  }

  inflight = (async () => {
    const [regime, data] = await Promise.all([fetchJson(REGIME_URL), fetchJson(DATA_URL)]);
    const storedAt = Date.now();
    regimeCache = { body: regime, storedAt };
    dataCache = { body: data, storedAt };
    return { regime, data };
  })();

  try {
    const { regime, data } = await inflight;
    return { regime, data, fetchedAt: regimeCache!.storedAt };
  } finally {
    inflight = null;
  }
}

export function clearSanctionsMapCacheForTests(): void {
  regimeCache = null;
  dataCache = null;
  inflight = null;
}
