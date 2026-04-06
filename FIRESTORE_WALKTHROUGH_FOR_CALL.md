# Firestore Walkthrough For Backend Call

Use this for the Friday call with Ben and Ollie.

Purpose:
- show the Firestore structure they should target
- keep the walkthrough short
- avoid getting dragged into non-MVP schema churn

Reference:
- detailed contract: `BACKEND_FIRESTORE_CONTRACT.md`

## Call objective

By the end of the call, everyone should be aligned on:
- the root path
- the key case subcollections
- what `/process` writes
- what `/report/generate` writes
- what is intentionally deferred for MVP

## 10 minute call structure

### 1. Start with the rule

Say this first:

> Backend writes to Firestore. Frontend reads Firestore directly. This is the schema backend should target for MVP.

### 2. Show the root

Screen share:

```text
organizations/{orgId}
```

Key point:
- we keep the org root for tenant separation and future multi-client support

### 3. Show one real case

Screen share:

```text
organizations/{orgId}/cases/{caseId}
```

Explain:
- this case doc holds case-level metadata and processing state

Main fields to mention:
- `practiceName`
- `assignedInspectorName`
- `riskLevel`
- `transactionType`
- `actingForLender`
- `amlTier`
- `focusAreas`
- `preInspectionConcerns`
- `knownParties`
- `status`
- `outcome`
- `processing_status`
- `has_unprocessed_changes`
- `unprocessed_summary`

### 4. Show the key subcollections

Screen share these in this order:

```text
uploads
documents
findings
requirements
report/current
reportSections
reportActions
events
history
```

Use these one-line descriptions:

- `uploads`
  upload/classify/confirm workflow state

- `documents`
  processed document state for viewer/report/extracted content

- `findings`
  findings/leads/review state

- `requirements`
  requirement status by code area

- `report/current`
  top-level report metadata

- `reportSections`
  report narrative sections

- `reportActions`
  action plan items

- `events` / `history`
  current MVP event trail / history trail

### 5. Explain the one important split

Say this clearly:

> `uploads` and `documents` are intentionally separate.
> `uploads` is the workflow state.
> `documents` is the processed/viewer-facing state.

### 6. Explain highlights / bbox shape

Say this clearly:

> For MVP, bbox/highlight data stays on `documents/{documentId}.overlayBoxes` because the current viewer already reads that shape.

### 7. Explain backend write targets

#### `/process`

Backend should write to:

```text
organizations/{orgId}/cases/{caseId}
organizations/{orgId}/cases/{caseId}/uploads/{uploadId}
organizations/{orgId}/cases/{caseId}/documents/{documentId}
organizations/{orgId}/cases/{caseId}/findings/{findingId}
organizations/{orgId}/cases/{caseId}/requirements/{requirementId}
```

Practical write breakdown:

- case doc
  - `processing_status`
  - `has_unprocessed_changes`
  - `unprocessed_summary`
  - `outcome`

- uploads
  - `confirmed`
  - `processing_status`
  - `classification`
  - `classification_confidence`
  - `processing_path`
  - `features_found`
  - `models_agree`
  - `interviewees`

- documents
  - `summary`
  - `extracted_fields`
  - `parties_found`
  - `overlayBoxes`

- findings
  - `title`
  - `detail`
  - `documentId`
  - `boxId`
  - `codeArea`
  - `certainty`
  - `polarity`
  - `is_good_practice`
  - `requirementId`
  - `evidencePassages`
  - `evidence_strength`
  - `origin`

- requirements
  - `status`

Supported requirement statuses:
- `compliant`
- `non_compliant`
- `lead`
- `lead_linked`
- `good_practice`
- `not_applicable`
- `not_assessed`

#### `/report/generate`

Backend should write to:

```text
organizations/{orgId}/cases/{caseId}/report/current
organizations/{orgId}/cases/{caseId}/reportSections/{sectionId}
organizations/{orgId}/cases/{caseId}/reportActions/{actionId}
```

Main fields:

- `report/current`
  - `executive_summary`
  - `overall_rating`
  - `generated_at`

- `reportSections`
  - `sectionId`
  - `codeAreaId`
  - `narrative`
  - `original_narrative`
  - `is_edited`

- `reportActions`
  - `action`
  - `codeRef`
  - `codeArea`
  - `deadline`
  - `person`

### 8. Close with what is deliberately not being forced for MVP

Say this if it comes up:

These are intentionally not being forced right now unless there is a strong backend reason:
- renaming `findings` to `items`
- renaming `events/history` to `audit/processing_log`
- separate `highlights` subcollection under documents
- separate `cases/{caseId}/parties` collection
- `active_session`
- analytics schema

## Suggested close

Use this wording:

> This is the schema the frontend is already built around, so the lowest-risk approach is for backend to point at this shape directly for MVP and only revisit cleanup later if we need to.
