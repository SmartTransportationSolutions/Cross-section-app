# Reference baseline — Streetmix

This document freezes the upstream reference that STS Street is measured
against, records how it was observed, and lists what could not be verified.

## Research date and sources

| Item | Value |
| --- | --- |
| Research date | 2026-10-03 |
| Upstream repository | https://github.com/streetmix/streetmix |
| Upstream commit (frozen baseline) | `f17578eec760d3c7b41216823ec32c7e8d04e8bc` — "fix: update canonical unfurl image url", 2026-09-24 |
| Upstream package versions at that commit | root `streetmix@1.3.0`, `@streetmix/client@1.4.0`, `@streetmix/illustrations@2.2.0` |
| Tag in this repository | `upstream-baseline` (the `main` branch of this repository is the unmodified import of that commit, with full history) |
| License at that commit | `LICENSE`: AGPL-3.0-or-later (BSD-3-Clause before the 2019 relicensing, per the file header); `packages/illustrations` and `packages/variant-icons`: CC-BY-SA-4.0 |
| Latest changelog entry at that commit | 2026-09-16 ("Better positioning of element resize handles…"); 14 commits followed it before the baseline commit (accessibility/floating-panel work, warnings refactor, drag/drop tweak, translation updates, Coastmix work). |

### Observation methods actually used

| Method | Status | Notes |
| --- | --- | --- |
| Source inspection of the frozen commit | **Done** | Four structured inventories, kept in `docs/research/` (client features: 330 IDs; backend/API/services; element catalog: 38 segment types / 223 variants, 16 boundaries, 10 skyboxes, 7 templates; docs/changelog/tests reconciliation). |
| Running an unmodified upstream instance locally | **Done** | Node 22.22, PostgreSQL 16 + PostGIS 3, `npm ci`, `sequelize db:migrate`, `npm run build` (Parcel), `node index.ts`. Home page rendered the default street (screenshot: `docs/evidence/baseline/upstream-home.png`), `POST /api/v1/streets` created an anonymous street. Upstream test suite: **118 files passed, 2 skipped; 635 tests passed, 13 skipped, 13 todo** (`vitest run`, 60 s). |
| Browser exploration of the live service (streetmix.net) | **Not possible** | Outbound requests to `streetmix.net`, `docs.streetmix.net` and `about.streetmix.net` are denied by the build environment's network policy (HTTP 403 from the egress proxy, also for the hosted fetch tool). The live deployment's exact revision and feature-flag state are therefore **unverified**; the source, bundled documentation (`docs/docs`) and changelog were used instead. |
| Documentation site | **Source only** | The documentation site's source (`docs/`) is part of the upstream repository and was read in full; its rendered form at docs.streetmix.net was not reachable. A web search snippet of the Streetmix+ page (2026-10-03) matched the bundled `streetmix-plus.md` content and the Open Collective pricing (monthly from $5, yearly from $50). |
| Authenticated / owner / premium experiences on the live service | **Not possible** | No authorized Streetmix test account exists, and the service was unreachable. Role and premium gating were established from source (`app/data/user_roles.json`, `isSubscriber` selectors, `unlockCondition` in catalog data) and are exercised against STS Street with seeded roles instead. |
| Partner integrations (3DStreet, Streetmeter) | **Partially** | The integration is a link to `https://3dstreet.app/#<street url>` and `https://streetmeter.net/#<street url>`; the partner sites were not reachable from this environment, so partner-side acceptance of STS URLs is **unverified**. |

## Feature flags and roles at the baseline

Default-on flags: `GEOTAG`, `ANALYTICS`, `EDIT_STREET_WIDTH`, `EDIT_STREET_NAME`,
`EDIT_BOUNDARY_LEFT`, `EDIT_BOUNDARY_RIGHT`, `NEW_STREET_TEMPLATES`,
`LOCALES_LEVEL_3`. All other flags default off; some are additionally granted
by role (`ADMIN`, `BETA_TESTER`, `ITDP`, `TRANSLATOR`, `SUBSCRIBER_1` →
`SAVE_AS_IMAGE_CUSTOM_DPI`). The complete table is in
`docs/research/upstream-client-features.md` §12.

