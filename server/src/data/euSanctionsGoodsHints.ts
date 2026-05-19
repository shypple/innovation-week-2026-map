/**
 * Reference categories often relevant under EU restrictive measures.
 * Not an exhaustive or live export from the EU Sanctions Map — point users to the map for authoritative measures.
 */
export type EuSanctionsGoodsHint = {
  id: string;
  label: string;
  /** Why this category frequently needs extra screening (plain language). */
  note: string;
  /** EU Sanctions Map (explore regimes by country/sector). */
  sanctionsMapUrl: string;
};

export const EU_SANCTIONS_MAP_HOME = "https://www.sanctionsmap.eu/";

/** Shown when `goodsBucket` is `unknown` so teams know what to clarify / check on the map. */
export const UNKNOWN_GOODS_EU_HINTS: EuSanctionsGoodsHint[] = [
  {
    id: "dual-use",
    label: "Dual-use goods and technology",
    note: "Items that can have civil or military use are often subject to export controls toward certain destinations.",
    sanctionsMapUrl: EU_SANCTIONS_MAP_HOME,
  },
  {
    id: "arms-military",
    label: "Arms, military equipment and related materiel",
    note: "Subject to strict prohibitions or licensing toward many listed jurisdictions.",
    sanctionsMapUrl: EU_SANCTIONS_MAP_HOME,
  },
  {
    id: "energy",
    label: "Oil, refined products, gas and energy-sector goods",
    note: "Sectoral restrictions are common; verify commodity, origin and counterparty against active regimes.",
    sanctionsMapUrl: EU_SANCTIONS_MAP_HOME,
  },
  {
    id: "aviation-maritime",
    label: "Aircraft, vessels, port and airport services",
    note: "Restrictions may apply to sale, supply, leasing and related services for designated jurisdictions.",
    sanctionsMapUrl: EU_SANCTIONS_MAP_HOME,
  },
  {
    id: "semiconductors-tech",
    label: "Advanced semiconductors, electronics and manufacturing equipment",
    note: "Tech-related trade toward high-risk destinations is increasingly sector-regulated.",
    sanctionsMapUrl: EU_SANCTIONS_MAP_HOME,
  },
  {
    id: "financial-assets",
    label: "Financial services, capital, crypto-assets and transfers",
    note: "Prohibitions and licensing can apply independently of physical goods.",
    sanctionsMapUrl: EU_SANCTIONS_MAP_HOME,
  },
];
