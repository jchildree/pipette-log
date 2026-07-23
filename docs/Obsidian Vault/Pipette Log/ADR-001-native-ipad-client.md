# ADR-001: Native iPad Client

**Project:** Pipette Log
Status: ACCEPTED
Date: 2026-07-22
Authors: Joseph Childree
Affected Layers: Client

---

## Context

Pipette Log digitizes a paper pipette-verification form (see `basic_digital pipette log.pptx`, slide 2) used at the bench by lab techs. The form is filled by hand, one entry per verification event, immediately after weighing on a balance. The device of record will be an iPad.

## Decision

Build the client as a native Apple app (Swift/SwiftUI) rather than a cross-platform framework or a mobile web app.

| Aspect | Details |
|--------|---------|
| **Approach** | Native SwiftUI app targeting iPadOS. |
| **Rationale** | Deployment target is iPad exclusively -- no Android/desktop requirement exists today. Native gives the most robust and user-friendly bench experience (form entry, camera/scanner integration if added later, offline storage) with first-class platform support from Apple, without the cross-platform runtime overhead of React Native/Flutter. |
| **Trade-offs** | Gain: best performance and platform integration, smallest number of moving parts for a single-platform target. Lose: if Android/desktop support is ever needed, this is a second codebase, not a shared one. |

Not chosen: React Native / Flutter (cross-platform) -- rejected because there is no current multi-platform requirement, and native was the requested criterion ("robust and user friendly ... Apple native, as we will be using iPads"). Not chosen: mobile web app -- rejected because it complicates the offline-first requirement (see ADR-002) and PIN sign-off UX.

## Consequences

| Positive | Negative |
|----------|----------|
| Best-in-class iPad UX and platform integration | Locked to Apple's ecosystem; no path to Android without a rewrite |
| Simpler offline storage story (Core Data / SQLite on-device) | Requires Swift/iOS expertise on the team going forward |

## Implementation Notes

Client lives outside the `nexus` monorepo's `apps/*/client` Vite convention (that pattern is for web clients). This app talks to its backend purely over the API defined in ADR-003 -- no shared frontend code with other Nexus apps is expected.

## Related ADRs
- ADR-002: offline-first sync strategy this client depends on
- ADR-003: backend/API this client talks to
