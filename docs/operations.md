# STS Street — operations guide

## 1. Runtime requirements

| Component | Requirement |
| --- | --- |
| Node.js | 22.x or 24.x (CI tests both); npm 11+ for `npm install` (npm 10 cannot resolve workspace packages; `npm ci` works on either) |
| PostgreSQL | 14+ with the PostGIS extension available (migration `20200311145404` runs `CREATE EXTENSION postgis`) |
| Fonts (server) | Noto Sans Georgian from npm (`@fontsource/noto-sans-georgian`), registered by the export renderer; no OS font packages needed |
| Outbound network | SMTP server (sign-in emails); optionally a Pelias-compatible geocoder and a map tile provider. Nothing else is required. |
| Disk | `data/` directory (signing key, mail outbox in dev, image cache) |

## 2. Local development (no Docker)

```bash
cp .env.example .env            # defaults work with a local PostgreSQL user "streetmix"
createuser -s streetmix          # or: psql -c "CREATE USER streetmix PASSWORD 'streetmix' SUPERUSER"
createdb -O streetmix sts_street_dev
npm ci
npx sequelize-cli db:migrate
npm run db:seed:demo             # optional: demo accounts and sample streets
npm start                        # server + Parcel watch + tsc watch, http://localhost:8000
```

Sign-in emails in development are written to `./data/mail-outbox/*.json`
(open the file and follow `link`). Demo accounts (password
`sts-street-demo-2026`): `demo-admin` (ADMIN), `demo-member` (STS Street
Plus), `demo-user`.

Useful scripts:

| Command | Purpose |
| --- | --- |
| `npm run build:app` | Build workspace packages and the client bundle (production) |
| `npm run build:docs` | Build the user guide (served at `/docs`) |
| `npm test` | Lint + unit/integration tests (`npm run vitest`) |
| `npm run test:e2e` | Playwright acceptance journeys against a running server (`E2E_BASE_URL`, default `http://localhost:8000`) |
| `npm run sts:admin -- <cmd>` | Admin CLI: users, roles, Plus membership, newsletter export, token pruning |
| `npm run auth:generate-key` | Create the RSA signing key for production |
| `npm run source:archive` | Build the corresponding-source archive served at `/source` |
| `npm run brand:assets` | Regenerate favicons/social image from the SVG logo |

## 3. One-command deployment (Docker Compose)

```bash
cp .env.example .env
# Required for production:
#   NODE_ENV=production
#   APP_DOMAIN=street.example.ge   APP_PROTOCOL=https
#   COOKIE_SESSION_SECRET=$(openssl rand -hex 32)
#   SMTP_URL=smtps://user:pass@smtp.example.ge:465   MAIL_FROM="STS Street <no-reply@example.ge>"
# Generate the token signing key into the app-data volume before first start:
docker compose run --rm app node bin/generate-auth-key.mjs /app/data/auth-key.pem
docker compose up -d --build
docker compose exec app npm run sts:admin -- create-user admin@example.ge 'a strong password' admin --role ADMIN
```

The app listens on port 8000 (HTTP). Terminate TLS in front of it (Caddy,
nginx, a cloud load balancer) and forward `X-Forwarded-*` headers;
`TRUST_PROXY=true` is set in the image. `/healthz` returns 200 when the
database is reachable.

Migrations run automatically from the container entrypoint before the server
starts (`SKIP_MIGRATIONS=true` disables this, e.g. for multiple replicas where
one job migrates).

## 4. Configuration reference

See `.env.example` for the full annotated list. Production hard requirements
(the server refuses to start otherwise): `COOKIE_SESSION_SECRET`,
`AUTH_JWT_PRIVATE_KEY` or `AUTH_JWT_PRIVATE_KEY_FILE`. `MAIL_TRANSPORT=outbox`
is refused in production.

Optional operator services and what happens without them:

| Service | Variables | Without it |
| --- | --- | --- |
| SMTP | `SMTP_URL` or `SMTP_HOST/PORT/USER/PASS`, `MAIL_FROM` | Magic-link sign-in and password reset return 503 and are hidden from the sign-in dialog; password sign-in still works |
| OIDC providers | `OIDC_<NAME>_CLIENT_ID/CLIENT_SECRET/ISSUER/LABEL` | No federated sign-in buttons |
| Geocoder | `PELIAS_HOST_NAME`, `PELIAS_API_KEY` | Location dialog shows the map but no address search / reverse geocoding |
| Map tiles | `MAP_TILES_URL`, `MAP_TILES_ATTRIBUTION` | Defaults to OpenStreetMap standard tiles (usage policy applies; use a provider for production) |
| Error reporting | `SENTRY_DSN` (build-time) | No browser error reporting |
| Analytics | `PLAUSIBLE_ID`, `PLAUSIBLE_HOST` | No analytics script |
| Translations | `TRANSIFEX_API_TOKEN` | Bundled translations only (recommended) |

