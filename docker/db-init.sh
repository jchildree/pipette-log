#!/usr/bin/env bash
set -e

SQLCMD=/opt/mssql-tools18/bin/sqlcmd

$SQLCMD -S mssql -U sa -P "$MSSQL_SA_PASSWORD" -C -Q \
  "IF DB_ID(N'PipetteLog') IS NULL CREATE DATABASE PipetteLog;"

for f in /sqlSchemas/*.sql; do
  echo "Applying $f"
  $SQLCMD -S mssql -U sa -P "$MSSQL_SA_PASSWORD" -C -d PipetteLog -i "$f"
done
