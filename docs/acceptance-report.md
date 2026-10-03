# STS Street — acceptance report

Date: 2026-10-03. Branch: `sts-street`. Deployment branch: `gh-pages`.
Reference: Streetmix at `f17578eec760d3c7b41216823ec32c7e8d04e8bc`.

## Overall assessment: **NOT DONE**

The application is built, tested and published, but the definition of done
is not met. The open items are listed under "Why NOT DONE" below. Nothing in
this report counts a mock, a skipped step or an unverifiable claim as done.

## Deployment

| Item | State |
| --- | --- |
| Hosting (STS decision 2026-10-03) | GitHub Pages, static edition, GitHub Gists as the data store |
| URL | <https://smarttransportationsolutions.github.io/Cross-section-app/> |
| Published build | `gh-pages` commit `7bf01e29a`, built from `sts-street` commit `0d4838b82` (`build.json` at the site root) |
| Pages enabled | Yes. The first push of `gh-pages` switched Pages on (`has_pages: true`). |
| Live site verified from here | **No.** This build sandbox cannot reach `github.io` or `api.github.com` (egress policy). See "Deployment status" at the end for what GitHub reported. |
| Continuous deployment | `.github/workflows/pages.yml` rebuilds and publishes on every push to `main` (after the PR is merged) and on manual dispatch. |
| Server edition | Docker image builds and runs (`docs/evidence/ops/container-smoke-2026-10-03.md`); no server host was provided, so it is not deployed. |

## How to use and test

* Open the site, edit a street without signing in (saved in the browser).
* Sign in: **Sign in → create a GitHub token with the `gist` scope → paste
  it**. Streets are then saved as public gists in your GitHub account.
* Grant STS Street Plus: add the GitHub login to `public/data/members.json`
  in a pull request.
* There are no shared test accounts for the Pages edition; every tester uses
  their own GitHub account. The server edition's demo accounts
  (`npm run db:seed:demo`) exist only on a local or self-hosted server.

## Verification results

| Suite | Result | Evidence |
| --- | --- | --- |
| Unit and component tests (server + client, Vitest) | 121 files, 669 tests pass, 0 fail | `npm run vitest:ci` |
| Static backend unit tests | 15/15 pass | `client/src/static/backend.test.ts` |
| Database-backed identity tests (PostgreSQL) | 7/7 pass | `PG_INTEGRATION=true` run; now enabled in CI |
| Server edition browser journeys J1–J10 (Chromium, real PostgreSQL) | 10/10 pass in one fresh run | `docs/evidence/e2e/e2e-run.log` |
| Pages edition browser journeys P1–P7 (Chromium, production static build) | 7/7 pass | `docs/evidence/pages/pages-run.log` |
| Catalog comparison | PASS (38 segment types, 223 variants, 16 boundaries, 10 environments, 338 illustrations, 84 icons) | `docs/catalog-report.md` |
| Lint (ESLint + Stylelint) | 0 errors | `npm run lint` |
| Type check | Not clean (pre-existing upstream errors); non-gating in CI | `npm run typecheck` |
| Docker build and smoke test | Pass | `docs/evidence/ops/container-smoke-2026-10-03.md` |
| Backup and restore (isolated databases) | Pass | same file |
| Firefox and WebKit | **Not run here** (browser downloads blocked); CI matrix now runs J1–J10 in both | CI |
| GitHub Actions CI | **Pending** (see "Deployment status") | Actions tab |

The Pages journeys use a simulated GitHub API (`test/e2e/github-mock.mjs`),
because the sandbox cannot reach GitHub. Everything else in them is the
production build served the way GitHub Pages serves it.

## Feature parity

121 rows in `docs/feature-parity.json` (rendered in `docs/feature-parity.md`).

| | NOT_STARTED | IMPLEMENTED_UNVERIFIED | VERIFIED | BLOCKED |
| --- | --- | --- | --- | --- |
| Implementation | 0 | 5 | 114 | 2 |
| Verification | 4 | 30 | 79 | 8 |

**Blocked:** OIDC social sign-in (no provider credentials), 3DStreet and
Streetmeter partner acceptance (unreachable), geocoder (no key), membership
billing (business decision), production email (no SMTP), server hosting
(superseded by Pages), one-click GitHub OAuth (needs a token-exchange
service).

**Not started:** Pages edition against the real GitHub API, live Pages
deployment check, CI run on GitHub, responsive testing on devices.

**Downgraded by the independent QA audit** (cited evidence did not exist or
did not test the claim; reasons are in each row's notes): EDIT-NEW-03,
EDIT-BOUNDARY-01, EDIT-ELEVATION-01, EDIT-KEYS-01, UI-COLORMODE-01,
USER-PROFILE-01, GAL-GLOBAL-01, GAL-DELETE-01, SAVE-FAIL-01,
SHARE-SOCIAL-01, SHARE-PREVIEW-01, EXPORT-IMAGE-02, EXPORT-IMAGE-03,
API-DOCS-01, INFO-WHATSNEW-01, INFO-DESC-01, INFO-HELP-01, I18N-UNITS-01,
ERR-PAGES-01.

## Independent review

A separate QA agent audited the matrix, evidence, code and docs. Its
blocker and high findings and what was done:

| Finding | Outcome |
| --- | --- |
| Evidence string claimed J1–J10 pass while the committed log showed J6 failing | Fixed: one fresh full run, 10/10, log committed; evidence string points to it |
| Auth rows cited a journey that did not exist and DB tests that never ran | Fixed: DB tests run locally (7/7) and in CI; citations corrected |
| VERIFIED rows citing non-existent tests | Downgraded with reasons (list above) |
| Translation endpoint path traversal | Fixed in both editions, with tests |
| Magic links created accounts for unverified addresses | Fixed: account created only when the link is opened, with a test |
| Bug-report page sent users to the upstream Discord | Fixed |
| Missing acceptance report | This document |
| Medium findings (lockout DoS, non-rotating refresh tokens, cookie `Secure` tied to NODE_ENV, rate limits on non-auth endpoints, proxy trust, per-process CSP nonce) | **Open**, server edition only; recorded here for follow-up |

## Configuration

Pages edition: `APP_BASE_PATH`, `SITE_URL`, optional `GITHUB_API_URL`
(build time). Membership: `public/data/members.json`. Server edition: see
`.env.example` and `docs/operations.md`.

## License and source

AGPL-3.0-or-later. The offer of corresponding source is published with the
site at `/Cross-section-app/source` with a downloadable archive of the
deployed commit, and the repository is public. Upstream attribution is in
the About dialog, the source page and `README.md`.

## Why NOT DONE

1. The live site and the GitHub API path have not been verified from a
   browser that can reach GitHub (this sandbox cannot).
2. CI has not completed green on GitHub yet.
3. 30 rows are implemented but not verified, 4 are not started, 8 are
   blocked (lists above).
4. Firefox and WebKit have not been run (added to CI).
5. The Pages edition has documented limitations versus the server edition
   (token sign-in, client-side Plus checks, no email/OIDC, no newsletter).
6. Open medium-severity security findings in the server edition.
7. Official STS brand assets have not been supplied; the palette is
   provisional (`docs/brand.md`).

## Deployment status

At the time of writing (2026-10-03 17:25 UTC):

* `gh-pages` was pushed and GitHub enabled Pages for the repository.
* The "pages build and deployment" run for `gh-pages` (run 37139891282) and
  the CI run for `sts-street` (run 37139875380) were both **queued** on
  GitHub's runners and had not started. Their results are tracked on the
  pull request.
