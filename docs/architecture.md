# STS Street — architecture and implementation strategy

Status: adopted 2026-10-03. Owner: STS Street engineering.

## 1. Decision summary

| Topic | Decision |
| --- | --- |
| Implementation approach | **Fork of the upstream Streetmix application**, imported with full git history, with STS-specific changes layered on top. No rewrite. |
| Upstream revision | `f17578eec760d3c7b41216823ec32c7e8d04e8bc` (upstream `main`, 2026-09-24, package version 1.3.0 / client 1.4.0). Tagged in this repository as `upstream-baseline`. |
| Code license | GNU Affero General Public License v3.0 or later (`AGPL-3.0-or-later`), unchanged. STS Street is distributed under the same license. |
| Asset licenses | Illustrations (`packages/illustrations`, 338 SVGs) and variant icons (`packages/variant-icons`, 84 SVGs): CC BY-SA 4.0. Fonts (Rubik, Manrope, Overpass, Geist Sans, Noto Sans Georgian): SIL OFL 1.1. UI icons: Tabler (MIT), Font Awesome Free (CC BY 4.0 / MIT). OpenMoji: CC BY-SA 4.0. |
| Identity | Built-in **STS identity service** (`app/auth/`): email + password, email magic links, password reset, optional federated sign-in through any OpenID Connect provider. Auth0 removed. |
| Entitlements | Unchanged role model (`app/data/user_roles.json`). `SUBSCRIBER_1` is the **STS Street Plus** tier, granted by STS administrators (API + CLI). Patreon/Coil/Stripe code removed. |
| Persistence | Two editions from one code base. **Server edition:** PostgreSQL 14+ with PostGIS, Sequelize migrations (upstream schema plus 3 STS migrations). **GitHub Pages edition:** GitHub Gists in each signed-in user's own GitHub account (see §7). |
| Hosting | **GitHub Pages** (static edition, chosen by STS on 2026-10-03: "Use github pages, and simple github dbs"), deployed by `.github/workflows/pages.yml`. The server edition (Docker image + `docker-compose.yml`) remains available for self-hosting; see `docs/operations.md`. |
| Corresponding source | Served by the application itself at `/source` (HTML offer) and `/source/sts-street-source.tar.gz` (archive built at deploy time), plus `/services/source` (JSON). |

## 2. Why a fork, not a rebuild

The upstream application is a mature editor: ~630 client source files, a
38-type / 223-variant element catalog, 29 locales, image export pipelines,
drag-and-drop editing with precision rules, schema migrations up to version
35, and 635 passing unit tests. Reimplementing it would cost months and would
inevitably diverge in behavior (the parity requirement). The upstream license
(AGPL-3.0-or-later) explicitly permits modified network use provided the
corresponding source is offered, which this project does.

Upstream was verified to run unmodified in this environment before any change
was made (see `docs/reference-baseline.md`): server + PostgreSQL + Parcel build,
118 test files / 635 tests passing.

## 3. What was retained, replaced, and added

### Retained (unchanged or lightly touched)
- Client editor (`client/src`): segments, palette, info bubble, boundaries,
  undo/redo, width/units logic, gallery, share menu, exports, sky/environment,
  localization, templates, feature flags, keyboard shortcuts.
- Street data model and all 35 schema versions (`app/lib/street_schema_update.js`).
- Street API (`/api/v1/streets*`), gallery API, translation API, sentiment
  survey API, remix handling, namespaced street IDs, soft delete.
- Package layout: `@streetmix/types`, `@streetmix/utils`, `@streetmix/parts`,
  `@streetmix/i18n`, `@streetmix/export-image`, `@streetmix/illustrations`.
  Package names, street JSON keys and public URL formats are deliberately
  unchanged for data compatibility and for the 3DStreet / Streetmeter
  integrations, which consume the public street URL.

### Replaced (operator-specific services)
| Upstream dependency | STS Street replacement | Where |
| --- | --- | --- |
| Auth0 (universal login, passwordless, social) | STS identity service: scrypt password accounts, magic links, password reset, RS256 tokens with local JWKS, generic OIDC federation | `app/auth/*`, `app/authentication.ts`, `client/src/app/routing.ts`, `client/src/dialogs/SignIn`, `client/src/dialogs/PasswordReset` |
| Patreon / Coil / Stripe membership plumbing | Role-based entitlements managed by STS: `PUT /api/v1/users/:id/roles` (admin) and `npm run sts:admin` CLI; in-app membership dialog explains how to request access | `app/resources/v1/users.ts`, `bin/sts-admin.ts`, `client/src/dialogs/Upgrade` |
| Cloudinary (profile image cache, street thumbnails) | Provider image URLs stored directly; street images rendered on demand by the server exporter with an on-disk cache and server-side entitlement checks | `app/resources/v1/street_images.ts` |
| Buttondown newsletter (browser → third party) | First-party subscription table | `app/resources/services/newsletter.ts`, migration `20261003100200` |
| Pelias geocoder at geocode.earth, CARTO basemap with upstream key | Pelias-compatible host/key supplied by STS (optional); basemap tile URL configurable, defaults to OpenStreetMap | `.env.example`, `client/src/app/config.ts`, `client/src/dialogs/Geotag` |
| Sentry (hard-coded upstream DSN), New Relic, Userback, Cloudflare Insights, Plausible (upstream site id) | All removed or made opt-in via env (`SENTRY_DSN`, `PLAUSIBLE_ID`/`PLAUSIBLE_HOST`) | `app.ts`, `client/src/main.tsx` |
| Transifex live translation fetch | Bundled translations in `packages/i18n/locales` (still supported when a token is configured) | unchanged code path |
| Upstream legal pages, docs site, Discord, store, sponsors | STS legal pages served by the app, in-app user guide at `/docs`, STS contact destinations | `app/views/legal/*`, `packages/branding` |
| Heroku Procfile / app.json | Dockerfile + docker-compose + GitHub Actions CI | `Dockerfile`, `docker-compose.yml`, `.github/workflows/ci.yml` |

