# Pipette Log

Pipette/balance calibration sign-off app. `backend/` is an Express + MSSQL REST API, `client/` is a React + Vite web app. See `CLAUDE.md` for repo layout and `docs/Obsidian Vault/Pipette Log/INDEX.md` for design decisions (ADRs).

## 1. Database (Docker)

```bash
export DB_PASSWORD="<strong-password>"   # PowerShell: $env:DB_PASSWORD = "<strong-password>"
docker compose up -d
```

This starts SQL Server on `localhost:1433` and applies `backend/sqlSchemas/*.sql` in order on first run. Data persists in the `db-data` volume across restarts; to start over, `docker compose down -v`.

## 2. Backend

```bash
cd backend
cp .env.example .env   # fill in DB_PASSWORD with the same value used above
npm install
npm start
```

Runs on `http://localhost:3000`.

## 3. Client

```bash
cd client
npm install
npm run dev
```

Runs on `http://localhost:8081`, talking to the backend at `http://localhost:3000` by default.

### Deploying to a different host

The client reads its API base URL from `VITE_API_URL` at **build time** (`client/src/api.ts`), not at runtime. Before running `npm run build` for a deploy target other than local dev, set it:

```bash
# client/.env
VITE_API_URL=http://<backend-host>:3000
```

Then `npm run build` and serve `client/dist`.

## 4. First-time sign-off account

Open the client, go to the **Sign Up** tab, and create a username/PIN. That PIN is required to sign off entries or add equipment -- there's no default account.

## Tests (backend)

- `npm test` -- unit tests, no DB required.
- `npm run test:integration` -- full route lifecycle against the DB from step 1. Requires reference data seeded: at least one row each in `balances` and `pipettes` (see `backend/scripts/seed-equipment.js`).
