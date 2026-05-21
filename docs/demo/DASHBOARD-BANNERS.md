# Dashboard banner copy: Shypple Sanctions Assist

Exact strings for **shypple-dashboard** and the **sanctions-triage** API shown in booking flows.

Implementation reference:

- Banner UI: `shypple-dashboard/src/components/SearchAndBook/SanctionsTriageBanner.tsx`
- User-facing messages: `server/src/euSanctionsMap/userMessages.ts`
- Triage logic: `server/src/service/shipmentTriage.ts`

---

## Banner titles (component)

| Status | i18n key | Default string |
|--------|----------|----------------|
| `warning` | `search_and_book.sanctions_triage.warning_title` | **Sanctions sense check: closer look advised** |
| `danger` | `search_and_book.sanctions_triage.danger_title` | **Sanctions sense check: review recommended** |

The **body** comes from the API field `message` (plain English). The banner may append `Goods classification: …` from `meta.goodsBucket`.

---

## API `message` examples (live EU Sanctions Map)

### `success` (no banner in dashboard)

No banner is shown. Example message if you call the API directly:

> No EU Sanctions Map goods restrictions apply to this destination (Germany) for the cargo described. Routine compliance checks still apply.

### `warning`

> Please confirm what you are shipping. Iran has EU sanctions on several goods categories, but we could not classify this cargo from the information provided. Check the HS code and description with your compliance team.

### `danger`

> Compliance review recommended before proceeding. Exporting luxury goods and gold, precious metals, diamonds to Syria may be prohibited or require a licence under EU sanctions. Please verify with your compliance team and the EU Sanctions Map.

> Compliance review recommended before proceeding. Exporting arms and military equipment to China may be prohibited or require a licence under EU sanctions. Please verify with your compliance team and the EU Sanctions Map.

> Compliance review recommended before proceeding. Exporting crude oil, petrol products, and oil refining to Russia may be prohibited or require a licence under EU sanctions. Please verify with your compliance team and the EU Sanctions Map.

### `success` on a sanctioned country (important demo beat)

> Based on the EU Sanctions Map, this cargo does not appear to match the goods restrictions currently listed for China. Routine compliance checks still apply.

---

## Full banner examples (title + body as the user reads them)

### No banner: Rotterdam → Hamburg, plants

*(Nothing shown in dashboard.)*

### No banner: NL → CN, HS 8471 (computers)

*(Nothing shown.)*  
Good demo beat: destination has sanctions, but cargo does not match China's **listed** goods measures.

### Red: NL → CN, HS 930100 (military)

**Title:** Sanctions sense check: review recommended

**Body:** Compliance review recommended before proceeding. Exporting arms and military equipment to China may be prohibited or require a licence under EU sanctions. Please verify with your compliance team and the EU Sanctions Map. Goods classification: Defense / military.

### Red: NL → RU, HS 271012 (oil)

**Title:** Sanctions sense check: review recommended

**Body:** Compliance review recommended before proceeding. Exporting crude oil, petrol products, and oil refining to Russia may be prohibited or require a licence under EU sanctions…

### Red: NL → SY, HS 711319 (jewellery)

**Title:** Sanctions sense check: review recommended

**Body:** Compliance review recommended before proceeding. Exporting luxury goods and gold, precious metals, diamonds to Syria may be prohibited or require a licence under EU sanctions…

### Amber: unknown cargo to sanctioned country

**Title:** Sanctions sense check: closer look advised

**Body:** Please confirm what you are shipping. [Country] has EU sanctions on several goods categories, but we could not classify this cargo…

**Popover:** country-specific `problematicGoods` from the live map (not a generic global list).

---

## `problematicGoods` popover

| i18n key | Default string |
|----------|----------------|
| `search_and_book.sanctions_triage.view_goods` | View goods categories to review |
| `search_and_book.sanctions_triage.goods_heading` | Goods categories often relevant under EU measures |
| `search_and_book.sanctions_triage.eu_sanctions_map` | EU Sanctions Map |

Items are **country-specific** measures from the live API when available.

---

## curl smoke tests (presenter laptop)

```bash
# Green: NL → DE
curl -s -X POST http://localhost:8787/api/v1/shipment-triage \
  -H 'content-type: application/json' \
  -d '{"pol":"ROTTERDAM","pod":"HAMBURG","goodsCode":"0604209000"}' | jq '.status, .message'

# Green surprise: NL → CN computers (live map: no tech match for CN)
curl -s -X POST http://localhost:8787/api/v1/shipment-triage \
  -H 'content-type: application/json' \
  -d '{"pol":"NLRTM","pod":"CNSHA","goodsCode":"8471"}' | jq '.status, .message'

# Red: NL → CN arms
curl -s -X POST http://localhost:8787/api/v1/shipment-triage \
  -H 'content-type: application/json' \
  -d '{"pol":"NLRTM","pod":"CNSHA","goodsCode":"930100"}' | jq '.status, .message'

# Red: NL → RU oil
curl -s -X POST http://localhost:8787/api/v1/shipment-triage \
  -H 'content-type: application/json' \
  -d '{"pol":"NLRTM","pod":"RULED","goodsCode":"271012"}' | jq '.status, .message'

# Red: NL → SY luxury
curl -s -X POST http://localhost:8787/api/v1/shipment-triage \
  -H 'content-type: application/json' \
  -d '{"pol":"NLRTM","pod":"SYDMS","goodsCode":"711319"}' | jq '.status, .message'

# Country-specific map hints (for standalone UI)
curl -s 'http://localhost:8787/api/sanctions-goods-hints?country=CN' | jq '.source, .hints[].label'

# Confirm live map loaded
curl -s http://localhost:8787/api/map-risk | jq '.source, .fetchedAt'
```

---

## AI diagnostics (technical appendix only)

```json
"meta": {
  "goodsBucket": "defense",
  "goodsBucketHeuristic": "defense",
  "goodsLlm": { "used": true, "cacheHit": false },
  "mapSource": "eu-sanctions-map",
  "matchedMeasureCount": 1,
  "cargoMeasureLabels": ["Arms embargo"]
}
```

Suggested future footnote (product decision):

> Goods category refined with AI from your description.

---

## Where the banner appears

| Surface | Hook |
|---------|------|
| Template booking request | `useTemplateSanctionsTriage` → `CreateBookingRequest.tsx` |
| Search & Book quote | `useSanctionsTriage` / `useShipmentSanctionsTriage` → `SABQuote/index.tsx` |

Config: `window.shyppleConfig.sanctionsTriageUrl` (e.g. `http://localhost:8787` in `public/configuration.js`).

---

## Footer disclaimer (optional under banner)

> Assistive only. Not legal advice. Confirm with compliance and the EU Sanctions Map.
