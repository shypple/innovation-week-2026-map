import { COUNTRY_TIER } from "../data/countryRiskSeed.js";
import type { RiskTier } from "../schemas.js";

/** Common country / territory names → ISO2 (demo-oriented, not exhaustive). */
const COUNTRY_NAME_TO_ISO2: Record<string, string> = {
  russia: "RU",
  "russian federation": "RU",
  belarus: "BY",
  ukraine: "UA",
  china: "CN",
  "peoples republic of china": "CN",
  iran: "IR",
  "north korea": "KP",
  "democratic peoples republic of korea": "KP",
  syria: "SY",
  cuba: "CU",
  venezuela: "VE",
  myanmar: "MM",
  burma: "MM",
  germany: "DE",
  netherlands: "NL",
  holland: "NL",
  belgium: "BE",
  france: "FR",
  "united kingdom": "GB",
  uk: "GB",
  britain: "GB",
  "united states": "US",
  usa: "US",
  turkey: "TR",
  india: "IN",
  poland: "PL",
  italy: "IT",
  spain: "ES",
  "st petersburg": "RU",
  moscow: "RU",
  damascus: "SY",
  tehran: "IR",
  rotterdam: "NL",
  antwerp: "BE",
  houston: "US",
  caracas: "VE",
};

const ISO2_NOISE = new Set([
  "EU",
  "UN",
  "US",
  "UK",
  "AI",
  "IT",
  "HR",
  "PR",
  "QC",
  "OF",
  "TO",
  "OR",
  "IN",
  "IS",
  "AT",
  "BE",
  "NO",
  "OK",
  "ON",
  "AS",
  "AN",
  "AM",
  "ME",
  "MY",
  "WE",
  "HE",
  "IF",
  "DO",
  "GO",
  "SO",
  "UP",
  "BY",
  "BL",
  "FC",
  "FL",
  "CL",
  "EX",
  "RE",
  "ED",
  "ER",
  "AL",
  "AD",
  "ID",
  "OS",
  "TV",
  "PC",
  "VIP",
  "FCL",
  "B/L",
  "HS",
  "EOD",
  "THX",
  "REF",
  "SHP",
  "LLC",
  "LTD",
  "GMBH",
  "BV",
  "NV",
  "SA",
  "AG",
  "PLC",
]);

const TIER_RANK: Record<RiskTier, number> = {
  high: 4,
  elevated: 3,
  unknown: 2,
  low: 1,
};

function tierRank(iso2: string): number {
  return TIER_RANK[COUNTRY_TIER[iso2] ?? "unknown"];
}

/** Earliest character index where this ISO2 is mentioned (name or code). */
function earliestMentionIndex(iso2: string, text: string): number {
  const upper = iso2.toUpperCase();
  const lower = text.toLowerCase();
  let best = Number.POSITIVE_INFINITY;

  for (const [name, code] of Object.entries(COUNTRY_NAME_TO_ISO2)) {
    if (code !== upper) continue;
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const idx = lower.search(new RegExp(`\\b${escaped}\\b`, "i"));
    if (idx >= 0) best = Math.min(best, idx);
  }

  const codeIdx = lower.search(new RegExp(`\\b${upper}\\b`, "i"));
  if (codeIdx >= 0) best = Math.min(best, codeIdx);

  return best;
}

/** Find ISO2 codes mentioned by country/territory name (longest names first). */
export function iso2FromCountryNames(text: string): string[] {
  const lower = text.toLowerCase();
  const found = new Set<string>();
  const names = Object.keys(COUNTRY_NAME_TO_ISO2).sort((a, b) => b.length - a.length);
  for (const name of names) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`\\b${escaped}\\b`, "i").test(lower)) {
      found.add(COUNTRY_NAME_TO_ISO2[name]);
    }
  }
  return [...found];
}

export function iso2FromExplicitCodes(text: string): string[] {
  const upper = text.toUpperCase();
  return [...upper.matchAll(/\b([A-Z]{2})\b/g)]
    .map((m) => m[1])
    .filter((c) => !ISO2_NOISE.has(c));
}

export function extractFromToLane(text: string): { originIso2: string | null; destinationIso2: string | null } {
  const m = text.match(/\bfrom\s+([A-Za-z][\w\s,.-]{0,40}?)\s+to\s+([A-Za-z?][\w\s,.-]{0,40}?)(?:\s|$|[,.])/i);
  if (!m) return { originIso2: null, destinationIso2: null };

  const resolve = (fragment: string): string | null => {
    const trimmed = fragment.trim().replace(/\?+/g, "").trim();
    if (!trimmed || /^[?\s]+$/.test(trimmed)) return null;
    const byName = iso2FromCountryNames(trimmed);
    if (byName.length) return byName[0];
    const code = trimmed.toUpperCase().match(/\b([A-Z]{2})\b/);
    if (code && !ISO2_NOISE.has(code[1])) return code[1];
    return null;
  };

  return {
    originIso2: resolve(m[1]),
    destinationIso2: resolve(m[2]),
  };
}

