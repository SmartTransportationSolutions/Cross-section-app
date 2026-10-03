# Container smoke test and backup/restore — 2026-10-03

Image: `sts-street:local`, built with `docker build --network host --build-arg SOURCE_COMMIT=…`
from the working tree (Dockerfile without OS packages; `.npmrc` copied before
`npm ci`). Database: fresh PostgreSQL 16 + PostGIS database `sts_street_docker`.

```text
$ docker run --init --network host -e NODE_ENV=production -e PORT=8100 … sts-street:local
[entrypoint] Waiting for database and applying migrations...
== 20180729103650-create-sequence: migrated
…  (23 migrations, including the 3 STS migrations)
$ curl localhost:8100/healthz
{"status":"ok","database":"ok","commit":"343fabb2858b3edc4ed207fdf194cbb59c273ae7"}
$ curl -o /dev/null -w "%{http_code}" localhost:8100/                  → 200
$ curl … localhost:8100/source/sts-street-source.tar.gz              → 200, 21069302 bytes
$ curl -X POST localhost:8100/services/auth/signup …                 → 201 Created
  Set-Cookie: user_id=smoke-user … refresh_token=… login_token=eyJhbGciOiJSUzI1NiIs…
```

Note: the first start failed with `EACCES` reading a root-owned key file
mounted read-only; the image runs as the unprivileged `node` user, so key
files must be readable by it (docs/operations.md generates the key inside
the app-data volume, which is owned by `node`).

## Backup and restore (isolated databases)

```text
$ pg_dump -Fc sts_street_docker > sts_backup.dump
$ createdb -O streetmix sts_street_restore && pg_restore -d sts_street_restore sts_backup.dump
$ psql -d sts_street_restore -c 'select id, email from "Users"'
smoke-user|smoke@example.com
$ psql -d sts_street_restore -c 'select count(*) from "SequelizeMeta"'
23
```
