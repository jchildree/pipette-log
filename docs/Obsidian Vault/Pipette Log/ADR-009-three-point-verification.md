# ADR-009: Three-Point (Low/Mid/High) Verification Per Entry

**Project:** Pipette Log
Status: ACCEPTED
Date: 2026-07-23
Authors: Joseph Childree
Affected Layers: Backend · Database · Client

---

## Context

ADR-006 modeled each entry as a single Volume/Mass/Pass-Fail measurement. The stakeholder-provided mockups (`Draft_digital pipette log.pptx` slide 3 annotated, and a follow-up screenshot of the same slide) show the Volume/Mass/Pass columns holding three stacked values per verification event -- annotated explicitly as "Low", "Mid", "High" (items 5/6/7), sourced from `Simple table.xlsx`'s Low/Mid/High columns (already captured on `equipment` per ADR-008's migration). The formula note (item 1: `0.970*Volume ≤ Mass ≤ 1.030*Volume`) is stated per volume/mass pair, confirming it applies at each of the three points independently, not once per entry.

## Decision

One sign-off event (one row in `entries`, one `signed_at`/`signed_by_user_id`/note) captures three volume/mass/pass triplets -- low, mid, high -- instead of one.

| Aspect | Details |
|--------|---------|
| **Approach** | `entries` gets three volume/mass/pass column sets (`*_low_ul`/`*_mid_ul`/`*_high_ul` etc.) replacing the single `volume_ul`/`mass_mg`/`pass_fail` columns. All three verification types use the same three-slot shape; for `tolerance_3pct` each point's pass/fail is computed server-side from that point's volume/mass, for `manufacturer_spec`/`after_external_cal` each point's pass/fail stays a manual Y/N (per ADR-006, "would follow same logic" per the annotated slide). Client pre-fills each point's Volume input from the selected pipette's `low_ul`/`mid_ul`/`high_ul` (editable, since the deck marks these with `*` -- order/exact values not fully fixed). |
| **Rationale** | Real-world pipette verification checks accuracy across the instrument's range, not at one arbitrary point -- confirmed as the actual stakeholder requirement, not a UI preference. |
| **Trade-offs** | Gain: matches how the equipment is actually calibrated and what the stakeholder mockup specifies. Lose: one entry row now carries 9 measurement columns instead of 3; corrections (ADR-005) still correct the whole event as one row, so a correction to one point's reading requires resubmitting all three. |

Not chosen: three separate `entries` rows per sign-off event (one per point) -- rejected because a single sign-off/note/timestamp covers all three points together, and ADR-005's correction chain is simpler against one row per event than three linked rows that would need to move together.

## Consequences

| Positive | Negative |
|----------|----------|
| Matches the actual calibration procedure (accuracy checked across the range, not once) | Wider entries table (9 measurement columns vs. 3) |
| Still one signature/note/correction-chain per verification event | Client form and API payload both got more complex (3 volume/mass/pass groups instead of 1) |

## Implementation Notes

Schema, routes, and both client/server code built under ADR-006's single-point assumption were reworked in the same pass as this ADR (no separate migration step -- phase 1 has no production data yet, so `sqlSchemas/003_entries.sql` was edited in place rather than layered as a migration).

## Related ADRs
- ADR-006: verification type model this extends (three verification types unchanged; only the measurement shape per entry changes)
- ADR-005: immutability/correction rules, unchanged -- still apply to the whole entry row
- ADR-008: equipment table (low_ul/mid_ul/high_ul) this entry shape reads its default volumes from
