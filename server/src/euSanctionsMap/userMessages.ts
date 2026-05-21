import type { EuSanctionsLaneEvaluation, SanctionsMapIndex } from "./types.js";

type TriageStatus = "success" | "warning" | "danger";

const ISO2_FALLBACK_NAMES: Record<string, string> = {
  SY: "Syria",
  IR: "Iran",
  RU: "Russia",
  CN: "China",
  NL: "the Netherlands",
  DE: "Germany",
  VE: "Venezuela",
  BY: "Belarus",
  UA: "Ukraine",
  KP: "North Korea",
};

function countryLabel(iso2: string, index: SanctionsMapIndex | null): string {
  const fromMap = index?.countryNames.get(iso2.toUpperCase());
  if (fromMap) return fromMap;
  return ISO2_FALLBACK_NAMES[iso2.toUpperCase()] ?? iso2.toUpperCase();
}

/** e.g. ["A", "B", "C"] → "A, B, and C" */
export function formatList(items: string[]): string {
  const cleaned = items.map((s) => s.trim()).filter(Boolean);
  if (cleaned.length === 0) return "these goods";
  if (cleaned.length === 1) return cleaned[0]!;
  if (cleaned.length === 2) return `${cleaned[0]!} and ${cleaned[1]!}`;
  return `${cleaned.slice(0, -1).join(", ")}, and ${cleaned.at(-1)!}`;
}

function humanizeMeasureTitle(title: string): string {
  const t = title.trim();
  if (/^arms embargo$/i.test(t)) return "arms and military equipment";
  if (/^embargo on dual-use goods$/i.test(t)) return "dual-use goods";
  if (/^dual-use goods export$/i.test(t)) return "dual-use goods";
  if (/^restrictions on goods$/i.test(t)) return "restricted goods";
  return t.charAt(0).toLowerCase() + t.slice(1);
}

function goodsDescription(evaluation: EuSanctionsLaneEvaluation): string {
  if (evaluation.matchedMeasures.length > 0) {
    return formatList(evaluation.matchedMeasures.map((m) => humanizeMeasureTitle(m.title)));
  }
  if (evaluation.cargoClassification.labels.length > 0) {
    return formatList(evaluation.cargoClassification.labels.map(humanizeMeasureTitle));
  }
  return "this cargo";
}

export function buildUserFriendlyTriageMessage(input: {
  status: TriageStatus;
  polIso2: string;
  podIso2: string;
  evaluation: EuSanctionsLaneEvaluation;
  mapIndex: SanctionsMapIndex | null;
}): string {
  const destination = countryLabel(input.podIso2, input.mapIndex);
  const goods = goodsDescription(input.evaluation);
  const { evaluation, status } = input;

  if (evaluation.mapSource === "fallback-seed") {
    if (status === "danger") {
      return `Compliance review recommended before proceeding. This shipment to ${destination} may fall under EU sanctions based on limited demo data. Please confirm with your compliance team.`;
    }
    if (status === "warning") {
      return `Please take a closer look before proceeding. This shipment to ${destination} may need extra compliance checks based on limited demo data.`;
    }
    return `No high-priority sanctions signal was found for this shipment to ${destination}. Routine compliance checks still apply.`;
  }

  if (evaluation.matchedMeasures.length > 0) {
    if (status === "danger") {
      return `Compliance review recommended before proceeding. Exporting ${goods} to ${destination} may be prohibited or require a licence under EU sanctions. Please verify with your compliance team and the EU Sanctions Map.`;
    }
    return `Please review this shipment before proceeding. Exporting ${goods} to ${destination} may be subject to EU restrictive measures. Confirm classification and licensing with your compliance team.`;
  }

  if (status === "warning" && evaluation.cargoClassification.goodsBucket === "unknown") {
    return `Please confirm what you are shipping. ${destination} has EU sanctions on several goods categories, but we could not classify this cargo from the information provided. Check the HS code and description with your compliance team.`;
  }

  if (evaluation.podGoodsMeasures.length > 0 && status === "warning") {
    return `Please confirm what you are shipping. ${destination} has EU sanctions on certain goods, but we could not match this cargo to a listed category. Your compliance team can cross-check on the EU Sanctions Map.`;
  }

  if (evaluation.podGoodsMeasures.length > 0 && status === "success") {
    return `Based on the EU Sanctions Map, this cargo does not appear to match the goods restrictions currently listed for ${destination}. Routine compliance checks still apply.`;
  }

  return `No EU Sanctions Map goods restrictions apply to this destination (${destination}) for the cargo described. Routine compliance checks still apply.`;
}
