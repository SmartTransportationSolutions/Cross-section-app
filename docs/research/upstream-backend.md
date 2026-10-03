# Streetmix backend inventory

Source: upstream checkout at `scratchpad/upstream-streetmix`, commit `f17578eec760d3c7b41216823ec32c7e8d04e8bc` (2026-09-24, "fix: update canonical unfurl image url"). All paths below are relative to that checkout root. Everything is derived from source; nothing was fetched from streetmix.net. Items marked **UNVERIFIED** could not be confirmed from source alone.

Stack summary (`package.json`): Node `^22.21 || ^24.10 || ^26` running TypeScript directly (type-stripping; `node index.ts`), Express 5.2, Sequelize 6.37 + `pg`, `express-jwt` 8 + `jwks-rsa`, `cookie-session`, `helmet` 8, `hbs` (Handlebars), `passport` + `passport-patreon` + `passport-oauth2`, `cloudinary` 2, `auth0` 6 (server SDK), `axios`, `zod` 4, `winston`, `newrelic`, `swagger-jsdoc` + `swagger-ui-express`, `svg-sprite`, `papaparse`, `nanoid`. Workspaces: `packages/types`, `packages/utils`, `packages/i18n`, `packages/parts`, `packages/*` (export-image, feature-flags, illustrations, variant-icons), `client`, `docs`.

---

## 1. Server entry and middleware stack

### 1.1 `index.ts`
- Imports `app.ts`, calls `app.listen(process.env.PORT, ...)`.
- Logs: Coastmix mode active if `STREETMIX_INSTANCE === 'coastmix'`; dev URL `http://localhost:${PORT}` when `NODE_ENV === 'development'`; "Offline mode is ON" when `OFFLINE_MODE === 'true'`.
- No clustering, no graceful shutdown beyond `SIGINT` handler in `app.ts`.

### 1.2 `app/globals.ts` (imported first by `app.ts`)
Sets `process.title = 'streetmix'` and defaults: `APP_DOMAIN` → `localhost`; `APP_PROTOCOL` → `PROTOCOL || (APP_DOMAIN === 'localhost' ? 'http' : 'https')` (note: reads `PROTOCOL`, not `APP_PROTOCOL`, as the override — operator precedence means `PROTOCOL` truthy OR localhost → `http`, else `https`; documented `APP_PROTOCOL` env var is effectively ignored as input); `PORT` → `8000`; `NODE_ENV` → `development`.

### 1.3 `app.ts` — startup side effects (before Express is built)
| Step | Evidence | Notes |
|---|---|---|
| `initCloudinary()` | `app/lib/cloudinary.ts` | `cloud_name: 'streetmix'` hard-coded; `api_key`/`api_secret` from `CLOUDINARY_API_KEY/SECRET`. |
| `compileSVGSprites('packages/variant-icons/icons/', 'icons', 'icon')` and `compileSVGSprites('packages/illustrations/images/', 'images', 'image')` (top-level `await Promise.all`) | `app/lib/svg_sprite.ts` | Globs `**/*.svg`, builds `build/icons.svg` and `build/images.svg` as `<symbol>` sprites with ids `icon-*` / `image-*`. Served at `/assets/icons.svg`, `/assets/images.svg`. Errors are logged, not fatal. |
| `app.locals.cacheTimestamp = Date.now()` | `app.ts` | Cache-busting token used in `main.hbs`/`error.hbs` asset URLs; stripped again by URL rewrite middleware. |
| `process.on('uncaughtException')` → log, `console.trace()`, `process.exit(1)` | `app.ts` | |
| `process.on('SIGINT')` → log in dev, `process.exit()` | `app.ts` | |
| `app.locals.env = { FACEBOOK_APP_ID, PLAUSIBLE_ID, WEB_MONETIZATION_PAYMENT_POINTER }` | `app.ts` | Only these three env vars reach templates. |

### 1.4 Middleware order (exact, `app.ts`)
1. `helmet(helmetConfig)` — `frameguard: false` (iframing allowed), `contentSecurityPolicy: false` (set separately below), `crossOriginEmbedderPolicy: false`, `hsts: { maxAge: 5184000 (60d), includeSubDomains: false }`, `referrerPolicy: strict-origin-when-cross-origin`. Other helmet defaults (nosniff, X-DNS-Prefetch-Control, etc.) remain on.
2. `express.json()` — default body limit (100kb). Street PUT/POST payloads go through this.
3. `compression()`
4. `cookieParser()`
5. `cookieSession({ secret: process.env.COOKIE_SESSION_SECRET || 'seger handrail', sameSite: 'strict' })` — **default secret in code** (see §12). Session is only used for `req.session.btpToken` (Coil) and by passport.
6. `requestHandlers.requestLog` (`app/lib/request_handlers/request_log.ts`) — `logger.debug({method,url,content_type,user_id: req.cookies.user_id})`.
7. `requestHandlers.requestIdEcho` (`request_id_echo.ts`) — echoes `X-Streetmix-Request-Id` request header back as response header.
8. `passport.initialize()`, `passport.session()`
9. Anonymous middleware setting `res.locals.nonces`, `res.locals.STREETMIX_IMAGE {image,width:1008,height:522}`, `STREETMIX_TITLE`, `STREETMIX_DESCRIPTION`, `STREETMIX_URL = appURL.href`. Values switch between Streetmix and Coastmix on `STREETMIX_INSTANCE === 'coastmix'` (image `https://streetmix.net/images/thumbnail.png` vs `https://coastmix.org/images/thumbnail-coastmix.png`).
10. `helmet.contentSecurityPolicy(csp)` — see §1.5.
11. URL rewrite: `req.url.replace(/\/([^/]+)\.[0-9]+\.(css|js)(\?[0-9]+)?$/, '/$1.$2')` (strips cache timestamp from `main.<ts>.css|js`).
12. View engine `hbs`, views dir `app/views`; registers Handlebars block helper `replace` (string token replacement, returns SafeString).
13. Static routes: `/help/about` → 302 `https://about.streetmix.net/`; `/help`, `/help/{*splat}` → 404; `/map` → 302 `https://streetmix.github.io/map/`; `/survey` → `auth(false)`, `controllers.survey.get`; `/privacy-policy` → `https://about.streetmix.net/privacy-policy/`; `/terms-of-service` → `https://about.streetmix.net/terms-of-use/`.
14. If `NODE_ENV !== 'production'`: `/api/docs` → swagger-ui from JSDoc in `app/api_routes.ts` and `app/service_routes.ts` (`swagger-jsdoc`, title "Streetmix", version `npm_package_version`).
15. `app.use('/api', apiRoutes)`; `app.use('/services', serviceRoutes)`; `app.use('/error', errorRoutes)`.
16. `app.use('/assets', express.static('<root>/build'))` — Parcel client bundle output + SVG sprites.
17. `app.use('/assets/data', express.static('<root>/app/data'))` — exposes `app/data/templates/*.yaml` and `app/data/user_roles.json` publicly.
18. `app.use(express.static('<root>/public'))` — favicons, `images/*`, `site.webmanifest`.
19. `app.all(/\/images\/.*/)` and `app.all(/\/assets\/.*/)` → 404 for missing assets.
20. `app.get(['/:user_id/:namespacedId', '/:user_id/:namespacedId/:street_name'], requestHandlers.metatags)` — see §1.7.
21. Catch-all `app.use((req,res) => res.render('main'))` — SPA shell.
22. Error handler `(err, req, res, next) => serveErrorPage(req, res, err.status || 500, err.user ?? null)` (`app/lib/errorPage.ts`), renders `error.hbs` with status 401/404/410/500/503.

### 1.5 Content Security Policy (`app.ts`)
`reportOnly: NODE_ENV === 'development'`; `reportUri: '/services/csp-report/'`. In development also adds `'unsafe-eval'` to `script-src` and `ws:` to `connect-src`.

| Directive | Sources |
|---|---|
| default-src | `'self'` |
| style-src | `'self'`, `'unsafe-inline'`, `checkout.stripe.com`, `static.userback.io` |
| script-src | `'self'`, `$AUTH0_DOMAIN`, `*.basemaps.cartocdn.com`, `$PELIAS_HOST_NAME`, `checkout.stripe.com`, `plausible.io`, `'nonce-<random per process>'`, `static.cloudflareinsights.com`, `static.userback.io` |
| worker-src | `'self'` |
| frame-ancestors | `'self'`, `https:` |
| frame-src | `'self'`, `streetmix.github.io`, `checkout.stripe.com` |
| img-src | `'self'`, `*.streetmix.app`, `blob:`, `data:`, `*.basemaps.cartocdn.com`, `abs.twimg.com`, `pbs.twimg.com`, `platform-lookaside.fbsbx.com`, `s.gravatar.com`, `*.googleusercontent.com`, `res.cloudinary.com`, `*.wp.com`, `cdn.auth0.com`, `*.stripe.com` |
| object-src | `'self'`, `*.streetmix.app`, twimg/fbsbx/gravatar/googleusercontent/cloudinary/wp.com/cdn.auth0.com (profile images in `<object>` on error page) |
| font-src | `'self'`, `static.userback.io`, `cdn.jsdelivr.net` |
| connect-src | `'self'`, `$PELIAS_HOST_NAME`, `sentry.io`, `$AUTH0_DOMAIN`, `checkout.stripe.com`, `plausible.io`, `buttondown.com`, `buttondown.email`, `cloudflareinsights.com`, `api.userback.io` |

The Plausible nonce (`crypto.randomBytes(16)`) is generated **once per process**, not per request.

