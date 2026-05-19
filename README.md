# Sanctions Triage (Innovation Week)

Assistive tool for **EU sanctions context triage**: combine a **deterministic risk tier**, optional **LLM-assisted parsing** of messy questions, and an **interactive choropleth map**. This is **not legal advice** and does not replace compliance review.

## Structure

- `server/` — Fastify API (evaluate, parse, map snapshot)
- `client/` — Vite + React + `react-simple-maps`

## Quick start

```bash
cd sanctions-triage
npm install
cp server/.env.example server/.env
npm run dev
```

Environment variables for the API must live in **`server/.env`** (not the monorepo root). On startup the server logs whether `OPENAI_API_KEY` was loaded.

**CORS:** by default **`http://localhost:5173`** and **`http://localhost:3000`** are allowed (e.g. shypple-dashboard). Override with a comma-separated `CORS_ORIGINS` in `server/.env`.

- API: [http://localhost:8787](http://localhost:8787)
- Web: [http://localhost:5173](http://localhost:5173)

### HTTP service for other apps (shipment triage)

`POST /api/v1/shipment-triage` — JSON body:

| Field | Required | Notes |
|--------|----------|--------|
| `pol` | yes | Port/country of loading: ISO2 (`NL`) or UN/LOCODE-style (`NLRTM` → `NL`) |
| `pod` | yes | Port/country of discharge (same rules) |
| `goodsCode` | no | HS / commodity / control style code; **used instead of** `goodsDescription` when both are non-empty |
| `goodsDescription` | no | Free-text goods description |
| `parties` | no | String array (counterparty names); does not run watchlist screening in this demo |

Response **`200`:** `{ "status": "success" \| "warning" \| "danger", "message": "...", "meta": { ... } }` — `meta` is optional detail (tier, ISO2 lane, rule ids).  
**`400`:** invalid body or unparseable POL/POD — `{ "error": "...", "field"?: "pol" \| "pod" }`.

Example:

```bash
curl -s -X POST http://localhost:8787/api/v1/shipment-triage \
  -H 'content-type: application/json' \
  -d '{"pol":"NLRTM","pod":"CNSHA","goodsCode":"8471","parties":["Acme Ltd"]}' | jq
```

### Optional: OpenAI-compatible parsing

Set in `server/.env`:

```bash
OPENAI_API_KEY=sk-...
# Optional overrides (defaults work with OpenAI)
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o-mini
```

Without a key, **parse** uses a lightweight heuristic fallback (still returns structured JSON).

Repeated **identical** parse requests (same trimmed text, hints, model, and base URL) are served from an **in-memory LRU cache** by default so the LLM is not called again until the entry expires or is evicted. Tune with `PARSE_LLM_CACHE_MAX`, `PARSE_LLM_CACHE_TTL_MS`, or disable with `PARSE_LLM_CACHE_DISABLE=1` in `server/.env`. See **`GET /api/llm-status`** for `parseLlmCache` stats.

### Optional: Slack (Bolt)

See `server/.env.example`. Start the API with Bolt enabled:

```bash
npm run dev:slack -w server
```

Requires a Slack app with **Socket Mode** or HTTP endpoints configured to match your deployment.

## Data note

Country tiers in `server/src/data/countryRiskSeed.ts` are **demo placeholders** for UX validation. Replace with data ingested from official EU sources (and your compliance team’s mapping) before any production use.

## Troubleshooting

### Server exits immediately while the web client still runs (`npm run dev`)

The API is started with **`tsx`**, which depends on **esbuild**. If you see `The package "@esbuild/..." could not be found`, optional platform packages may have been skipped during install (for example `omit=optional` in npm config or installs with `--omit=optional`).

From the repo root, run:

```bash
npm run postinstall
```

or:

```bash
node scripts/ensure-esbuild.cjs
```

Then start again with `npm run dev`. You can confirm with:

```bash
npm run dev -w server
```

You should see `API listening on http://localhost:8787` in the terminal.

### LLM still shows `usedLlm: false`

1. Confirm the **live** API process loaded secrets (you may have an **old Node process** still bound to port 8787 after a failed restart — stop it, then run `npm run dev` again).
2. Open **`GET http://localhost:8787/api/llm-status`** — check `dotenvReadOk`, `openAiKeyPresent`, `openAiBaseUrl`, `openAiModel`, and `dotenvPath`.
3. Call **`POST /api/parse`** and read optional **`llmError`** in the JSON when `usedLlm` is false — it surfaces API/parse failures without logging your key.

## Attribution

World map topology: [World Atlas](https://github.com/topojson/world-atlas) / Natural Earth (public domain).
