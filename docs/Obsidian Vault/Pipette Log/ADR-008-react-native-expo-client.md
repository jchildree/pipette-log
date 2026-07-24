# ADR-008: React Native / Expo Client (Supersedes ADR-001)

**Project:** Pipette Log
Status: DEPRECATED (superseded by ADR-012)
Date: 2026-07-23
Authors: Joseph Childree
Affected Layers: Client

---

## Context

ADR-001 committed to a native Swift/SwiftUI iPad app. That decision assumed development would happen on a Mac with Xcode. In practice, the development environment for this project is Windows, with no Mac/Xcode access. Native SwiftUI cannot be authored, compiled, or verified at all under that constraint -- it is a hard blocker, not a workflow inconvenience.

## Decision

Rebuild the client target as React Native via Expo instead of native SwiftUI.

| Aspect | Details |
|--------|---------|
| **Approach** | React Native (TypeScript) client, built and iterated on with Expo tooling. iOS binary production and code signing go through Expo's EAS Build cloud service rather than a local Xcode toolchain. |
| **Rationale** | Expo/EAS is the only realistic path to shipping a real iPadOS binary (not a web app) from a Windows-only dev environment -- EAS performs the iOS build and signing remotely, so a local Mac is never required, including for final builds. |
| **Trade-offs** | Gain: Windows-native day-to-day development, no Mac dependency anywhere in the pipeline, still ships a real installable iPad app (not a PWA). Lose: cross-platform runtime overhead ADR-001 explicitly avoided; JS/RN expertise required instead of Swift; EAS cloud build introduces a network/service dependency and (for iOS specifically) Apple Developer account + EAS credentials management. |

Not chosen: staying native SwiftUI -- rejected because it is simply not buildable in the actual dev environment. Not chosen: Flutter -- also cross-platform and Windows-dev-friendly, but Flutter's iOS build still generally expects a local Mac/Xcode step that EAS avoids for React Native; Expo was judged the more complete "never need a Mac" path. Not chosen: web app / PWA -- rejected because it was the explicitly-rejected option in ADR-001 for the same reasons (offline-first + PIN sign-off UX) and those reasons haven't changed.

## Consequences

| Positive | Negative |
|----------|----------|
| Fully Windows-native development and build pipeline (via EAS) | Loses native SwiftUI's platform-integration ceiling (ADR-001's stated advantage) |
| Still ships a real installable iPad binary, not a browser app | New dependency on Expo/EAS as a build service (account, quotas, network access to build) |
| TypeScript across client, shared tooling/ecosystem knowledge with any future web work | Offline storage story changes: Core Data/SQLite (native) → AsyncStorage/SQLite via RN library, re-verify against ADR-002/ADR-005 requirements |

## Implementation Notes

- Offline queue and network-state detection (ADR-002) must be re-implemented against RN equivalents: `NetInfo` in place of `NWPathMonitor`, `expo-sqlite` or similar in place of Core Data.
- PIN sign-off model (ADR-004/ADR-007) and pass/fail computed-vs-editable UI (ADR-006) are UI/behavior requirements independent of platform -- carry over unchanged, just re-implemented in RN components.
- iOS builds/signing require an Apple Developer account wired into EAS; this is a one-time setup task before any real device/TestFlight testing, tracked as a prerequisite, not solved by this ADR.

## Related ADRs
- ADR-001: superseded by this decision (native SwiftUI is no longer the client approach)
- ADR-002: offline-first sync strategy this client still implements, against different platform APIs
- ADR-003: backend/API this client talks to (unchanged)
