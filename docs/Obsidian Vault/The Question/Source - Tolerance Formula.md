---
id: spiffe://pipette-log/spec-interrogation/source/tolerance-formula
asserted: "For tolerance_3pct: Pass (Y) iff 0.97*Volume <= Mass <= 1.03*Volume, else Fail (N). Direct 1:1 mg-to-uL comparison, no density/temperature correction table."
source: user
method: quoted
confidence: corroborated
verify: "unit test: Volume=100, Mass=97 -> Y; Mass=96.9 -> N; Mass=103 -> Y; Mass=103.1 -> N"
---

# Tolerance Formula

Closes ADR-006's explicit "do not guess" flag. Formula is direct comparison, Mass (mg) against Volume (uL) at a fixed 1:1 ratio -- no density/water-temperature correction table implied or requested. Bounds are inclusive (<=, not <).

## Related
[[Case - Pipette Log Spec Interrogation]]
