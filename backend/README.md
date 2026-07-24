# Pipette Log Backend

## Local dev database (Docker)

```bash
docker run -d --name pipette-log-mssql \
  -e "ACCEPT_EULA=Y" \
  -e "MSSQL_SA_PASSWORD=<strong-password>" \
  -p 1433:1433 \
  -v pipette-log-mssql-data:/var/opt/mssql \
  mcr.microsoft.com/mssql/server:2022-latest

docker exec pipette-log-mssql /opt/mssql-tools18/bin/sqlcmd \
  -S localhost -U sa -P "<strong-password>" -C -Q "CREATE DATABASE PipetteLog;"

docker cp sqlSchemas pipette-log-mssql:/tmp/sqlSchemas
for f in 001_users.sql 002_equipment.sql 003_entries.sql 004_entry_point_attempts.sql 005_tips.sql 006_entry_channel_points.sql; do
  docker exec pipette-log-mssql /opt/mssql-tools18/bin/sqlcmd \
    -S localhost -U sa -P "<strong-password>" -C -d PipetteLog -i "/tmp/sqlSchemas/$f"
done
```

Copy `.env.example` to `.env` and fill in `DB_PASSWORD` with the same password.

## Tests

- `npm test` -- unit tests, no DB required (tolerance formula).
- `npm run test:integration` -- full route lifecycle against the live DB above (user setup, sign-off, tolerance calc, corrections, PIN lockout). Requires reference data seeded: at least one row each in `balances` and `pipettes`.
