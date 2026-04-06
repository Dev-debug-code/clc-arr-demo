# Backend Firestore Contract (MVP)

This is the single source of truth for the Firestore shape the frontend is currently built around.

Backend should target this shape for MVP.

Important:
- this is the MVP contract, not a proposal for a cleaner future schema
- collection/path renames are intentionally avoided unless there is a strong backend reason
- backend can add fields beyond these where sensible, but should not change paths/nesting without aligning first

## Root

Keep the org root:

```text
organizations/{orgId}
```

Reason:
- tenant separation
- matches current auth/rules/user membership
- avoids future multi-client collisions

## Full Structure

```text
organizations/{orgId}
  users/{userId}
  feedback/{feedbackId}
  cases/{caseId}
    documents/{documentId}
    uploads/{uploadId}
    findings/{findingId}
    requirements/{requirementId}
    findingNotes/{noteId}
    documentNotes/{noteId}
    contextNotes/{noteId}
    observations/{observationId}
    report/current
    reportSections/{sectionId}
    reportActions/{actionId}
    events/{eventId}
    history/{historyId}
```

## Product Model

This section is deliberately short. It exists so backend implementers understand what the collections mean in product terms, not just in Firestore terms.

- A `case` is one inspection workspace for one regulated practice at one point in time.
- The uploaded PDFs are inspection evidence, for example:
  - policy documents
  - client matter evidence
  - source-of-funds documents
  - bank statements
  - website screenshots
  - interview transcripts
- Current frontend upload flow is PDF-only.
- `POST /process` is currently modelled as a case-level run over the confirmed uploads for that case, not as a per-document micro-endpoint.

Core data buckets:

- `cases/{caseId}`
  case-level setup, inspection metadata, and overall processing state
- `uploads/{uploadId}`
  raw document workflow state: uploaded/classified/verified/needs reprocess
- `documents/{documentId}`
  processed document records used by the viewer and evidence navigation
- `findings/{findingId}`
  backend-produced findings / leads / good-practice items with evidence linkage
- `requirements/{requirementId}`
  normalized outcome state per requirement/check
- `report/current`, `reportSections`, `reportActions`
  generated report metadata, narrative sections, and action-plan items

Reviewer activity:

- reviewers accept / reject / dismiss findings
- reviewers can add notes, observations, and context
- those reviewer actions change review state and can make the report stale/requiring regeneration

Report responsibility split for MVP:

- backend should write generated report content into:
  - `report/current`
  - `reportSections/{sectionId}`
  - `reportActions/{actionId}`
- frontend already supports:
  - rendering the report
  - editing report sections
  - editing action items
  - exporting a PDF
- frontend currently has a local export/generation fallback, but MVP direction is still that backend owns the generated report content contract

## Collection Meanings

- `users/{userId}`
  org membership / role docs
- `feedback/{feedbackId}`
  feedback submissions
- `cases/{caseId}`
  case-level metadata and processing state
- `documents/{documentId}`
  processed / viewer-facing document state
- `uploads/{uploadId}`
  upload / classification / confirmation workflow state
- `findings/{findingId}`
  findings / leads / review state
- `requirements/{requirementId}`
  requirement-level status
- `findingNotes/{noteId}`
  finding note docs
- `documentNotes/{noteId}`
  document note docs
- `contextNotes/{noteId}`
  case-level context notes
- `observations/{observationId}`
  inspector-added observations
- `report/current`
  top-level report metadata
- `reportSections/{sectionId}`
  report narrative sections
- `reportActions/{actionId}`
  action plan items
- `events/{eventId}`
  MVP event trail
- `history/{historyId}`
  MVP activity/history timeline

## Path-by-Path Field Contract

### `organizations/{orgId}/users/{userId}`

Current fields:
- `email`
- `displayName`
- `role`
- `status`
- `createdAt`
- `updatedAt`
- `lastSeenAt`

### `organizations/{orgId}/feedback/{feedbackId}`

