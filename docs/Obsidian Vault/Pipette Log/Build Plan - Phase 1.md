# Pipette Log -- Phase 1 Build Plan

Synthesized 2026-07-22 from ADR-001 through ADR-007 plus the six spec-interrogation resolutions in `docs/Obsidian Vault/The Question/Case - Pipette Log Spec Interrogation.md`. Every decision below traces to a specific ADR or Source note -- no invented behavior.

## Critique of the Source Material

- **Strong:** ADR-005/006 are unusually precise for a lab digitization project -- amend-only correction chain and an exact tolerance formula are both nailed down, which is the hardest part to retrofit later. Build on these first; they're load-bearing for the schema.
- **Risk surfaced by interrogation, not by the ADRs themselves:** ADR-003/004 assumed Nexus (LDAP, `@il/db`) was available from day one. It wasn't -- the standalone-phase decision (ADR-007) means phase 1 has *two* auth implementations across its lifetime (local now, LDAP later) and an undesigned identity-mapping step at migration. This is accepted debt, not a gap to close now, but the migration step needs its own spike before phase 1 accumulates real signed records, since signed records are immutable (ADR-005) and can't be silently remapped.
- **Still genuinely open, correctly deferred:** PIN hashing scheme and PIN-guess rate-limiting (ADR-007 Implementation Notes) are unresolved. These are phase-1-blocking in practice even though ADR-007 marks them "not phase-1-blocking" -- a PIN-only auth model with no throttle is a real guessing-attack surface. Recommend resolving before backend implementation, not after.
- **One inconsistency to watch:** ADR-002's "live sync is default, queue is fallback" plus the new phase-1 "PIN is the entire auth event, no session" combine into a subtle requirement -- a queued offline write must carry the signing tech's username+PIN *at time of entry*, and the drain (single POST per entry, per interrogation) must replay that same credential later, not re-prompt. If the PIN is re-validated at drain time against a since-changed PIN, a legitimately-signed offline entry could fail to sync. Recommend: **validate PIN once, at moment of signing (online or offline), and store the entry as already-signed in the local queue** -- drain is then just a network retry of an already-authorized write, never a second auth event. Not decided anywhere in the ADRs; flagging as a build-time decision, not re-opening the interrogation for it since it follows mechanically from what's already locked.

## Atomic Blueprint

Grouped by layer; each block is independently buildable and independently testable. Dependencies noted where they exist.

### 1. Database (`PipetteLog` MSSQL, standalone phase 1 -- ADR-007)

```
users        (id, username UNIQUE, pin_hash, created_at)
balances     (id, name, location, ... -- reference data, PipetteLog-owned per interrogation)
pipettes     (id, pipette_number, min_range, max_range, ... -- reference data, PipetteLog-owned)
entries      (id, pipette_id FK, balance_id FK, verification_type ENUM('tolerance_3pct','manufacturer_spec','after_external_cal'),
              volume_ul, mass_mg, pass_fail ENUM('Y','N') NULL,
              note TEXT NULL,  -- required at app layer for manufacturer_spec/after_external_cal
              signed_by_user_id FK, signed_at TIMESTAMP NULL,
              corrects_entry_id FK NULL -- self-referencing, ADR-005
              created_at, updated_at)
```
- `entries` is insert-only once `signed_at` is set (app-layer enforced minimum, per ADR-005). Pre-sign, freely mutable (locked-in interrogation answer).
- Corrections are new rows with `corrects_entry_id` pointing at the original; both remain queryable (ADR-005). "Current state" of an entry = latest row in its correction chain.
- No ORM, raw SQL under `sqlSchemas/`, matching Nexus convention exactly (ADR-003/ADR-007).

### 2. Backend (standalone Express, phase 1 -- ADR-007)

Stateless, no session middleware, no token issuance -- every write endpoint takes `username` + `pin` in the body and validates fresh (locked-in auth model).

```
POST /api/entries              body: {username, pin, pipette_id, balance_id, verification_type, volume_ul, mass_mg, note?}
                                -> validates pin_hash match; computes pass_fail server-side if tolerance_3pct
                                   (0.97*volume_ul <= mass_mg <= 1.03*volume_ul -> Y else N); else pass_fail from body (manual)
                                -> rejects if verification_type in (manufacturer_spec, after_external_cal) and note is empty
                                -> sets signed_at = now(); rejects any further UPDATE to this row at the route layer

POST /api/entries/:id/correct  body: {username, pin, ...same fields, note (required, always)}
                                -> inserts new row with corrects_entry_id = :id, never touches original

GET  /api/balances             reference data, cacheable client-side
GET  /api/pipettes             reference data, cacheable client-side
GET  /api/entries/:id/history  original + full correction chain, for audit view
POST /api/users/setup          body: {username, pin} -- first-login self-service PIN set (ADR-007)
```
- Tolerance formula is a pure function, unit-testable in isolation against the four cases already pinned (97→Y, 96.9→N, 103→Y, 103.1→N).
- No batch endpoint -- offline drain reuses `POST /api/entries` per queued item (locked-in interrogation answer).

### 3. Client (native SwiftUI, iPad -- ADR-001)

- **Sign-off UI**: username dropdown (populated from `users`) + PIN field. This single screen *is* the auth event for every entry (no separate login screen anywhere in the app).
- **Network state**: `NWPathMonitor` observes connectivity (locked-in). Online -> POST directly. Offline -> PIN is still validated and the entry is still marked signed *locally* at time of entry (per the build-time decision above, closing the drain-revalidation gap) -- write goes into a local queue (Core Data/SQLite) as an already-authorized record.
- **Auto-drain**: on `NWPathMonitor` transition to reachable, iterate the local queue, POST each queued entry once, remove from queue on 2xx, leave in queue and surface an error on failure (don't silently drop).
- **Reference data cache**: balances/pipettes cached locally at each successful fetch; staleness surfacing to the user is still an open ADR-002 item -- out of scope for phase 1 unless explicitly requested.
- **Form logic**: verification_type selection drives Notes-field required/optional and Pass/Fail computed-display-vs-editable-input, per ADR-006.

### 4. Deferred / explicitly out of scope for phase 1

- LDAP integration, `@il/auth`, `@il/db` -- migration-time work (ADR-007).
- Identity-mapping spike (local `users` row -> Nexus LDAP identity) -- must happen before migration, not before phase 1 ships.
- Reference-data staleness UX (ADR-002 open item) -- unresolved, not blocking.
- Manufacturer-spec/after-external-cal Pass/Fail automation -- explicitly manual-only in v1 (ADR-006).

## Deterministic Contract Checklist

Every phase-1 write is reproducible from these fixed rules -- no runtime ambiguity:
- [x] Tolerance formula: `0.97*volume_ul <= mass_mg <= 1.03*volume_ul` -> Y, else N (inclusive bounds)
- [x] Sign-off = username + PIN, validated per request, no session state
- [x] Immutability boundary = `signed_at IS NOT NULL`
- [x] Corrections = new row + `corrects_entry_id`, original never mutated
- [x] Notes required iff `verification_type IN (manufacturer_spec, after_external_cal)`
- [x] Offline queue holds already-signed entries; drain is retry, not re-auth

## Related
[[Case - Pipette Log Spec Interrogation]]