### Added
- `packages/branding`: single source of truth for product/operator names and
  destinations, consumed by server views and the client.
- `client/styles/_brand.css`: STS palette mapped onto the upstream CSS tokens.
- `/healthz`, `/.well-known/jwks.json`, `/source`, `/privacy-policy`,
  `/terms-of-service`, `/reset-password`.
- Account deletion that actually deletes (upstream `DELETE /users/:id` was a
  no-op), server-side ownership checks on `PATCH /users/:id`, admin check
  hardening on `GET /users`, server-side enforcement of premium export options.
- Georgian script support in server-side image export (Noto Sans Georgian).
- Demo seed (`npm run db:seed:demo`), admin CLI, key generator, source archive
  builder, Playwright acceptance journeys (`test/e2e`).

## 4. Identity service design

```
Browser ──(email+password | magic link | OIDC)──► /services/auth/*
                                                     │ issues RS256 id token (7 d)
                                                     │ + opaque refresh token (90 d, hashed in AuthTokens)
                                                     ▼
Cookies: login_token (JWT), refresh_token, user_id   ──► API requests verified by app/authentication.ts
                                                          using the local public key (JWKS at /.well-known/jwks.json)
```

- Subjects: `sts|<uuid>` for local accounts, `oidc:<provider>|<sub>` for
  federated accounts; stored in `Users.auth_subject` (renamed from `auth0_id`).
- Passwords: scrypt (N=2^15, r=8, p=1), minimum 10 characters, common-password
  deny list, lockout after 10 failures for 15 minutes, rate limits on all
  credential endpoints.
- Magic links / password resets: single-use, hashed, 15 min / 60 min expiry.
- Signing key: `AUTH_JWT_PRIVATE_KEY(_FILE)`; production refuses to start
  without one. Development/test generate an ephemeral key.
- Email: SMTP via nodemailer; `outbox` file transport for development and tests
  (refused in production); `none` disables email-dependent flows with explicit
  503 responses, never silent failure.
- The cookie contract with the client (names, readable `login_token`) is kept
  from upstream so that the client's refresh scheduling and cross-tab
  sign-in detection keep working.

## 5. Maintenance and upstream update strategy

- `git remote add upstream https://github.com/streetmix/streetmix.git`
- `git fetch upstream && git merge upstream/main` on a branch; the fork keeps
  full upstream history so three-way merges work. STS-specific code lives in
  clearly separated locations (`app/auth`, `packages/branding`, `app/views`,
  `client/styles/_brand.css`, `bin/`, `docs/*.md`) to minimize conflicts.
- Known conflict hotspots: `app.ts`, `app/service_routes.ts`,
  `app/resources/v1/users.ts`, `client/src/dialogs/SignIn`, menus/About dialog.
- Translations: product name substitution happens at runtime
  (`client/src/store/slices/locale.ts`), so upstream translation updates can be
  merged without re-editing 29 locale files.
- After each merge: `npm ci && npm run build:app && npm test && npm run test:e2e`.

## 6. Licensing obligations checklist

- [x] `LICENSE` retained (AGPL-3.0-or-later with upstream relicensing note).
- [x] Upstream copyright preserved in `README.md`, About dialog, `/source`.
- [x] Illustration/icon CC BY-SA 4.0 attribution retained in About dialog,
      exported-image license footer, `/source`.
- [x] Prominent source offer in the running application: footer link
      "Source code" on every page shell, About dialog, `/source`, `/services/source`.
- [x] Complete corresponding source archive produced by `npm run source:archive`
      (run automatically in the Docker build) and served at
      `/source/sts-street-source.tar.gz`; it contains build/install material
      (`README.md`, `docs/operations.md`, `Dockerfile`) and excludes secrets and
      user data (`.env`, `data/`).
- [x] No claim of endorsement by or affiliation with Streetmix.
- [ ] Business decision (STS): keep the GitHub repository public, or rely on the
      in-app archive as the sole source channel. Both satisfy AGPL §13; the
      archive is the mechanism this release relies on.

