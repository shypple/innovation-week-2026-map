# Dashboard banner copy: Shypple Sanctions Assist

Exact strings for **shypple-dashboard** and the **sanctions-triage** API messages shown in booking flows.

Implementation reference: `shypple-dashboard/src/components/SearchAndBook/SanctionsTriageBanner.tsx`

i18n keys live under `search_and_book.sanctions_triage.*`. Defaults below are used when no translation file overrides them.

---

## Banner titles (component)

| Status | i18n key | Recommended default string |
|--------|----------|----------------------------|
| `warning` | `search_and_book.sanctions_triage.warning_title` | **Sanctions sense check: closer look advised** |
| `danger` | `search_and_book.sanctions_triage.danger_title` | **Sanctions sense check: review recommended** |

Avoid "Sanctions checker" in titles. Use **sense check** or **Sanctions Assist**.

---

## Banner body (from API `message` + optional goods line)

The API returns a short `message`. The banner appends goods classification when `meta.goodsBucket` is present.

### API messages (`server/src/service/shipmentTriage.ts`)

| Status | Server `message` (headline + lane) |
|--------|-------------------------------------|
| `success` | No banner shown in dashboard |
| `warning` | `Sanctions context warrants a closer look; confirm classification and lists. Lane POL {pol} → POD {pod}.` |
| `danger` | `Elevated sanctions context: compliance review recommended before proceeding. Lane POL {pol} → POD {pod}.` |

Optional friendlier API copy for a future tweak (not required for demo):

| Status | Alternative message |
|--------|---------------------|
| `warning` | `This route and goods profile may need extra compliance review. Lane POL {pol} → POD {pod}.` |
| `danger` | `This route and goods profile match a high-sensitivity pattern. Compliance review recommended. Lane POL {pol} → POD {pod}.` |

### Goods line (component append)

| i18n key | Template | Example |
|----------|----------|---------|
| `search_and_book.sanctions_triage.goods_bucket` | `Goods classification: {{label}}.` | `Goods classification: Technology / software.` |

### Goods bucket labels (`sanctionsShipmentTriage.ts`)

| Bucket | Label shown in banner |
|--------|------------------------|
| `general` | General cargo |
| `dual_use` | Dual-use / export-control sensitive |
| `defense` | Defense / military |
| `energy_oil_gas` | Energy (oil & gas) |
| `financial` | Financial / services |
| `luxury_consumer` | Luxury / consumer (sanctions-sensitive categories) |
| `tech_software` | Technology / software |
| `unknown` | Unknown / not classified |

---

## Problematic goods popover (when `goodsBucket` is `unknown`)

| i18n key | Default string |
|----------|----------------|
| `search_and_book.sanctions_triage.view_goods` | View goods categories to review |
| `search_and_book.sanctions_triage.goods_heading` | Goods categories often relevant under EU measures |
| `search_and_book.sanctions_triage.eu_sanctions_map` | EU Sanctions Map |

Link target: `https://www.sanctionsmap.eu/`

---

## Full banner examples (as the user reads them)

### Amber: NLRTM → CNSHA, HS 8471

**Title:** Sanctions sense check: closer look advised

**Body:** Sanctions context warrants a closer look; confirm classification and lists. Lane POL NL → POD CN. Goods classification: Technology / software.

### Red: NLRTM → VECCS, HS 271012

**Title:** Sanctions sense check: review recommended

**Body:** Elevated sanctions context: compliance review recommended before proceeding. Lane POL NL → POD VE. Goods classification: Energy (oil & gas).

### Amber with unknown goods (popover)

**Title:** Sanctions sense check: closer look advised

**Body:** … Lane POL NL → POD IR. Goods classification: Unknown / not classified. **View goods categories to review** (opens popover with dual-use, arms, energy, etc., plus EU Sanctions Map link).

---

## Optional: AI indicator (not in UI today)

For a technical appendix slide or dev-only tooltip, the API exposes:

```json
"meta": {
  "goodsBucket": "tech_software",
  "goodsBucketHeuristic": "general",
  "goodsLlm": { "used": true, "cacheHit": false }
}
```

Suggested future banner footnote (product decision):

> Goods category refined with AI from your description.

Do not show this to general ops users unless you explain it clearly.

---

## Where the banner appears

| Surface | Hook |
|---------|------|
| Template booking request | `useTemplateSanctionsTriage` → `CreateBookingRequest.tsx` |
| Search & Book quote | `useSanctionsTriage` / `useShipmentSanctionsTriage` → `SABQuote/index.tsx` |

Config: `window.shyppleConfig.sanctionsTriageUrl` (e.g. `http://localhost:8787` in `public/configuration.js`).

---

## curl smoke tests (presenter laptop)

```bash
# Amber
curl -s -X POST http://localhost:8787/api/v1/shipment-triage \
  -H 'content-type: application/json' \
  -d '{"pol":"NLRTM","pod":"CNSHA","goodsCode":"8471"}' | jq '.status, .message, .meta.goodsBucket'

# Red
curl -s -X POST http://localhost:8787/api/v1/shipment-triage \
  -H 'content-type: application/json' \
  -d '{"pol":"NLRTM","pod":"VECCS","goodsCode":"271012"}' | jq '.status, .message, .meta.goodsBucket'

# AI path (heuristic general/unknown + description)
curl -s -X POST http://localhost:8787/api/v1/shipment-triage \
  -H 'content-type: application/json' \
  -d '{"pol":"NLRTM","pod":"CNSHA","goodsCode":"9999","goodsDescription":"CNC machine tools for factory upgrade"}' \
  | jq '.status, .meta.goodsBucketHeuristic, .meta.goodsBucket, .meta.goodsLlm'
```

---

## Footer disclaimer (optional under banner)

Short version for a future `Typography` caption:

> Assistive only. Not legal advice. Confirm with compliance and the EU Sanctions Map.
