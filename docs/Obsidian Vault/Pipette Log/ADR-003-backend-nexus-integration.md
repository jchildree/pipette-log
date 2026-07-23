# ADR-003: Backend Built as a Nexus App (Express + MSSQL, On-Prem)

**Project:** Pipette Log
Status: ACCEPTED
Date: 2026-07-22
Authors: Joseph Childree
Affected Layers: Backend · Database

---

## Context

Balance/pipette reference data and pass/fail logic live centrally (confirmed: "Central database"). The backend "needs to be compatible with Nexus' setup" -- Nexus (`../nexus`) is the company's internal monorepo hosting LIMS and other internal systems: a Node/TypeScript monorepo where each domain gets its own app under `apps/<name>`, an Express server, its own MSSQL database (one SQL Server instance, one database per app -- see `nexus/docker-init/01-create-databases.sql`), shared packages (`@il/db` for MSSQL pooling, `@il/auth` for LDAP/JWT session auth, `@il/config`, `@il/types`), and self-initializing schema (`db-init.ts` per app, raw SQL under `sqlSchemas/`, no ORM). Hosting is on-prem/internal (confirmed).

## Decision

Build Pipette Log's backend as a new Nexus app (`apps/pipette-log` or similar), following the existing monorepo conventions, rather than a standalone service or a different stack.

| Aspect | Details |
|--------|---------|
| **Approach** | Express REST API server, its own MSSQL database (e.g. `PipetteLog`) on the shared on-prem SQL Server instance, using `@il/db` for connection pooling and raw SQL schema files under `sqlSchemas/` per existing convention. Hosted on-prem alongside other Nexus apps. |
| **Rationale** | "Compatible with Nexus' setup" means following its established pattern (one app, one DB, REST over Express, shared infra packages) rather than introducing a second stack (e.g. Postgres/GraphQL) the team would have to operate in parallel. |
| **Trade-offs** | Gain: reuses proven infra, deployment (`ecosystem.config.js`/PM2 per `nexus/ecosystem.config.js`), and auth packages instead of building new ones. Lose: inherits Nexus's stack constraints (MSSQL, raw SQL, no ORM) even though those weren't independently chosen for this project. |

Not chosen: PostgreSQL + GraphQL as a fresh, independent stack -- rejected because the explicit constraint was Nexus compatibility, and Nexus already standardizes on MSSQL + Express + REST + on-prem hosting.

**API style confirmed 2026-07-22: REST.** No app in the monorepo was found using GraphQL; Pipette Log follows the Nexus-wide REST convention -- resource-oriented endpoints (`/api/verifications`, `/api/balances`, `/api/pipettes`, etc.) under `apps/pipette-log`, matching the shape ADR-002's sync client and offline queue call against.

## Consequences

| Positive | Negative |
|----------|----------|
| One infra/ops model for IT to support (matches every other Nexus app) | Client is a native iPad app, not a Vite web client -- this app breaks the `apps/*/client` convention on the frontend side even while matching it on the backend |
| Reuses `@il/db`, `@il/auth`, `@il/config` instead of rebuilding pooling/auth | MSSQL + raw SQL (no ORM) is the Nexus-wide pattern; team must maintain schema/migrations by hand like other apps do |

## Implementation Notes

Still open (not decided in this session):
- Exact endpoints/contract the offline sync layer (ADR-002) needs.
- Whether balance/pipette reference tables are owned by `PipetteLog` directly or pulled from another Nexus app's DB (e.g. an existing asset/instrument registry) -- `apps/asset-manager` and `apps/instrument-status` exist in the monorepo and may already own this data; check before duplicating it.

## Related ADRs
- ADR-002: offline sync this backend must support
- ADR-004: how user identity is established against this backend
