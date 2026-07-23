# ADR-002: Offline-First With Deferred Sync

**Project:** Pipette Log
Status: ACCEPTED
Date: 2026-07-22
Authors: Joseph Childree
Affected Layers: Client · Backend

---

## Context

Verification entries happen at the bench, where iPad network connectivity is not guaranteed. Reference data needed to fill out a form (balance list, pipette list + ranges, per ADR-003) lives centrally, and the pass/fail record itself must eventually land in the central database.

## Decision

The iPad app must be usable with no network connection at the point of use, caching reference data locally and queuing writes for later sync.

| Aspect | Details |
|--------|---------|
| **Approach** | Sync defaults to live: writes (verification entries) and reference-data reads go straight to the REST API (ADR-003) over the network when connectivity is present. Local on-device store (Core Data/SQLite) caches balance/pipette reference tables and holds unsynced entries in a write queue *only* as the fallback path -- entered automatically when the network is down, and drained automatically once connectivity returns. |
| **Rationale** | User confirmed the app "must work offline, sync later" -- live connectivity at the bench is not guaranteed. Updated 2026-07-22: live sync is the default mode, not merely one option among equals; local queueing is explicitly the degraded-network fallback, not the primary path. |
| **Trade-offs** | Gain: techs are never blocked from logging a verification, and the common case (network up) writes straight to the central DB with no queue latency. Lose: sync conflict handling, staleness of cached reference data, and a window where a signed entry exists only on-device become real engineering problems that must be solved. |

Not chosen: requiring live connectivity at all times -- rejected explicitly by the user because it would block entry when the network drops. Also not chosen: local-first/queue-always (writing to the local queue even when online, syncing on a delay regardless of connectivity) -- rejected because it adds latency and staleness risk for the common case where the bench has a live connection.

## Consequences

| Positive | Negative |
|----------|----------|
| Bench workflow never stalls on network availability | Requires conflict-resolution and retry logic for the sync queue |
| Reference data (balances/pipettes) available even mid-outage | Cached reference data can go stale between syncs -- needs a refresh/staleness policy |
| Common case (network up) gets live writes with no queue latency | App needs reliable online/offline detection to decide live-vs-queue path, and to trigger auto-drain on reconnect |

## Implementation Notes

Client must detect network state and switch paths: online → call REST API (ADR-003) directly; offline → write to local queue, then auto-flush the queue against the REST API as soon as connectivity is detected again.

Open questions to resolve before implementation (not decided in this session -- flag for a follow-up ADR or spike):
- Sync protocol/transport against the Express/MSSQL REST backend from ADR-003 (poll vs push, delta sync, reconnect-detection mechanism).
- How staleness of the local balance/pipette cache is surfaced to the user, given that entries are signed off (ADR-005) against potentially outdated reference ranges.
- Conflict policy if the same entry is somehow modified in two places (unlikely given amend-only records in ADR-005, but the reference-data cache itself can still drift).

## Related ADRs
- ADR-001: native iPad client this sync layer runs inside
- ADR-003: backend/API and reference data this syncs against
- ADR-005: record immutability rules that constrain what "sync" is allowed to overwrite
