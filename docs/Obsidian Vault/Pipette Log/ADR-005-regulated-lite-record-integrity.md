# ADR-005: Regulated-Lite Record Integrity -- Immutable Signed Entries, Amend-Only Corrections

**Project:** Pipette Log
Status: ACCEPTED
Date: 2026-07-22
Authors: Joseph Childree
Affected Layers: Backend · Database

---

## Context

Pipette Log replaces a physical calibration/verification logbook -- a record type that historically needs to withstand audit. User confirmed this needs regulated record-keeping intent, but explicitly **not** full 21 CFR Part 11 formality. User also confirmed that when a signed entry needs correction, the fix must be an appended correction record, not an edit to the original.

## Decision

Once an entry is signed (PIN, per ADR-004), it becomes immutable. Corrections are new records that reference the original, not in-place edits.

| Aspect | Details |
|--------|---------|
| **Approach** | An entry row is write-once after sign-off. A correction is a new row with a `corrects_entry_id` (or equivalent) foreign key back to the original, its own timestamp, its own PIN sign-off, and required note text explaining the correction. Both the original and every correction remain visible in the entry's history. |
| **Rationale** | User explicitly chose "amend-only: append a correction record" over "void + re-enter," to preserve full history without implying the original was deleted or replaced. |
| **Trade-offs** | Gain: complete audit trail, no silent edits, matches the regulated-lite intent without building full Part 11 machinery (no requirement here for things like independent witness signatures or validated software lifecycle docs). Lose: schema and UI both need to represent "an entry plus its correction chain" rather than a single flat row -- more complex than plain CRUD. |

Not chosen: full 21 CFR Part 11 compliance (explicitly ruled out by user -- not formally required). Not chosen: void + re-entry (rejected in favor of amend-only).

## Consequences

| Positive | Negative |
|----------|----------|
| Original data is never lost or silently altered | Every read of "the current state of an entry" must resolve the correction chain, not just SELECT the row |
| Audit trail is a natural byproduct of the data model, not bolted on | Reporting/export logic must decide how to represent superseded vs. current values |

## Implementation Notes

Applies at the database layer in the `PipetteLog` DB (ADR-003): entry table should be insert-only once signed (no UPDATE on signed fields at the application layer; enforce via app logic at minimum, DB trigger/permissions if stronger guarantee is wanted later).

Open question (not decided this session): whether unsigned, in-progress entries (before PIN sign-off, e.g. drafts sitting in the offline queue from ADR-002) are also immutable, or only become so at the moment of signing. Current reading: only signed entries are immutable -- drafts can be freely edited before sign-off.

## Related ADRs
- ADR-004: PIN sign-off that triggers immutability
- ADR-006: pass/fail data this immutability rule protects