Current fields:
- `caseId`
- `category`
- `text`
- `metadata`
- `authorUserId`
- `authorName`
- `createdAt`

### `organizations/{orgId}/cases/{caseId}`

Current fields already used by frontend:
- `caseId`
- `licenceNumber`
- `practiceName`
- `owner`
- `ownerEmail`
- `inspector`
- `inspectorUserId`
- `inspectorEmail`
- `assignedInspectorName`
- `assignedInspectorUserId`
- `assignedInspectorEmail`
- `status`
- `outcome`
- `riskLevel`
- `transactionType`
- `actingForLender`
- `amlTier`
- `started`
- `previousInspection`
- `holp`
- `hofa`
- `focusAreas`
- `preInspectionConcerns`
- `knownParties`
- `progress`
- `progressLabel`
- `unreviewed`
- `leads`
- `goodPractice`
- `lastActivity`
- `createdByUserId`
- `createdByName`
- `createdAt`
- `updatedAt`
- `lastActivityAt`

Backend/MVP processing fields on this same doc:
- `processing_status`
- `has_unprocessed_changes`
- `unprocessed_summary`

Notes:
- frontend also tolerates legacy camelCase variants:
  - `hasUnprocessedChanges`
  - `unprocessedSummary`

### `organizations/{orgId}/cases/{caseId}/uploads/{uploadId}`

Current fields:
- `name`
- `filename`
- `status`
- `confirmed`
- `processing_status`
- `classification`
- `classificationL1`
- `classificationL2`
- `classificationDetail`
- `limitedAnalysis`
- `parties`
- `interviewees`
- `intervieweeName`
- `intervieweeRole`
- `interviewDate`
- `confidence`
- `addedOn`
- `summary`
- `createdAt`
- `updatedAt`

Backend-written fields expected here:
- `processing_status`
- `classification`
- `confirmed`
- `classification_confidence`
- `processing_path`
- `features_found`
- `models_agree`
- `interviewees`

Workflow meaning:
- `status`
  UI workflow state: `queued | classified | verified | attention`
- `confirmed`
  explicit inspector confirmation
- `processing_status`
  backend pipeline state

Supported document processing statuses:
- `uploaded`
- `classifying`
- `classified`
- `extracting`
- `extracted`
- `complete`
- `failed_classification`
- `failed_extraction`
- `failed_ocr`
- `failed`
- `failed_partial`

### `organizations/{orgId}/cases/{caseId}/documents/{documentId}`

Current fields:
- `name`
- `filename`
- `label`
- `classification`
- `documentType`
- `status`
- `parties`
- `confidence`
- `summary`
- `severity`
- `pdf`
- `overlayBoxes`
- `extracted_fields`
- `parties_found`
- `storagePath`
- `createdAt`
- `updatedAt`

Notes:
- `overlayBoxes` is the current bbox/highlight shape the viewer already consumes
- for MVP keep bbox/highlights on the document doc rather than introducing a separate `highlights` subcollection

### `organizations/{orgId}/cases/{caseId}/findings/{findingId}`

Current fields accepted by frontend:
- `title`
- `detail`
- `documentId`
- `boxId`
- `codeArea`
- `code_area`
- `severity`
- `certainty`
- `polarity`
- `isGoodPractice`
- `is_good_practice`
- `requirementId`
- `requirementSeverity`
- `requirement_severity`
- `reviewStatus`
- `review_status`
- `reviewReason`
- `review_reason`
- `reviewReasonNote`
- `review_reason_note`
- `reviewedAt`
- `reviewedByUserId`
- `evidenceStrength`
- `evidence_strength`
- `observationSource`
- `observation_source`
- `evidencePassages`
- `evidence_passages`
- `reference`
- `origin`
- `isInspectorAdded`
- `source`
- `createdAt`
- `updatedAt`

Backend-written fields expected here:
- findings/leads taxonomy
- requirement linkage
- evidence passages
- report-related metadata

