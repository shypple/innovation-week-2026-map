# Demo materials: Shypple Sanctions Assist

Innovation Week presentation pack for Tudor's sanctions sense check in Shypple Dashboard.

| File | Use |
|------|-----|
| [HANDOUT.md](./HANDOUT.md) | One-page handout (print or export to PDF) |
| [SPEAKER-NOTES.md](./SPEAKER-NOTES.md) | Three slides + speaker script |
| [DASHBOARD-BANNERS.md](./DASHBOARD-BANNERS.md) | Banner titles, API message examples, curl smoke tests |

**Product name:** Shypple Sanctions Assist (assistive triage, not a legal "checker").

**Data source:** Live [EU Sanctions Map](https://www.sanctionsmap.eu/) API (`/api/v1/regime` + `/api/v1/data`), cached on the sanctions-triage server (~6h).

**Live demo:** Shypple Dashboard template booking + `POST /api/v1/shipment-triage` on `:8787`. Optional: standalone map at `:5173`.

**Before presenting:** restart `npm run dev` in `sanctions-triage` and confirm `curl -s http://localhost:8787/api/map-risk | jq .source` returns `"eu-sanctions-map"`.

Export handout to PDF (example):

```bash
pandoc docs/demo/HANDOUT.md -o docs/demo/Shypple-Sanctions-Assist-handout.pdf
```

Or paste `HANDOUT.md` into Google Docs / Notion and export from there.
