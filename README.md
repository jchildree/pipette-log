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

### 2. Backend

```bash
cd backend
cp .env.example .env   # DB_PASSWORD must match the one in the root .env
npm install
npm run dev   # or: npm start
```

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

- **Sign Off** -- the main workflow. Pick a Pipette (or a Tip, for repeater pipettes) and a Balance, choose a verification type, enter Volume/Mass for Low/Mid/High (and every channel, for multichannel pipettes), then **Sign & Submit**. Signing asks for a technician username + PIN, created via Sign Up below.
- **Audit Log** -- browse every signed entry, filterable by pipette/balance. Click an entry to see its full correction history.
- **Equipment** -- add new pipettes and balances to the reference data (equipment ID, category, calibration due date, low/mid/high targets, etc.). Also requires a technician username + PIN.
- **Sign Up** -- create a new technician username + PIN. No admin approval needed -- this is what a first-time user does before using Sign Off or Equipment.

### First login

Open the client, go to **Sign Up**, create a username/PIN. That account can then sign on to **Sign Off** or **Equipment**.

## Tests

- `cd backend && npm test` -- unit tests, no DB required.
- `cd backend && npm run test:integration` -- full route lifecycle against the Docker DB above. Requires reference data seeded: at least one row each in `balances` and `pipettes` (see `backend/scripts/seed-equipment.js`).
