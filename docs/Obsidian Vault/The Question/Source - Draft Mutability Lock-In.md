---
id: spiffe://pipette-log/spec-interrogation/source/draft-mutability
asserted: "Unsigned drafts (mid-entry or queued offline) are freely editable. Immutability begins exactly at PIN sign-off, no intermediate locked-for-review state."
source: user
method: quoted
confidence: corroborated
verify: "confirm entry table has no status column between draft and signed; UPDATE allowed pre-signed_at, blocked post-signed_at"
---

# Draft Mutability Lock-In

Confirms ADR-005's own "current reading" as final, closing its one open question. No new workflow step invented -- matches paper form's single fill-then-sign motion.

## Related
[[Case - Pipette Log Spec Interrogation]]
