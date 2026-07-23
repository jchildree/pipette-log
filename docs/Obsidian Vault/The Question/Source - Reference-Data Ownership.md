---
id: spiffe://pipette-log/spec-interrogation/source/reference-data-ownership
asserted: "PipetteLog DB owns balance/pipette reference tables directly, for now -- not pulled from apps/asset-manager or apps/instrument-status"
source: user
method: observed
confidence: unverified
verify: "confirm no cross-app FK/read exists to asset-manager or instrument-status in apps/pipette-log/sqlSchemas/"
---

# Reference-Data Ownership

Closes the open question in ADR-003 (Implementation Notes) about whether `apps/asset-manager` or `apps/instrument-status` already own balance/pipette data. User decision: PipetteLog owns it directly, for now -- no cross-app dependency in v1. "For now" flagged as scoped, not permanent.

## Related
[[Case - Pipette Log Spec Interrogation]]
