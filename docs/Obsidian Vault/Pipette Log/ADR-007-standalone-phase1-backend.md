# ADR-007: Standalone Phase 1 Backend, Nexus-Shaped for Later Migration

**Project:** Pipette Log
Status: ACCEPTED
Date: 2026-07-22
Authors: Joseph Childree
Affected Layers: Backend · Database

---

## Context

ADR-003 decided the backend would be built as a Nexus app from day one (Express + MSSQL, `@il/db`, `@il/auth` LDAP). ADR-004 decided PIN sign-off layers on top of that Nexus LDAP session. During spec interrogation (2026-07-22), the user clarified: Pipette Log will run **self-contained until it is integrated into Nexus**, but must use identical tools/formatting so that integration is seamless when it happens.

## Decision

Phase 1 (v1) backend is a **standalone Express + MSSQL app**, structurally identical to a Nexus app, but without a dependency on Nexus's shared packages or LDAP.

| Aspect | Details |
|--------|---------|
| **Approach** | Express REST API, own MSSQL database, raw SQL schema files under `sqlSchemas/`, no ORM -- same conventions ADR-003 specified for a Nexus app, just not physically inside the `nexus` monorepo and not importing `@il/db`/`@il/auth`. Auth is local: a `users` table (LDAP username analog) plus a hashed PIN column, populated via in-app first-login self-service profile setup. |
| **Rationale** | Matching Nexus's shape exactly means later migration is a drop-in swap of the local `users`/auth code for `@il/auth`, and the local DB connection code for `@il/db` -- not a rewrite of schema, routes, or client contract. |
| **Trade-offs** | Gain: ships independently now, no dependency on Nexus infra/ops availability; migration later is mechanical. Lose: two auth implementations exist across the app's lifetime (local now, LDAP later); local `users` table's records need a migration/mapping step to LDAP identities whenever integration happens. |

Not chosen: building against Nexus infra from day one (original ADR-003 posture) -- superseded because the user wants the app usable before Nexus integration is in place. Not chosen: a materially different stack for phase 1 (e.g. SQLite, Postgres, a different framework) -- rejected because it would make the later Nexus migration a rewrite instead of a drop-in swap, which was the explicit reason for choosing "same tools/formatting."

## Consequences

| Positive | Negative |
|----------|----------|
| Ships without waiting on Nexus onboarding/infra provisioning | Two auth code paths exist until migration (local PIN+password/local-account vs LDAP) |
| Migration to Nexus is a swap of two packages, not a rewrite | Local `users` table needs an identity-mapping plan to LDAP accounts at migration time -- not yet decided |
| PIN setup lives entirely in-app (first-login self-service), no separate admin surface needed for v1 | If migration is delayed indefinitely, local auth becomes de facto permanent and its lighter security posture (see Implementation Notes) stays exposed longer than intended |

## Implementation Notes

**Auth model for phase 1 (resolved 2026-07-22):** No password, no login screen, no session/token. Every entry sign-off is: pick your name from a dropdown of provisioned users, enter your PIN. That single action is both identity and authorization for the write -- there is no separate "logged in" state before or after it. Every write endpoint validates `username` + `pin` fresh, per request, server-side. This deliberately supersedes ADR-004's original "PIN is not a login replacement" framing, which assumed LDAP as the base layer; phase 1 has no LDAP, so PIN is the only credential, by explicit user decision (security posture accepted as adequate for this phase).

Still open, not phase-1-blocking:
- Hashing scheme for the PIN (bcrypt/argon2 -- pick one compatible with whatever `@il/auth` would want later, so it isn't re-hashed at migration).
- Identity-mapping plan: how a local `users` row becomes a Nexus LDAP identity at migration time (manual admin mapping, matched-by-username, etc.) -- deferred, should be designed before phase 1 accumulates significant production data.
- Rate-limiting/lockout on repeated PIN failures (no password to fall back on, so PIN guessing is the entire attack surface -- worth a lightweight throttle even at this security posture).

## Related ADRs
- ADR-003: Nexus-app backend decision this supersedes for phase 1 scope only (Nexus integration remains the eventual target)
- ADR-004: PIN sign-off decision; phase 1 needs its own login-credential answer since LDAP isn't present yet
