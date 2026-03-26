# Sumplexity ARR Demo

A single-page React experience that walks prospects through the proposed ARR → Compliance Audit workflow. Everything is front-end only with curated data, canned ARR commentary, and a bundled PDF that represents the 2022 ARR document.

## Getting started

```bash
npm install
npm run dev
```

The dev server will start on http://localhost:5173. No environment variables are required.

## Data provider mode

The app now routes all case data operations through `src/services/dataProvider.js`.

Set `VITE_DATA_PROVIDER` to choose where reads/writes come from:

- `firestore` (default): Firestore-backed reads/writes
- `mock`: temporary contract-mock mode (currently mirrors Firestore provider behavior)
- `api`: backend API mode through `src/services/providers/apiProvider.js`

Firestore mode also supports:

- `VITE_FIREBASE_DATABASE_ID` (defaults to `clc-dev-db`)
- `VITE_ORGANIZATION_ID` (defaults to `clc-dev`)

When using `api` mode, set:

- `VITE_API_BASE_URL` (for example `http://localhost:8000`)
- Optional: `VITE_API_BEARER_TOKEN` (uses static bearer token instead of Firebase ID token)

Example:

```bash
VITE_DATA_PROVIDER=firestore npm run dev
```

## Firestore seed/reset (baseline demo data)

```bash
npm run seed:db:fresh   # reset org tree + reseed baseline
npm run seed:db:reset   # reset only
npm run seed:db         # additive seed
```

The baseline seed includes a realistic 10-document canned case set plus known findings/evidence so uploaded files with matching filenames can map to mocked evidence/highlights during frontend-only flows.

Optional env vars let you seed your signed-in Firebase user with a specific role/display name:

```bash
FIREBASE_USER_ID=<auth_uid> \
FIREBASE_USER_EMAIL=<auth_email> \
FIREBASE_USER_DISPLAY_NAME="Wayne Bradley" \
FIREBASE_USER_ROLE=team_lead \
npm run seed:db:fresh
```

## Firestore rules (recommended for persistent use)

Reference ruleset is in `firestore.rules`.

- open Firebase Console -> Firestore Database -> Rules
- paste `firestore.rules`
- publish

Operational notes are in [ACCESS_CONTROL.md](/mnt/c/ConvPlat/clc-arr-demo/ACCESS_CONTROL.md#L1).

This ruleset enforces the product access model:

- `inspector`: assigned cases only
- `team_lead`: all cases in the org/team dashboard view
- internal all-access roles: `admin`, `owner`, `full_access`

It also prevents self-escalation of role/status for ordinary users and blocks self-enrollment into an org. User provisioning must now happen through a privileged path such as the seed script or manual Firestore admin changes.

If you use Firebase CLI instead of the Console, `firebase.json` is already wired to deploy `firestore.rules`.

## Backend smoke checks (read-only)

```bash
npm run smoke:api -- --base-url http://localhost:8000 --case-id <case_id> --check-export
```

Optional env vars for the smoke script:

- `API_BEARER_TOKEN`
- `CASE_ID`

## Production build

```bash
npm run build
npm run preview   # optional smoke test of the static build
```

## Highlights

- Sumplexity design system tokens lifted from the existing workspace so the demo looks consistent with production tooling.
- Each ARR/Audit step is interactive with simulated progress bars, selectable cards, and mock findings.
- Step 3 embeds the supplied `CLC_ARR_2022.pdf` and keeps the commentary list in sync with bounding boxes drawn on top of the viewer.
- Findings dashboard (Step 6) lets users filter by severity, jump between document tabs, and deep-link from findings to the corresponding file.
- Export step shows the final PDF hand-off with download/email CTAs; all data lives in `src/data/mockData.js` for easy tweaking.
