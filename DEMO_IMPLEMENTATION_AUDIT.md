# Demo Implementation Audit

Last updated: 17 May 2026

This file is the code-side implementation audit for the demo UI based on:
- the original action list
- Ben's screenshot/comments list
- the recent dev chat

Status values:
- `Complete`
- `Partial`
- `Not done`
- `Ben / data / deploy dependent`

Confidence values:
- `High`
- `Medium`
- `Low`

## 1. Case creation / case setup flow

### Remove default DEMO case from starting state
- Status: `Complete`
- Confidence: `High`

### User begins by clicking `New case`
- Status: `Complete`
- Confidence: `High`

### Replace free-text Practice name with a dropdown
- Status: `Complete`
- Confidence: `High`

### Add dummy practice names
- Status: `Complete`
- Confidence: `High`

### Remove CLC licence number from the form
- Status: `Complete`
- Confidence: `High`

### Selecting a practice pre-fills practice details + inspection context
- Status: `Complete`
- Confidence: `High`

### Practice prefill should come from JSON
- Status: `Complete`
- Confidence: `High`
- Notes:
  - Runtime now reads from `src/data/demoPracticeProfiles.json` via `src/data/demoPracticeProfiles.js`.
  - Content is still placeholder/demo profile data unless Ben provides a final set.

### Practice JSON should not pre-fill case properties
- Status: `Complete`
- Confidence: `Medium`
- Notes:
  - Setup metadata is prefilled; case identifiers / live workflow state are not.

### Remove Known parties section from inspection context
- Status: `Complete`
- Confidence: `High`

### Add `Case setup` tab to the left of `Documents`
- Status: `Complete`
- Confidence: `High`

### Tabs should stay locked until reached
- Status: `Complete`
- Confidence: `High`

### Firm-driven demo behaviour
- Status: `Complete`
- Confidence: `Medium`
- Notes:
  - Selected firm changes setup metadata / focus areas / prefill as requested.
  - The create-from-scratch flow still uses the shared demo storyline, which matches the previously agreed/demo-acceptable frontend behaviour rather than a per-firm scenario system.

## 2. Documents page flow

### Documents page starts on `Select documents`
- Status: `Complete`
- Confidence: `High`

### Initial state shows no documents
- Status: `Complete`
- Confidence: `High`

### Bulk import documents
- Status: `Complete`
- Confidence: `High`

### Imported docs appear as unclassified / reviewable
- Status: `Complete`
- Confidence: `High`

### `Unprocessed changes pending` popup removed before processing
- Status: `Complete`
- Confidence: `High`

## 3. Classification table updates

### Confirm buttons smaller / less noisy
- Status: `Complete`
- Confidence: `Medium`

### Remove Reason column / rename Justification to Notes / remove yellow explanation box
- Status: `Complete`
- Confidence: `High`

### Add Confidence column back
- Status: `Complete`
- Confidence: `High`

### Confirm/remove dropdown replaces tickboxes
- Status: `Complete`
- Confidence: `High`

### Generate findings gated until every row has a decision
- Status: `Complete`
- Confidence: `High`

### Low-confidence unresolved row is yellow
- Status: `Complete`
- Confidence: `High`

### Low-confidence example changed from PEP to `16_car_insurance_certificate.pdf`
- Status: `Complete`
- Confidence: `High`
- Notes:
  - Frontend no longer hardcodes PEP as the low-confidence example.
  - Local seed + bundled demo data now include the car-insurance scenario.

### PEP document should be a normal high-confidence classification row
- Status: `Complete`
- Confidence: `High`

### Clicking a doc from classification should show raw document only, not findings workflow
- Status: `Complete`
- Confidence: `High`

### PEP row removal should exclude that item from generated findings
- Status: `Complete`
- Confidence: `High`
- Notes:
  - The current local low-confidence example is now the car-insurance document rather than PEP.
  - The review/remove gating logic correctly excludes the unresolved low-confidence document from downstream generated findings.

## 4. Findings page updates

### Default filter should be `All`
- Status: `Complete`
- Confidence: `High`

### Filter should persist when navigating away/back
- Status: `Complete`
- Confidence: `High`

### Findings grouped by code area
- Status: `Complete`
- Confidence: `High`

### Only 3 code areas used
- Status: `Complete`
- Confidence: `High`

### Fix mislabelled finding severities / requirement card hookups
- Status: `Complete`
- Confidence: `High`
- Notes:
  - Shared requirement contract now drives code area, label, and content mappings.

### Remove evidence quote snippets like `Verified: Yes - certified copy attached`
- Status: `Complete`
- Confidence: `High`

### Requires review finding visually consistent with other findings
- Status: `Complete`
- Confidence: `High`