## 5. Backup and restore

Backup:

```bash
docker compose exec -T db pg_dump -U streetmix -Fc sts_street > backup-$(date +%F).dump
docker compose cp app:/app/data/auth-key.pem ./auth-key.pem.bak    # keep secret!
```

Restore into an isolated environment (never over production without a
maintenance window):

```bash
docker compose -p sts-restore up -d db
docker compose -p sts-restore exec -T db pg_restore -U streetmix -d sts_street --clean --if-exists < backup-YYYY-MM-DD.dump
```

What must be backed up: the database (streets, users, credentials hashed,
tokens hashed, newsletter list) and the signing key (losing it signs everyone
out; it does not lose data). The image cache (`data/image-cache`) is
disposable.

## 6. Migrations and rollback

- Apply: `npx sequelize-cli db:migrate` (entrypoint does this).
- Roll back the last migration: `npx sequelize-cli db:migrate:undo`.
- Roll back a release: redeploy the previous image tag; STS migrations
  (`20261003100000`–`20261003100200`) are additive except the
  `auth0_id → auth_subject` rename, which `db:migrate:undo` reverses.
- Street data schema versions are migrated lazily on read
  (`app/lib/street_schema_update.js`); the server is the source of truth for
  `LATEST_SCHEMA_VERSION`.

## 7. Updating from upstream Streetmix

```bash
git remote add upstream https://github.com/streetmix/streetmix.git
git fetch upstream
git checkout -b upstream-merge main      # or the current release branch
git merge upstream/main                  # resolve conflicts (see docs/architecture.md §5)
npm ci && npm run build:app && npm test && npm run test:e2e
```

## 8. Membership (STS Street Plus) administration

- Grant: `npm run sts:admin -- grant-plus <username>`
- Revoke: `npm run sts:admin -- revoke-plus <username>`
- Or, as a signed-in administrator: `PUT /api/v1/users/<username>/roles`
  with `{"roles":["SUBSCRIBER_1"]}` (ADMIN cannot be granted via the API).
- Users request membership from the in-app dialog (mailto to
  `brand.supportEmail`). There is no billing integration; see
  `docs/feature-parity.md` (MEMB-*) for the business decision that is pending.

## 9. Security notes

- The content security policy sends `upgrade-insecure-requests` only when
  `APP_PROTOCOL=https`. Serving the app over plain HTTP with that directive
  makes Chromium rewrite its own API requests to `https://` and fail; set
  `APP_PROTOCOL=https` whenever TLS terminates in front of the app.
- All ownership checks are server-side; anonymous streets (no creator) are
  editable by anyone who has the link, as upstream.
- Credentials: scrypt hashes; lockout after repeated failures; rate limits on
  auth endpoints; single-use hashed tokens for email flows.
- Cookies: `login_token` is readable by the client bundle (upstream contract);
  `sts_session` is HttpOnly. Set `APP_PROTOCOL=https` so cookies are `Secure`.
- CSP is enforced in production (report-only in development). Allowed external
  hosts are only those configured (tiles, geocoder, analytics, error reporting)
  plus `https:` for provider-supplied profile images.
- Dependency audit: `npm audit` (see `docs/acceptance-report.md` for the
  state at release).

## 10. GitHub Pages edition (static)

The production deployment chosen by STS is the static edition on GitHub
Pages (architecture: `docs/architecture.md` §7).

### Build and test locally

```bash
npm ci
APP_BASE_PATH=/Cross-section-app npm run build:pages   # → dist-pages/
node bin/serve-pages.mjs 8080                          # http://localhost:8080/Cross-section-app/
PAGES_BASE_URL=http://localhost:8080/Cross-section-app npm run test:e2e:pages
```

`SKIP_DOCS=true` and `SKIP_SOURCE_ARCHIVE=true` speed up local builds.
`APP_BASE_PATH` must match the path the site is served under: `/<repo>` for
`https://<owner>.github.io/<repo>/`, or empty for a custom domain.

### Deploy

`.github/workflows/pages.yml` builds the site on every push to `main` (and
on manual dispatch) and commits it to the `gh-pages` branch. One-time
repository setting (admin): **Settings → Pages → Build and deployment →
Deploy from a branch → `gh-pages` / `(root)`**.

Custom domain: add the domain in the same settings page, create the DNS
record GitHub shows, and build with `APP_BASE_PATH=` (empty) and
`SITE_URL=https://<domain>`.

### Membership administration

Edit `public/data/members.json` (GitHub logins, case-insensitive) in a pull
request; the next deployment applies it. `admin` implies Plus.

### Backup and restore

There is no STS-held database in this edition. Each person's streets are
gists in their own GitHub account (GitHub's durability applies; people can
clone a gist with git). STS-owned configuration (members list, examples) is
in this repository. Restoring the site = re-running the Pages workflow for
the desired commit.

### Monitoring

`build.json` at the site root records the deployed commit and build time.
