# Pipette Log

Pipette/balance calibration sign-off app. `backend/` is an Express + MSSQL REST API, `client/` is a React + Vite web app. See `CLAUDE.md` for repo layout and `docs/Obsidian Vault/Pipette Log/INDEX.md` for design decisions (ADRs).

## Quick start (downloaded release build)

If you got this as a zip from a GitHub Release, `client/dist/` is already built -- skip straight to serving it, no `npm install` needed on the client side.

**Requires:** [Docker Desktop](https://www.docker.com/products/docker-desktop/) and [Node.js](https://nodejs.org/) (v18+) installed.

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

Open `http://localhost:8081`. `VITE_API_URL` is baked into this build as `http://localhost:3000` -- if your backend runs somewhere else, rebuild from source with a different `client/.env` instead (see [Client](#3-client) below).

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

`scripts/xlsx-to-equipment-json.js` and `scripts/xlsx-to-tips-json.js` regenerate those two JSON files from the source workbook (`T:\IL\QA Projects\Pipette docs\Simple table.xlsx`) if the real inventory changes.

### 3. Client

```bash
cd client
cp .env.example .env
```

Set `VITE_API_URL` in `client/.env` to the backend's URL for your deploy target (e.g. `http://localhost:3000` for local dev, or the reachable host/port for a hosted test instance). `VITE_API_URL` is baked in at build time, so it must be set before `npm run build` -- changing it later requires a rebuild.

```bash
npm install
npm run dev     # local dev server
# or
npm run build   # production build, output in client/dist
```

## Using the app

Four tabs across the top:

- **New Verification** -- the main workflow. Pick a Pipette (or a Tip, for repeater pipettes) and a Balance, enter Volume/Mass for Low/Mid/High (and every channel, for multichannel pipettes), then **Sign & Submit**. Verification defaults to auto pass/fail at ±3% tolerance; check **After External Calibration** for manual pass/fail entry instead (note required). A reading that fails tolerance is archived as a retry attempt and the field clears for re-entry -- or click **Accept this result** on a prior attempt to submit it as final anyway (note required). Signing asks for a technician username + PIN, created via Users below.
- **Audit Log** -- browse every signed entry, filterable by pipette/balance. Click an entry to see its full correction history, or **Correct This Entry** to amend the current values (technician username + PIN + note required -- corrections are additive, the original stays in the history).
- **Equipment** -- browse pipettes/balances as paginated tables (click a row to expand full detail). Adding new equipment is admin-only: log in via **Admin Login** (top right) to unlock **+ Add Equipment**.
- **Users** -- create a new technician username + PIN, no approval needed. Logged-in admins additionally see a checkbox to create a new user as an admin, and a table of every user (promote/demote, deactivate/reactivate, unlock a PIN-locked account).

### First login

Bootstrap the first admin outside the app: `node backend/scripts/seed-admin.js <username> <pin>`. Everyone else self-signs-up from the **Users** tab -- that account can sign on to **New Verification**. Adding equipment or managing other users needs an admin: click **Admin Login** (top right of every page) with an admin account's credentials.

## Tests

- `cd backend && npm test` -- unit tests, no DB required.
- `cd backend && npm run test:integration` -- full route lifecycle against the Docker DB above. Requires reference data seeded: at least one row each in `balances` and `pipettes` (see `backend/scripts/seed-equipment.js`).
