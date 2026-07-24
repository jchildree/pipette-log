# ADR-012: Plain React + Vite Web Client, Nexus-Shaped (Supersedes ADR-008)

**Project:** Pipette Log
Status: ACCEPTED
Date: 2026-07-24
Authors: Joseph Childree
Affected Layers: Client

---

## Context

ADR-008's React Native/Expo client was undebuggable in practice: the Expo web dev server (Metro bundler) run from this project's path -- under a OneDrive-synced folder -- repeatedly served stale JavaScript regardless of hard refresh, cleared site data, or a fully cache-cleared server restart (`expo start --web --clear`). Verified directly: fetching the served bundle from the dev server showed correct, current code (`curl` against `/index.bundle`), while the browser's own Network tab showed every request failing outright. Hours were spent misdiagnosing this as a caching issue before establishing it was Metro/Expo-web-specific -- not a code bug in the app.

Separately, this session surfaced that the company has a real internal platform, **Nexus** (`nexus/` monorepo -- `apps/<name>/{shared,server,client}` workspaces, React + TypeScript + Vite client, Express + TypeScript + `mssql` server, `packages/*` shared libraries). Pipette Log is intended to eventually live there as `apps/pipette-log`, matching that pattern. The developer's push access to that monorepo is currently restricted to `apps/eqms` only (a GitHub ruleset), so Pipette Log stays in its own repo for now but should already match Nexus's shape and stack to minimize rework when it moves.

## Decision

Replace the Expo/React Native client entirely with a plain React + TypeScript + Vite web app, matching Nexus's own client pattern.

| Aspect | Details |
|--------|---------|
| **Scaffold** | `npm create vite@latest client -- --template react-ts`. Dev server serves raw ES modules directly (no bundler, no bundle-hash caching layer) -- this is what actually fixes the stale-code problem, not just a different tool. |
| **Kept from the RN client** | All business logic: retry tracking (ADR-010), multichannel (ADR-011), repeater tips (ADR-011), offline queue (ADR-002), PIN sign-off (ADR-004). `types.ts` was already platform-agnostic and ported unchanged. Brand colors (`#1298c9` / `#d6ecf7` / `#7ec8e3`) carried over as CSS custom properties. |
| **Dropped** | `react-native` / `react-native-web`, `expo`, `@react-native-picker/picker`, `@react-native-community/netinfo`, `@react-native-async-storage/async-storage`. Replaced with plain DOM elements (`<select>`, `<input>`, `<textarea>`), native `navigator.onLine` + `window` online/offline events, and native `localStorage` -- no new dependencies needed for any of it. |
| **Nexus alignment** | React + TypeScript + Vite client matches `nexus/apps/control-logs/client` exactly. Backend (Express + `mssql`, already this shape per ADR-003/ADR-007) needs no client-driven changes. Full workspace restructure (`shared/`/`server`/`client` npm workspaces, `@il/ui`, etc.) deferred until this repo actually moves into the Nexus monorepo -- not worth doing twice. |
| **Verification discipline going forward** | Every claim of "this works now" for the client must be backed by a direct check against the dev server (`curl` the served module, grep for the expected content/absence of error strings) before telling the user to look -- not inferred from "the file on disk is correct" or "should be fixed now." |

Not chosen: keep Expo, target Expo web only for dev while planning to eventually use Expo for a real native build. Rejected because the entire session's actual blocker was Metro's web dev server, not React Native itself -- but Nexus's real precedent is a plain web client (Vite), and there's no other current requirement for RN specifically once web-first was accepted.

Not chosen: debug Metro's OneDrive-path caching further. Rejected as a sunk-cost trap -- hours already spent, no fix found, and Vite is both simpler and matches the actual target platform (Nexus).

## Consequences

| Positive | Negative |
|----------|----------|
| Dev server caching/staleness class of bug is structurally gone (no bundle hash, no Metro) | Loses Expo/EAS's path to a real native iOS binary without a Mac (ADR-008's original reason for existing) |
| Matches Nexus's actual client stack -- less rework when this moves into `apps/pipette-log` | React Native expertise/code from ADR-008 is fully discarded, not reused |
| Fewer dependencies overall (native browser APIs replace 4 RN-ecosystem packages) | Any future "real" iOS app is a separate client build, not a mode of this one |

## Implementation Notes

Eventual Xcode/iOS conversion (raised alongside this pivot) is a **separate future client**, not blocked or pre-built for here: the backend's REST API (ADR-003/ADR-007) is already the clean boundary a native client would consume, same as this web client does. No speculative native-facing abstraction was added to the web client on the strength of "might need iOS later" -- that would be exactly the kind of premature structure this ADR is reacting against.

## Related ADRs
- ADR-008: superseded by this decision (Expo/React Native is no longer the client approach)
- ADR-002: offline-first sync strategy -- re-implemented against native browser APIs instead of RN equivalents, same behavior
- ADR-003/ADR-007: backend this client talks to, unchanged
- ADR-010/ADR-011: retry and multichannel/repeater UI logic, ported as-is