### Revert button after confirming a lead
- Status: `Complete`
- Confidence: `High`

### Rejected finding greyed out
- Status: `Complete`
- Confidence: `Medium`

### Remove `? Something to tell us?` link
- Status: `Complete`
- Confidence: `High`
- Notes:
  - Feedback remains available via the separate feedback control.

### Remove `Add observation` button from findings page
- Status: `Complete`
- Confidence: `High`
- Notes:
  - Observation code still exists internally, but there is no exposed findings-page trigger.

### Keep `Add manual finding` visible but do not use it in the demo
- Status: `Partial`
- Confidence: `High`
- Notes:
  - Button remains visible and functional.
  - This is left intentionally because it was not part of the current blocking asks and can simply be avoided in the demo.

## 5. Guidance / viewer behaviour

### `Show guidance text` button present inside findings
- Status: `Complete`
- Confidence: `High`

### Guidance opens in-app rather than in a new tab
- Status: `Complete`
- Confidence: `High`

### Guidance viewer should visually match the other PDF viewers
- Status: `Complete`
- Confidence: `High`

### `Show guidance text` on requirement summary sections too
- Status: `Complete`
- Confidence: `High`

### Requirement section should say `Content` and use requirement `label`
- Status: `Complete`
- Confidence: `High`

### Requirement bold heading should use `codeAreaLabel`
- Status: `Complete`
- Confidence: `High`

### Remove extra explanatory text around evidence highlighting
- Status: `Complete`
- Confidence: `High`

### Guidance source PDFs for non-AML references
- Status: `Complete`
- Confidence: `High`
- Notes:
  - Code of Conduct and Acting for Lenders source PDFs are bundled and wired.

### Exact bbox highlighting inside regulatory source PDFs
- Status: `Partial`
- Confidence: `High`
- Notes:
  - Correct source PDF and relevant page open.
  - Literal bbox highlight inside the regulatory source PDF is not implemented because source-PDF bbox mappings are not present.

## 6. Good practice / compliant handling

### Do not treat all compliant findings as good practice
- Status: `Complete`
- Confidence: `High`

### Only `GP-AML-001` is good practice
- Status: `Complete`
- Confidence: `High`

## 7. Reggie

### Suggested prompts present
- Status: `Complete`
- Confidence: `High`

### Inline `[1]`, `[2]` citations should jump to docs
- Status: `Complete`
- Confidence: `High`

### `Medium` = canned, `High` = live endpoint
- Status: `Partial`
- Confidence: `High`
- Notes:
  - Toggle exists.
  - `Medium` follows the canned flow.
  - `High` is still mocked in the UI until Ben’s endpoint is deployed.

### Suggested prompt / canned-response source should match Ben's latest backend-side source path
- Status: `Complete`
- Confidence: `Medium`
- Notes:
  - Frontend canned prompts/responses are now mirrored to match the current backend-side canned source.
  - The frontend still keeps its own local copy rather than importing Python source directly.

### Agent-like “plan my approach / delayed answer” feel
- Status: `Complete`
- Confidence: `Medium`
- Notes:
  - High thinking mode now stages a planning message before returning the cited answer.
  - This is still a mocked UI flow rather than the real deployed agent endpoint.

## 8. Report updates

### CLC-aligned report wording pass
- Status: `Complete`
- Confidence: `Medium`
- Notes:
  - Implemented as a pragmatic consistency pass using the current demo language.
  - Report terminology now aligns with the rest of the UI (`Non-compliant`, `Requires review`, `Good practice`, `Compliant`).
  - Practice details now distinguish `CLC licence number` from `Case reference`.

## 9. Dashboard / case list behaviour

### Active cases progress should not drift just by opening and going back
- Status: `Complete`
- Confidence: `High`

### Seeded case may still show `13/18 requirements met`
- Status: `Ben / data / deploy dependent`
- Confidence: `High`
- Notes:
  - Current local seed explicitly hardcodes this in `demo/seed/case_data.py`.
  - This is not a frontend bug.

## 10. Ben / data / deploy dependent items

### Evidence bbox accuracy on case PDFs
- Status: `Ben / data / deploy dependent`
- Confidence: `High`

### Live Reggie endpoint / real High mode
- Status: `Ben / data / deploy dependent`
- Confidence: `High`

### Any newer `demo` / `CLC_platform-demo` pushes not yet copied locally
- Status: `Ben / data / deploy dependent`
- Confidence: `High`

## Short remaining list

If the goal is to say “all done apart from x, y, z”, the remaining honest items are:

1. `High` Reggie mode is still mocked until Ben deploys the endpoint.
2. Exact source-PDF bbox highlighting for guidance docs is not implemented.
3. `Add manual finding` remains functional rather than hover-only / disabled, by deliberate user choice rather than oversight.
