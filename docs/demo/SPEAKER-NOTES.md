# Shypple Sanctions Assist: 3-slide speaker notes

For Google Slides or similar. Paste slide titles and bullets on the slides; keep the **Speaker notes** section for yourself.

No em dashes in customer-facing copy.

---

## Slide 1: The problem and Tudor's ask

**On slide (visible):**

**Shypple Sanctions Assist**  
Innovation Week · Requested by Tudor

- Sensitive trade lanes are easy to miss during booking
- Risk depends on **destination** and **goods** (not every shipment to a flagged country is the same)
- Goal: warn ops **early**, inside Shypple, in **plain language**

**Speaker notes:**

Open with Tudor's request: when users book from a **template**, Shypple should flag sanctions risk from **ports and HS code** before a specialist notices later.

Explain HS codes as "the commodity classification on the booking."

Stress **assistive**: smoke alarm, not fire marshal. Not legal advice.

Point to the official source: [EU Sanctions Map](https://www.sanctionsmap.eu/).

Timing: ~90 seconds.

---

## Slide 2: Live map + rules + AI

**On slide (visible):**

**How it works**

1. User selects template → **POL**, **POD**, **HS code**
2. Sanctions Assist loads **live EU Sanctions Map** data (each country has its **own** goods list)
3. **Rules** classify cargo from HS + description
4. **AI** refines classification when data is ambiguous
5. Alert only if cargo **matches that country's listed goods restrictions**
6. User sees **no banner**, **amber**, or **red** with a **readable sentence** (not POL/POD codes)

**Live map for lists. Rules for speed. AI for messy descriptions.**

**Speaker notes:**

This is the slide for leadership and for anyone who cares about AI.

**Live EU data:** we call `sanctionsmap.eu` regime + data APIs. China on the map is mostly **arms embargo**. Russia lists **crude oil, luxury, dual-use**, and more. That is why two shipments to "sanctioned" countries can behave differently.

**Rules:** ports → countries; HS chapters → sanctions-map goods categories.

**AI:** same `POST /api/v1/shipment-triage` endpoint; `meta.goodsLlm.used` when the model ran. AI does **not** make legal decisions. It helps classify **what** is being shipped.

Example message to read aloud:

> Compliance review recommended before proceeding. Exporting arms and military equipment to China may be prohibited or require a licence under EU sanctions.

Timing: ~2 minutes.

---

## Slide 3: Live demo and what is next

**On slide (visible):**

**Live demo (Dashboard)**

| Step | Lane | Cargo | Result |
|------|------|-------|--------|
| 1 | NL → DE | Plants / general HS | No banner |
| 2 | NL → CN | Computers HS 8471 | **No banner** (teach: not every CN shipment alerts) |
| 3 | NL → CN | Military HS 93 | Red banner |
| 4 | NL → RU | Oil HS 2710 | Red banner |

**Today:** live EU map · per-country goods match · plain-language alerts · template + quote hooks  
**Next:** party screening · production policy (warn vs block) · deeper HS / TARIC linkage

**Assistive only. Confirm on [sanctionsmap.eu](https://www.sanctionsmap.eu/) and with compliance.**

**Speaker notes:**

**Demo order (recommended):**

1. **Green first:** Rotterdam → Hamburg with plants HS. Message sounds like: "No EU Sanctions Map goods restrictions apply to this destination (Germany)…"
2. **Surprise green:** NL → CN with computers. Many people expect an alert; explain that the **live map** lists arms for China, not general electronics. This proves we are not just "flagging China."
3. **Red:** NL → CN military HS **or** NL → RU oil **or** NL → SY luxury/jewellery. Read the full banner sentence out loud.
4. **Optional:** standalone map at `:5173`, click Syria or Russia, show **country-specific** goods list in the tooltip.

**Do not demo** NL → VE oil expecting red: Venezuela's live map list does not include crude oil (telecom and other items only). Use Russia for an oil story.

**Honest limits (say once):** assistive only; no party screening; cargo-to-measure mapping uses HS chapters as a practical proxy.

Close by crediting Tudor. Invite questions.

Timing: ~5 minutes live demo + 1 minute Q&A setup.

---

## Backup if live demo fails

- Screenshots of no banner, red banner, and one country tooltip from the map UI
- Run curl from laptop (examples in `DASHBOARD-BANNERS.md`)
- Show `GET http://localhost:8787/api/map-risk` returns `"source": "eu-sanctions-map"`
- `GET http://localhost:8787/api/llm-status` for technical audience only

---

## One-liners if challenged

**"Is this a sanctions checker?"**  
No. It is a **sense check** that tells ops when to involve compliance, using live map data.

**"Why AI?"**  
Because real bookings have vague HS codes and plain-language descriptions. AI classifies cargo; the **map** decides if that category is listed for **that country**.

**"Will it block booking?"**  
Not in this demo. Product can choose warn vs block later.

**"Is China banned?"**  
No. China has EU measures, but our alert fires when cargo matches **what is listed for China** (for example arms), not for every HS code.

**"Why no alert on computers to China?"**  
That is correct behaviour with live map data. Use the military HS example for a red alert to China.