## 7. GitHub Pages edition (static, GitHub as the database)

Decision 2026-10-03 (STS): host on GitHub Pages and use "simple GitHub
databases". GitHub Pages serves static files only, so this edition runs the
whole application in the browser.

### How it works

| Concern | Server edition | GitHub Pages edition |
| --- | --- | --- |
| HTTP API | Express (`app/`) | `client/src/static/backend.ts`, installed by `client/src/static/install.ts`, which wraps `window.fetch`. The client still calls the same `/api/v1/*` and `/services/*` URLs, so editor code is shared. |
| Street storage | PostgreSQL `Streets` table | One **public gist** per street in the signed-in user's GitHub account, file `sts-street-<n>.json` (`<n>` = the per-user street number used in URLs). |
| Anonymous streets | Stored on the server, creator IP recorded | Stored in this browser's local storage only; promoted to a gist when the person signs in (same "promote on sign-in" flow). |
| Settings | `Users.data` | A **secret gist** `sts-street-settings.json`, mirrored in local storage. |
| Identity | STS identity service | GitHub account. The person pastes a personal access token with the `gist` scope; it stays in local storage and is sent only to `api.github.com`. Revoked tokens are detected (401) and sign the person out. |
| Permissions | Server-side owner checks | Enforced by GitHub: only a gist's owner can change or delete it. The backend mirrors the server's 401/403 responses; ownership is taken from the gist owner, never from file content. |
| Plus membership | `SUBSCRIBER_1` role granted by admins | `public/data/members.json` (GitHub logins), changed by reviewed pull request. Client-side enforcement only (see limitations). |
| Translations, changelog | `/api/v1/translate`, `/services/changelog` | Static files published with the site (`locales/`, `data/changelog.md`). |
| Examples gallery | `examples` user account | `public/data/examples.json` (generated by `bin/build-examples.mjs`, every part validated against the catalog). The `examples` name is reserved and never looked up on GitHub. |
| Image export | Client canvas + optional server renderer | Client canvas export (the upstream default path). |
| Routing | Express catch-all | `404.html` is a copy of `index.html`, so deep links (`/<user>/<n>/<slug>`) load the app. `APP_BASE_PATH` (e.g. `/Cross-section-app`) prefixes every in-app URL (`client/src/static/env.ts`, `packages/branding`). |
| Legal pages, source offer | Rendered by Express | Rendered at build time from the same Handlebars partials (`app/views/static/*`); the corresponding-source archive is published with the site at `/source/`. |

### Saving semantics

* "Saved" is only reported after GitHub accepts the write: the PUT promise
  the editor waits on resolves when the gist update succeeds.
* Rapid edits are **coalesced**: at most one write per street every 2 s,
  carrying the latest state. This keeps heavy editing inside GitHub's
  secondary rate limits for content creation.
* Viewing another person's street costs two GitHub API calls (list their
  gists, read the gist). Anonymous visitors share GitHub's limit of 60 API
  requests per hour per IP address; signed-in people get 5,000 per hour.
  Rate-limit responses are shown as a temporary error, and a cached copy is
  used where one exists.

### Limitations of the Pages edition (recorded, not hidden)

1. **Sign-in uses a personal access token**, not an OAuth button. GitHub's
   OAuth token exchange needs a client secret and does not allow browser
   (CORS) requests, so a one-click "Sign in with GitHub" needs a small token
   exchange service (for example a serverless function). Not built, because
   it would be the server this edition avoids.
2. **Email/password, magic links, password reset and OIDC providers** exist
   only in the server edition.
3. **Plus entitlements are enforced in the browser**, from a public list. A
   technically skilled person can unlock Plus UI features locally. Nothing
   is charged and no data is exposed by this, but it is weaker than the
   server edition's checks.
4. **Streets of signed-in people are public gists** (as streets are public by
   link in Streetmix). Settings are in a secret gist, which GitHub describes
   as unlisted rather than private.
5. **Anonymous streets live in one browser** and cannot be opened on another
   device until the person signs in.
6. **No global gallery** (there is no index of all users' gists); the admin
   global gallery shows the streets stored in this browser instead.
7. **Newsletter sign-up, surveys, geolocation, server image renderer and the
   remixes CSV endpoint** need the server and are hidden or report "not
   available" (HTTP 404/501) in this edition.
8. **The site has no HTTP response headers of its own** (GitHub Pages), so
   the content security policy is delivered as a `<meta>` tag and cannot
   include `frame-ancestors`.

### Verification

* Unit tests: `client/src/static/backend.test.ts` (fake GitHub API).
* Browser journeys P1–P7: `test/e2e/pages.mjs` against the production build
  served the way GitHub Pages serves it (`bin/serve-pages.mjs`) and a
  simulated GitHub API (`test/e2e/github-mock.mjs`). The test sandbox cannot
  reach `api.github.com`; the real API is exercised only on the deployed
  site.
