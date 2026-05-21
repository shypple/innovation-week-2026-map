# Shypple Sanctions Assist

**Innovation Week demo · Requested by Tudor**

One-page handout for the company demo. Print or share as PDF.

---

## What is it?

**Shypple Sanctions Assist** is an early warning built into booking. When someone starts a shipment from a template (or a quote), Shypple checks the **destination**, **goods** (HS code and description when needed), and the **live [EU Sanctions Map](https://www.sanctionsmap.eu/)** data. It shows a plain-language alert only when the cargo appears to match **that country's listed goods restrictions**.

It is **assistive triage**, not a legal clearance tool. It does not replace your compliance team or the official map.

---

## Why it matters

- Sensitive lanes are easy to miss when teams move fast.
- Sanctions risk depends on **where** goods go and **what** they are. China and Iran are not the same list.
- Tudor asked for a check **at booking time**, before paperwork and costs pile up.

---

## How it works (plain language)

```
Pick template or quote  →  POL + POD + HS code
              ↓
     Sanctions Assist loads live EU Sanctions Map data
              ↓
     Classify cargo (HS + rules, AI when ambiguous)
              ↓
     Match cargo to that destination's listed goods measures
              ↓
   No banner          Amber banner              Red banner
   (no match)         (review advised)          (review recommended)
```

**Live EU data:** each country has its **own** list of restricted goods categories (for example, China: mainly arms embargo; Russia: crude oil, luxury, dual-use, and more).

**Rules** map ports to countries and HS chapters to sanctions-map categories.

**AI (LLM)** helps when the HS code or description is ambiguous.

---

## What you will see in Shypple Dashboard

| Signal | Meaning for ops |
|--------|------------------|
| **No banner** | No match between this cargo and the goods restrictions listed for that destination on the EU Sanctions Map. Routine checks still apply. |
| **Amber banner** | Unclear cargo classification, or a softer match. Confirm HS code and description with compliance. |
| **Red banner** | Cargo appears to match EU restrictive measures for that destination. Compliance review recommended before proceeding. |

Banner **title** (short):

- Amber: **Sanctions sense check: closer look advised**
- Red: **Sanctions sense check: review recommended**

Banner **body** (plain English from the API), for example:

> Compliance review recommended before proceeding. Exporting luxury goods and gold, precious metals, diamonds to Syria may be prohibited or require a licence under EU sanctions. Please verify with your compliance team and the EU Sanctions Map.

---

## Demo scenarios (live walkthrough)

Use **UN/LOCODE** (`NLRTM`, `DEHAM`) or city names (`ROTTERDAM`, `HAMBURG`) for ports.

| # | Story | POL | POD | HS / goods | Expected |
|---|-------|-----|-----|------------|----------|
| 1 | Normal EU lane | ROTTERDAM | HAMBURG | `0604209000` (plants) | **No banner** |
| 2 | Tech to China (surprise) | NLRTM | CNSHA | `8471` (computers) | **No banner** (China lists arms, not general tech on the map) |
| 3 | Arms to China | NLRTM | CNSHA | `930100` (military) | **Red banner** |
| 4 | Oil to Russia | NLRTM | RULED | `271012` (light oils) | **Red banner** |
| 5 | Luxury to Syria | NLRTM | SYDMS | `711319` (jewellery) | **Red banner** |
| 6 | AI moment (optional) | NLRTM | CNSHA | Vague HS + description "CNC machine tools" | Depends on classification; good for showing AI |

**Talking point for step 2:** the destination can be sanctioned without every shipment triggering an alert. That is the point of matching **cargo to the country's list**.

---

## Rules + AI + live map (for leadership)

| Layer | Role |
|-------|------|
| **EU Sanctions Map API** | Live `/regime` + `/data` feeds; per-country goods measures; cached on the server (~6 hours). |
| **Cargo classification** | HS chapter + goods bucket mapped to sanctions-map measure types (energy, arms, luxury, dual-use, etc.). |
| **AI classification** | When HS or description is unclear, the model refines the goods category before matching. |
| **Human compliance** | Final decisions, licensing, party screening, and legal interpretation stay with people and official sources. |

---

## Standalone map tool (optional in demo)

Open `http://localhost:5173` to show the **EU sanctions choropleth** and **country-specific goods lists** loaded from the same live API when you click a highlighted country.

---

## What this demo is NOT

- Not a definitive "sanctions checker" or pass/fail gate
- Not party or watchlist screening
- Not legal advice
- Not a substitute for reading the official measure text on the EU Sanctions Map

---

## Official reference

Always cross-check on the [EU Sanctions Map](https://www.sanctionsmap.eu/). Country regimes differ widely (China vs Iran vs Syria are different lists).

---

## Closing line for the room

> Tudor asked for a sanctions sense check at booking time. We use **live EU map data**, **rules for speed**, and **AI for ambiguity**, so ops see a **plain-language alert** only when the cargo looks like it hits **that country's listed goods restrictions**.

**Questions?** Contact the Innovation Week demo team.
