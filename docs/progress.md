# STS Street — progress log

Branch: `sts-street` (PR target: `main` = unmodified upstream import).
Updated: 2026-10-03.

## Completed

- Research and baseline: four source inventories in `docs/research/`, baseline
  frozen at upstream `f17578e`, unmodified upstream verified locally
  (`docs/reference-baseline.md`).
- Strategy and licensing: fork with full history, AGPL obligations mapped
  (`docs/architecture.md`), corresponding-source offer implemented (`/source`).
- Identity service (`app/auth`): password, magic link, password reset, OIDC
  (generic), RS256 tokens, JWKS, rate limits, lockout; client sign-in and
  password-reset dialogs; account deletion.
- Entitlements: roles API (admin) and CLI; membership dialog; server-side
  enforcement for export options.
- Operator services replaced: image export + previews, first-party newsletter,
  configurable maps, optional error reporting/analytics, upstream telemetry
  removed; CSP reduced to configured hosts.
- Branding: `packages/branding`, theme, logo/wordmark/favicons/social image,
  rebranded UI strings (source + runtime locale substitution), legal pages,
  user guide, changelog, README.
- Deployment: Dockerfile, Compose, entrypoint with migrations, health check, CI
  workflow, seed and admin scripts, `.env.example`, `docs/operations.md`.
- Tests: server suite green (46 tests), client suite green after rebrand
  (553 tests, snapshots regenerated), new tests for sign-in dialog, contact
  menu, product-name substitution, authentication middleware, service routes.
- Parity contract: `docs/feature-parity.json` + generated `.md` (107 rows).

## In progress / next actionable task

1. Execute the Playwright journeys (`npm run test:e2e`) against the local
   server and record results in `docs/acceptance-report.md`; fix any failures.
2. Add server unit tests for `app/auth` (password policy, identity nickname
   derivation, token hashing) and a DB-backed API test for sign-up/login.
3. Build the user guide (`npm run build:docs`) and verify `/docs`.
4. Catalog coverage report script (`bin/catalog-report.mjs`) → CAT-REPORT-01.
5. Build the Docker image and run `docker compose up` locally; run
   `npm run source:archive` and verify `/source/sts-street-source.tar.gz`.
6. Cross-browser run of the journeys (Firefox, WebKit) and responsive
   screenshots.
7. Open the PR `sts-street → main`.

## Blockers (need STS input)

- Public deployment: no hosting credentials, DNS or spending approval were
  provided; the build environment has no outbound access to STS or hosting
  providers. Local/Compose deployment is the verifiable path.
- SMTP credentials for production email; OIDC provider credentials for social
  sign-in; geocoder key and tile provider for the Location dialog.
- Business decision on membership pricing/billing (capability access is done).
- Official STS brand assets (website unreachable from the build environment).

## Commands

See `docs/operations.md`. Quick reference: `npm start`, `npm test`,
`npm run build:app`, `npm run test:e2e`, `npm run sts:admin -- list-users`.
