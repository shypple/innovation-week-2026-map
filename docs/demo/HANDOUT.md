# Shypple Sanctions Assist

**Innovation Week demo · Requested by Tudor**

One-page handout for the company demo. Print or share as PDF.

---

## What is it?

**Shypple Sanctions Assist** is an early warning built into booking. When someone starts a shipment from a template (or a quote), Shypple checks the **port pair** and **goods** (HS code, and description when needed) and shows a simple alert if compliance should take a closer look.

It is **assistive triage**, not a legal clearance tool. It does not replace your compliance team or the official [EU Sanctions Map](https://www.sanctionsmap.eu/).

---

## Why it matters

- Sensitive lanes are easy to miss when teams move fast.
- Sanctions risk depends on **where** goods go and **what** they are.
- Tudor asked for a check **at booking time**, before paperwork and costs pile up.

---

## How it works (plain language)

```
Pick template or quote  →  POL + POD + HS code
              ↓
     Sanctions Assist runs in the background
              ↓
   Green: no banner     Amber: look closer     Red: review recommended
```

**Rules** handle clear cases quickly (country route, HS chapter).

**AI (LLM)** helps when commodity data is ambiguous: vague HS codes, sample shipments, or descriptions that rules alone cannot classify confidently.

---

## What you will see in Shypple Dashboard

| Signal | Meaning for ops |
|--------|------------------|
| **No banner** | No high-severity hit in the demo dataset. Routine diligence still applies. |
| **Amber banner** | Route and/or goods warrant a closer look. Confirm with compliance. |
| **Red banner** | High-sensitivity lane and goods profile. Compliance review recommended before proceeding. |

Banner title examples:

- Amber: **Sanctions sense check: closer look advised**
- Red: **Sanctions sense check: review recommended**

Each banner includes the lane (e.g. NL → CN) and, when known, a plain-language goods classification.

---

## Demo scenarios (for the live walkthrough)

| Story | POL | POD | HS / goods | Expected |
|-------|-----|-----|------------|----------|
| Normal EU lane | NLRTM | DEHAM | Furniture / general HS | No banner |
| Tech to China | NLRTM | CNSHA | 8471 (computers) | Amber |
| Oil to Venezuela | NLRTM | VECCS | 271012 (light oils) | Red |
| AI moment (optional) | NLRTM | CNSHA | Broad HS + description "CNC machine tools" | Amber or red; AI refines goods type |

---

## Rules + AI (for leadership and product)

| Layer | Role |
|-------|------|
| **Deterministic rules** | Map ports to countries, apply demo country tiers, apply HS chapter heuristics, combine route + goods for green / amber / red. |
| **AI classification** | When HS or description is unclear, the model assigns a goods category (energy, tech, luxury, dual-use, etc.) so the alert reflects real-world wording, not only the code on the form. |
| **Human compliance** | Final decisions, list screening, and legal interpretation stay with people and official sources. |

---

## What this demo is NOT

- Not a definitive "sanctions checker" or pass/fail gate
- Not live ingestion of every country-specific measure from the EU Sanctions Map (demo uses simplified seeds)
- Not party or watchlist screening in this version
- Not legal advice

---

## Official reference

Always cross-check on the [EU Sanctions Map](https://www.sanctionsmap.eu/). Country regimes differ widely (for example, measure lists for China vs Iran are not the same).

---

## Closing line for the room

> Tudor asked for a sanctions sense check when booking from templates. We deliver **rules for speed** and **AI for ambiguity**, with a clear signal in the dashboard so teams involve compliance **early**, not after the shipment is hard to unwind.

**Questions?** Contact the Innovation Week demo team.
