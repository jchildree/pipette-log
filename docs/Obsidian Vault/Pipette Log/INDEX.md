# Architectural Decision Records -- Pipette Log

| ADR | Title | Status | Affected Layers | Date |
|-----|-------|--------|-----------------|------|
| ADR-001 | Native iPad Client | DEPRECATED (superseded by ADR-008) | Client | 2026-07-22 |
| ADR-002 | Offline-First With Deferred Sync | ACCEPTED | Client · Backend | 2026-07-22 |
| ADR-003 | Backend Built as a Nexus App (Express + MSSQL, On-Prem) | ACCEPTED | Backend · Database | 2026-07-22 |
| ADR-004 | 6-Digit PIN Sign-Off Layered on Nexus Session Identity | ACCEPTED | Client · Backend | 2026-07-22 |
| ADR-005 | Regulated-Lite Record Integrity -- Immutable Signed Entries, Amend-Only Corrections | ACCEPTED | Backend · Database | 2026-07-22 |
| ADR-006 | Verification Type Model and Pass/Fail Calculation | ACCEPTED | Backend · Database · Client | 2026-07-22 |
| ADR-007 | Standalone Phase 1 Backend, Nexus-Shaped for Later Migration | ACCEPTED | Backend · Database | 2026-07-22 |
| ADR-008 | React Native / Expo Client (Supersedes ADR-001) | DEPRECATED (superseded by ADR-012) | Client | 2026-07-23 |
| ADR-009 | Three-Point (Low/Mid/High) Verification Per Entry | ACCEPTED | Backend · Database · Client | 2026-07-23 |
| ADR-010 | Per-Point Retry Attempt Tracking (tolerance_3pct only) | ACCEPTED | Backend · Database · Client | 2026-07-24 |
| ADR-011 | Multichannel (8-Channel) Entries and Repeater Tip Reference Data | ACCEPTED | Backend · Database · Client | 2026-07-24 |
| ADR-012 | Plain React + Vite Web Client, Nexus-Shaped (Supersedes ADR-008) | ACCEPTED | Client | 2026-07-24 |

**Status values:** PROPOSED | ACCEPTED | DEPRECATED
