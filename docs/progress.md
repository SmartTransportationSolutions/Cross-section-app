# STS Street — progress log

Branch: `sts-street` (PR target: `main` = unmodified upstream import).
Deployment branch: `gh-pages` (GitHub Pages).
Updated: 2026-10-03.

## Completed

- Research and baseline: four source inventories in `docs/research/`, baseline
  frozen at upstream `f17578e`, unmodified upstream verified locally
  (`docs/reference-baseline.md`).
- Strategy and licensing: fork with full history, AGPL obligations mapped
  (`docs/architecture.md`), corresponding-source offer implemented in both
  editions (`/source` + archive).
- Server edition: STS identity service (password, magic link, reset, OIDC),
  entitlements, image export, first-party newsletter, configurable maps,
  telemetry removed; Docker image builds and runs (smoke test + backup and
  restore recorded in `docs/evidence/ops/`).
- **GitHub Pages edition** (STS decision 2026-10-03): in-browser backend,
  GitHub Gists as the data store, GitHub token sign-in, members.json for
  Plus, examples, static legal/source pages, deploy workflow; published to
  the `gh-pages` branch (Pages enabled by the first push).
- Security fixes from the independent QA audit: translation path traversal,
  magic-link pre-registration.
- Tests: unit suite 121 files / 669 tests pass (incl. 15 static-backend
  tests); DB-backed identity suite 7/7 with PostgreSQL; server journeys
  J1–J10 10/10 in one fresh run; Pages journeys P1–P7 7/7.
- Parity contract: 121 rows; QA-audit corrections applied with visible
  history (`docs/feature-parity.json` → meta.deviations).

## Next actionable tasks

1. Confirm the GitHub Pages deployment and CI results (this sandbox cannot
   reach github.io or api.github.com; see `docs/acceptance-report.md`).
2. Verify the Pages edition with a real GitHub account on the live site
   (PAGES-REALAPI-01).
3. Re-verify the rows downgraded by the QA audit by adding the missing
   tests (list in `docs/acceptance-report.md`).
4. Merge the PR so `.github/workflows/pages.yml` redeploys on every push to
   `main`.

## Blockers (need STS input)

- One-click GitHub OAuth sign-in needs a token-exchange service and an OAuth
  app registration (PAGES-OAUTH-01).
- Server-edition-only services: SMTP and OIDC credentials, geocoder key.
- Business decision on membership pricing/billing.
- Official STS brand assets (website unreachable from the build environment).

## Commands

See `docs/operations.md`. Quick reference: `npm run build:pages`,
`npm run serve:pages`, `npm run test:e2e:pages`, `npm start`, `npm test`,
`npm run test:e2e`.