Premium ("Streetmix+") gating in source: `isSubscriber` is true when the
user has role `SUBSCRIBER_1` (or, formerly, a Coil Web Monetization session).
Gated: element label editing, environment picker (unless
`ENVIRONMENTS_UNLOCKED`), watermark removal, custom export scale, and
`unlockCondition: SUBSCRIBE` items: segments drainage-channel and bioswale;
variants double-decker bus, AV shuttle, microvan, car-with-bus and
car-with-bike mixed lanes, universal sidewalk elevation. Sign-in-gated
(`SIGN_IN`): outdoor dining, utilities, street vendor, temporary barriers,
BRT station/lane, magic carpet, two-way bike lanes, AV, motorcycle sidecar,
pedestrian drive lane, compound-wall boundary.

Documented Streetmix+ feature list (`docs/docs/user-guide/streetmix-plus.md`):
rename segments; change environmental backgrounds; export without watermark;
export at print-ready resolutions; new segments double-decker bus, microvan,
autonomous shuttle; "unlimited streets" (doc-only, no cap implemented).
Membership activation upstream is manual (OpenCollective/Patreon e-mail
match); the in-app `UPGRADE` dialog and `/services/pay` Stripe stub are dead
code (`MEMBER_UPGRADE` flag unused).

## Known discrepancies between upstream documentation and source

From `docs/research/upstream-catalog.md` §8 and `upstream-docs-and-tests.md`:

- `street-design-elements.md` widths differ from `segment-lookup.yaml` for
  drive lane (doc 9 ft min vs 8 ft), turn lane (10 vs 9 ft), parking (default
  8 vs 7 ft), bike lane (min 3 vs 5 ft; max 8 vs none), streetcar/light rail
  (default 10 vs 12 ft; max none vs 14 ft); the doc lists a cherry tree and a
  pedestrian median that do not exist in source. **STS Street follows the
  source (the shipped behavior).**
- Metric default widths below the minimum for bikeshare, flex-zone and
  parking-lane (2 m default, 2.1 m min) and missing metric overrides for
  perpendicular/angled parking — reproduced as-is (upstream behavior), noted
  as upstream defects, not fixed silently.
- Street thumbnail upload to Cloudinary is disabled in the upstream client;
  `GET /streets/:id/image` returned Cloudinary JSON that the metatag handler
  expected but the experimental route streamed PNG (broken unfurl). STS Street
  replaces this with on-demand server rendering.
- Upstream `DELETE /api/v1/users/:id` is a no-op; `PATCH /api/v1/users/:id`
  has no ownership check; `GET /api/v1/users` admin check passes when the
  caller row is missing. STS Street fixes these (documented in
  `docs/feature-parity.md` as intentional deviations).
- `tsc -b` does not pass on the upstream tree (108 errors); upstream CI does
  not typecheck. STS Street CI reports typecheck results but does not gate on
  them.

## Items inventoried separately (not treated as shipped requirements)

- Coastmix instance mode (`STREETMIX_INSTANCE=coastmix`, `COASTMIX_MODE`):
  a white-label for the City of Boston; flag off by default; retained in code,
  not branded, not in the STS parity scope.
- Dormant/experimental flags: `SAVE_UNDO`, `SEGMENT_3D_PARKING`,
  `SEGMENT_INCEPTION_TRAIN`, `WEATHER_EFFECTS`, `SKY_ANIMATED_CLOUDS`,
  `GALLERY_SEARCH` (console stub), `SENTIMENT_SURVEY` (dialog reachable only
  with the flag; survey street gating appears unreachable), `MEMBER_UPGRADE`,
  `SILLY_CLOWNS`, `DEBUG_*`.
- Deprecated templates `harborwalk`, `coastal_road`, `beach` (Coastmix).
- `/map` (redirect to an external upstream map viewer) and `/survey`
  (sentiment survey) — survey is retained; the map redirect is removed.