### 1.6 Handlebars views (`app/views/*.hbs`)
`main.hbs` (SPA shell) consumes: `STREETMIX_TITLE`, `STREETMIX_DESCRIPTION`, `STREETMIX_URL`, `STREETMIX_IMAGE.image/width/height` (OpenGraph + Twitter cards), `env.FACEBOOK_APP_ID` (`fb:app_id`), `env.WEB_MONETIZATION_PAYMENT_POINTER` (`<meta name="monetization">`), `env.PLAUSIBLE_ID` (loads `https://plausible.io/js/{{PLAUSIBLE_ID}}.js` + inline init with `nonce="{{nonces.plausible}}"`), `cacheTimestamp` (`/assets/main.{{cacheTimestamp}}.css|js`). Mount point `#react-app`, SVG staging `#svg`, privacy-policy link. `lang="en"` hard-coded. **No locale, flags, user, or feature data is injected server-side**; the client fetches all of it over the API.

`error.hbs` consumes: `lang`, `title`, `errorCode`, `heading`, `message`, `temporary`, `returnButton`, `signInButton` (never set in code), `userId`, `userName`, `userRedirect`, `profileImageUrl`, `profileImageMimeType`, `needHelp`, `cacheTimestamp`. Content is English-only (`app/lib/errorPage.ts`, TODO to use Accept-Language).

### 1.7 Metatags request handler (`app/lib/request_handlers/metatags.ts`)
For `/:user_id/:namespacedId[/:street_name]`: `user_id === '-'` means anonymous creator (`creatorId: null`); otherwise looks up `User` by id → 404 if missing. Finds `Street` by `{creatorId, namespacedId}`; 404 if none (Sequelize errors from non-integer namespacedId also → 404); 410 if `status === 'DELETED'`. On success sets `res.locals.STREETMIX_TITLE = "<name|Unnamed Street> - Streetmix"`, appends `${userId}/${namespacedId}/` to `STREETMIX_URL`, then does an HTTP self-call `GET ${appURL.origin}/api/v1/streets/${id}/image/` (id becomes `DEFAULT_STREET`/`EMPTY_STREET` when `editCount === 0`) and uses `secure_url/width/height` from the JSON response if present. Note: `/image` now streams PNG bytes (see §8), so `results.secure_url` will never exist — thumbnail unfurls are effectively broken. Also `if (!userId || !namespacedId) { next() }` lacks `return`.

### 1.8 Error routes (`app/error_routes.ts`, mounted at `/error`)
`/access-denied` → 401; `/authentication-api-problem`, `/no-access-token`, `/no-twitter-access-token`, `/no-twitter-request-token` → 503; any other `/error/*` → 404. All render `error.hbs` via the catch-all error handler.

### 1.9 Health endpoints
None. Grep for `health|ping|status|readiness|liveness` in `app.ts`, `app/*.ts`, `app/resources` yields nothing. The closest is any route returning 200 (e.g. `GET /services/changelog`).

---

## 2. Routes

Auth legend: `auth()` = JWT required (401 JSON on missing/invalid); `auth(false)` = JWT optional (invalid/expired treated as anonymous); `none` = no auth middleware. `cors()` = `cors` package with defaults (`Access-Control-Allow-Origin: *`). Rate limiting: **none anywhere** (only `jwks-rsa` limits JWKS fetches to 5/min).

### 2.1 `app/api_routes.ts` (mounted at `/api`)
`router.options(/.*/, cors())` handles all preflights.

| Method | Path | Auth | Handler | Request | Response | Validation / ownership |
|---|---|---|---|---|---|---|
| POST | `/v1/users` | `auth()`, `cors()` | `v1.users.post` (`app/resources/v1/users.ts`) | JSON `{ auth0: {nickname, auth0Id, email, profileImageUrl} }` or `{ auth0_twitter: {screenName, auth0Id, profileImageUrl} }` | 201 `{id}` + `Location` on create; 200 `{id}` on existing; 400 unknown method; 500 | No zod. Called server-to-server by the Auth0 callback with the new `id_token` as `login_token` cookie. Any valid JWT holder can call it with arbitrary body (creates/updates a user keyed by `auth0Id`). |
| GET | `/v1/users` | `auth(false)`, `cors()` | `v1.users.get` | — | 200 `User[]` (full `asUserJson`) if caller is ADMIN; 401 otherwise | Admin check `callingUser?.roles?.indexOf('ADMIN') !== -1` — evaluates **true when `callingUser` is null** (see §12). No pagination (TODO). |
| GET | `/v1/users/:user_id` | `auth(false)`, `cors()`, `BTPTokenCheck` | `v1.users.get` | — | 200 full user (`id, displayName, profileImageUrl, flags, roles, data`) if `req.auth.sub === user.auth0Id`, else basic (`id, displayName, profileImageUrl`); 404 | `BTPTokenCheck` (Coil) may set `btpToken` cookie. |
| PUT | `/v1/users/:user_id` | `auth()`, `cors()` | `v1.users.put` | JSON `{ data: UserSettings }` (anything else ignored) | 204; 401; 404 | Caller must be same user or ADMIN. Only `data` is written (swagger lists roles/flags/profileImageUrl but code ignores them). |
| PATCH | `/v1/users/:user_id` | `auth()`, `cors()` | `v1.users.patch` | JSON `{ displayName }` | 204; 401 (no sub); 404 | **No ownership check** — any authenticated user can change any user's `displayName` (see §12). Model validates `len [0,30]`. |
| DELETE | `/v1/users/:user_id` | `auth()`, `cors()` | `v1.users.del` | — | 204; 401; 404 | Same user or ADMIN. Body is `User.update(user, …)` — a no-op write; **nothing is deleted or anonymised**. |
| DELETE | `/v1/users/:user_id/login-token` | `auth()`, `cors()` | `v1.userSession.del` (`user_session.ts`) | — | 204 | Clears cookies `refresh_token`, `login_token`, `access_token` (maxAge 0). `:user_id` is not checked against the token. |
| DELETE | `/v1/users/:user_id/streets` | `auth()`, `cors()` | `v1.usersStreets.del` (`users_streets.ts`) | — | 204; 401; 403; 404; 500 | Sets `status='DELETED'` on all ACTIVE streets of target. Self or ADMIN. |
| GET | `/v1/users/:user_id/streets` | none, `cors()` | `v1.usersStreets.get` | query `page` (default 1), `limit` (default 100, max 200) | 200 `{streets: StreetBasic[], pagination}`; 400 zod field errors; 404 | zod `paginationQuerySchema`; filters `status: 'ACTIVE'`, order `updatedAt DESC`; drops rows with `data === null`. |
| POST | `/v1/streets` | `auth(false)` | `v1.streets.post` (`streets.ts`) | JSON `{name?, clientUpdatedAt?, data?, originalStreetId?}` | 201 `Street` + `Location`; 404 orig street/user; 401; 500 | **No validation of `data`** (`// TODO: Validation`). Stores `creatorIp` (first `X-Forwarded-For` value or socket address). If authed, `creatorId = user.id` and `namespacedId` from `user.lastStreetId++`; else from global `Sequences('streets')`. `originalStreetId` is only *verified*, not stored (client sets it later via PUT). |
| GET / HEAD | `/v1/streets` | none | `v1.streets.find` | query `creatorId?`, `namespacedId?`, `page`, `limit` | With `creatorId`+`namespacedId` or `namespacedId` alone: **307** redirect to `/api/v1/streets/:id` with `Access-Control-Allow-Origin: *`; 404/410. Otherwise 200 `{streets, pagination}` of all ACTIVE streets newest first. | zod `findQuerySchema`. |
| DELETE | `/v1/streets/:street_id` | `auth()` | `v1.streets.del` | — | 204 (also when street not found); 401; 403; 404 user | Owner only (`street.creatorId === user.id`); anonymous streets cannot be deleted (403). Soft delete (`status='DELETED'`). |
| HEAD / GET | `/v1/streets/:street_id` | none | `v1.streets.get` | — | HEAD: 204 + `Last-Modified`; GET: 200 `Street` with `Access-Control-Allow-Origin: *`, `Location`; 404; 410 if DELETED | Strips legacy `undoStack/undoPosition`; runs `updateToLatestSchemaVersion` and **writes back** (`save({silent:true})`) if upgraded (write-on-read). Adds deprecated `left/rightBuilding*` fields and `plugins: {}` via `asStreetJson`. |
| PUT | `/v1/streets/:street_id` | `auth(false)` | `v1.streets.put` | JSON `{name?, data?, clientUpdatedAt?, originalStreetId?}` | 204; 400; 401; 403; 404; 410 | Anonymous street (`creatorId` null): **anyone can update**. Owned street: must be owner. `originalStreetId` verified to exist then stored. No `data` validation. |
| POST | `/v1/streets/:street_id/image` | `bodyParser.text({limit:'3mb'})`, `auth()` | `v1.streetImages.post` (`street_images.ts`) | `text/plain` body = JSON string `{image (data URL), event, streetType?, editCount, creatorId}` | 201 `{public_id,width,height,format,secure_url,created_at}`; 400; 403; 404; 500; **501** if `event` not `INITIAL`/`TEST` | See §8. |
| DELETE | `/v1/streets/:street_id/image` | `auth()` | `v1.streetImages.del` | — | 204; 400 for stock ids; 401; 403; 404 | Owner only; `cloudinary.uploader.destroy`. |
| GET | `/v1/streets/:street_id/image` | none | `v1.streetImages.get` | query `experimental=1` + export params | 200 `image/png` stream; 404; 400 zod; 500 | See §7/§8. |
| GET | `/v1/streets/:street_id/remixes` | none | `v1.streetRemixes.get` (`street_remixes.ts`) | — | 200 `text/csv`; 404; 500 | All ACTIVE streets with `originalStreetId === :street_id`, CSV via `streetsToCSV`. No auth, no pagination, not recursive. |
| GET | `/v1/translate/:locale_code/:resource_name` | none | `v1.translate.get` (`translate.ts`) | — | 200 JSON, `Cache-Control: max-age=86400`, `Location`; 404 ENOENT; 500 | See §9. **No validation of path params** (see §12). |
| GET | `/v1/votes` | `auth()`, `cors()` | `v1.votes.get` (`votes.ts`) | — | 200 `{ballots: Vote[]}` (one random candidate); 204 none left; 403 user missing; 500 | Candidate ballots = `Vote` rows with `voterId IS NULL` not containing `user.id` in `submitted`; skips creator's own streets (appends to `submitted`), marks ballots for non-ACTIVE streets `voterId='DELETED'`. |
| POST | `/v1/votes` | `auth()`, `cors()` | `v1.votes.post` | JSON `{data, score, streetId}` | 200 `{ballot, updates}`; 401; 403; 500 | Creates `Vote{id: uuid, voterId: user.id}`, appends `user.id` to `submitted` on candidate ballot for that street. No validation of `score`/`streetId`. |
| PUT | `/v1/votes` | `auth()`, `cors()` | `v1.votes.put` | JSON `{id, comment}` | 200 `Vote`; 401; 403 not owner; 413 >280 chars | Only own ballot (`voterId: user.id`). |
| ALL | `/*` | — | inline | — | 404 `{status:404,error:'Not found. Did you mispell something?'}` | |

