# API Integration Checklist (Frontend)

Source contract: `api-specification-v6.md` (wireframes v6 companion).

Latest backend/Firestore contract for the simplified MVP model: [BACKEND_FIRESTORE_CONTRACT.md](./BACKEND_FIRESTORE_CONTRACT.md)

## Status summary (2026-03-08)

- Frontend adapter coverage: in place for core POC endpoints.
- Primary remaining work: run full click-through in live `api` mode and confirm payload compatibility.
- No architecture blocker remaining on frontend side; remaining risk is backend response shape/consistency.

## Wired in `src/services/providers/apiProvider.js`

- `GET /cases`
- `GET /practices/lookup`
- `GET /cases/{case_id}`
- `POST /cases`
- `POST /cases/{case_id}/items`
- `DELETE /cases/{case_id}/items/{item_id}`
- `POST /cases/{case_id}/observations`
- `PATCH /cases/{case_id}/items/{item_id}/review`
- `POST /cases/{case_id}/items/{item_id}/notes`
- `POST /cases/{case_id}/documents/{doc_id}/notes`
- `POST /cases/{case_id}/process`
- `POST /cases/{case_id}/documents` (when a `File` object is available)
- `PATCH /cases/{case_id}/documents/{doc_id}`
- `GET /cases/{case_id}/documents/{doc_id}/content`
- `POST /cases/{case_id}/documents/confirm-all`
- `POST /cases/{case_id}/report/generate`
- `POST /cases/{case_id}/report/actions`
- `PATCH /cases/{case_id}/report/actions/{action_id}`
- `DELETE /cases/{case_id}/report/actions/{action_id}`
- `POST /cases/{case_id}/search`
- `PATCH /cases/{case_id}/observations/{obs_id}`
- `DELETE /cases/{case_id}/observations/{obs_id}`
- `PATCH /cases/{case_id}/report`
- `PATCH /cases/{case_id}/report/sections/{section_id}`
- `PATCH /cases/{case_id}/report/sections/{section_id}` (used for both edit and revert, with original narrative on revert)
- `GET /cases/{case_id}/report/export?format=pdf`
- `POST /feedback`
- `PATCH /cases/{case_id}` (context notes + status/outcome summary patch sync)

## Still pending for full parity

- Validate live backend payload acceptance in API mode (`VITE_DATA_PROVIDER=api`) for:
  - `PATCH /cases/{case_id}`
  - `PATCH /cases/{case_id}/report`
  - `PATCH /cases/{case_id}/report/sections/{section_id}`
  - `POST/PATCH /cases/{case_id}/report/actions` (`code_ref` now user-editable in UI)
- Confirm backend sends stable `report.sections[].id` + `code_area` so code-area-level report edit/revert mapping remains deterministic.

## Important notes

- Current app state model still contains legacy fields (`severity`, local report edit state, local observations).
- API provider maps v6 item taxonomy into current UI shape as a compatibility layer.
- Report editing is now resilient even when backend omits `report.sections`: frontend/provider applies deterministic fallback section ids (`section_<code_area>`), then persists/reloads narrative content.
- Firestore seed baseline includes `report/current` and `reportSections/*` so report UI starts from stable persisted content after `seed:db:fresh`.
- Added read-only smoke runner for backend checks: `npm run smoke:api` (optional: `-- --case-id <id> --check-export`).
- For live API mode, set:
  - `VITE_DATA_PROVIDER=api`
  - `VITE_API_BASE_URL=<backend-base-url>`
