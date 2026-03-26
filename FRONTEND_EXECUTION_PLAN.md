# Frontend Execution Plan (POC)

This is the practical run-order for finishing the frontend safely while backend endpoints are still landing.

## Current status (2026-03-09)

- Done:
  - Workflow order and step timeline aligned to wireframes (`Dashboard -> Create -> Documents -> AI Processing -> Overview -> Viewer -> Report`).
  - Firestore read/write foundation for cases, documents, findings, notes, observations, report sections, and report actions.
  - Deterministic reset flow (`seed:db:fresh`) for repeatable demos.
  - Data-provider split in place (`firestore` / `api` / `mock`) with API adapter wired for core v6 endpoints.
  - Known uploaded baseline files map by filename to seeded evidence/highlights for stable UI walkthrough.
  - Seed baseline now restores a realistic 10-document canned case set rather than a thin 3-upload stub.
  - Final frontend-only parity/data pass completed for overview stats, document upload metadata, viewer footer actions, and upload-state-driven document status.
- Remaining:
  - Live backend payload validation in `api` mode.
  - Final micro-polish only (spacing/copy), not structural frontend work.
  - Repo hygiene cleanup (tracked noise, zone identifiers, build artifacts).

## Priority 1 (Do Now)

1. Keep current workflow and 10-doc baseline stable:
   - `Case Dashboard -> Create Case -> Documents -> AI Processing -> Overview -> Document Viewer -> Report`
   - Known seeded files in `public/assets/case-files` continue to map to mocked findings/evidence/highlights by filename.
2. Keep Firestore persistence stable for inspector edits:
   - case status/outcome patch
   - finding decisions + notes
   - document/case notes
   - observations add/edit/delete
   - report summary + section patch/revert
   - report action plan add/edit/delete
3. Keep reset workflow deterministic:
   - `npm run seed:db:fresh` should always restore a clean baseline for demo/testing.

## Priority 2 (Backend Hookup Readiness)

1. Run app in API mode:
   - `VITE_DATA_PROVIDER=api`
   - `VITE_API_BASE_URL=<backend-url>`
2. Validate these endpoints in live click-through:
   - `PATCH /cases/{case_id}`
   - `PATCH /cases/{case_id}/report`
   - `PATCH /cases/{case_id}/report/sections/{section_id}`
   - `POST/PATCH/DELETE /cases/{case_id}/report/actions`
3. Confirm case identity is always backend case id (not licence string) after create/load.

## Priority 3 (Optional Frontend Polish)

1. Documents page spacing/copy polish only.
2. Overview evidence-card spacing/copy polish only.
3. Document Viewer spacing/copy polish only.
4. Report typography/spacing polish only.

## Can Move Later (Post-POC / Cleanup)

1. Repository hygiene:
   - remove `Zone.Identifier` artifacts
   - clean tracked build/dependency noise
2. Bundle size/chunking optimization.
3. Optional UI diagnostics panels.

## Definition of "Frontend Done for POC"

1. End-to-end flow works on seeded baseline without runtime errors.
2. Inspector actions persist and survive refresh.
3. API mode can replace mocked/Firestore behavior with endpoint responses without UI rewrites.
4. Remaining gaps are backend data-quality/model details, not frontend architecture.
