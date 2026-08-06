# Pipette Log

Pipette/balance calibration sign-off app. `backend/` is an Express + MSSQL REST API, `client/` is a React + Vite web app. See `CLAUDE.md` for repo layout and `docs/Obsidian Vault/Pipette Log/INDEX.[...]

For a plain-language walkthrough of daily use, see [`docs/USER_GUIDE.md`](docs/USER_GUIDE.md).

## Tech stack

| Layer | Technology | Notes |
|---|---|---|
| Client | React 19 + TypeScript, Vite 8 | Plain SPA, no framework (Next/Remix) or router library -- tab state lives in `App.tsx`. `oxlint` for linting. See ADR-012 for why this replaced an earlie[...]|
| Backend | Node.js (v18+), Express 4 | CommonJS (`type: "commonjs"` in `backend/package.json`), not ESM. |
| Database | Microsoft SQL Server 2022 | Runs via the `mssql` npm driver (`backend/src/lib/db.js`). Schema is plain `.sql` files in `backend/sqlSchemas/`, applied in numeric filename order by `doc[...]`
| Auth | `bcrypt` password hashing, custom PIN-lockout logic | `backend/src/lib/auth.js`. Session is a technician username + 6-digit PIN checked per-action (sign-off, correction, admin actions), n[...]
| Infra (local/on-prem) | Docker Compose | `docker-compose.yml` runs two services: `mssql` (the DB, stays up) and `mssql-init` (one-shot schema bootstrap, exits after running). No Kubernetes/cloud[...]
| Tests | Node's built-in `node:test` runner | No Jest/Mocha/Vitest. `backend/test/*.test.js`; unit tests need no DB, integration tests need the Docker DB running with reference data seeded. |

**Where things live, for making changes:**
- REST routes: `backend/src/routes/*.js` (`entries.js` = sign-offs/corrections, `reference.js` = pipettes/balances/tips CRUD, `users.js` = accounts/admin).
- Business rules (tolerance math, pass/fail): `backend/src/lib/tolerance.js`.
- DB schema: `backend/sqlSchemas/NNN_description.sql`, new files only, never edit an applied one in place -- add a new numbered file for any change and re-run `docker compose up -d` against a fres[...]
- Client screens: `client/src/screens/*.tsx`, one file per tab (`SignOffForm`, `AuditLog`, `EquipmentManager`, `UsersManager`).
- API calls from the client: `client/src/api.ts`.

No CI/CD pipeline exists yet -- deploys are the manual "Building from source" steps below, run by whoever owns the box.

## Quick start (downloaded release build)

If you got this as a zip from a GitHub Release, `client/dist/` is already built -- skip straight to serving it, no `npm install` needed on the client side.

**Requires:** [Docker Desktop](https://www.docker.com/products/docker-desktop/) and [Node.js](https://nodejs.org/) (v18+) installed.

**If you're extracting the zip into a OneDrive-synced folder** (Desktop and Documents are OneDrive-synced by default on managed Windows machines), OneDrive's "Files On-Demand" can leave files as u[...]
1. Right-click the extracted folder (or at least `client/dist/`) in Explorer -> **Always keep on this device**.
2. Wait for the OneDrive sync icon on that folder to clear (green check, not a cloud icon).

This bit an earlier native-client attempt too (see ADR-012). Extracting outside OneDrive (e.g. `C:\Apps\pipette-log`) avoids the problem entirely.

```bash
# 1. Database
cp .env.example .env   # set DB_PASSWORD to a strong password
docker compose up -d

# 2. Backend (new terminal)
cd backend
cp .env.example .env   # DB_PASSWORD must match the root .env
npm install
npm start

# 3. Client (new terminal)
npx serve -l 8081 client/dist
```

Open `http://localhost:8081`. `VITE_API_URL` is baked into this build as `http://localhost:3000` -- if your backend runs somewhere else, rebuild from source with a different `client/.env` instead [...]

## Building from source

### 1. Database (Docker)

```bash
cp .env.example .env   # set DB_PASSWORD to a strong password
docker compose up -d
```

This starts SQL Server, creates the `PipetteLog` database, and applies every schema in `backend/sqlSchemas/` in order. `mssql-init` exits once done; `mssql` keeps running.

If port 1433 is already taken on your machine (another SQL Server instance), add a `docker-compose.override.yml` remapping the host port and set `DB_PORT` to match in `backend/.env`:

```yaml
services:
  mssql:
    ports: !override
      - "1434:1433"
```

### 2. Backend

```bash
cd backend
cp .env.example .env   # DB_PASSWORD must match the one in the root .env
npm install
npm run dev   # or: npm start
```

Seed reference data before first use (all one-off scripts, not part of the app runtime):

```bash
node scripts/seed-admin.js <username> <pin>              # bootstraps the first admin account
node scripts/seed-equipment.js scripts/equipment.json    # pipettes + balances
node scripts/seed-tips.js scripts/tips.json               # repeater tip low/mid/high targets
```

`scripts/xlsx-to-equipment-json.js` and `scripts/xlsx-to-tips-json.js` regenerate those two JSON files from the source workbook (`T:\IL\QA Projects\Pipette docs\Simple table.xlsx`) if the real inv[...]

### 3. Client

```bash
cd client
cp .env.example .env

# Install dev and runtime dependencies (important: TypeScript, Vite and the Vite plugin live in devDependencies)
npm install

# Local development server
npm run dev     # vite dev server

# Production build (outputs to client/dist)
npm run build   # runs the local `tsc -b` and `vite build` from node_modules/.bin
```

Notes and troubleshooting

- If you see an error like "'tsc' is not recognized" when running `npm run build`, it means the TypeScript compiler isn't available on your PATH. Make sure you ran `npm install` inside `client/` so the project's devDependencies (typescript, vite, @vitejs/plugin-react) are installed and the local binaries are available. Alternatively, you can run the build using npx:

  npx tsc -b && npx vite build

- The production build output folder is `client/dist`. To serve it with `serve`, run the command from the repo root so the path resolves correctly:

```bash
# from the repo root (not inside client/)
npx serve -l 8081 client/dist
```

Running `npx serve -l 8081 client/dist` from inside `client/` looks for `client/client/dist`, which doesn't exist -- every request will 404 (`serve`'s console log looks like `HTTP <timestamp> ::1 GET /` then `Returned 404`).

**Blank page even though `serve` is running and returning 200s:** open the browser's devtools console (F12) first -- that's the fastest way to tell a JS error (crash before render) apart from an asset/build mismatch.

## Using the app

Four tabs across the top:

- **New Verification** -- the main workflow. Pick a Pipette (or a Tip, for repeater pipettes) and a Balance, enter Volume/Mass for Low/Mid/High (and every channel, for multichannel pipettes), the[...]
- **Audit Log** -- browse every signed entry, filterable by pipette/balance. Click an entry to see its full correction history, or **Correct This Entry** to amend the current values (technician u[...]
- **Equipment** -- browse pipettes/balances as paginated tables (click a row to expand full detail). Adding, editing, or deleting equipment is admin-only: log in via **Admin Login** (top right) t[...]
- **Users** -- create a new technician username + PIN, no approval needed. Logged-in admins additionally see a checkbox to create a new user as an admin, and a table of every user (promote/demote[...]

### First login

Bootstrap the first admin outside the app: `node backend/scripts/seed-admin.js <username> <pin>`. Everyone else self-signs-up from the **Users** tab -- that account can sign on to **New Verificat[...]

## Tests

- `cd backend && npm test` -- unit tests, no DB required.
- `cd backend && npm run test:integration` -- full route lifecycle against the Docker DB above. Requires reference data seeded: at least one row each in `balances` and `pipettes` (see `backend/sc[...]
