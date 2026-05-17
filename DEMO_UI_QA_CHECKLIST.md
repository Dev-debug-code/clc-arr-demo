# Demo UI QA Checklist

Last updated: 17 May 2026

## Current demo contract

### Findings page
- Default filter is `All` / no filtering.
- Filter state should persist when navigating away and back.
- Findings are grouped by code area.
- Demo code areas are limited to:
  - `Anti-Money Laundering`
  - `Acting for Lenders`
  - `Code of Conduct`
- `Requires review` cards use the same structure as normal findings, only with warning styling.
- Reverting a confirmed lead must restore the yellow `Requires review` state.
- Rejected / dismissed findings stay greyed out.
- Evidence quote snippets are not shown under `Highlight evidence`.
- Requirement summary cards use the shared demo requirement contract:
  - heading from the requirement guidance reference / label mapping
  - `Content` from the requirement text
  - `Show guidance text` on the requirement row
- `Unprocessed changes pending` banner should not appear in findings / history / report.

### Documents and classification
- Documents starts on `Select Documents`.
- Classification review only shows raw documents when a document name is clicked from the documents flow.
- `Generate findings` stays gated until every row in `Confirm/remove` has a decision.
- The yellow unresolved classification row is data-driven.
  - The UI no longer hardcodes `10_PEP_Screening`.
  - Whatever upload is `confirmed: false` with low confidence becomes the unresolved row.
- Current local seeded/bundled example: `16_car_insurance_certificate.pdf`.
- `10_PEP_Screening.pdf` is now a normal high-confidence classification row and the issue remains expressed as `LEAD-AML-003`.

### Case setup
- Practice dropdown / prefill now reads from `src/data/demoPracticeProfiles.json` via the shared `demoPracticeProfiles.js` wrapper.
- Placeholder profile content is still demo data unless Ben supplies a final profile set.

### Guidance view
- `Show guidance text` stays in-app.
- Guidance documents render through the same PDF viewer component as the main document viewer.
- Non-AML guidance PDFs are now bundled and wired:
  - `Code-of-Conduct.pdf`
  - `20240110-Acting-for-Lenders-and-Prevention-and-Detection-of-Mortgage-Fraud-Guidance.pdf`
- Current guidance behaviour is page-level linking into the correct source PDF.
- Literal source-PDF bbox highlighting is still a separate data problem if Ben wants it later.

### Reggie
- `Medium` thinking level = canned demo flow.
- `High` thinking level is still mocked until Ben exposes the live endpoint.
- Assistant answers support structured citations.
- Inline citation labels like `[1]` / `[2]` should open the linked source document.
- Suggested prompts should stay aligned to the current storyline:
  - John Bloggs / estate letter
  - source of funds
  - MLRO interview
  - bank statements
  - good practice

## Shared data rules
- Demo requirement metadata is centralised in `src/data/demoRequirementCatalog.js`.
- Use that catalog as the source of truth for:
  - code area
  - display label
  - requirement text
  - manual finding dropdown labels
  - manual requirement severity defaults
- This avoids stale inference from requirement id prefixes alone.
- Important example: `aml-1` belongs to `Acting for Lenders`, not AML, in the current demo storyline.

## Known intentional caveats
- The create-from-scratch flow still uses the bundled frontend demo dataset, not live backend generation per click.
- The live seeded Firestore case should remain the source of truth for the main demo walkthrough.
- Some evidence bbox coordinates may still need Ben's final QA pass.
- `High` Reggie mode is a UI/mock branch until the real endpoint is available.

## Fast smoke test
1. Open the seeded demo case.
2. Confirm findings filter defaults to `All`.
3. Confirm only the three demo code areas are present.
4. Open a classification-row document from the Documents tab and verify raw-document-only viewer behaviour.
5. Open a finding and verify:
   - requirement summary text looks correct
   - `Show guidance text` opens the right source PDF/page
   - `Jump to evidence` opens the evidence document
6. Open Reggie and verify inline citation buttons open documents.
