import crypto from "node:crypto";
import type { GoodsBucket } from "../schemas.js";
import { parseLlmCacheConfig } from "./parseLlmCache.js";

type CacheEntry = {
  value: GoodsBucket;
  expiresAt: number | null;
};

const store = new Map<string, CacheEntry>();

export function goodsBucketLlmCacheKey(parts: {
  code: string | null;
  desc: string | null;
  heuristic: string;
  mode: "fallback" | "always";
  model: string;
  baseUrl: string;
}): string {
  const payload = JSON.stringify({
    c: parts.code,
    d: parts.desc,
    h: parts.heuristic,
    mode: parts.mode,
    m: parts.model,
    u: parts.baseUrl.replace(/\/?$/, ""),
  });
  return crypto.createHash("sha256").update(payload, "utf8").digest("hex");
}

function touch(key: string, entry: CacheEntry): void {
  store.delete(key);
  store.set(key, entry);
}

export function goodsBucketLlmCacheGet(key: string): GoodsBucket | undefined {
  const cfg = parseLlmCacheConfig();
  if (!cfg.enabled) return undefined;

  const entry = store.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt !== null && Date.now() > entry.expiresAt) {
    store.delete(key);
    return undefined;
  }
  touch(key, entry);
  return entry.value;
}

export function goodsBucketLlmCacheSet(key: string, bucket: GoodsBucket): void {
  const cfg = parseLlmCacheConfig();
  if (!cfg.enabled) return;

  while (store.size >= cfg.maxEntries) {
    const first = store.keys().next().value as string | undefined;
    if (first === undefined) break;
    store.delete(first);
  }

  const expiresAt = cfg.ttlMs === null ? null : Date.now() + cfg.ttlMs;
  touch(key, { value: bucket, expiresAt });
}

export function goodsBucketLlmCacheStats(): { size: number } {
  return { size: store.size };
}