export function extractDestinationLineCountries(text: string): string[] {
  const m = text.match(/destination\s*:\s*([^\n]+)/i);
  if (!m) return [];
  return iso2FromCountryNames(m[1]);
}

export function extractPolPod(text: string): { pol: string | null; pod: string | null } {
  const pol = text.match(/\bPOL\s*:\s*(\S+)/i)?.[1] ?? null;
  const pod = text.match(/\bPOD\s*:\s*(\S+)/i)?.[1] ?? null;
  const polIso = pol ? resolveLocationToken(pol) : null;
  const podIso = pod ? resolveLocationToken(pod) : null;
  return { pol: polIso, pod: podIso };
}

function resolveLocationToken(token: string): string | null {
  const upper = token.trim().toUpperCase();
  if (/^[A-Z]{2}$/.test(upper) && !ISO2_NOISE.has(upper)) return upper;
  if (upper.length >= 5 && /^[A-Z]{2}/.test(upper)) return upper.slice(0, 2);
  return iso2FromCountryNames(token)[0] ?? null;
}

/**
 * Prefer highest-seeded-risk destination when text lists multiple (e.g. "Russia OR Belarus").
 * On equal tier, prefer the country mentioned first in the text (conservative triage for "A or B").
 */
export function pickDestinationIso2(candidates: string[], text?: string): string | null {
  if (!candidates.length) return null;
  const unique = [...new Set(candidates.map((c) => c.toUpperCase()))];
  unique.sort((a, b) => {
    const tierDiff = tierRank(b) - tierRank(a);
    if (tierDiff !== 0) return tierDiff;
    if (text) {
      const posDiff = earliestMentionIndex(a, text) - earliestMentionIndex(b, text);
      if (posDiff !== 0) return posDiff;
    }
    return a.localeCompare(b);
  });
  return unique[0] ?? null;
}

export function extractParties(text: string): string[] {
  const parties: string[] = [];
  const line = text.match(/parties\s*:\s*([^\n]+)/i)?.[1];
  if (line) {
    const parts = line.split(/\s*,\s*|\s+also\s+/i);
    for (const p of parts) {
      const trimmed = p.replace(/^also\s+/i, "").trim();
      if (trimmed.length >= 2 && trimmed.length <= 120 && !/^a person/i.test(trimmed)) {
        parties.push(trimmed);
      }
    }
  }
  const llc = [...text.matchAll(/\b([A-Z][A-Za-z0-9&.-]*(?:\s+[A-Z][A-Za-z0-9&.-]*)*\s+(?:LLC|Ltd|GmbH|BV|NV|SA|AG|PLC))\b/g)];
  for (const m of llc) {
    if (!parties.includes(m[1])) parties.push(m[1]);
  }
  return parties.slice(0, 10);
}

export type ExtractedLane = {
  destinationIso2: string | null;
  originIso2: string | null;
  destinationCandidates: string[];
  notes: string[];
};

export function extractLaneFromText(text: string): ExtractedLane {
  const notes: string[] = [];
  const destinationCandidates: string[] = [];

  const destLine = extractDestinationLineCountries(text);
  destinationCandidates.push(...destLine);

  const fromNames = iso2FromCountryNames(text);
  const fromTo = extractFromToLane(text);
  const polPod = extractPolPod(text);
  const codes = iso2FromExplicitCodes(text);

  if (polPod.pod) destinationCandidates.push(polPod.pod);
  if (polPod.pol) {
    if (!fromTo.originIso2) fromTo.originIso2 = polPod.pol;
  }

  if (fromTo.destinationIso2) destinationCandidates.push(fromTo.destinationIso2);
  if (fromTo.originIso2 && !codes.includes(fromTo.originIso2)) {
    codes.unshift(fromTo.originIso2);
  }

  destinationCandidates.push(...fromNames);

  let destinationIso2 = pickDestinationIso2(destinationCandidates, text);

  let originIso2 = fromTo.originIso2;
  if (!originIso2 && codes.length >= 1 && destinationIso2 && codes[0] !== destinationIso2) {
    originIso2 = codes[0];
  }
  if (!originIso2 && codes.length >= 2) {
    originIso2 = codes[0];
    if (!destinationIso2) destinationIso2 = codes[codes.length - 1];
  }

  const uniqueDest = [...new Set(destinationCandidates.filter(Boolean))];
  if (uniqueDest.length > 1) {
    notes.push(
      `Multiple destinations mentioned (${uniqueDest.join(", ")}); using ${destinationIso2 ?? "?"} (highest demo risk tier).`,
    );
  }
  if (fromTo.originIso2 && destinationIso2) {
    notes.push(`Lane from structured text: ${fromTo.originIso2} → ${destinationIso2}.`);
  }

  return {
    destinationIso2,
    originIso2,
    destinationCandidates: uniqueDest,
    notes,
  };
}
