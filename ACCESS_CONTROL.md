# Access Control

This project now uses a real Firestore-backed access model for case visibility and user roles.

## Canonical roles

- `inspector`: can see only cases assigned to them or created by them
- `team_lead`: can see all cases in the configured org and use the team dashboard view
- `admin`: internal all-access role for dev/support/testing

The product-facing roles in the wireframes/spec are `inspector` and `team_lead`. `admin` exists as an operational override for provisioning, support, and testing.

## Org model

- Data is scoped under `organizations/{orgId}`
- The app is configured to one org at a time via `VITE_ORGANIZATION_ID`
- A user only has access if they have a Firestore user document at `organizations/{orgId}/users/{uid}`

This means:

- users from org A do not read org B data
- there is no in-app multi-org switcher
- there is no sub-team scoping inside an org right now

## Provisioning model

Access is not granted by Firebase Authentication alone.

A user must have:

1. a valid Firebase Auth account
2. a Firestore user document in the configured org

The app no longer auto-creates org membership on first login. If the Firestore user doc is missing, the UI shows an `Account not provisioned` state.

## Firestore rules intent

The rules in [firestore.rules](/mnt/c/ConvPlat/clc-arr-demo/firestore.rules#L1) enforce:

- no self-escalation of role or status
- no self-enrollment into an org
- inspectors read only assigned cases
- team leads read all cases in the configured org
- privileged users can provision users and perform destructive admin actions

## Current provisioning workflow

For local/dev/test use, provision users by:

- running the seed script with the real Firebase Auth `uid` and `email`
- or creating/updating the Firestore user doc manually

Example:

```bash
FIREBASE_USER_ID=<auth_uid> \
FIREBASE_USER_EMAIL=<auth_email> \
FIREBASE_USER_DISPLAY_NAME="Alex Carter" \
FIREBASE_USER_ROLE=admin \
npm run seed:db:fresh
```

Windows `cmd`:

```cmd
set FIREBASE_USER_ID=<auth_uid>
set FIREBASE_USER_EMAIL=<auth_email>
set FIREBASE_USER_DISPLAY_NAME=Alex Carter
set FIREBASE_USER_ROLE=admin
npm run seed:db:fresh
```

## Role testing

To test a role, reseed the same Firebase Auth account with one of:

- `inspector`
- `team_lead`
- `admin`

Then refresh the app and sign in with that same account.

Expected behavior:

- `inspector`: `My Cases` only
- `team_lead`: `My Cases` and `Team Cases`
- `admin`: same broad visibility as team lead, plus privileged backend permissions

## Current limitations

- There is no admin UI yet for creating users, changing roles, or reassigning cases
- There is no case reassignment/admin workflow yet beyond direct Firestore data changes
- Firestore mode ignores `VITE_FORCE_USER_ROLE`; role comes from the Firestore user document
- Team leads currently operate at whole-org scope, not a narrower `teamId`

## Recommendation

Current setup is fine for dev, internal demos, and controlled pilot rollout.

Build an admin panel only when one of these becomes true:

- non-developers need to provision users regularly
- customer admins need to manage inspectors or assignments themselves
- case reassignment becomes a frequent operational workflow

Until then, the current seed/manual approach is simpler and lower risk.