`v1.geo.get` (`app/resources/v1/geo.ts`) exists (GeoJSON FeatureCollection of all ACTIVE streets with `data.street.location`) but **is not wired to any route**.

Swagger JSDoc definitions in `api_routes.ts`: `UserData`, `User`, `Language`, `GeolocationResponse`, `StreetImageData`, `Segment`, `StreetData`, `NewStreetImage`, `NewStreet`, `Street`, `Flags`, `FlagItem`. Several are stale relative to code (e.g. `NewStreet` requires `password`; `PUT /users` lists `roles`/`flags`).

### 2.2 `app/service_routes.ts` (mounted at `/services`)

| Method | Path | Auth | Handler | Behaviour |
|---|---|---|---|---|
| GET | `/changelog` | none | `services.changelog.get` (`app/resources/services/changelog.ts`) | Reads `<cwd>/docs/docs/user-guide/changelog.md`, splits on `---\n`, returns the body after front-matter as `text/plain`; 404 if file missing; 500 if no body. |
| POST | `/pay` | **none** | `services.payments.post` (`payments.ts`) | Stripe code is commented out. Reads `userId` from body, loads user, pushes `SUBSCRIBER_1` role onto the in-memory instance, then dereferences undefined `subscription.id` → caught → 500 "Unexpected error while processing payment." Never saves. Dead code; see §12. |
| GET | `/geoip` | none (Referer check) | `services.geoip.get` (`geoip.ts`) | 403 unless `Referer` host equals `appURL.host`. Returns `{countryCode}` from Cloudflare `cf-ipcountry` header, else `null`. No external provider is called. |
| OPTIONS | `/images` | `cors()` | — | preflight |
| GET | `/images` | `auth()`, `cors()` | `services.images.get` (`images.ts`) | Intended to return Cloudinary upload signature `{signature, timestamp, api_key}` for `req.query`. Compares `req.auth.sub !== user.id` (auth0 sub vs. nickname) → **always 401 for real users**; effectively dead. 500 if `CLOUDINARY_API_SECRET` unset. |
| POST | `/auth0/refresh-login-token` | none, `cors()` | `controllers.refreshLoginToken.post` | Body `{token: <refresh_token>}` → Auth0 `/oauth/token` grant `refresh_token` with client id+secret; sets `login_token` cookie to new `id_token`; 200 `{token}`; 401 on failure. |
| GET | `/auth0/sign-in-callback` | none | `controllers.auth0SignInCallback.get` | OAuth code exchange; see §3. |
| GET | `/auth0/just-signed-in/` | none | inline `res.render('main')` | Client handles `JUST_SIGNED_IN` mode. |
| GET | `/integrations/patreon` | `auth()` | `patreon.get` | `passport.authorize('patreon', {state: req.auth.sub, failureRedirect: '/error'})`; 500 if `PATREON_CLIENT_ID/SECRET` unset. Scope `users pledges-to-me my-campaign`. |
| GET | `/integrations/patreon/callback` | none | `patreon.callback`, `patreon.connectUser` | Verify callback looks up user by `req.query.state` (auth0 sub), stores profile in `req.profile`; `connectUser` → `addUserConnection(req.account, req.profile)`; redirect `/` or `/error`. No role assigned. |
| POST | `/integrations/patreon/webhook` | none (HMAC) | `patreon.webhook` | Requires `x-patreon-event` + `x-patreon-signature` (403); 501 if `PATREON_WEBHOOK_SECRET` unset; verifies HMAC-MD5 of `JSON.stringify(req.body)`; on success **does nothing** (204). |
| GET | `/integrations/coil` | `auth()` | `coil.get` | `passport.authorize('coil', {state: req.auth.sub})`; 500 if `COIL_CLIENT_ID/SECRET` unset. |
| GET | `/integrations/coil/callback` | none | `coil.callback`, `coil.connectUser` | OAuth2 strategy (`https://coil.com/oauth/auth`, `/oauth/token`, scope `simple_wm openid`), userProfile via `POST https://api.coil.com/user/info`; `connectUser` fetches BTP token (`POST https://api.coil.com/user/btp`), stores in `req.session.btpToken`, `addUserConnection`, `syncAccountStatus` → `addRole('SUBSCRIBER_1')`. |
| POST | `/csp-report` | none, `bodyParser.json({type:'application/csp-report'})` | `services.cspReport.post` | 400 if no `csp-report`; ignores `__parcel_code_frame`, `eval`, `moz-extension`; logs warn; 204. |
| ALL | `/*` | — | inline 404 JSON | |

### 2.3 `apiary.apib` (root)
Legacy API Blueprint for `http://streetmix-staging.herokuapp.com/api/v1`: `POST /users` with Twitter OAuth credentials returning `loginToken`, `DELETE /users/{id}/login-token`, `GET/PUT /users/{id}`, `GET /users/{id}/streets`, `POST/GET/DELETE/PUT /streets[/{id}]`, `POST /feedback`. It describes the pre-Auth0 (Twitter + login-token) API and does not match current code (no `/feedback` route exists; `loginToken` removed by migration `20200429210044`). Treat as historical.

---

## 3. Authentication

### 3.1 JWT verification (`app/authentication.ts`)
- `jwksRsa.expressJwtSecret({cache: true, rateLimit: true, jwksRequestsPerMinute: 5, jwksUri: https://$AUTH0_DOMAIN/.well-known/jwks.json})`.
- `expressjwt({algorithms: ['RS256'], issuer: https://$AUTH0_DOMAIN/, audience: $AUTH0_CLIENT_ID, credentialsRequired, getToken})`.
- `getToken` reads **only** `req.cookies.login_token` (no `Authorization` header support). Decoded token lands on `req.auth`; handlers use `req.auth.sub`.
- `auth(true)`: `UnauthorizedError` → 401 `{status:401, msg:'Access token expired.'}` when `inner.name === 'TokenExpiredError'`, else `'Unauthorized request.'`. `auth(false)`: any `UnauthorizedError` → proceed anonymous. Non-JWT errors propagate.
- The token is Auth0's **`id_token`** (audience = client id), not an access token.

### 3.2 Sign-in flow
1. Client (`client/src/app/auth0.ts`, `client/src/app/routing.ts`): `auth0-js` `WebAuth({domain, clientID, scope: 'openid profile screen_name offline_access email'})`. `authorize({responseType:'code', connection: 'twitter'|'facebook'|'google-oauth2', redirectUri: <origin>/services/auth0/sign-in-callback})` or passwordless email magic link (`passwordlessStart({send:'link', connection:'email'})`). Client gets `AUTH0_DOMAIN`/`AUTH0_CLIENT_ID` inlined by Parcel at build time (`client/src/app/config.ts`).
2. `GET /services/auth0/sign-in-callback?code=…` (`app/controllers/auth0_sign_in_callback.ts`): on `?error` → `/error/access-denied`. POST `https://$AUTH0_DOMAIN/oauth/token` with `grant_type: authorization_code`, `client_id`, `client_secret`, `code`, `redirect_uri`. Failure → `/error/no-access-token`.
3. With `access_token`, `userClient.getUserInfo()` (`auth0` SDK `UserInfoClient`, `app/lib/auth0.ts`). Build body: if `sub` starts with `twitter|` → `{auth0_twitter: {screenName: user['https://twitter.com/screen_name'], auth0Id: sub, profileImageUrl: picture}}`; else `{auth0: {nickname, auth0Id: sub, email, profileImageUrl: picture}}`.
4. Server-to-server `axios.post(${appURL.origin}/api/v1/users, body, {headers: {Cookie: login_token=<id_token>}})` — the server calls its own API through the public origin, authenticating with the fresh id_token.
5. On success sets three cookies with `{maxAge: 9000000000 (≈104 days), sameSite: 'strict'}` and **no `httpOnly`/`secure`**: `user_id` (= `user.id` from API, fallback nickname/screenName), `refresh_token`, `login_token` (= id_token). Redirect `/services/auth0/just-signed-in`. Failure → `/error/authentication-api-problem`.