### `organizations/{orgId}/cases/{caseId}/requirements/{requirementId}`

Current fields:
- `requirementId`
- `codeArea`
- `code_area`
- `label`
- `title`
- `status`
- `createdAt`
- `updatedAt`

Supported requirement statuses for MVP:
- `compliant`
- `non_compliant`
- `lead`
- `lead_linked`
- `good_practice`
- `not_applicable`
- `not_assessed`

### `organizations/{orgId}/cases/{caseId}/findingNotes/{noteId}`

Current fields:
- `findingId`
- `text`
- `authorUserId`
- `authorName`
- `createdAt`
- `updatedAt`

### `organizations/{orgId}/cases/{caseId}/documentNotes/{noteId}`

Current fields:
- `documentId`
- `text`
- `authorUserId`
- `authorName`
- `createdAt`
- `updatedAt`

### `organizations/{orgId}/cases/{caseId}/contextNotes/{noteId}`

Current fields:
- `text`
- `actor`
- `actorUserId`
- `timestampLabel`
- `createdAt`

### `organizations/{orgId}/cases/{caseId}/observations/{observationId}`

Current fields:
- `text`
- `requirement`
- `sourceType`
- `createdByUserId`
- `createdByName`
- `timestampLabel`
- `createdAt`
- `updatedAt`

### `organizations/{orgId}/cases/{caseId}/report/current`

Current fields:
- `executiveSummary`
- `executive_summary`
- `overallRating`
- `overall_rating`
- `generated_at`
- `updatedAt`
- `updatedByUserId`
- `updatedByName`

Backend-written fields expected here:
- `executive_summary`
- `overall_rating`
- `generated_at`

### `organizations/{orgId}/cases/{caseId}/reportSections/{sectionId}`

Current fields:
- `sectionId`
- `codeAreaId`
- `codeArea`
- `code_area`
- `narrative`
- `lines`
- `original_narrative`
- `is_edited`
- `updatedAt`
- `updatedByUserId`
- `updatedByName`

### `organizations/{orgId}/cases/{caseId}/reportActions/{actionId}`

Current fields:
- `action`
- `codeRef`
- `code_ref`
- `codeArea`
- `deadline`
- `person`
- `status`
- `createdAt`
- `updatedAt`

Backend-written fields expected here:
- generated action items

### `organizations/{orgId}/cases/{caseId}/events/{eventId}`

Current fields:
- `eventType`
- `actorUserId`
- `actorName`
- `targetType`
- `targetId`
- `payload`
- `createdAt`

MVP note:
- keep using this instead of introducing a new literal `audit` collection

### `organizations/{orgId}/cases/{caseId}/history/{historyId}`

Current fields:
- `timestampLabel`
- `detail`
- `actor`
- `actorUserId`
- `createdAt`

MVP note:
- keep using this instead of introducing a new literal `processing_log` collection

## Endpoint Write Targets

### `POST /process`

Should write to:
- `cases/{caseId}`
- `uploads/{uploadId}`
- `documents/{documentId}`
- `findings/{findingId}`
- `requirements/{requirementId}`
- optional `events/{eventId}` / `history/{historyId}`

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

### `POST /report/generate`

Should write to:
- `report/current`
- `reportSections/{sectionId}`
- `reportActions/{actionId}`
- optional `events/{eventId}` / `history/{historyId}`

### `GET /report/export`

Does not need a Firestore schema change.

### `POST /agent`

Lower priority than `/process` + report flow for MVP.

## MVP Guidance

For MVP:
- keep the current collection names
- keep the org root
- keep the `uploads` / `documents` split
- keep bbox/highlights on `documents/{documentId}.overlayBoxes`

Avoid for now unless there is a strong reason:
- collection renames for cleanliness only
- replacing `events/history` with new audit/log collections
- collapsing `uploads` and `documents`
- moving bbox data to a separate highlights collection
- introducing a separate `cases/{caseId}/parties` collection
- introducing literal `active_session` locking now
