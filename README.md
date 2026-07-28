# Pipette Log

Pipette/balance calibration sign-off app. `backend/` is an Express + MSSQL REST API, `client/` is a React + Vite web app.

## 1. Database (Docker)

```bash
cp .env.example .env   # set DB_PASSWORD to a strong password
docker compose up -d
```

This starts SQL Server, creates the `PipetteLog` database, and applies every schema in `backend/sqlSchemas/` in order. `mssql-init` exits once done; `mssql` keeps running.

## 2. Backend

```bash
cd backend
cp .env.example .env   # DB_PASSWORD must match the one in the root .env
npm install
npm run dev   # or: npm start
```

## 3. Client

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

## 4. First login

Open the client and use the **Sign Up** tab to create a username/PIN -- no admin step required. That account can then sign on to the **Sign Off** tab.

## Tests

- `cd backend && npm test` -- unit tests, no DB required.
- `cd backend && npm run test:integration` -- full route lifecycle against the Docker DB above. Requires reference data seeded: at least one row each in `balances` and `pipettes` (see `backend/scripts/seed-equipment.js`).
