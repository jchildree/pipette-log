# ADR-006: Verification Type Model and Pass/Fail Calculation

**Project:** Pipette Log
Status: ACCEPTED
Date: 2026-07-22
Authors: Joseph Childree
Affected Layers: Backend · Database · Client

---

## Context

The paper form (`basic_digital pipette log.pptx`, slides 1-2) offers three checkboxes under "Verification Type": ±3% Tolerance, Manufacturer specifications, and After External Calibration. Slide annotations: type 1 (±3% Tolerance) "will be selected 99.9999% of the time"; type 2 (Manufacturer specifications) is "rarely selected and will need case by case logic -- lower priority ... could force manual entry initially"; type 3 (After External Calibration) note 8 originally read as a modifier flag, but the user clarified it is a distinct checkbox requiring its own note. Pass/Fail (per slide note on item 4/7/8) is derived from Verification Type + Volume (µL) + Mass (mg).

## Decision

Model Verification Type as three mutually exclusive options. Only ±3% Tolerance gets automated Pass/Fail calculation in v1; the other two are manual-entry Pass/Fail with a required note.

| Aspect | Details |
|--------|---------|
| **Approach** | `verification_type` is a single-select enum: `tolerance_3pct` \| `manufacturer_spec` \| `after_external_cal`. Selecting `manufacturer_spec` or `after_external_cal` requires a non-empty note (Notes field, slide item 7). Pass/Fail: for `tolerance_3pct`, computed automatically from Volume/Mass against the pipette's range; for `manufacturer_spec` and `after_external_cal`, Pass/Fail is a manual Y/N field entered by the tech. |
| **Rationale** | User confirmed Manufacturer spec is manual-only for v1 (rare, case-by-case, no fixed formula). User confirmed After External Calibration should be treated the same way -- manual entry -- rather than reusing the ±3% formula. User confirmed types 2 and 3 both require an accompanying note, correcting an earlier reading of the slide (item 8) that treated "After External Calibration" as a flag rather than a full third option. |
| **Trade-offs** | Gain: v1 ships with exactly the automation that has a well-defined rule (±3% tolerance), avoiding a guessed formula for the other two cases. Lose: two of three verification paths require manual Pass/Fail judgment from the tech, same as paper -- no automation gain there in v1. |

Not chosen: automating Pass/Fail for "After External Calibration" using the same ±3% rule -- explicitly rejected by the user in favor of manual entry, matching Manufacturer spec's treatment. Not chosen: modeling "After External Calibration" as a boolean flag alongside a 2-value verification type -- rejected once the user clarified it is a distinct, third checkbox with its own required note.

## Consequences

| Positive | Negative |
|----------|----------|
| No invented tolerance formula for cases where none was specified | Two of three verification types get no Pass/Fail automation in v1 -- a stated future-automation candidate (per slide: "could force manual entry initially," implying automation may come later) |
| Required-note enforcement for types 2/3 preserves the audit context the paper form's blank Notes box captured informally | UI must conditionally show/require the Notes field and switch Pass/Fail from computed-display to editable input based on verification type |

## Implementation Notes

The ±3% Tolerance auto-calculation needs the pipette's valid range (populated from Pipette Number per slide item 4, editable) plus the entered Volume/Mass pair(s) -- exact tolerance formula (how Mass converts to expected Volume, what counts as "within 3%") was not specified this session and must be confirmed with the source SOP/reference before implementation; do not guess it from the slide alone.

Signed Pass/Fail values (whether computed or manual) become immutable per ADR-005 once the entry is signed.

## Related ADRs
- ADR-005: immutability rules this Pass/Fail value falls under once signed
