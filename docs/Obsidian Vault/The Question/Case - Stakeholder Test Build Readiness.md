---
id: spiffe://pipette-log/stakeholder-test-build/finding/case
asserted: "App builds cleanly but is missing pieces needed to hand a working instance to stakeholders outside Nexus"
source: user
method: observed
confidence: verified
---

# Case - Stakeholder Test Build Readiness

**Status:** Open

## Symptom
Faceless review (functionality + buildability only, not data correctness) of the ADR-013 branch found the app builds and runs, but has no path for a stakeholder to actually get a working login or a hosted instance without hand-holding.

## Findings (ranked, from review)

1. 🔴 No client UI for `POST /users/setup` (`backend/src/routes/users.js:14`) -- no way to create a username/PIN outside manual curl.
2. 🔴 No root README / docker-compose -- DB setup is a manual `docker run` + `sqlcmd` loop (`backend/README.md:3-21`).
3. 🟡 `AuditLog.tsx:20-22,128,149` hardcodes µL/mg display, ignoring per-entry `unit` (ADR-013) -- inconsistent with SignOffForm.
4. 🟡 `client/src/api.ts:3` -- `VITE_API_URL` baked in at `vite build` time, no doc step for setting it per deploy target.
5. 🔵 nit: `cors()` wide open, no `/health` route.
6. 🔵 nit: README's placeholder DB password doesn't match `.env.example`'s blank default.

## Decisions locked (interrogate-spec)

- **#1 fix** -- new self-serve "Sign Up" tab in `App.tsx` (4th tab), posts straight to `/users/setup`. No admin gate -- matches a test build anyone with the URL can use. [[Source - Phase 1 Auth Model]]
- **#2 fix** -- `docker-compose.yml` for SQL Server + schema apply only. Backend/client stay `npm run` (documented in a new root `README.md`). Rejected full 3-service containerization -- disproportionate for a single npm-run deploy target.
- **#3 fix** -- pure client-side fix, no backend change: `AuditLog.tsx` already calls `fetchPipettes()` and holds `pipettes` state, map `entry.pipette_id` → `pipette.unit` and reuse `SignOffForm`'s `toDisplay` conversion. Decided by codebase inspection, not asked.
- **#4 fix** -- docs-only: README step "set `VITE_API_URL` in `client/.env` before `npm run build`" for the target host. Rejected runtime `config.json` fetch as more moving parts than a single-instance test deploy needs.
- **#5/#6** -- no judgment call, straight fixes, no interrogation needed.

## Execution plan (criticality order)

| # | Item | Files touched | Depends on |
|---|------|---------------|------------|
| 1 | Sign Up tab + `POST /users/setup` wiring | `client/src/App.tsx`, new `client/src/screens/SignUp.tsx`, `client/src/api.ts`, `client/src/types.ts` | none |
| 2 | `docker-compose.yml` (SQL Server + schema apply) + root `README.md` | new `docker-compose.yml`, new root `README.md` | none |
| 3 | AuditLog unit-aware display | `client/src/screens/AuditLog.tsx` | none (reuses SignOffForm's existing `toDisplay`, likely hoist it to a shared util) |
| 4 | `VITE_API_URL` deploy doc step | root `README.md` (folds into #2's doc) | #2 |
| 5 | `cors()` scoping + `/health` route | `backend/src/server.js` | none |
| 6 | README/.env.example password consistency | `backend/README.md` or `.env.example` | none |

[[Investigation Board Index]]
