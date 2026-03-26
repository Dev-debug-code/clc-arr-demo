# Backend Firestore Contract (MVP)

This is the current Firestore contract the frontend already uses in Firestore mode.

Backend should target this shape for MVP.

## Root

Keep the org root:

```text
organizations/{orgId}
```

Reason:
- tenant separation
- matches current auth/rules/user membership
- avoids future multi-client collisions

## Collections

```text
organizations/{orgId}/users/{userId}
organizations/{orgId}/feedback/{feedbackId}
organizations/{orgId}/cases/{caseId}

organizations/{orgId}/cases/{caseId}/documents/{documentId}
organizations/{orgId}/cases/{caseId}/uploads/{uploadId}
organizations/{orgId}/cases/{caseId}/findings/{findingId}
organizations/{orgId}/cases/{caseId}/requirements/{requirementId}
organizations/{orgId}/cases/{caseId}/findingNotes/{noteId}
organizations/{orgId}/cases/{caseId}/documentNotes/{noteId}
organizations/{orgId}/cases/{caseId}/contextNotes/{noteId}
organizations/{orgId}/cases/{caseId}/observations/{observationId}
organizations/{orgId}/cases/{caseId}/report/current
organizations/{orgId}/cases/{caseId}/reportSections/{sectionId}
organizations/{orgId}/cases/{caseId}/reportActions/{actionId}
organizations/{orgId}/cases/{caseId}/events/{eventId}
organizations/{orgId}/cases/{caseId}/history/{historyId}
```

## Collection meanings

- `cases/{caseId}`: case-level config/state
- `uploads/{uploadId}`: upload/classify/confirm workflow state
- `documents/{documentId}`: processed/viewer-facing document state
- `findings/{findingId}`: findings/leads/review state
- `report/current`: overall report doc
- `reportSections/{sectionId}`: report narratives
- `reportActions/{actionId}`: action plan items

## Case doc

Path:

```text
organizations/{orgId}/cases/{caseId}
```

Current case-level fields already used by the frontend include:

- `practiceName`
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

Backend fields that can be added here:

- `processing_status`
- `has_unprocessed_changes`
- `unprocessed_summary`
- `outcome`

## Upload docs

Path:

```text
organizations/{orgId}/cases/{caseId}/uploads/{uploadId}
```

Use this for upload/classification workflow state.

Backend fields that fit here:

- `processing_status`
- `classification`
- `confirmed`
- `classification_confidence`
- `processing_path`
- `features_found`
- `models_agree`
- `interviewees`

Current frontend workflow meaning:

- `status: queued|classified|verified|attention`
- `confirmed: boolean`
- `processing_status` for backend pipeline state

## Document docs

Path:

```text
organizations/{orgId}/cases/{caseId}/documents/{documentId}
```

Current frontend reader expects fields such as:

- `filename`
- `classification`
- `summary`
- `pdf`
- `overlayBoxes`

Backend fields that fit here:

- `summary`
- `extracted_fields`
- `parties_found`
- file/url metadata
- `overlayBoxes`

For MVP, keep bbox/highlight rectangles on the document doc as `overlayBoxes`, because the current viewer already reads that field directly.

## Finding docs

Path:

```text
organizations/{orgId}/cases/{caseId}/findings/{findingId}
```

Current frontend reader expects/accepts:

- `title`
- `detail`
- `documentId`
- `boxId`
- `codeArea` or `code_area`
- `certainty`
- `polarity`
- `isGoodPractice` or `is_good_practice`
- `reviewStatus` or `review_status`
- `reviewReason` or `review_reason`
- `reviewReasonNote` or `review_reason_note`
- `evidenceStrength` or `evidence_strength`
- `observationSource` or `observation_source`
- `evidencePassages` or `evidence_passages`
- `reference`
- `origin`

Backend fields that fit here:

- findings/leads taxonomy
- requirement linkage
- `evidencePassages`
- report-related metadata

## Requirement docs

Path:

```text
organizations/{orgId}/cases/{caseId}/requirements/{requirementId}
```

Supported requirement statuses for MVP:

- `compliant`
- `non_compliant`
- `lead` or `lead_linked`
- `good_practice`
- `not_applicable`
- `not_assessed`

## Report docs

Paths:

```text
organizations/{orgId}/cases/{caseId}/report/current
organizations/{orgId}/cases/{caseId}/reportSections/{sectionId}
organizations/{orgId}/cases/{caseId}/reportActions/{actionId}
```

Current report fields already used by the frontend include:

On `report/current`:
- `executiveSummary` or `executive_summary`

On `reportSections/{sectionId}`:
- `sectionId`
- `codeAreaId` or `codeArea` or `code_area`
- `narrative`
- `lines`
- `original_narrative`
- `is_edited`

On `reportActions/{actionId}`:
- `action`
- `codeRef` or `code_ref`
- `codeArea`
- `deadline`
- `person`

Backend fields that fit here:

On `report/current`:
- `generated_at`
- `overall_rating`
- `executive_summary`

On `reportSections/{sectionId}`:
- `original_narrative`
- `narrative`
- `is_edited`

On `reportActions/{actionId}`:
- generated action items

## Event/history docs

Paths:

```text
organizations/{orgId}/cases/{caseId}/events/{eventId}
organizations/{orgId}/cases/{caseId}/history/{historyId}
```

Use these for MVP instead of introducing new `audit` / `processing_log` collections.

## Endpoint write targets

### `POST /process`

Should write to:

- `cases/{caseId}`: processing state
- `uploads/{uploadId}`: classification/progress workflow fields
- `documents/{documentId}`: summaries, extracted fields, `overlayBoxes`
- `findings/{findingId}`: findings/leads/evidence linkage
- `requirements/{requirementId}`: requirement status if needed
- `history/{historyId}` / `events/{eventId}`: process activity

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

## MVP guidance

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
