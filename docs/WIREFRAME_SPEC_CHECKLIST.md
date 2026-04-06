# Wireframe Spec Checklist

This file tracks the annotated `*-spec.html` pages in:

`/mnt/c/ConvPlat/CLC_platform-ui_wireframes (2)/CLC_platform-ui_wireframes/src/ui/wireframes/pages`

Scope:

- Product controls, workflow rules, and annotated behaviors
- Not pixel-perfect styling
- Not prototype scaffolding such as `View Interactive`, annotation markers, legend tables, or page-order badges

Status meanings:

- `Implemented`: present in the app and part of the intended workflow
- `Implemented (UI-only)`: represented in the UI, but the underlying browser/platform feature is intentionally not wired in this MVP
- `Ignored for MVP`: intentionally omitted with a reason
- `Source conflict`: the annotated spec and the visible wireframe page disagree, so the current build follows one source and the conflict is called out explicitly

## Rule Decisions

- Case creation gate: `Create Case` stays disabled until practice name, licence number, and at least one focus area are present.
- Documents gate: `Generate findings` stays disabled until every uploaded document is classified and confirmed.
- Report gate: `Generate report` and `Regenerate` stay blocked while any findings remain unreviewed.
- Report source-of-truth: report sections, appendix rows, and action-plan drafts are derived from accepted findings only. This follows the report copy/spec language that the report is assembled from reviewed findings and action-plan items come from accepted non-compliant findings.

## Global Ignore Rules

- Spec-only scaffolding is ignored everywhere: `View Interactive`, spec markers, annotation legend, page-order badges.
- Browser-native dictation is UI-only in this MVP. Microphone buttons remain as UI affordances where shown, but no speech pipeline is wired.
- Backend transport details such as debouncing, signed URLs, and exact endpoint persistence are treated as provider concerns unless they change the visible workflow.

## 0. Login

- `Implemented` — Brand Logos
- `Implemented` — Email Input
- `Implemented` — Password Input
- `Implemented` — Sign-in Button
- `Implemented` — Error Alert
- `Implemented` — Forgot Password
- `Implemented` — Footer

## 1. Dashboard

- `Implemented` — View Toggle
- `Implemented` — Active Case Count
- `Implemented` — Filter Bar
- `Implemented` — Attention Alerts
- `Implemented` — + New Case
- `Implemented` — Case Cards
- `Implemented` — Recently Completed
- `Implemented` — Feedback Tab

Notes:

- Team-case visibility still depends on role/account state, which is provider-driven rather than hardcoded into the wireframe layer.

## 2. Case Setup

- `Implemented` — Licence Auto-Match
- `Implemented` — Practice Details
- `Implemented` — Risk Level
- `Implemented (UI-only)` — Pre-inspection Concerns
- `Implemented` — Focus Areas
- `Implemented` — Known Parties
- `Implemented` — Questionnaire Upload
- `Implemented` — Create Button

Notes:

- The pre-inspection concerns microphone is intentionally UI-only in the current MVP.

## 3. Documents

- `Implemented` — Upload Zone
- `Implemented` — Verification Table
- `Source conflict` — L1/L2 Dropdown
- `Implemented` — Low Confidence Row
- `Implemented` — All Correct
- `Implemented` — Generate Findings
- `Implemented` — Processing Log

Notes:

- The visible wireframe page shows a simple select plus manual confirmation and a scroll-gate modal for `Confirm all remaining`. The annotated spec text also says the L1/L2 selection auto-confirms the row. Those two sources conflict; the app follows the visible page/manual-confirm flow.
- Filename hover preview remains a gap relative to the annotated spec text.
- File-picker supported types and filename click-to-open are implemented.

## 4. Overview

- `Implemented` — Summary Cards
- `Implemented` — Code Area Rows
- `Implemented` — Finding Card
- `Implemented` — Lead Card
- `Implemented` — Action Buttons
- `Implemented` — Three-Dot Menu
- `Implemented` — Reggie (AI Assistant)

Notes:

- Accept/reject/add-note behavior is wired inline, and the accept button now visibly updates state on the card.
- Delete confirmation remains in place because the spec explicitly requires confirmation for deleting inspector-added findings.

## 5. Document Viewer

- `Implemented` — PDF Viewer Panel
- `Implemented` — Evidence Highlighting
- `Implemented` — Minimap
- `Implemented` — Document Navigator
- `Implemented` — Findings Panel
- `Implemented` — Findings Filter
- `Source conflict` — In-Document Search
- `Implemented` — Reggie (AI Assistant)

Notes:

- The annotated spec describes a bottom-bar document search input with results and `Jump to passage` / `Add as finding`.
- The visible wireframe page instead says document search uses the document-scoped Reggie slide-in path.
- The current app follows the visible page path more closely than the annotated bottom-bar search description.

## 6. History

- `Implemented` — Empty State (First Inspection)
- `Implemented` — Compliance Trend Bars
- `Implemented` — Last Inspection Summary
- `Implemented` — Previous Findings Table
- `Implemented` — Recurring Badge

Notes:

- Where no previous recorded metrics exist, the history UI intentionally shows `Not recorded` rather than fabricating prior percentages.

## 7. Report

- `Implemented` — Stale Banner
- `Implemented` — Report Card (Document Container)
- `Implemented` — Editable Sections
- `Implemented` — Action Plan Table
- `Implemented` — Report Structure (CLC Format)
- `Implemented` — Export Button

Notes:

- Export is PDF-only in the MVP, matching the spec.
- The app now enforces the reviewed-findings rule before generate/regenerate.
- Action-plan suggestions are derived from accepted non-compliant findings only.
