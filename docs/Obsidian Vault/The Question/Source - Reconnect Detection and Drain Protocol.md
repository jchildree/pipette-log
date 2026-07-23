---
id: spiffe://pipette-log/spec-interrogation/source/reconnect-drain
asserted: "Client uses NWPathMonitor for reconnect detection, draining queue via one POST per entry against the existing /api/verifications endpoint (no batch endpoint)"
source: user
method: observed
confidence: unverified
verify: "confirm client code registers an NWPathMonitor callback and drain path reuses the live single-entry POST route"
---

# Reconnect Detection and Drain Protocol

Closes ADR-002's open "reconnect-detection mechanism" question. User accepted recommendation: `NWPathMonitor` (native path-monitor callback, no polling) triggers drain. Drain shape: one POST per queued entry against the same endpoint the live path uses -- no separate batch endpoint, so a single bad row in the queue doesn't block the rest.

## Related
[[Case - Pipette Log Spec Interrogation]]
