# ADR-010: Per-Point Retry Attempt Tracking (tolerance_3pct only)

**Project:** Pipette Log
Status: ACCEPTED
Date: 2026-07-24
Authors: Joseph Childree
Affected Layers: Backend · Database · Client

---

## Context

Stakeholder feedback: techs currently redo a failed low/mid/high point silently and re-measure until it passes -- no record of the failed attempt(s) survives to the paper log today. Managers confirmed this happens but could not describe a formal process for it. Grilled the stakeholder directly (2026-07-24) to convert "apparently they do something, not formalized" into a concrete spec:

- Applies to `tolerance_3pct` only. `after_external_cal` pass/fail stays manual (ADR-006) with no computed retry trigger; `manufacturer_spec` is being removed from the client per the same stakeholder update (separate change, not covered by this ADR).
- Retry is scoped per-point (low/mid/high), not per-entry -- a tech re-measuring a bad mid point doesn't need to redo low/high.
- On multichannel entries (8 channels × 3 points), retry applies independently per channel/point pair -- same data shape reused, no special-casing.
- No hard cap on attempt count for v1.
- Attempts stay locked once the entry is signed (ADR-005 amend-only correction model, no exception).

## Decision

When a `tolerance_3pct` point's computed pass_fail is `N`, the client auto-adds a new attempt row for that point instead of overwriting the failed reading. Each point on an entry now holds an ordered list of attempts instead of a single volume/mass/pass triplet; the last attempt in the list is the one that counts toward the entry's overall pass/fail.

| Aspect | Details |
|--------|---------|
| **Data model** | New `entry_point_attempts` table: `id`, `entry_id`, `point_key` (low/mid/high), `channel` (1-8, null for single-channel), `attempt_number`, `volume_ul`, `mass_mg`, `pass_fail`, `created_at` (server-assigned). `entries` table keeps only the final (passing) triplet per point per ADR-009's existing columns, unchanged -- attempts are additive history, not a replacement of that shape. |
| **Trigger** | Client computes pass_fail same as ADR-006/009 tolerance formula; on `N`, auto-spawns a new attempt input for that point/channel instead of blocking submission. Tech can keep retrying until pass, no cap. |
| **Scope** | Per point, per channel independently. A multichannel entry's channel 3 low point can have 3 attempts while every other point/channel passes on attempt 1. |
| **PIN/signature** | None per attempt. Sign-off PIN (ADR-004) stays entry-level, applied once at final submission -- re-signing per failed attempt was explicitly rejected as workflow friction with no benefit. |
| **Timestamp** | Captured automatically server-side on save, not tech-entered. |
| **Verification type scope** | `tolerance_3pct` only. `after_external_cal` has no computed pass/fail to trigger a retry, stays single manual entry per point. |
| **UI** | Attempt history collapsed by default under the passing row, expandable via a small chip ("▸ N attempts"), to keep the 8-channel table scannable. |
| **Immutability** | Attempts lock at sign-off along with the rest of the entry (ADR-005). No separate correction path for attempt history -- an amend-only correction to the entry corrects the whole event, attempts included. |

Not chosen: capturing only an attempt *count* instead of full per-attempt data (rejected -- stakeholder wants the actual failed readings, not just a number, since a pattern of near-misses vs. wild misses means different things for equipment service decisions). Not chosen: a hard retry cap with escalation (rejected for v1 -- no formal threshold exists yet; revisit once attempt-count data exists to inform one).

## Consequences

| Positive | Negative |
|----------|----------|
| Captures real failure data for the first time -- basis for a future "flag equipment after N failed attempts" feature once a threshold is defined | New child table + one-to-many join the client/API didn't previously need to handle |
| Doesn't disrupt `after_external_cal` manual flow or multichannel point/channel shape | Entry submission payload grows (array of attempts per point/channel instead of one triplet) |
| No added PIN friction per retry | UI needs new expand/collapse affordance not present in current `SignOffForm.tsx` table |

## Implementation Notes

Depends on the multichannel (8-table) and manufacturer-tolerance-removal changes landing first, since retry's per-channel scope and `tolerance_3pct`-only trigger both assume that shape exists. No production data yet, so `entry_point_attempts` can be added directly to phase-1 schema rather than as a layered migration (same precedent as ADR-009).

## Related ADRs
- ADR-009: three-point verification shape this extends -- `entries` keeps its final low/mid/high columns unchanged, attempts are additive
- ADR-006: verification type model -- retry trigger only applies to the `tolerance_3pct` computed-pass-fail path
- ADR-005: immutability/correction rules -- attempts lock with the rest of the entry, no exception
- ADR-004: PIN sign-off -- stays entry-level, not per-attempt
