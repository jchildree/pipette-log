# Master Plan -- Verification Workflow Scoping (2026-08-03)

Source: investigative-report session on 2026-08-03. Reference this file when asked "what's next."

## Scope decisions (locked)

- Attempt-cap / auto-out-of-service tracking applies **separately per pipette and per balance** -- not as a pipette+balance pair.
- Out-of-range toast stays **submit-time only** (existing gate covers it, no typing-time toast).
- "Failure" = an entry where any point reads `N` and wasn't explicitly accepted; granularity is **per entry**, not per point (all 3 points failing in one entry = 1 failure; 1 point failing = also 1 failure).
- Same `signed_by_user_id` may sign 2 consecutive failed entries for one equipment; a 3rd consecutive failure requires a different signer; if that 3rd entry also fails, the equipment auto-flips to `Out of Service`.
- Audit Log export/filter scope = **all** `entries` fields + joined `equipment`/`users` fields.
- Calibration-due email (#13) is **scope-only** -- do not build, it rolls in with the future Nexus migration.

## Status of originally-reported items

| # | Item | Status |
|---|---|---|
| 1 | Force accept/reverify before sign-off popup on out-of-range | **Closed** -- already fixed in commit `a981439` ("retry-popup fix"), 2026-07-30, before this session started. `SignOffForm.tsx:206-233` is the gate. |
| 5 | Decimal entry on verification page | **Not a bug** -- already works (`SignOffForm.tsx:384-394`, plain text input + `Number()`, no integer restriction). |
| 6 | QA review/edit of new DB fields | **Blocked** -- waiting on updated Access DB from Joanne. Revisit when it lands. |

## Sprint plan (ordered by dependency)

Each sprint sized to fit roughly a 100k-140k token execution context. Don't combine sprints across this line without re-checking size.

### Sprint 1 -- Equipment status foundation
Add `Out of Service` as a valid `equipment.status` value, app-layer only (no DB `CHECK` constraint -- `status` stays free-text `NVARCHAR(20)` since it's sourced from inventory import, `002_equipment.sql:17`). Wire into `EquipmentManager.tsx` dropdown + existing `PATCH /equipment/:id` validation.

### Sprint 2 -- Failure tracking backend (pipette + balance tracked separately)
- Per-point acceptance tracking on `entries` (schema addition -- exact shape TBD at implementation time: 3 bits vs. derived flag).
- Query: last N entries for a given `pipette_id`, and separately for a given `balance_id`, ordered by `created_at desc`.
- Consecutive-failure counter + same/different-`signed_by_user_id` gate, evaluated independently for the pipette side and balance side of each entry.
- Backend-only: routes, schema migration, integration tests. No frontend work in this sprint.
- Depends on: Sprint 1 (needs the `Out of Service` status value to write to).

### Sprint 3 -- Auto out-of-service + frontend surfacing
- Wire Sprint 2's 3rd-consecutive-failure case to auto-write `status = 'Out of Service'` on the relevant equipment (could be pipette, balance, or both in one entry).
- Frontend: toast for the "different user required" block (403), and a distinct toast/banner when equipment goes out of service mid-submit.
- Depends on: Sprint 2 complete and tested. Do not start concurrently with Sprint 2.

### Sprint 4 -- Verification page UX: picker filter + last-verification panel
- Filter pipette/balance/tip pickers in `SignOffForm.tsx` to `Active` status only (meaningfully includes excluding `Out of Service`, so sequence after Sprint 1/3).
- New `GET` endpoint for latest entry by `equipment_id` + small info panel next to the existing pipette-info card.
- No work needed for submit-time toast -- already covered by the existing gate (confirmed, not a gap).
- Depends on: Sprint 1 (status filtering), ideally Sprint 3 (out-of-service exclusion).

### Sprint 5 -- Equipment admin: inactive comment + tips CRUD
- Require a comment when `status` PATCHes to `Inactive` or `Out of Service` -- one validation line + one required-field UI toggle, same pattern as `noteRequired` in `SignOffForm.tsx:127`.
- Tips admin section: `tips` table already exists (`005_tips.sql`, no FK), needs a new `/tips` CRUD route + UI, reusing `EquipmentManager.tsx`'s existing add/edit/delete pattern -- don't build a separate abstraction.
- Depends on: Sprint 1.

### Sprint 6 -- Audit Log export: backend
New export endpoint covering all `entries` fields + joined `equipment`/`users` fields, with per-field range/filter query params (dates and numerics, not just text match).

### Sprint 7 -- Audit Log export: frontend
Column-picker UI + filter controls wired to Sprint 6's query params + export trigger. Kept separate from Sprint 6 because the filter/column-picker UI is its own real surface, not a bolt-on.
- Depends on: Sprint 6.

## Not scoped / not built

- **#13 -- calibration-due email**: needs a scheduled job reading `equipment.calibration_due_date` and a recipient list (QA + "applicable users," still undefined). Note the interface shape when the Nexus migration starts; don't stub it now.

## Open questions to resolve before each sprint starts

- Sprint 2: exact schema shape for per-point acceptance tracking (3 bits vs. derived flag) -- decide at implementation time, not before.
- Sprint 6/7: confirm exact list of `equipment`/`users` joined fields wanted in export vs. just `entries` columns, once Joanne's Access DB (item #6) lands and QA's new fields are known.
