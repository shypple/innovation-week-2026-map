# Shypple Sanctions Assist: 3-slide speaker notes

For Google Slides or similar. Paste slide titles and bullets on the slides; keep the **Speaker notes** column for yourself.

No em dashes in customer-facing copy.

---

## Slide 1: The problem and Tudor's ask

**On slide (visible):**

**Shypple Sanctions Assist**  
Innovation Week · Requested by Tudor

- Sensitive trade lanes are easy to miss during booking
- Risk depends on **route** and **goods**, not only the customer name
- Goal: warn ops **early**, inside Shypple, before costs and paperwork grow

**Speaker notes:**

Open with Tudor's request in one sentence: when users book from a **template**, Shypple should flag sanctions **context** from **ports and HS code**, not wait for a specialist to notice later.

Audience may not know HS codes: "the commodity classification on the booking."

Stress **assistive**: smoke alarm, not fire marshal. Not legal advice.

Mention the official reference: [EU Sanctions Map](https://www.sanctionsmap.eu/).

Timing: ~90 seconds.

---

## Slide 2: Rules + AI in the booking flow

**On slide (visible):**

**How it works**

1. User selects template → **POL**, **POD**, **HS code**
2. Dashboard calls **Sanctions Assist** in the background
3. **Rules** score the lane and goods (fast, explainable)
4. **AI** steps in when the HS code or description is ambiguous
5. User sees **green / amber / red** style alert (amber or red only in UI)

**Rules handle the obvious. AI handles the messy.**

**Speaker notes:**

This is the slide for non-tech leadership and for anyone who cares about AI.

**Rules:** port codes → countries; demo country tiers; HS chapter heuristics (e.g. chapter 27 energy, 84/85 tech).

**AI:** reads code + description when rules return "unknown" or "general" but text says something else (samples, VIP client, machine tools). Same API the dashboard already calls: `POST /api/v1/shipment-triage`.

Do **not** say AI makes legal decisions. Say it **interprets cargo wording** so the alert matches how people describe shipments.

Optional one-liner: "Millisecond rules for structured data; AI for human language."

Timing: ~2 minutes.

---

## Slide 3: Live demo and what is next

**On slide (visible):**

**Live demo (Dashboard)**

| Step | Lane | Result |
|------|------|--------|
| 1 | NL → DE, general goods | No banner |
| 2 | NL → CN, HS 8471 | Amber alert |
| 3 | NL → VE, oil HS | Red alert |

**Today:** demo seed data · assistive alerts · template + quote hooks  
**Next:** richer EU map data · party screening · production policy (warn vs block)

**Assistive only. Confirm on [sanctionsmap.eu](https://www.sanctionsmap.eu/) and with compliance.**

**Speaker notes:**

**Demo order:** green first (reassure: normal bookings stay quiet), then amber (China + tech), then red (Venezuela + oil). Pause on the banner text and lane line.

**Optional AI beat:** template with vague HS + strong description; mention that rules alone might under-react until AI classifies the goods.

**Optional second tab:** standalone map tool at `:5173` for messy Slack/email text. Same engine, different door. Skip if time is short.

**Honest limits (say once):** not country-specific measure lists yet; not watchlist screening; demo tiers in `countryRiskSeed`.

Close by crediting Tudor and inviting questions.

Timing: ~5 minutes live demo + 1 minute Q&A setup.

---

## Backup if live demo fails

- Screenshot the three banner states from staging
- Run curl from laptop (examples in `docs/demo/DASHBOARD-BANNERS.md`)
- Show `GET http://localhost:8787/api/llm-status` only for technical audience

---

## One-liners if challenged

**"Is this a sanctions checker?"**  
No. It is a **sense check** that tells ops when to involve compliance.

**"Why AI?"**  
Because real bookings use incomplete HS data and plain-language descriptions. AI closes that gap; rules keep the outcome explainable.

**"Will it block booking?"**  
Not in this demo. Product can choose warn vs block later.

**"Is China banned?"**  
No. The demo marks some destinations as elevated **context**. Exact measures depend on goods and the EU map.