### 3.3 User id derivation (`app/resources/v1/users.ts` `post`)
- Twitter: `User.findOne({id: screenName})`; create `{id: screenName, auth0Id, profileImageUrl}` or update `auth0Id`/`profileImageUrl`.
- Other providers: `User.findOne({auth0Id})`. If none: if no user with `id === nickname`, create `{id: nickname, auth0Id, email, profileImageUrl}`; else `id = nickname + '-' + <random 4 digits>` (collision not checked, TODO). If found: refresh `auth0Id`, `email`, and `profileImageUrl` via `handleUserProfileImage` → uploads the provider avatar to Cloudinary (`upload_preset: 'profile_image'`, `public_id: ${NODE_ENV}/profile_image/${user.id}`), falls back to provider URL on failure.
- So `User.id` is a human-readable username (nickname or Twitter handle), `User.auth0Id` is the Auth0 `sub` (e.g. `google-oauth2|123`). Authorization everywhere is `User.findOne({auth0Id: req.auth.sub})`, then compare `user.id` to the resource's `creatorId`.
- `email` is `unique` in the model/migration; two providers with the same email → create fails (500 "Could not create user").

### 3.4 Anonymous users
No identity. Streets created without a JWT get `creatorId: null`, `creatorIp: requestIp(req)`, and a `namespacedId` from the global `Sequences` row `streets`. Anonymous streets are addressed as `/-/<namespacedId>` (client `ANONYMOUS_USER_ID_FRAGMENT = '-'`, metatags `ANON_CREATOR = '-'`; note `streets_export.ts` uses `~` instead — inconsistency). Anyone may PUT an anonymous street; nobody may DELETE it via API (403), only via DB.

### 3.5 Client-side session handling (`client/src/users/authentication.ts`)
- `loadSignIn()`: reads cookies `login_token`, `refresh_token`, `user_id` (js-cookie); stores in Redux + `localStorage['sign-in']`. `jwtDecode` to check `exp`; if within 1 day of expiry → `POST /services/auth0/refresh-login-token {token: refreshToken}`. Then `GET /api/v1/users/:userId` for `flags`/`roles`/`data`.
- `JUST_SIGNED_IN` mode (`client/src/app/page_url.ts`, path `/services/auth0/just-signed-in`): after sign-in, if the previous street was anonymous (`!street.creatorId`) → `setPromoteStreet(true)` → `remixStreet()` adopts it as the user's street. Also honours `last_survey_url` cookie set by `/survey`.
- `signOut()`: `DELETE /api/v1/users/:id/login-token`, remove cookies and localStorage. Cross-tab sync via `storage` events (`FORCE_RELOAD_SIGN_IN/OUT`).
- `AUTH_EXPIRED` mode when localStorage has sign-in data but cookies are missing or token undecodable (`Sentry.captureMessage` with the raw token).

### 3.6 Passport
`passport.initialize()/session()` are installed globally but only used by the Patreon/Coil `authorize` flows (`req.account`, `req.profile`). `serializeUser/deserializeUser` are registered (deserialize is broken: returns an async function instead of a user) but unused.

---

## 4. Data model

Sequelize config in `app/db/config/config.ts`, connection in `app/db/db.ts`, models in `app/db/models/*.ts`, migrations in `app/db/migrations/*.cjs` (`.sequelizerc` points sequelize-cli at these). Table names are Sequelize defaults (pluralised, capitalised): `Users`, `Streets`, `Sequences`, `Votes`, `UserConnections`. Model fields use `field:` to map camelCase → snake_case columns (except `UserConnections`, which is snake_case in both). No `sequelize.sync()` is run by the app; schema is migrations-only.

### 4.1 Migrations (chronological)
| File | Change |
|---|---|
| `20180729103650-create-sequence.cjs` | `Sequences(id STRING PK, seq INTEGER default 1)` |
| `20191125021742-create-street.cjs` | `Streets(id STRING PK, namespaced_id INTEGER, status ENUM('ACTIVE','DELETED') default ACTIVE, name STRING, creator_id STRING, data JSON, created_at, updated_at, client_updated_at nullable, creator_ip STRING, original_street_id STRING)` |
| `20191125021742-create-user.cjs` | `Users(id STRING PK unique, _id STRING unique NOT NULL, twitter_id, twitter_credentials JSON, auth0_id, email unique nullable, roles TEXT[], login_tokens TEXT[], profile_image_url STRING, data JSON, created_at, updated_at, last_street_id INTEGER)` |
| `20200311145404-enable-postgis.cjs` | `CREATE EXTENSION IF NOT EXISTS postgis` (nothing in code uses PostGIS types) |
| `20200323115435-update-user-flags.cjs` | add `Users.flags JSON` |
| `20200429210044-remove-login-tokens.cjs` | drop `Users.login_tokens` |
| `20200526041323-create-vote.cjs` | `Votes(id STRING PK, data JSON, created_at, updated_at, score DOUBLE default 0, street_id STRING, voter_id STRING)` |
| `20200611193223-add-index-to-streets.cjs` | non-unique index `Streets(namespaced_id, creator_id)` |
| `20200614230057-remove-user-legacy-id.cjs` | drop `Users._id` |
| `20200705103525-update-vote.cjs` | add `Votes.submitted TEXT[]`, `Votes.comment STRING(280)` |
| `20201223200005-default-user-role.cjs` | `Users.roles` default `['USER']` |
| `20210204224824-update-user-add-identities.cjs` | add `Users.identities JSON` |
| `20210209160716-index-streets-and-users.cjs` | indexes `Streets(id)`, `Users(id)`, `Users(auth0_id)` |
| `20210303183552-remove-twitter-auth.cjs` | drop `Users.twitter_id`, `Users.twitter_credentials` |
| `20210506170155-update-user-profile-url.cjs` | `profile_image_url` → STRING(1024) |
| `20210506212658-create-user-connections.cjs` | `UserConnections(id SERIAL PK, user_id STRING, provider STRING, provider_user_id STRING, deleted BOOLEAN default false, monetized BOOLEAN, metadata JSON, createdAt, updatedAt)` |
| `20221112173817-index-original_street_id.cjs` | index `Streets(original_street_id)` |
| `20230512035538-add-display-name.cjs` | add `Users.display_name STRING` |
| `20240509152241-increase-user-profile-url-length.cjs` | `profile_image_url` → STRING(2048) |
| `20241031205836-update-street-id-uuid-datatype.cjs` | `ALTER TABLE "Streets" ALTER COLUMN id TYPE uuid USING id::uuid` (raw SQL) |

Discrepancies between models and migrations: `Street` model declares the `(namespaced_id, creator_id)` index as `unique: true` (migration is non-unique); `Vote` model declares an index on `(created_at, updated_at, voter_id)` and `UserConnections` declares a unique index on `(user_id, provider)` — **neither has a migration**, so they only exist if `sync()` was ever run (**UNVERIFIED** in production). `Street.originalStreetId` and `Vote.streetId` remain `STRING` while `Street.id` is `UUID`.

### 4.2 Models

**`User`** (`app/db/models/user.ts`) — `id STRING PK` (username), `auth0Id STRING` (`auth0_id`), `displayName STRING` (`display_name`, validate len 0–30), `email STRING unique`, `identities JSON` (deprecated array of `{provider, user_id, access_token?, refresh_token?}`), `roles TEXT[]` default `['USER']` with validator against keys of `app/data/user_roles.json`, `profileImageUrl STRING(2048)`, `flags JSON`, `data JSON` (client `UserSettings`: `lastStreetId`, `lastStreetNamespacedId`, `lastStreetCreatorId`, `saveAsImage*`, `newStreetPreference`, `units`, locale etc.), `lastStreetId INTEGER` (per-user namespaced counter), `createdAt/updatedAt`. Methods `addRole(role)`, `removeRole(role)`. Associations: `Street.belongsTo(User, {foreignKey:'creatorId'})`, `Vote.belongsTo(User, {foreignKey:'voterId'})` (no DB-level FKs in migrations).

**`Street`** (`street.ts`) — `id UUID PK`, `namespacedId INTEGER`, `status ENUM('ACTIVE','DELETED')` default ACTIVE, `name STRING`, `creatorId STRING|null`, `data JSON` (`StreetData`), `creatorIp STRING`, `originalStreetId STRING`, `clientUpdatedAt DATE`, `createdAt/updatedAt`. `Street.belongsTo(Street, {foreignKey:'originalStreetId'})` for remixes.

**`Sequence`** (`sequence.ts`) — `id STRING PK`, `seq INTEGER default 1`, no timestamps. Only row used: `id = 'streets'`.

**`Vote`** (`vote.ts`) — `id STRING PK` (UUID generated in code), `data JSON` (snapshot of street), `streetId STRING`, `voterId STRING` (null = unanswered candidate ballot; `'DELETED'` = invalidated), `comment STRING(280)`, `submitted TEXT[]` (user ids who have voted on / been excluded from this candidate), `score DOUBLE`, timestamps. Candidate ballots (voterId null) are **never created by server code** — they must be seeded externally (**UNVERIFIED**).

**`UserConnections`** (`userconnections.ts`) — `id INTEGER autoincrement PK`, `user_id STRING`, `provider STRING` (`'patreon'|'coil'`), `provider_user_id STRING`, `deleted BOOLEAN`, `monetized BOOLEAN`, `metadata JSON` (entire passport profile, including Coil `access_token`/`refresh_token`), default camelCase timestamps. Written by `addUserConnection` in `app/resources/services/integrations/helpers.ts` inside a transaction that also dual-writes `User.identities`.

