import { z } from "zod";

export const riskTierSchema = z.enum(["low", "elevated", "high", "unknown"]);
export type RiskTier = z.infer<typeof riskTierSchema>;

export const goodsBucketSchema = z.enum([
  "general",
  "dual_use",
  "defense",
  "energy_oil_gas",
  "financial",
  "luxury_consumer",
  "tech_software",
  "unknown",
]);
export type GoodsBucket = z.infer<typeof goodsBucketSchema>;

export const evaluateRequestSchema = z.object({
  destinationIso2: z
    .string()
    .length(2)
    .transform((s) => s.toUpperCase()),
  originIso2: z
    .string()
    .length(2)
    .transform((s) => s.toUpperCase())
    .optional(),
  goodsBucket: goodsBucketSchema,
  parties: z.array(z.string()).optional(),
});

export type EvaluateRequest = z.infer<typeof evaluateRequestSchema>;

export const parseRequestSchema = z.object({
  text: z.string().min(1).max(8000),
  hint: z
    .object({
      destinationIso2: z.string().length(2).optional(),
      goodsBucket: goodsBucketSchema.optional(),
    })
    .optional(),
});

export type ParseRequest = z.infer<typeof parseRequestSchema>;

export const parsedShipmentSchema = z.object({
  destinationIso2: z.string().length(2).nullable(),
  originIso2: z.string().length(2).nullable(),
  goodsBucket: goodsBucketSchema,
  /** Models often omit this; default keeps validation from forcing heuristic fallback. */
  parties: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(1).default(0.75),
  notes: z.string().optional(),
});

export type ParsedShipment = z.infer<typeof parsedShipmentSchema>;
