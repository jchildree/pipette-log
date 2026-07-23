# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo actually is

No application code yet. Root contains:
- `.claude/` -- an installed Claude-ITect-Skill pack (54 skills, 4 agents, hooks) wired into `settings.json`
- `Claud-itect-Skill-main/` -- the source repo for that same skill pack (installer scripts, skill/agent/hook source, its own `README.md`/`CLAUDE.md`)
- `basic_digital pipette log.pptx` -- a slide deck, likely the actual project's spec/design source

There is no `package.json`, `src/`, build step, lint config, or test suite at the project root. There is nothing to build or run for "Pipette Log" itself yet.

## Working with the skill pack

`Claud-itect-Skill-main/` is a self-contained skill-pack installer, not part of the Pipette Log application. If asked to modify skills/agents/hooks, edit them in `Claud-itect-Skill-main/` (the source) and re-run the installer to sync into `.claude/` -- don't hand-edit `.claude/skills/*` or `.claude/hooks/*` directly, since those are installer-managed copies.

```powershell
cd "Claud-itect-Skill-main"
.\install.ps1 -ProjectPath "C:\Users\jchildree\OneDrive - TheIndustrialLaboratoriesCompany\Desktop\Projects\Pipette Log" -Force
```

Full details on the skill/agent/hook file formats, the caveman hook system, and its security constraints (symlink rejection, 64-byte flag-file cap, mode whitelist) are in `Claud-itect-Skill-main/CLAUDE.md` -- read that before touching anything under `hooks/`.

## Starting actual project work

If the task is to build out the Pipette Log application itself, there is no existing architecture to preserve -- check `basic_digital pipette log.pptx` for the intended spec/scope before scaffolding, since it's the only project-specific source of truth in this repo.