### 4.3 `namespaced_id` / sequence logic (`app/resources/v1/streets.ts` `post`)
- Authenticated: `User.findOne({auth0Id})` → if `lastStreetId` null set to 1 else `increment('lastStreetId', {by: 1})`; `namespacedId = user.lastStreetId`. Not transactional with the street insert; concurrent creates may race (**UNVERIFIED**).
- Anonymous: `Sequence.findByPk('streets')` → `update({seq: seq+1})` (or create with seq 1); `namespacedId = seq`. Also non-atomic read-modify-write.
- Public URL = `/<creatorId or '-'>/<namespacedId>[/<slug>]`; `GET /api/v1/streets?creatorId=&namespacedId=` resolves it to a UUID via 307.

### 4.4 Street status, remix, deletion
`status` is a soft-delete flag. `DELETE /streets/:id` (owner), `DELETE /users/:id/streets` (bulk) set `DELETED`. Reads return 410 for DELETED (`streets.get`, `streets.find`, metatags). Galleries and remixes filter `status: 'ACTIVE'`. Remix = client creates a new street then `PUT`s `originalStreetId` (verified to exist, not checked for DELETED on PUT; POST does check but doesn't persist). `GET /streets/:id/remixes` lists direct children as CSV.

### 4.5 Street `data` JSON schema
Type `StreetData` in `packages/types/src/index.ts`: `{ street: StreetJson, history?: HistoryState (unused), plugins: StreetPluginData {coastmix?: CoastmixState} }`. `StreetJson`: `id`, `namespacedId`, `schemaVersion`, `units` (0 metric / 1 imperial; legacy 2), `width` (metres), `segments: SliceItemForServerTransmission[]` (`{id, type, variantString, width, elevation, elevationChanged?, slope: {on, values[]}, label?}` — `variant` object stripped), deprecated `left/rightBuildingHeight|Variant`, `boundary: {left, right: {id, variant, floors, elevation}}`, `skybox`, `weather: 'rain'|'snow'|null`, `location: {latlng:{lat,lng}, wofId, label, hierarchy} | null`, `showAnalytics`, `capacitySource?`, `userUpdated`, `editCount`. The API response (`StreetAPIResponse`) wraps it with `id, namespacedId, name, clientUpdatedAt, data, createdAt, updatedAt, originalStreetId, creatorId` (`asStreetJson` in `app/lib/util.ts`, which re-adds deprecated building props from `boundary` and ensures `plugins`).

### 4.6 Schema migrations (`app/lib/street_schema_update.js`, `LATEST_SCHEMA_VERSION = 35`)
Applied lazily on `GET /streets/:id` and persisted. Missing `schemaVersion` → 17 if `createdAt/updatedAt` starts with `2018`, else 1. Each case N transforms version N → N+1:

| To | Change |
|---|---|
| 2 | add `leftBuildingHeight=4`, `rightBuildingHeight=3` |
| 3 | add `leftBuildingVariant='narrow'`, `rightBuildingVariant='wide'` |
| 4 | `transit-shelter` variant += `|street-level` |
| 5 | `sidewalk-lamp` += `|modern` |
| 6 | `streetcar` += `|regular` |
| 7 | `bus-lane`, `light-rail` += `|regular` |
| 8 | `bike-lane` += `|regular` |
| 9 | `drive-lane` += `|car` |
| 10 | `sidewalk` variant = `normal` |
| 11 | `planting-strip`→`divider` (`planting-strip`), `small-median`→`divider` (`median`) |
| 12 | `small-tree`→`big-tree`; `sidewalk-tree` `small`→`big` |
| 13 | `sidewalk-bike-rack` += `|sidewalk` |
| 14 | `sidewalk-wayfinding` variant = `large` |
| 15 | sidewalk `randSeed = 36` placeholder |
| 16 | no-op (undo stack lives outside `street`) |
| 17 | bike-lane `colored`→`green` |
| 18 | `location.latlng` array → `{lat,lng}` |
| 19 | add `environment='day'` |
| 20 | `bike-lane` += `|road` |
| 21 | `bikeshare` += `|road` |
| 22 | drive-lane `randSeed = 37` placeholder |
| 23 | add `segment.id = nanoid()` |
| 24 | delete `randSeed` |
| 25 | `bus-lane` += `|typical` |
| 26 | no-op (superseded) |
| 27 | backfill `segment.elevation` by hard-coded type table (0/1/-2, conditional on variant) |
| 28 | add `editCount = 0` if missing |
| 29 | rename `environment`→`skybox` |
| 30 | convert widths to metric (`×0.3` if `units===2` then `units=0`; else `×0.3048`), round 3 |
| 31 | `units===2` → `0` |
| 32 | add `boundary.{left,right} = {id: nanoid(), variant, floors, elevation: 1}`; delete `*Building*` props |
| 33 | elevation re-scaling: drainage `-2→0`; transit-shelter `2→0.75m` (or 2.5ft→m); `1→0.15m` (or 6in→m); boundary elevation ×0.15 (or ×0.5×0.3048) |
| 34 | add `slope = {on:false, values:[]}` to every slice |
| 35 | ensure `location` property exists (`null`) |

Uses `round` from `@streetmix/utils`, `nanoid`. Note in file: update 27 historically wrote `editcount` (lower-case) — may leave stray keys.

### 4.7 Factories / seeders
`app/db/factories/user.js` (faker-based `User.create`) and `app/db/seeders/20201223190854-10-test-users.js` (bulk insert 10 fake users into `Users`). Both are ESM but sequelize-cli with `.sequelizerc` ESM config — usability **UNVERIFIED**.

---

## 5. Roles and feature flags

### 5.1 Definitions
`app/data/user_roles.json` — roles `USER`, `ADMIN`, `BETA_TESTER`, `ITDP`, `TRANSLATOR`, `SUBSCRIBER_1`, `SUBSCRIBER_2`, `SUBSCRIBER_3`, each `{key, text, value, flags: {FLAG: true,…}}`:
- USER: `VARIANT_TWOWAY_BIKES`
- ADMIN: `LOCALES_LEVEL_1`, `NEW_STREET_TEMPLATES`, `COLOR_MODE_TOGGLE`, `COASTMIX_MODE`
- BETA_TESTER: `LOCALES_LEVEL_1`, `NEW_STREET_TEMPLATES`, `GALLERY_SEARCH`, `ELEVATION_CONTROLS_UNLOCKED`, `UNIVERSAL_ELEVATION_CONTROLS`, `SEGMENT_CROSSWALK`, `SEGMENT_DRAINAGE_CHANNEL_UNLOCKED`, `VARIANT_MIXED_DRIVE_LANES_1/2`, `COLOR_MODE_TOGGLE`, `COASTMIX_MODE`
- ITDP: `ELEVATION_CONTROLS_UNLOCKED`, `SEGMENT_DRAINAGE_CHANNEL_UNLOCKED`, `VARIANT_MIXED_DRIVE_LANES_1/2`
- TRANSLATOR: `LOCALES_LEVEL_1`
- SUBSCRIBER_1: `SAVE_AS_IMAGE_CUSTOM_DPI`; SUBSCRIBER_2/3: none

`packages/feature-flags/flags.json` — 33 flags `{label, defaultValue, enabled?}` (e.g. `GEOTAG`, `ANALYTICS`, `EDIT_*` true; `COLOR_MODE_TOGGLE`, `GALLERY_SEARCH`, `SENTIMENT_SURVEY`, `LOCALES_LEVEL_1/2`, `SAVE_AS_IMAGE_CUSTOM_DPI`, `SAVE_AS_IMAGE_NEW_EXPORT_PIPELINE`, `MEMBER_UPGRADE`, `COASTMIX_MODE`, `SILLY_CLOWNS` false; `SAVE_UNDO` and `SEGMENT_3D_PARKING` `enabled: false`). `VARIANT_TWOWAY_BIKES` (USER role) is **not defined** in flags.json, so it is silently ignored by the client merge.

### 5.2 Role assignment
- Default `['USER']` (DB default + `asUserJson` forces `USER` first).
- `SUBSCRIBER_1`: only via Coil `connectUser` → `syncAccountStatus` (`helpers.ts`), which adds the role if any `identities[]` entry has `user_id` (very permissive; TODO in code). `/services/pay` would add it but is dead.
- Patreon: connecting records a `UserConnections` row and `identities` entry but **assigns no role**; webhook does nothing. Pledge-based role sync is absent.
- `ADMIN`, `BETA_TESTER`, `ITDP`, `TRANSLATOR`: no API path writes `roles` → set manually in the database (**UNVERIFIED** operational practice).
- Per-user `flags` JSON: no API writes it either (`PUT /users` only writes `data`) → DB-managed only.
- Server-side role checks: `ADMIN` in `users.get` (list all), `users.put`, `users.del`, `usersStreets.del`.

### 5.3 Flag merge
Server does **no** merging; `GET /users/:id` (self) returns raw `flags` and `roles`. Client (`client/src/users/authentication.ts` `fetchSignInDetails` + `client/src/app/flag_utils.ts` `applyFlagOverrides`): start from `flags.json` defaults (Redux `flags` slice, `source:'initial'`), then apply in order (later wins): each role's flags in array order (`source: 'role:<ROLE>'`), then user `flags` (`source: 'user'`), then `localStorage['flags']` session toggles (`source: 'session'`). Only keys present in defaults are applied. Session toggles persist via `initLocalStorageUpdateListener`. `preinit/debug_settings.ts` handles only `?debug-force-*` URL params (left-hand traffic, non-retina, offline, read-only), not flags. `app/data/user_roles.json` is imported directly by the client bundle (and is also served at `/assets/data/user_roles.json`).

---

## 6. External services and outbound domains

| Service | Purpose | Env var(s) | Code | Without it | User data |
|---|---|---|---|---|---|
| **Auth0** | Identity provider: authorization-code flow, userinfo, refresh tokens, JWKS for id_token verification | `AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET` (required; `app.json`) | `app/authentication.ts`, `app/lib/auth0.ts`, `app/controllers/auth0_sign_in_callback.ts`, `app/controllers/refresh_login_token.ts`, client `app/auth0.ts` | No sign-in; every `auth()` route 401s (JWKS URL `https://undefined/...`); anonymous use still works | Yes — email, nickname, picture, provider sub |
| **Cloudinary** | Cache of user avatars (`profile_image` preset) and street thumbnails (`<env>/street_thumbnails/<id>`); upload signatures | `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` (cloud `streetmix` hard-coded) | `app/lib/cloudinary.ts`, `app/resources/v1/users.ts`, `app/resources/v1/street_images.ts`, `app/resources/services/images.ts` | Avatar upload fails → falls back to provider URL; thumbnail GET/POST/DELETE → 500/404; metatag images absent | Yes — avatars, street renders |
| **Patreon** | OAuth connect (passport-patreon, scope `users pledges-to-me my-campaign`) + webhook | `PATREON_CLIENT_ID`, `PATREON_CLIENT_SECRET`, `PATREON_WEBHOOK_SECRET` | `app/resources/services/integrations/patreon.ts` | Routes return 500 "unavailable"; webhook 501 | Yes — Patreon profile stored in `UserConnections.metadata` |
| **Coil / Web Monetization** | OAuth (`coil.com/oauth/*`, `api.coil.com/user/info`, `/user/btp`), BTP token cookie; `<meta name="monetization">` payment pointer | `COIL_CLIENT_ID`, `COIL_CLIENT_SECRET` (not in `.env.example`), `WEB_MONETIZATION_PAYMENT_POINTER` | `integrations/coil.ts`, `app.ts`, `main.hbs`, client `integrations/coil.ts` | Routes 500; `BTPTokenCheck` is a no-op without identities; meta tag omitted | Yes — access/refresh tokens in `identities` + `UserConnections`. Note `btoa()` helper lacks `return` → Basic auth header is `Basic undefined` (integration likely broken). Coil shut down in 2023. |
| **Pelias / geocode.earth** | Client-side geocoding/reverse geocoding (`https://$PELIAS_HOST_NAME/v1/reverse?api_key=`) | `PELIAS_API_KEY`, `PELIAS_HOST_NAME` (e.g. `api.geocode.earth`) | client `dialogs/Geotag/GeotagDialog.tsx`, `store/slices/map.ts`; server only adds host to CSP | Geotag dialog cannot search/reverse-geocode | Street locations (lat/lng, labels) sent to third party |
| **Carto** | Basemap tiles `https://{s}.basemaps.cartocdn.com/rastertiles/voyager/...?key=` | `CARTO_API_KEY` | client `GeotagDialog.tsx`; CSP in `app.ts` | Tiles may be refused | IP/tile requests only |
| **Plausible** | Analytics script `https://plausible.io/js/<id>.js` | `PLAUSIBLE_ID` | `app.ts`, `main.hbs` | Not loaded | Pageviews |
| **New Relic** | APM agent `node -r newrelic` | `NEW_RELIC_LICENSE_KEY`, `NEW_RELIC_LOG_LEVEL` | `newrelic.cjs`, `package.json` `serve` | Agent logs missing key, app runs | Request telemetry |
| **Transifex** | Translation download (API v3 via `@transifex/api`, org/project `streetmix`) at runtime for non-`en` and in CI | `TRANSIFEX_API_TOKEN` | `packages/i18n/src/transifex.ts`, `app/resources/v1/translate.ts`, `.github/workflows/update-translations.yml` | Falls back to local `packages/i18n/locales/*` | No |
| **Userback** | Feedback widget | `USERBACK_TOKEN` (client build-time) | client `app/userback/client.ts`, `App.tsx`; CSP `static.userback.io`, `api.userback.io` | Widget absent | User-submitted feedback, screenshots |
| **Sentry** | Client error reporting; DSN hard-coded `https://fac2c236…@sentry.io/82756`, only on `streetmix.net` hostnames; sourcemap upload in `client` `postbuild` (`sentry-cli`, needs `SENTRY_AUTH_TOKEN`, **UNVERIFIED**; CI sets `SENTRY_ALLOW_FAILURE`) | none server-side | client `main.tsx`, `client/package.json` | Build `postbuild` may fail without allow-failure | Error payloads incl. raw JWT on parse failure |
| **Facebook** | `fb:app_id` meta only | `FACEBOOK_APP_ID` | `app.ts`, `main.hbs`, client `config.ts` | Meta omitted | No |
| **Stripe** | Referenced in CSP (`checkout.stripe.com`, `*.stripe.com`) and dead `/services/pay` code; `STRIPE_TIER1_PLAN_ID` read but no Stripe SDK dependency | `STRIPE_TIER1_PLAN_ID` | `app/resources/services/payments.ts`, `app.ts` | Nothing functional today | None |
| **Buttondown** (newsletter) | Client POSTs `https://buttondown.email/api/emails/embed-subscribe/streetmix` (form-encoded) | none | client `dialogs/Newsletter/NewsletterDialog.tsx`; CSP `buttondown.com`, `buttondown.email` | Dialog errors | Email address (direct from browser; no server route) |
| **GeoIP** | `GET /services/geoip` reads Cloudflare `cf-ipcountry` header; **no external provider** | none | `app/resources/services/geoip.ts` | Behind Cloudflare only; otherwise `countryCode: null` | Country code |
| **Changelog** | `GET /services/changelog` reads local `docs/docs/user-guide/changelog.md` from the repo | none | `app/resources/services/changelog.ts` | 404 if docs workspace not deployed | No |
| **Sentiment survey** | Stored in Postgres `Votes` table (no external storage) | none | `app/resources/v1/votes.ts` | — | Votes/comments keyed by user id |
| **Cloudflare Insights** | CSP allows `static.cloudflareinsights.com`, `cloudflareinsights.com` (injected by CF, not by code) | none | `app.ts` | — | Pageviews |
| **about.streetmix.net / docs.streetmix.net / streetmix.github.io** | Redirect/link targets | none | `app.ts`, client | — | No |
| **Papertrail** | Heroku logging add-on (`app.json`) | provisioned by Heroku | `app.json` | — | Logs incl. `user_id` cookie values and request URLs |

---

## 7. Export

### 7.1 CSV (`app/lib/streets_export.ts`)
`streetsToCSV(streets)` via `papaparse`: columns `id, name, creator_id, width, width_imperial, left_boundary_variant, left_boundary_floors, slice_<i>_type|variant|width|width_imperial|elevation` (padded to the widest street), `right_boundary_variant, right_boundary_floors, edit_count, created_at, url`. `url = appURL.href + (creatorId || '~') + '/' + namespacedId`. Note `width_imperial` multiplies metres by 0.3048 (should divide) — values are wrong (**bug**). Only consumer: `GET /api/v1/streets/:id/remixes`.

### 7.2 Server-side PNG (`packages/export-image`)
- Entry `src/index.ts`: `StreetImageExportSchema` (zod) parses query params: `locale` (default `en`), `transparentSky` (false), `labels` (true), `streetName` (true), `watermark` (true), `silhouette` (false), `scale` (0.5–5.0, default 1.0; "formerly dpi"); string-bools accept `true/1/false/0`, empty strings → defaults. `runTestCanvas(street, options) → Buffer` (PNG).
- `src/image.ts`: `@napi-rs/canvas`; registers fonts at module load via `GlobalFonts.registerFromPath` from `node_modules/@fontsource-variable/rubik/.../rubik-latin-wght-normal.woff2` ("Rubik"), `@fontsource/geist-sans` 400 + 600 ("Geist Sans"), `@fontsource-variable/overpass` ("Overpass"). Draws sky (`sky.ts`, loads `@streetmix/illustrations/images/sky/sky-front.svg`/`sky-rear.svg` via `import.meta.resolve`), earth, slices (`slices.ts`, uses `@streetmix/parts` `getSegmentInfo`; sprite drawing is still commented out), labels (`labels.ts`, "Geist Sans"), silhouette, nameplate (`nameplate.ts`), watermark (`watermark.ts`, `assets/wordmark_black|white.svg`, localized via `packages/i18n` `export.watermark`). Still contains a test block that draws a rotated `construction/cone.svg` at (80,80). Height is a fixed 500 base (building heights TODO). Output `canvas.encode('png')`.
- Exposure: only `GET /api/v1/streets/:id/image?experimental=1[&locale&scale&labels&streetName&watermark&silhouette&transparentSky]` when no Cloudinary resource exists (`street_images.ts`). Flag `SAVE_AS_IMAGE_NEW_EXPORT_PIPELINE` gates client use (**UNVERIFIED** whether client calls it). `locale.ts` dynamically imports `@streetmix/i18n/locales/<locale>/main.json` with `with {type:'json'}`.
- Package deps: `@fontsource/geist-sans`, `@napi-rs/canvas`; relies on client's `@fontsource-variable/rubik|overpass` being hoisted to root `node_modules`.

---

## 8. Street thumbnails / images

Routes in §2.1; handler `app/resources/v1/street_images.ts`. Cloudinary `public_id = ${NODE_ENV}/street_thumbnails/${streetType || street_id}` where `streetType ∈ {DEFAULT_STREET, EMPTY_STREET}`.

- **POST** (`auth()`, `text/plain` ≤3 MB): body is a JSON string `{image: <data URL PNG>, event, streetType?, editCount, creatorId}`. Flow: find street (404) → `cloudinary.api.resource(publicId)`; `thumbnailSaved` if stock type exists or first tag equals `editCount`. If `event` not `INITIAL`/`TEST` → **501** (only initial renders are stored). If saved → 201 existing metadata. Else if no resource (or anonymous street and `ALLOW_ANON_STREET_THUMBNAILS` — hard-coded `false`) → upload (`remove_all_tags` then `upload(image, {public_id, tags: editCount})`) **regardless of who is signed in**. Else if owned → owner check then upload. Response `{public_id,width,height,format,secure_url,created_at}`.
- **DELETE** (`auth()`): owner only; stock ids → 400; `uploader.destroy`.
- **GET** (public): stock ids → 404; `cloudinary.api.resource`; if found, proxies the image (`axios` stream of `resource.url`, note `http` not `secure_url`) as `image/png`; if 404 on Cloudinary and `experimental=1` → server render (§7.2) else 404.
- **Client**: `client/src/streets/image.ts` `saveStreetThumbnail` is **entirely commented out ("TEMPORARILY DISABLED")** — the client never POSTs thumbnails today. `deleteStreetThumbnail` → `DELETE /streets/:id/image` is still called on street delete (`streets/xhr.ts`). `/services/images` signature endpoint is unused by the client.

---

## 9. Translations `/api/v1/translate/:locale_code/:resource_name`

Handler `app/resources/v1/translate.ts`. If `TRANSIFEX_API_TOKEN` is unset **or** `locale === 'en'` → read `<cwd>/packages/i18n/locales/<locale>/<resource>.json` (404 on ENOENT). Otherwise fetch live from Transifex via `getFromTransifex(locale, resource, token)` (`packages/i18n/src/transifex.ts`: org `streetmix`, project `streetmix`, resource slug = `resource_name`, language code with `-`→`_` except `zh-*`, `ResourceTranslationsAsyncDownload` mode `onlytranslated`, then `axios.get(url)`) — no local fallback on failure (TODO). Response headers `Cache-Control: max-age=86400`, `Location`.

Resources: `main`, `segment-info`. Locales on disk (`packages/i18n/locales/`): am, ar, ca, cs, de, en, en-GB, es, es-419, es-ES, es-MX, fi, fil, fr, id, it, ja, ko, nb-NO, nl-NL, pl, pt-BR, ro-RO, ru, sk, sv, tr, zh-Hans, zh-Hant. `LOCALES` with readiness levels 1–4 in `packages/i18n/src/locales.ts` (level 4 = `en`; `ENABLED_LOCALE_LEVEL = 3`; levels gated client-side by `LOCALES_LEVEL_*` flags).

Build pipeline: `npm run translations:download` (`tsx --env-file=.env packages/i18n/src/download_translations.ts`) iterates all non-`en` locales × resources and writes JSON (indent 2) into `packages/i18n/locales/`. CI `.github/workflows/update-translations.yml` runs daily (07:30 UTC) with `secrets.TRANSIFEX_API_TOKEN` and opens a PR (`peter-evans/create-pull-request`, reviewer `louh`). English source strings live only in the repo. `packages/i18n` builds with `tsc` to `build/`.

---

## 10. Tests

Root `vitest.config.ts`: projects `app/vitest.config.ts` (label `server`, `environment: node`, `globals: true`, `setupFiles ./test/vitest.setup.ts`, include `**/*.test.ts`), `client/vitest.config.ts` (label `client`, `happy-dom`, yaml plugin, image/`~` aliases), and `packages/*`. Scripts: `vitest`, `vitest:server` (`--project server`), `vitest:ci` (`run --coverage`, codecov threshold 1%). `app/test/vitest.setup.ts`: `process.loadEnvFile('.env.test')`, `NODE_ENV=test`, `vi.mock('../lib/logger.ts')` (resolves to `app/lib/__mocks__/logger.js`, a CommonJS no-op logger — vitest `__mocks__` resolution with `.ts`→`.js` name mismatch **UNVERIFIED**).

Helpers: `app/test/setup-mock-server.ts` (`setupMockServer(fn)` builds an Express app with `express.json()`; `createMockAuthMiddleware()` returns `{jwtMock (default sub 'foo|123'), mockUserMiddleware}` setting `req.auth`), `app/test/model-fixtures.ts` (`makeUserFixture`, `makeStreetFixture` (schemaVersion 24, boundary, plugins), `makeVoteFixture`). Legacy `app/db/models/__mocks__/index.js` uses `sequelize-mock` with query handlers for `Street`, `Vote`, `User`, `Sequence` — current tests use inline `vi.mock` factories instead, so this file appears unused (**UNVERIFIED**). CI (`.github/workflows/ci.yml`) runs tests **without a database** (Postgres service commented out).

| Test file | Covers |
|---|---|
| `app/__tests__/api_routes.test.ts` | Router wiring with mocked `auth`, `BTPTokenCheck`, and all v1 handlers: optional auth on `POST /streets`, BTP middleware on `GET /users/:id`, text-body image upload, 404 JSON catch-all, 401 on auth-required, anonymous/authenticated access on optional routes. |
| `app/__tests__/service_routes.test.ts` | Services wiring: changelog, images (auth mocked to pass), CSP report with `application/csp-report`, Coil callback middleware chain, 404 catch-all. |
| `app/authentication.test.ts` | `auth()` with mocked `express-jwt`: 401 generic, 401 expired message, `auth(false)` passes with no/invalid credentials. |
| `app/db/models/__tests__/user.test.ts` | `describe.skip` — role add/remove/validation against a real DB; never runs. |
| `app/resources/v1/__tests__/street_images.test.ts` | POST 201 (data URL; no existing thumbnail), 403 non-owner; DELETE 204 owner; GET 200 (mocks `cloudinary`, `axios`, models). |
| `app/resources/v1/__tests__/streets.test.ts` | POST 201, GET list 200, PUT 204, DELETE 204, GET by id 200 (mocks models and `street_schema_update`). |
| `app/resources/v1/__tests__/translate.test.ts` | Local file for `en`, local when token missing, Transifex when token set for non-en (mocks `node:fs/promises`, `@streetmix/i18n`). |
| `app/resources/v1/__tests__/user.test.ts` | PUT self 204, PUT other 401, PUT as admin 204; GET 200; DELETE self 204, other 401, admin 204. |
| `app/resources/v1/__tests__/user_session.test.ts` | DELETE login-token 204. |
| `app/resources/v1/__tests__/users.test.ts` | POST 200 with credentials, 400 without; GET list 200 admin, 401 non-admin; `describe.todo` for PUT/DEL/PATCH. |
| `app/resources/v1/__tests__/votes.test.ts` | GET returns only available ballot; POST vote; PUT comment >280 → 413; PUT comment on another user's ballot → 403. |

Not covered: `metatags`, `streets.find` 307 path, `users_streets`, `street_remixes`/CSV, `geoip`, `changelog`, `payments`, Patreon/Coil handlers, Auth0 callback/refresh controllers, schema update logic, export-image rendering. `package.json` `test:models` scripts still use Jest flags (`--watchAll --testPathPattern`) — stale. E2E: Cypress (`cypress.config.ts`, baseUrl `http://localhost:8000`, exposes `PELIAS_HOST_NAME`; CI runs with `NODE_ENV=test`, dummy Pelias vars, `record: true`).

---

## 11. Deployment and configuration

- **Procfile**: `web: npm run serve` → `nodemon --exec "node -r newrelic index.ts"` (nodemon in production, TS run natively); `release: ./bin/release_tasks.sh` → `npx sequelize db:migrate` (Heroku release phase; failure cancels deploy).
- **app.json** (Heroku): stack `heroku-22`, buildpack `heroku/nodejs`, add-ons `heroku-postgresql:mini` (as `DATABASE`), `papertrail:choklad`, `newrelic:wayne`; env `COOKIE_SESSION_SECRET` (generator `secret`), `AUTH0_DOMAIN/CLIENT_ID/CLIENT_SECRET` required, `CYPRESS_INSTALL_BINARY=0`, `HUSKY=0`. Build on Heroku runs the root `build` script → `npm run build --workspaces --if-present` (packages `tsc`, client `parcel build src/main.tsx --dist-dir ../build --public-url /assets` + `postbuild` Sentry sourcemaps) — exact Heroku invocation **UNVERIFIED**.
- **newrelic.cjs**: `app_name: ['Streetmix ' + NODE_ENV]`, `license_key: NEW_RELIC_LICENSE_KEY`, `logging.level: NEW_RELIC_LOG_LEVEL || 'info'`.
- **Dev**: `npm start` → concurrently `dev-server` (`nodemon … node --env-file-if-exists=.env index.ts`), `dev-client` (parcel watch), `dev-tsc` (`tsc -b --watch`). `.nvmrc` `lts/*`.
- **Sequelize config** (`app/db/config/config.ts`): `dialect: postgres`; `logging` only when `DEBUG === 'true'`; pool `{max:16, min:0, acquire:30000, idle:10000}` (Heroku 20-connection limit). If `DATABASE_URL` set → `config.url = DATABASE_URL` (sequelize-cli) and `db.ts` does `new Sequelize(DATABASE_URL, configEnv)`; else `database = PGDATABASE || 'streetmix_dev'`, `host = PGHOST || '127.0.0.1'`, `port = PGPORT || 5432`; `PGUSER`/`PGPASSWORD` are not set explicitly and are picked up by the `pg` driver from the environment. In `production`, `dialectOptions.ssl = { rejectUnauthorized: false }` (Heroku self-signed certs). Config object is keyed by `NODE_ENV`. It calls `process.loadEnvFile('.env')` in development and `'.env.test'` in test **unguarded** — a missing `.env` in development throws ENOENT at import (**UNVERIFIED** at runtime).
- **Env files**: `.env.example` lists `NODE_ENV`, `AUTH0_*`, `APP_DOMAIN`, `APP_PROTOCOL`, `PORT`, `CLOUDINARY_API_KEY/SECRET`, `FACEBOOK_APP_ID`, `NEW_RELIC_LICENSE_KEY`, `PATREON_CLIENT_ID/SECRET/WEBHOOK_SECRET`, `PELIAS_API_KEY`, `PELIAS_HOST_NAME`, `CARTO_API_KEY`, `PLAUSIBLE_ID`, `TRANSIFEX_API_TOKEN`, `WEB_MONETIZATION_PAYMENT_POINTER`, `USERBACK_TOKEN`, `PGUSER/PGPASSWORD/PGDATABASE/PGHOST/PGPORT`, `DATABASE_URL`, `COOKIE_SESSION_SECRET`, `DEBUG`, `OFFLINE_MODE`, `STREETMIX_INSTANCE`, `SPONSOR_BANNER`. `.env.test`: `NODE_ENV=test`, `PGDATABASE=streetmix_test`, `PELIAS_API_KEY=ge-iampelias2`, `PELIAS_HOST_NAME=api.geocode.earth`. Not in `.env.example` but read in code: `COIL_CLIENT_ID`, `COIL_CLIENT_SECRET`, `STRIPE_TIER1_PLAN_ID`, `NEW_RELIC_LOG_LEVEL`, `PROTOCOL`, `npm_package_version`.

Full env var inventory (from `grep process.env`):

| Var | Read in | Required | Effect |
|---|---|---|---|
| `NODE_ENV` | `globals.ts`, `app.ts`, `logger.ts`, `config.ts`, `csp_report.ts`, `street_images.ts`, `users.ts`, `newrelic.cjs`, client | default `development` | prod: CSP enforced, swagger off, DB SSL, info-level logs; Cloudinary public_id prefix |
| `PORT` | `globals.ts`, `index.ts`, `url.ts` | default 8000 | |
| `APP_DOMAIN`, `APP_PROTOCOL`, `PROTOCOL` | `globals.ts`, `url.ts` | default localhost/http | `appURL` used for redirect URIs, self-calls, CSV URLs, geoip referer check |
| `AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET` | auth files, `app.ts` CSP, client | yes | |
| `COOKIE_SESSION_SECRET` | `app.ts` | no (default `'seger handrail'`) | cookie-session signing |
| `CLOUDINARY_API_KEY/SECRET` | `cloudinary.ts`, `images.ts` | no | |
| `PATREON_CLIENT_ID/SECRET/WEBHOOK_SECRET` | `patreon.ts` | no | |
| `COIL_CLIENT_ID/SECRET` | `coil.ts` | no | |
| `STRIPE_TIER1_PLAN_ID` | `payments.ts` | no | dead |
| `PELIAS_HOST_NAME`, `PELIAS_API_KEY`, `CARTO_API_KEY` | `app.ts` CSP, client, cypress | no | |
| `PLAUSIBLE_ID`, `FACEBOOK_APP_ID`, `WEB_MONETIZATION_PAYMENT_POINTER` | `app.ts` → templates | no | |
| `TRANSIFEX_API_TOKEN` | `translate.ts`, i18n download | no | |
| `NEW_RELIC_LICENSE_KEY`, `NEW_RELIC_LOG_LEVEL` | `newrelic.cjs` | no | |
| `DATABASE_URL`, `PGDATABASE`, `PGHOST`, `PGPORT` (+ `PGUSER`, `PGPASSWORD` via pg) | `config.ts`, `db.ts` | one of | |
| `DEBUG` | `config.ts` | no | SQL logging |
| `OFFLINE_MODE` | `index.ts`, client | no | client offline mode |
| `STREETMIX_INSTANCE` | `index.ts`, `app.ts`, client | no | `coastmix` branding |
| `SPONSOR_BANNER`, `USERBACK_TOKEN` | client only | no | |
| `npm_package_version` | `app.ts` swagger | auto | |

---

## 12. Security review notes

1. **Default cookie-session secret** `'seger handrail'` when `COOKIE_SESSION_SECRET` unset (`app.ts`). Heroku `app.json` generates one, but any other deployment silently uses the known default.
2. **Auth cookies lack `httpOnly`/`secure`** (`auth0_sign_in_callback.ts`, `refresh_login_token.ts`): `login_token` (id_token), `refresh_token`, `user_id` are readable by JS (by design — the client reads them with js-cookie) with ≈104-day lifetime. XSS → full account takeover including long-lived refresh token. `sameSite: 'strict'` is the only CSRF defence; no CSRF tokens.
3. **Refresh endpoint is unauthenticated and uses the server's client secret** (`POST /services/auth0/refresh-login-token`): anyone with a stolen refresh token can mint id_tokens; no binding to the session.
4. **`PATCH /api/v1/users/:user_id` has no ownership check** (`users.ts` `patch`): any signed-in user can set any user's `displayName`.
5. **Admin check bug in `GET /api/v1/users`**: `callingUser?.roles?.indexOf('ADMIN') !== -1` is `true` when `callingUser` is `null` (undefined !== -1). A valid Auth0 token whose `sub` has no `Users` row can dump all users with full `asUserJson` (flags, roles, settings data). Same pattern (with explicit null guards) is used correctly elsewhere.
6. **`DELETE /api/v1/users/:id` deletes nothing** (`User.update(user, …)` no-op, returns 204) — account deletion requests are silently ignored (GDPR concern).
7. **Anonymous streets are world-writable**: `PUT /api/v1/streets/:id` with `auth(false)` updates any street whose `creatorId` is null; anyone who learns a UUID (e.g. via `GET /api/v1/streets` listing) can overwrite it. Street `data` is never validated (TODO), so arbitrary JSON (size-limited by `express.json` 100 kb) is persisted and later rendered by other clients and by the server-side canvas renderer.
8. **`GET /api/v1/translate/:locale_code/:resource_name` builds a filesystem path from unvalidated params**. Express decodes `%2F`, so `..%2F` sequences can escape `packages/i18n/locales/` and read any `*.json` file on disk (e.g. `package.json`). Exploitability **UNVERIFIED** but no sanitisation exists.
9. **Thumbnail upload for any street** (`street_images.ts` POST branch 3c): when no Cloudinary resource exists yet, any authenticated user may upload the thumbnail for any street (including others' owned streets); only subsequent re-uploads are owner-checked.
10. **Server-side rendering DoS surface**: `GET /streets/:id/image?experimental=1&scale=5` runs `@napi-rs/canvas` unauthenticated with up to 5× scale; also throws `TypeError` (`street` null → `street.dataValues`) → 500 for unknown ids.
11. **`/services/pay` is unauthenticated dead code** that trusts `req.body.userId`; it currently fails before `save()`, but reviving Stripe without adding auth would let anyone grant `SUBSCRIBER_1` to any account.
12. **Patreon webhook verifies the signature then discards the event** — no entitlement sync; `syncAccountStatus` grants `SUBSCRIBER_1` to anyone with *any* connected identity (comment: "make this less permissive").
13. **Coil tokens stored in plaintext** in `Users.identities` and `UserConnections.metadata`; `btpToken` set as a non-httpOnly cookie. `btoa()` helper returns `undefined` → OAuth basic auth header is `Basic undefined`.
14. **`/services/images` always 401s** (compares auth0 `sub` to username) — dead endpoint that, if "fixed" naively, would sign arbitrary client-supplied Cloudinary params (`cloudinary.utils.api_sign_request(req.query, secret)`).
15. **Open CORS**: `cors()` default `*` on user/vote routes and `Access-Control-Allow-Origin: *` on street GET; `frameguard` disabled and `frame-ancestors https:` (clickjacking from any HTTPS origin accepted by design).
16. **Logging of identifiers**: `request_log.ts` logs `user_id` cookie on every request at debug level; `auth0_sign_in_callback.ts` logs `req.query` (contains OAuth `code`); client sends raw JWTs to Sentry on decode failure.
17. **DB TLS** `rejectUnauthorized: false` in production (Heroku workaround) — MITM-able Postgres connection.
18. **`X-Forwarded-For` trusted blindly** (`requestIp`) for `creatorIp` storage (spoofable; also stores IPs of anonymous users indefinitely with no retention policy).
19. **Static exposure of `app/data`** at `/assets/data` (templates + roles) — harmless but note it mirrors server config publicly.
20. **No rate limiting** on any endpoint (sign-in callback, token refresh, street creation, votes). Sequence/`lastStreetId` increments are non-transactional.
21. **Write-on-read**: `GET /streets/:id` persists schema upgrades with `silent: true`; a flood of GETs on legacy streets causes writes.
22. **Per-process CSP nonce** rather than per-request; `reportOnly` in development only.
23. `uncaughtException` → `process.exit(1)`; with nodemon in production this restarts, but requests in flight are dropped.
24. Users' `email` is unique → account creation fails for a second provider with the same email (availability, not confidentiality).
25. `creatorIp` and `email` are returned nowhere in API responses (good); `asUserJsonBasic` limits public profile to `id, displayName, profileImageUrl`.
