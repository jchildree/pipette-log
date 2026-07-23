---
id: spiffe://pipette-log/spec-interrogation/source/phase1-auth
asserted: "No password, no separate login screen, no app session. Username selected from dropdown + PIN entered is the sign-off action itself, performed fresh at every entry. Stateless per-request auth."
source: user
method: quoted
confidence: corroborated
verify: "confirm client has no auth-token storage and no login route; every write endpoint takes username+PIN in the request body and validates both server-side per call"
---

# Phase 1 Auth Model

Resolves the auth-credential blindspot that fell out of [[Source - Standalone Phase 1, Nexus-Shaped for Migration]] (Option A pivot invalidated ADR-004's original "PIN is not login" reasoning, since that reasoning assumed LDAP as the base layer). User explicitly chose PIN-only, no password, citing low security requirement for this phase -- then confirmed shape (b): no persistent session, username-dropdown + PIN performed at every single sign-off IS the auth event, not a one-time login. Collapses "login" and "sign-off" into one action, one PIN check per entry, no token/session concept anywhere in the API.

## Related
[[Case - Pipette Log Spec Interrogation]]
[[Source - Standalone Phase 1, Nexus-Shaped for Migration]]
