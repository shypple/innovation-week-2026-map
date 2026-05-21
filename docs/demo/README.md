# Demo materials: Shypple Sanctions Assist

Innovation Week presentation pack for Tudor's sanctions sense check in Shypple Dashboard.

| File | Use |
|------|-----|
| [HANDOUT.md](./HANDOUT.md) | One-page handout (print or export to PDF) |
| [SPEAKER-NOTES.md](./SPEAKER-NOTES.md) | Three slides + speaker script |
| [DASHBOARD-BANNERS.md](./DASHBOARD-BANNERS.md) | Exact banner strings, i18n keys, curl smoke tests |

**Product name:** Shypple Sanctions Assist (assistive triage, not a legal "checker").

**Live demo:** Shypple Dashboard template booking + `POST /api/v1/shipment-triage` on `:8787`.

**Official reference:** [EU Sanctions Map](https://www.sanctionsmap.eu/)

Export handout to PDF (example):

```bash
# From repo root, if you have pandoc installed:
pandoc docs/demo/HANDOUT.md -o docs/demo/Shypple-Sanctions-Assist-handout.pdf
```

Or paste `HANDOUT.md` into Google Docs / Notion and export from there.
