import crypto from "node:crypto";
import type { ParseRequest, ParsedShipment } from "../schemas.js";

export type CachedParseResult = {
  parsed: ParsedShipment;
  usedLlm: true;
  llmCacheHit: true;
};

type CacheEntry = {
  value: { parsed: ParsedShipment };
  expiresAt: number | null;
};

const store = new Map<string, CacheEntry>();

export function parseLlmCacheConfig(): {
  enabled: boolean;
  maxEntries: number;
  ttlMs: number | null;
} {
  const disabled =
    process.env.PARSE_LLM_CACHE_DISABLE === "1" ||
    process.env.PARSE_LLM_CACHE_DISABLE === "true";
  const maxRaw = Number(process.env.PARSE_LLM_CACHE_MAX ?? 500);
  const maxEntries = Number.isFinite(maxRaw) && maxRaw >= 1 ? Math.floor(maxRaw) : 500;
  const ttlEnv = process.env.PARSE_LLM_CACHE_TTL_MS;
  let ttlMs: number | null;
  if (ttlEnv === undefined || ttlEnv === "") {
    ttlMs = 86_400_000;
  } else {
    const ttlRaw = Number(ttlEnv);
    if (!Number.isFinite(ttlRaw) || ttlRaw < 0) {
      ttlMs = 86_400_000;
    } else if (ttlRaw === 0) {
      ttlMs = null;
    } else {
      ttlMs = Math.floor(ttlRaw);
    }
  }
  return { enabled: !disabled, maxEntries, ttlMs };
}

/** Stable cache key: same trimmed text, hints, model, and API base → same parse result. */
export function parseLlmCacheKey(body: ParseRequest, model: string, baseUrl: string): string {
  const payload = JSON.stringify({
    t: body.text.trim(),
    h: body.hint ?? null,
    m: model,
    u: baseUrl.replace(/\/?$/, ""),
  });
  return crypto.createHash("sha256").update(payload, "utf8").digest("hex");
}

function touch(key: string, entry: CacheEntry): void {
  store.delete(key);
  store.set(key, entry);
}

export function parseLlmCacheGet(key: string): CachedParseResult | undefined {
  const cfg = parseLlmCacheConfig();
  if (!cfg.enabled) return undefined;

  const entry = store.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt !== null && Date.now() > entry.expiresAt) {
    store.delete(key);
    return undefined;
  }
  touch(key, entry);
  return {
    parsed: structuredClone(entry.value.parsed),
    usedLlm: true,
    llmCacheHit: true,
  };
}

/** Only successful LLM parses are stored (saves tokens on repeat). */
export function parseLlmCacheSet(key: string, parsed: ParsedShipment): void {
  const cfg = parseLlmCacheConfig();
  if (!cfg.enabled) return;

  while (store.size >= cfg.maxEntries) {
    const first = store.keys().next().value as string | undefined;
    if (first === undefined) break;
    store.delete(first);
  }

  const expiresAt = cfg.ttlMs === null ? null : Date.now() + cfg.ttlMs;
  touch(key, {
    value: { parsed: structuredClone(parsed) },
    expiresAt,
  });
}

export function parseLlmCacheStats(): {
  enabled: boolean;
  size: number;
  maxEntries: number;
  ttlMs: number | null;
} {
  const cfg = parseLlmCacheConfig();
  return { enabled: cfg.enabled, size: store.size, maxEntries: cfg.maxEntries, ttlMs: cfg.ttlMs };
}
