/**
 * Resolve POL/POD to an ISO 3166-1 alpha-2 country code for seeded demo tiers.
 * - `NL` → NL
 * - `NLRTM` / UN/LOCODE-style → first two letters when they match [A-Z]{2}
 */
export function locationToIso2(loc: string): { ok: true; iso2: string } | { ok: false; reason: string } {
  const s = loc.trim().toUpperCase().replace(/\s+/g, "");
  if (s.length < 2) {
    return { ok: false, reason: "Location must be at least 2 characters." };
  }

  if (s.length === 2) {
    if (/^[A-Z]{2}$/.test(s)) return { ok: true, iso2: s };
    return { ok: false, reason: "ISO country code must be two letters (A–Z)." };
  }

  // UN/LOCODE: CCXXX (e.g. NLRTM, USNYC)
  if (s.length >= 5 && /^[A-Z]{2}[A-Z0-9]{3}/.test(s)) {
    return { ok: true, iso2: s.slice(0, 2) };
  }

  // Fallback: leading ISO-like pair (e.g. "NL RTM" already normalized away)
  if (/^[A-Z]{2}/.test(s)) {
    return { ok: true, iso2: s.slice(0, 2) };
  }

  return { ok: false, reason: "Could not derive country (use ISO2, e.g. DE, or UN/LOCODE, e.g. NLRTM)." };
}
