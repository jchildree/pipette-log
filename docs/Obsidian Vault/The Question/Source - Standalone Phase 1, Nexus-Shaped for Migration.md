---
id: spiffe://pipette-log/spec-interrogation/source/standalone-phase1
asserted: "v1 backend is a standalone Express + MSSQL app (own DB, raw SQL under sqlSchemas/, no ORM, local users+PIN table instead of LDAP) -- structurally identical to a Nexus app so later migration is a drop-in of @il/db and @il/auth, not a rewrite. PIN and profile setup happen entirely in Pipette Log's own first-login flow."
source: user
method: quoted
confidence: corroborated
verify: "confirm apps/pipette-log backend has no import of @il/auth or @il/db in phase 1, and its own users/PIN table + sqlSchemas/ layout matches Nexus app conventions field-for-field"
---

# Standalone Phase 1, Nexus-Shaped for Migration

Supersedes ADR-003's "build as a Nexus app from day one" and ADR-004's "authenticates via Nexus LDAP as normal" for v1 specifically. Both ADRs need a follow-up amendment noting this phased path -- not a reversal of the eventual Nexus-integration decision, just a v1 scoping.

User's own reasoning: run self-contained until Nexus integration happens, but use identical tooling/formatting (Express, MSSQL, raw SQL schema convention, no ORM) so the later migration is seamless. Resolves ADR-004's "where PINs are set/reset" open question as a side effect: self-service, first-login, inside Pipette Log's own onboarding -- no separate admin surface, no LDAP dependency for the PIN itself.

## Related
[[Case - Pipette Log Spec Interrogation]]
[[Source - Reference-Data Ownership]]
