export type RiskTier = "low" | "elevated" | "high" | "unknown";

export type GoodsBucket =
  | "general"
  | "dual_use"
  | "defense"
  | "energy_oil_gas"
  | "financial"
  | "luxury_consumer"
  | "tech_software"
  | "unknown";

export type EvaluateResponse = {
  input: {
    destinationIso2: string;
    originIso2?: string;
    goodsBucket: GoodsBucket;
    parties?: string[];
  };
  result: {
    tier: RiskTier;
    ruleIds: string[];
    citations: { id: string; label: string; sourceUrl: string }[];
    checklist: string[];
    summary: string;
  };
};

export type ParseAndEvaluateResponse =
  | {
      usedLlm: boolean;
      parsed: {
        destinationIso2: string | null;
        originIso2: string | null;
        goodsBucket: GoodsBucket;
        parties: string[];
        confidence: number;
        notes?: string;
      };
      evaluate: null;
      message: string;
    }
  | {
      usedLlm: boolean;
      parsed: {
        destinationIso2: string | null;
        originIso2: string | null;
        goodsBucket: GoodsBucket;
        parties: string[];
        confidence: number;
        notes?: string;
      };
      evaluate: EvaluateResponse;
    };
