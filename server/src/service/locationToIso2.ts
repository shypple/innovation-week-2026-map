/**
 * Resolve POL/POD to an ISO 3166-1 alpha-2 country code for seeded demo tiers.
 * - `NL` → NL
 * - `NLRTM` / UN/LOCODE (5 chars) → NL
 * - City names such as `Rotterdam` → NL (avoid mistaking ROTTERDAM → RO)
 */
const UNLOCODE = /^[A-Z]{2}[A-Z0-9]{3}$/;

/** Demo-oriented city / port name → ISO2 when autocomplete labels omit UN/LOCODE. */
const CITY_NAME_TO_ISO2: Record<string, string> = {
  rotterdam: "NL",
  hamburg: "DE",
  antwerp: "BE",
  amsterdam: "NL",
  bremerhaven: "DE",
  felixstowe: "GB",
  london: "GB",
  shanghai: "CN",
  shenzhen: "CN",
  "hong kong": "HK",
  singapore: "SG",
  caracas: "VE",
  tehran: "IR",
  moscow: "RU",
  "saint petersburg": "RU",
  "st petersburg": "RU",
};

function isUnlocode(token: string): boolean {
  return token.length === 5 && UNLOCODE.test(token);
}

function cityNameToIso2(raw: string): string | null {
  const base = raw.trim().toLowerCase().replace(/\s+/g, " ");
  const withoutRegion = base.replace(/,.*$/, "").trim();
  return CITY_NAME_TO_ISO2[withoutRegion] ?? CITY_NAME_TO_ISO2[base] ?? null;
}

export function locationToIso2(loc: string): { ok: true; iso2: string } | { ok: false; reason: string } {
  const raw = loc.trim();
  const s = raw.toUpperCase().replace(/\s+/g, "");
  if (s.length < 2) {
    return { ok: false, reason: "Location must be at least 2 characters." };
  }

  if (s.length === 2) {
    if (/^[A-Z]{2}$/.test(s)) return { ok: true, iso2: s };
    return { ok: false, reason: "ISO country code must be two letters (A–Z)." };
  }

  if (isUnlocode(s)) {
    return { ok: true, iso2: s.slice(0, 2) };
  }

  const fromCity = cityNameToIso2(raw);
  if (fromCity) {
    return { ok: true, iso2: fromCity };
  }

  return {
    ok: false,
    reason:
      "Could not derive country (use ISO2, UN/LOCODE e.g. NLRTM, or a known port/city name).",
  };
}
