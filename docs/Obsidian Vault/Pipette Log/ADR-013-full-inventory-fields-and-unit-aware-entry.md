# ADR-013: Full Inventory Field Set, Low Usage Reference Value, and Unit-Aware Sign-Off

**Project:** Pipette Log
Status: ACCEPTED
Date: 2026-07-24
Authors: Joseph Childree
Affected Layers: Backend · Database · Client

---

## Context

Stakeholder shared two updated source tabs on `Simple table.xlsx`: a cleaned real-inventory export ("Joanne's Cleaned Pipette DB", 138 rows, far more columns than the original `EQP` tab the schema was seeded from) and a "Repeater Dropdown" tab (5 rows) giving real low/mid/high targets per repeater tip -- the data `tips` (ADR-011) shipped empty pending. The `EQP` tab also gained a `Low usage` column: a possible future accuracy floor on pipette use, not yet spec'd. The repeater tab mixes µL and mL rows (large-volume tips recorded in mL, e.g. "5 mL" tip: Low 0.5 / Mid 2.5 / High 5), confirmed by stakeholder as legitimate -- not a data-entry error -- with the conversion 1µL=1mg, 1mL=1g holding throughout.

## Decision

| Aspect | Details |
|--------|---------|
| **Low Usage** | Stored only. `equipment.low_usage_ul` / `tips.low_usage_ul` added and seeded; shown as reference text next to the selected pipette/tip in `SignOffForm`. No gating/blocking logic -- the accuracy-floor rule itself isn't defined yet, building enforcement now would be guessed business logic. |
| **Inventory fields** | All of Joanne's Cleaned Pipette DB columns adopted onto `equipment`: `status`, `rack_number`, `serial_number`, `sub_location`, `last_calibration_date`, `mechanism`, `calibration_conducted_by`, `ranges_used`, `department`, `manufacturer`, `old_id`, `review_comment`, `adjustment_comment`, `comments_2`. Seeded from source data and shown in `EquipmentManager`'s list view. Not added to the manual "Add Pipette" form -- that form covers the fields a tech plausibly sets going forward (ID, category, range, cal date, low/mid/high, status, unit, low usage); the rest is bulk inventory metadata populated at seed time, matching how it entered the business today (spreadsheet, not one-by-one). |
| **Units** | Canonical storage/calc stays µL/mg everywhere it already is (`equipment.low_ul` etc, `entries.volume_*_ul`/`mass_*_mg`, `tolerance3pct`) -- not renamed. New `equipment.unit` / `tips.unit` (`'uL'` \| `'mL'`) is a display-only flag: `SignOffForm` labels Volume/Mass by the selected pipette/tip's unit and converts ×1000 at the input boundary before the canonical µL/mg payload is built. Same pattern as `category`'s existing role of driving client layout, not calc. |
| **Reseed** | `equipment`/`tips` schema changes land directly in phase-1 `sqlSchemas` (no migration layer -- no production data yet, same precedent as ADR-009/010/011). Seed scripts extended for the new columns; `tips` gets its first real seed data via a new `seed-tips.js`, same shape as `seed-equipment.js`. |

Not chosen: renaming `mass_mg`/`volume_ul` columns to be unit-generic. Rejected -- canonical-unit storage with display-side conversion is a smaller, well-contained change; a genuine unit-generic schema would touch every table/route/type that currently assumes µL/mg for no functional gain.

Not chosen: building the Low Usage accuracy-floor check now. Rejected -- no confirmed rule (hard block vs warning vs manual-only flag) exists yet; would be invented business logic.

## Consequences

| Positive | Negative |
|----------|----------|
| `tips` finally has real data -- repeater flow (ADR-011) is actually usable, not just built | `equipment` gains 16 new columns, most write-only from seed (no UI to edit them post-seed) |
| mL tips display correctly to the tech (0.5 mL, not 500 µL) without touching calc/storage | `SignOffForm` needs unit-aware label/conversion logic it didn't have before |
| Low Usage value preserved for whenever the accuracy-floor rule gets defined | Low Usage sits unused in the UI beyond a reference line until that rule lands |

## Implementation Notes

Source data (`Simple table.xlsx` EQP + Joanne's Cleaned Pipette DB + Repeater Dropdown tabs) parsed externally into `equipment.json`/`tips.json`, same manual-script precedent as the original `seed-equipment.js` (`Not part of the app runtime`).

## Related ADRs
- ADR-011: `tips` table this seeds for the first time; `category` client-branching pattern `unit` reuses
- ADR-009: `entries` low/mid/high columns whose µL/mg canonical shape is preserved unchanged
- ADR-006: tolerance_3pct formula, unaffected -- still operates on canonical µL/mg
