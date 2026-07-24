# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo actually is

A working pipette/balance calibration sign-off app. Two pieces:
- `backend/` -- Express + `mssql` REST API (Node, JS). `npm test` / `npm run test:integration` (needs local SQL Server, see `backend/README.md`). Schema lives in `backend/sqlSchemas/*.sql`, applied in numeric order.
- `client/` -- React + TypeScript + Vite web app (`npm run dev`, defaults to `:8081`). No React Native/Expo -- see ADR-012 for why (Expo's Metro web dev server was undebuggable under this OneDrive-synced path; plain Vite also matches the real internal Nexus platform's client pattern).

All design decisions are recorded as ADRs in `docs/Obsidian Vault/Pipette Log/` -- `INDEX.md` is the table of contents, read the relevant ADR before changing behavior it governs rather than re-deriving intent from the code alone.

This repo is meant to eventually move into the company's Nexus monorepo (`../nexus/`) as `apps/pipette-log`, matching that repo's `shared/server/client` workspace shape -- not done yet since push access there is currently scoped to `apps/eqms` only.

Other root contents:
- `.claude/` -- an installed Claude-ITect-Skill pack (54 skills, 4 agents, hooks) wired into `settings.json`
- `Claud-itect-Skill-main/` -- the source repo for that same skill pack (installer scripts, skill/agent/hook source, its own `README.md`/`CLAUDE.md`)
- `basic_digital pipette log.pptx` -- original spec/design source slide deck

## Working with the skill pack

`Claud-itect-Skill-main/` is a self-contained skill-pack installer, not part of the Pipette Log application. If asked to modify skills/agents/hooks, edit them in `Claud-itect-Skill-main/` (the source) and re-run the installer to sync into `.claude/` -- don't hand-edit `.claude/skills/*` or `.claude/hooks/*` directly, since those are installer-managed copies.

```powershell
cd "Claud-itect-Skill-main"
.\install.ps1 -ProjectPath "C:\Users\jchildree\OneDrive - TheIndustrialLaboratoriesCompany\Desktop\Projects\Pipette Log" -Force
```

Full details on the skill/agent/hook file formats, the caveman hook system, and its security constraints (symlink rejection, 64-byte flag-file cap, mode whitelist) are in `Claud-itect-Skill-main/CLAUDE.md` -- read that before touching anything under `hooks/`.

