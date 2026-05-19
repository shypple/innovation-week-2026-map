import type { GoodsBucket } from "./schemas.js";

/** Keyword-based goods bucket for free-text (shipments, product descriptions). */
export function goodsBucketFromDescription(text: string): GoodsBucket {
  if (/\bDUAL[\s-]?USE\b|\bEXPORT CONTROL/i.test(text)) return "dual_use";
  if (/\bMILITARY|\bDEFENSE|\bARMAMENT/i.test(text)) return "defense";
  if (/\bOIL|\bGAS|\bENERGY/i.test(text)) return "energy_oil_gas";
  if (/\bCHIP|\bSEMICONDUCTOR|\bSOFTWARE|\bTECH\b/i.test(text)) return "tech_software";
  if (/\bLUXURY|\bHIGH[\s-]?END\b/i.test(text)) return "luxury_consumer";
  if (/\bFINANC|BANKING|INSURANCE\b/i.test(text)) return "financial";
  return "unknown";
}

/**
 * Infer bucket from HS-style commodity code (digits) or control-list style tokens.
 * If `goodsCode` is provided it takes precedence over description at the call site.
 */
export function goodsBucketFromCommodityCode(code: string): GoodsBucket {
  const normalized = code.trim().toUpperCase();
  if (!normalized) return "unknown";

  if (/^(ECCN|USML|ML\d|9[AE])\b/i.test(normalized)) return "dual_use";

  const digitsMatch = normalized.match(/\d{2,}/);
  if (!digitsMatch) return "general";

  const digits = digitsMatch[0].replace(/\D/g, "");
  if (digits.length < 2) return "general";

  const chapter = parseInt(digits.slice(0, 2), 10);
  if (Number.isNaN(chapter)) return "general";

  if (chapter === 93) return "defense";
  if (chapter >= 88 && chapter <= 90) return "tech_software";
  if (chapter === 27) return "energy_oil_gas";
  if (chapter === 84 || chapter === 85) return "dual_use";
  if (chapter === 71) return "luxury_consumer";

  return "general";
}
