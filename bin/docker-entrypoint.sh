#!/bin/bash
# Container entrypoint: waits for PostgreSQL, applies migrations, then starts
# the server (or runs the given command).
set -euo pipefail
cd /app

if [ "${SKIP_MIGRATIONS:-false}" != "true" ]; then
  echo "[entrypoint] Waiting for database and applying migrations..."
  for i in $(seq 1 30); do
    if npx sequelize-cli db:migrate >/tmp/migrate.log 2>&1; then
      cat /tmp/migrate.log
      break
    fi
    if [ "$i" -eq 30 ]; then
      echo "[entrypoint] Database migration failed:" >&2
      cat /tmp/migrate.log >&2
      exit 1
    fi
    sleep 2
  done
fi

exec "$@"
