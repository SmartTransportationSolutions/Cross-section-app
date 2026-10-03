# Streetmix — Documentation reconciliation & test infrastructure

Source of truth: upstream checkout at `scratchpad/upstream-streetmix`, commit `f17578eec760d3c7b41216823ec32c7e8d04e8bc` (2026-09-24, "fix: update canonical unfurl image url"). Docs source: `docs/docs/**` (Docusaurus 3 site, hosted on Netlify per `docs/docs/contributing/documentation.md`). Live docs site was not reachable; everything below is from the checkout. Items marked **UNVERIFIED** could not be confirmed from source.

Path shorthand: `docs/` = `docs/docs/`, `client/` = `client/src/`, `app/` = server.

---

## Part A — Documentation reconciliation

### A1. `docs/user-guide/changelog.md` ("What's new in Streetmix?")

84 dated entries, newest first. No version numbers are used in the changelog (headings are dates only). `package.json` version is `1.3.0` (root) / `1.4.0` (`@streetmix/client`), unrelated to changelog headings. The server exposes this file at `GET /services/changelog` (`app/resources/services/changelog.ts` reads `docs/docs/user-guide/changelog.md`) and the client "What's new?" dialog renders it.

| Date | Heading(s) | Features / changes |
|---|---|---|
| 2026-09-16 | UI improvements; Bug fixes | Better resize-handle positioning on small screens; fix popups hijacking interactions when navigating menus on small screens |
| 2026-07-14 | New features; Bug fixes | **"My streets" gallery pagination** (100 streets per page, navigation for more); fix long street names overflowing; fix Safari active-slice highlight blocking popups |
| 2026-07-02 | Bug fixes | Fix undo crash; fix multiple undos toggling between last two states; fix inbound shared turn lane min/max width; fix broken external links in item descriptions |
| 2026-05-04 | Bug fixes | Fix touchpad horizontal street scroll |
| 2026-03-31 | Known issues | Gallery fails for users with many hundreds of streets; temporary cap: show most recent 100 |
| 2026-03-26 | Bug fixes | Fix unsetting street name not saved to server; fix avatar images |
| 2026-02-13 | Bug fixes | Fix popup contents shifting position on tall screens |
| 2026-01-31 | Bug fixes | Fix popups aggressively switching to adjacent slices on mouse movement |
| 2026-01-14 | UI; Bug fixes | Icon + tooltip for element width and building height controls; UI cohesion tweaks; fix "grab" cursor; fix new streets temporarily assigned wrong creator |
| 2026-01-02 | UI; Bug fixes | Icon tweaks; clearer scroll-button visuals; fix non-interactive scroll buttons |
| 2025-12-20 | New features; UI; Bug fixes | **New starting templates** (first: "stroad"), templates in beta for signed-in users via "New street" menu; tooltips on variant popup & width input; metric precision 0.1 m, **hold Shift for 0.05 m**; map view centers on user's current position if allowed; description ("learn more") popups standalone; resize-handle hover state; boundary illustration tweaks; Czech & Finnish updates; drag/drop fixes (incl. leftmost drop); RTL variant popup fix; clearing custom label resets default; geolocation re-naming fix; metric/US precision fixes |
| 2025-05-21 | Bug fixes | Fix building height keyboard controls; fix share URLs when username contains `+` |
| 2025-04-24 | Bug fixes | Fix globe icon when dragging (Chrome/macOS); fix drag not working in Safari |
| 2025-04-23 | New features; UI; Bug fixes; New bugs | **Export to Streetmeter**; **two-way cycletracks for all signed-in users** (formerly Streetmix+); redesigned "New street" dropdown; improved keyboard navigation across menus; fix deleting street name; known issues with keyboard resize/delete targeting, drag "stuck", drop on right side |
| 2025-03-28 | Bug fixes | Fix moon not appearing |
| 2025-03-27 | Bug fixes | Fix US-customary fractional width input making street 10× wider; fix palette drag preview flash |
| 2025-03-25 | Bug fixes; Improvements | Fix tall dialogs cut off; add Bluesky links; remove Twitter & Instagram links |
| 2024-08-12 | UI | Dialog behavior on mobile |
| 2024-08-08 | UI | Street width dropdown visual upgrade |
| 2024-08-04 | UI | Menus and icons visual upgrade |
| 2024-05-09 | Bug fixes | Fix Google-email login DB issue; fix two-way bike lanes availability |
| 2024-04-26 | Bug fixes | Fix experimental crosswalks and "one other secret item" exposed |
| 2024-04-08 | Improvements | Keyboard navigation to several UI elements |
| 2024-03-22 | (narrative); Improvements; Bug fixes | **Metric units used internally**; conversion now precise `1 ft = 0.3048 m` (was 0.3); min-width rules defined per unit system; French updates; fix broken bike lane variant on new streets; fix colored asphalt icons |
| 2023-11-25 | Improvements | Korean translation updates |
| 2023-06-20 | New features | **Display name** for accounts (Settings → Profile → Display name) |
| 2023-04-22 | New features | **Share using Mastodon** (asks for instance domain) |
| 2023-04-19 | New features | Indonesian |
| 2023-04-11 | Bug fixes | Fix Facebook share |
| 2023-03-23 | New features | **Export directly to 3DStreet** from Share menu |
| 2022-11-19 | Bug fixes | Safari artwork not drawn; Safari menu positioning |
| 2022-11-15 | New features | **Streetmix+**: two-way cycletracks, mixed-use lane (with bus), mixed-use lane (with bike), drainage channel, sidewalk elevation toggle. **All signed-in**: street vendors, compound wall (ITDP Africa) |
| 2022-11-12 | UI; Improvements | Gallery thumbnails fixed; Finnish & Czech updates |
| 2022-10-25 | UI | **Custom scale slider** in Save-as-image (up to 500%), labels show %, px resolution, print size — **Streetmix+ member feature** |
| 2022-09-08 | UI | New settings menu (signed-in users' user menu); new language selection menu; icons/tooltips in menu bar & street metadata |
| 2022-08-24 | New features; Improvements | Czech & Spanish (Spain); Finnish & Norwegian updates |
| 2022-01-31 | New features | **Streetmix+ announced** (monthly membership): rename street segments; change environmental backgrounds; export without watermark; new segments: double-decker bus, microvan, autonomous shuttles |
| 2021-12-09 | New features | Amharic (ITDP Africa) |
| 2021-11-03 | Improvements | Finnish & Swedish updates |
| 2021-10-21 | UI | Fix Korean word breaks |
| 2021-08-07 | Improvements | New documentation site |
| 2021-07-29 | New features; Improvements | Utility pole segment; palette icons larger/standardized |
| 2021-07-22 | Bug fixes | Buses disappearing on new streets; old Twitter accounts sign-in |
| 2021-07-07 | New features | Swedish |
| 2021-04-07 | New features | Norwegian Bokmål |
| 2021-02-03 | Improvements | BRT stations expand/contract with width |
| 2020-12-17 | Improvements | Food truck tweaks + palette-swap human variant |
| 2020-12-15 | New features; UI | Turkish & Catalan; new trash icon; Overpass font for nameplate |
| 2020-11-19 | New features; UI | Capacity metrics: switch data sources, new infographics; can no longer fork someone else's street from analytics window |
| 2020-10-22 | New features; Bug fixes; UI | Plausible analytics (replaces Google); fix manual width input updating wrong segment; width input +/- grouped; fr/it/es-419 updates |
| 2020-10-07 | New features | BRT station & bus segments |
| 2020-09-29 | Bug fixes | Sentiment survey reappearing |
| 2020-07-23 | Bug fixes | Sentiment survey tooltip translation/layout |
| 2020-07-15 | New features | **Vote on someone else's street** ("how joyful is it?") |
| 2020-07-08 | Bug fixes | Auth fixes |
| 2020-06-19 | Service notice | "Error RM1" auth issue explanation |
| 2020-05-27 | New features; UI; Bug fixes | Outdoor dining; geolocation search zooms; Edge tooltip fix |
| 2020-05-19 | Service notice; New features | Auth system upgrade (everyone signed out); **hide capacity counts** |
| 2020-05-07 | New features | European-style arcade buildings |
| 2020-04-18 | UI | Toast notifications; rounded buttons |
| 2020-04-16 | New features | Planting strips: bushes & flowers |
| 2020-04-08 | New features; Bug fixes | People walk in the street; temp barrier drag fix |
| 2020-04-02 | New features; UI; Bug fixes | Temporary barriers (cones, barricades, jersey barriers); **sign-in-required segments shown (locked) when signed out**; flags fix |
| 2020-03-19 | Improvements; Bug fixes | **MongoDB → PostgreSQL migration complete**; debug "D" key leak fix; gallery crash fix |
| 2020-03-11 | New features | Raised bike lanes; bike share on sidewalk |
| 2020-01-29 | New features; UI; Bug fixes | Outbound AV; motorcycle w/ sidecar (signed-in); Italian, Korean, Latin-American Spanish; gallery remodel; several fixes |
| 2020-01-18 | New features; UI; Bug fixes | Email/Facebook/Google sign-in in all languages (plus Twitter); Rubik UI font; fixes |
| 2020-01-08 | New features; Bug fixes | Turn lane variant with left/right/straight arrows; fix browser back/forward on wide-street scroll |
| 2019-10-14 | — | New logo |
| 2019-09-24 | — | Autonomous vehicles; magic carpets; **street capacity summaries** (NUMO; sign in) |
| 2019-05-21 | — | Electric scooters |
| 2019-01-04 | — | Arabic (RTL UI) |
| 2018-12-19 | — | Minecraft server; forums reset |
| 2018-10-24 | — | Sign-in methods in Spanish |
| 2018-10-10 | — | Discord chatroom |
| 2018-10-09 | — | Russian |
| 2018-09-24 | — | German complete |
| 2018-09-17 | — | Sign in with Google, Facebook, e-mail (en/fi/fr/pl first); ToS & privacy policy |
| 2018-09-09 | — | Light rail/streetcar on grass |
| 2018-08-28 | — | "What's new" box created; flex zone items (taxi/rideshare, food truck, bikeshare, waiting area); palette tooltips; crash fix |
| 2018-08-20 | — | "My streets" gallery requires sign-in |
| 2018-08-10 | — | Chinese (traditional & simplified); new blog |

**Most recent dated entry: 2026-09-16.** Commits in `git log --since=2026-09-16` (14 commits, 2026-09-16 → 2026-09-24):

| Date | SHA | Subject | Likely user-visible? |
|---|---|---|---|
| 2026-09-24 | f17578eec | fix: update canonical unfurl image url | metadata only |
| 2026-09-24 | 130cddef5 | fix(drag_and_drop): try removing preventDefault() | drag/drop behavior tweak |
| 2026-09-24 | b089a5be5 | Reskin/unskin portions of Coastmix UI (#3787) | Coastmix instance only |
| 2026-09-23 | 2e4544144 | feat(SeaLevel): do not transition sea level in some cases | Coastmix only |
| 2026-09-22 | 930b3c6f2 | chore(translations): automated update (#3786) | translations |
| 2026-09-21 | 6b2211fd2 | Move warning state from slices to app-level reducer (#3785) | internal refactor |
| 2026-09-21 | ad1ffae7c | feat(Warnings): extra info for pedestrian or nature types | warnings UI text |
| 2026-09-21 | 9d4c7af73 | Refactor warnings array into object (#3784) | internal |
| 2026-09-21 | 66b4e0c21 | Handful of updates (#3783) | deps/lint |
| 2026-09-17 | 6d27437a1 | chore(translations): automated update (#3779) | translations |
| 2026-09-17 | f24feb5d9 | bump @babel/core (#3778) | deps |
| 2026-09-17 | cdb36de0c | refactor: remove second illustrations escape hatch (#3782) | internal |
| 2026-09-17 | ce5d4f37f | Floating panel portals (#3781) | z-index/stacking of floating panels |
| 2026-09-16 | 39a672e0a | Basic A11y improvements (#3780) | a11y labels on boundary elements/scroll buttons, Coastmix fonts, CSP fontsource host, popups reposition when banners open |

Estimate: after the 2026-09-16 entry, nothing with a changelog-worthy user feature shipped except (a) accessibility labels / floating-panel stacking (#3780, #3781 — possibly what the 09-16 entry already describes), (b) warnings extra info for pedestrian/nature slices, (c) extensive **Coastmix** work (`STREETMIX_INSTANCE=coastmix`, `COASTMIX_MODE` flag, sea-level rise, Boston header, templates `beach`, `coastal_road`, `empty_waterfront`, `harborwalk`). **Coastmix is never mentioned in the changelog** — it is a separate white-label instance (meta description in `app.ts`: "Coastmix is a project by Streetmix and the City of Boston…"). Whether these commits are deployed to production streetmix.net is **UNVERIFIED** (docs say staging auto-deploys, production is manual).

### A2. `docs/user-guide/streetmix-plus.md` — "Sign up for Streetmix+ (beta)"

**Capabilities listed (verbatim bullets):**
1. Rename street segments
2. Change environmental backgrounds
3. Export images without watermark
4. Export images at print-ready resolutions
5. New segments: double decker bus, microvan, and autonomous shuttles
6. Unlimited streets ("Technically, everyone does have unlimited streets already, but this creates some data storage problems on our end, so we need to start setting caps. We'll do this in a fair way. Stay tuned for more.")
7. "Streetmix+ members will also be able to help us prioritize future features to come!"

**How to become a member:**
- **OpenCollective** (preferred; "Both monthly and yearly memberships are available"; CTA link `opencollective.com/streetmix/contribute/streetmix-membership-monthly-1274`). Activation is manual: matched by e-mail "within one week", "We process membership activations on Mondays"; guest/organization accounts must e-mail hello@streetmix.net with receipt + username; prior contributors can be credited.
- **Patreon** (`patreon.com/streetmix`), same manual e-mail matching, one-week/Mondays process.
- **GitHub Sponsors** — "Discontinued … due to low usage".
- **Coil** — "Discontinued. Coil shut down its products on March 15, 2023."

**Pricing statements (verbatim):** The doc gives **no price**. Only: "a membership-based monthly subscription"; "Both monthly and yearly memberships are available." (Changelog 2022-01-31/2022-10-25 also only says "monthly membership subscription".) The only price in the repo is dead client code: `client/dialogs/Upgrade/UpgradeDialog.tsx` default message "For only $5/month, the Enthusiast Plan lets users support Streetmix while also gaining access to new experimental features. Plus your avatar gets a neat badge!" — this dialog is never opened (`showDialog('UPGRADE')` is commented out in `UpgradeButton.tsx` and `StreetmixPlusPrompt.tsx`; both open the docs page instead).

**How membership is linked to the account (doc):** by e-mail match between payment platform and Streetmix login, performed manually by staff; confirmed by "an icon beside your user account name".

**How membership is linked (source):**
- Server: user row has `roles: string[]` (`app/db/models/user.ts`, `addRole()/removeRole()`). Role catalog `app/data/user_roles.json`: `USER` (flags `VARIANT_TWOWAY_BIKES`), `ADMIN`, `BETA_TESTER`, `ITDP`, `TRANSLATOR`, `SUBSCRIBER_1` (flags `SAVE_AS_IMAGE_CUSTOM_DPI: true`), `SUBSCRIBER_2`/`_3` (empty flags).
- Client: `client/store/slices/user.ts` sets `isSubscriber = true` when `signInData.details.roles` includes `SUBSCRIBER_1` (also re-asserted in `setUserProfile` as a "QUICK FIX" for a race). `isCoilPluginSubscriber` via Web Monetization `document.monetization` events (`client/integrations/coil.ts`, still called from `initialization.js`) also sets `isSubscriber` while signed in.
- Role flags are applied client-side in `client/users/authentication.ts` `fetchSignInDetails`: overrides in order `role:<KEY>` for each role → `user` (per-user `flags` column) → `session` (localStorage). So `SUBSCRIBER_1` ⇒ `SAVE_AS_IMAGE_CUSTOM_DPI` on.
- **No API path to grant the role**: `PUT /api/v1/users/:id` only writes `data` (`app/resources/v1/users.ts`). `POST /services/pay` (`app/resources/services/payments.ts`) maps `STRIPE_TIER1_PLAN_ID` → `SUBSCRIBER_1`, but all Stripe calls are commented out and it dereferences `subscription.id` on undefined → would 500. Patreon OAuth (`/services/integrations/patreon`, `/callback`, `/webhook` with MD5 HMAC via `PATREON_WEBHOOK_SECRET`) only records a `UserConnections` row; the webhook returns 204 and grants nothing. Coil OAuth (`/services/integrations/coil`) calls `syncAccountStatus()` which adds `SUBSCRIBER_1` if *any* identity has a `user_id` (very permissive, TODO in code). Feature flag `MEMBER_UPGRADE` ("Integrated membership billing", default false) is defined but **unreferenced in client code**. Conclusion: role assignment in production is a manual DB operation — **UNVERIFIED** (consistent with the doc's "we process activations on Mondays").

**Premium feature cross-check table**

| Premium feature | Doc statement (streetmix-plus.md / changelog) | Source gate | Status |
|---|---|---|---|
| Rename street segments (slice labels) | "Rename street segments" (2022-01-31) | `client/info_bubble/PopupHeader/PopupHeader.tsx`: `isEditUnlocked={isSubscriber \|\| coastmixMode}` → `EditableLabel`; `client/segments/labels.ts` `editSliceLabel` | Shipped |
| Change environmental backgrounds (skybox) | "Change environmental backgrounds" | `client/sky/SkyPicker/SkyPicker.tsx`: `isEnabled = isSubscriber \|\| flags.ENVIRONMENTS_UNLOCKED \|\| COASTMIX_MODE`; locked state shows `StreetmixPlusPrompt`. Flag `ENVIRONMENTS_UNLOCKED` default false, not in any role. `WEATHER_EFFECTS` flag (default false) adds weather options. | Shipped |
| Export images without watermark | "Export images without watermark" | `client/dialogs/SaveAsImage/SaveAsImageDialog.tsx`: `watermark = settings.saveAsImageWatermark \|\| !user.isSubscriber`; checkbox disabled + lock icon + tooltip `plus.locked.sub` for non-subscribers. Server export (`/api/v1/streets/:id/image?watermark=`) honors param without checking role — **UNVERIFIED server-side enforcement** (`app/resources/v1/street_images.ts`, `packages/export-image/src/watermark.ts`) | Shipped (client-enforced) |
| Export at print-ready resolution (custom scale up to 500%) | "Export images at print-ready resolutions"; changelog 2022-10-25 | `client/dialogs/SaveAsImage/CustomScale.tsx`: gated by `flags.SAVE_AS_IMAGE_CUSTOM_DPI.value`; slider 1–5 step 0.25; shows %, px, print size at 300 dpi. Flag granted via `SUBSCRIBER_1` role flags, not via `isSubscriber` (so Coil-plugin-only subscribers don't get it) | Shipped (role-flag gated) |
| Double-decker bus | "New segments: double decker bus" | `client/segments/variant_icons.yaml` `bus` set → `double-decker: unlockCondition: SUBSCRIBE` (enforced in `VariantButton.tsx`) | Shipped |
| Microvan | "microvan" | `variant_icons.yaml` drive-lane vehicle `microvan: unlockCondition: SUBSCRIBE` | Shipped |
| Autonomous shuttle | "autonomous shuttles" | `variant_icons.yaml` `av-shuttle: unlockCondition: SUBSCRIBE` | Shipped |
| Unlimited streets / caps for free users | "Unlimited streets … we need to start setting caps" | No per-user street cap anywhere in `app/`. `DEFAULT_LIMIT=100`, `MAX_LIMIT=200` in `app/resources/v1/users_streets.ts` / `streets.ts` are pagination only. | Doc-only (not implemented) |
| Two-way cycletrack | 2022-11-15: Streetmix+; 2025-04-23: all signed-in users | `variant_icons.yaml` `twoway-left/right: unlockCondition: SIGN_IN`; `USER` role flag `VARIANT_TWOWAY_BIKES` | Shipped, demoted to sign-in (doc consistent via changelog; streetmix-plus.md never listed it) |
| Mixed-use drive lane with bus | changelog 2022-11-15 only | `variant_icons.yaml` `car-with-bus: unlockCondition: SUBSCRIBE, unlockWithFlag: VARIANT_MIXED_DRIVE_LANES_1` (flag given to `BETA_TESTER`, `ITDP`) | Source-only vs streetmix-plus.md (changelog-only) |
| Mixed-use drive lane with bike | changelog 2022-11-15 only | `car-with-bike: SUBSCRIBE / VARIANT_MIXED_DRIVE_LANES_2` | Source-only vs streetmix-plus.md |
| Drainage channel | changelog 2022-11-15 only | `packages/parts/data/segment-lookup.yaml` `drainage-channel: unlockCondition: SUBSCRIBE, unlockWithFlag: SEGMENT_DRAINAGE_CHANNEL_UNLOCKED` (enforced in `client/palette/PaletteItem.tsx`) | Source-only vs streetmix-plus.md |
| Sidewalk elevation toggle | changelog 2022-11-15 only | `variant_icons.yaml` `universal-elevation.sidewalk: SUBSCRIBE / unlockWithFlag ELEVATION_CONTROLS_UNLOCKED`; also `UNIVERSAL_ELEVATION_CONTROLS` flag in `PopupControls.tsx`/`VariantSet.tsx` | Source-only vs streetmix-plus.md |
| Rain garden (bioswale) | not in docs | `segment-lookup.yaml` `bioswale: enableWithFlag: COASTMIX_MODE, unlockCondition: SUBSCRIBE` | Source-only (Coastmix) |
| No sponsor banner | not in docs | `client/app/SponsorBanner.tsx`: returns null for subscribers (banner config from `SPONSOR_BANNER` env) | Source-only |
| Userback feedback widget | not in docs | `client/app/App.tsx`: `initUserback()` only if `coastmixMode \|\| isSubscriber` (`USERBACK_TOKEN` env) | Source-only |
| Member badge next to avatar | "you'll see an icon beside your user account name" | `client/menubar/AvatarMenu.tsx` (badge `streetmix-plus.svg`, title "Streetmix+ member"), `IdentityMenu.tsx` role badge, `MenuBar.tsx` hides `UpgradeButton` for subscribers | Shipped |
| In-app purchase / upgrade dialog | doc: sign up via OpenCollective/Patreon | `UpgradeDialog.tsx` + `/services/pay` (Stripe stubbed out), `MEMBER_UPGRADE` flag unused | Source-only, non-functional |
| Coil / Web Monetization | doc: discontinued | Client `initCoil()` still runs; `WEB_MONETIZATION_PAYMENT_POINTER` meta tag in `main.hbs`; server Coil OAuth routes present | Source-only (doc says discontinued) |

### A3. Parity-matrix claims from user-guide docs

| Claim / behavior | Evidence (doc file) | Source corroboration |
|---|---|---|
| Documentation is "under construction"; user guide a work in progress | `intro.md`, `street-design-elements.md`, `vehicles.md`, `case-studies.md` (unlisted) | — |
| `segments.md` is a redirect stub to `street-design-elements.md` | `segments.md` (`unlisted: true`) | — |
| Default/min/max widths: drive lane 10/9/12 ft (3.0/2.7/3.6 m); turn lane 10/10/12; center turn lane 12/10/16 ft; parallel parking 8/7/10 ft; perpendicular 18–20/14–18/22 ft; bike lane 6/3/8 ft; sharrow 14/12/14 ft; two-way cycletrack min 3 m (10 ft) by convention with ITDP; medians 1.2–24 m; pedestrian median ≥6 ft; streetcar/light rail 10 ft min; sidewalk 2.4 m min; sidewalk border min 2 ft | `street-design-elements.md` | Actual rules live in `packages/parts/data/segment-lookup.yaml` (`defaultWidth`, `rules.minWidth/maxWidth` per metric/imperial) — not cross-checked value-by-value |
| Left-hand-side and contra-flow bike lanes are "permissible in Streetmix" | `street-design-elements.md` | variants `inbound/outbound` |
| Painted buffer "not currently automatic"; shoulders/gutters "not presently planned" | `street-design-elements.md` | — |
| Vehicles present/planned: cars (personal, taxi, rideshare, AV), bicycle, motorcycle w/ sidecar, truck, food truck, streetcar, light rail, bus, e-scooter, magic carpet; pedestrians are not vehicles | `vehicles.md` | `variant_icons.yaml`, `segment-lookup.yaml` |
| Climate-resilience glossary (berm, elevated roadway, seawall, deployable barrier, dune, marsh, green infrastructure, rain garden/bioswale, managed retreat) — Boston-focused | `climate-resilience.md` | Coastmix segments `beach`, `marsh`, `wall`, `guardrail`, `slope`, `bioswale` all `enableWithFlag: COASTMIX_MODE` |
| Licensing: software AGPL-3.0, content CC-BY-SA 4.0; formerly BSD-3; attribution required | `support/faq.md` | `LICENSE` header, `packages/illustrations/README.md` |
| Self-hosting allowed; whitelabel instances offered commercially | `support/faq.md` | `STREETMIX_INSTANCE` env, `InstanceBadge.tsx` |
| Internet Explorer unsupported; evergreen browsers | `support/faq.md`; `contributing/code/reference/project.md` ("last two major versions"; tablets supported; mobile limited) | `browserslist` in `package.json` |
| No setback lines / curb-to-curb widths; no locking parts of a street | `support/faq.md` | — |
| Sign-in methods: e-mail magic link (single-use; "Welcome to Streetmix! Your sign-in link is here." from hello@streetmix.net via Mailgun), Twitter, Facebook, Google | `support/troubleshooting.md`; changelog 2018-09-17, 2020-01-18 | Auth0 (`AUTH0_*` env), `/services/auth0/sign-in-callback`, `/services/auth0/refresh-login-token` |
| Error codes: 9B (empty street data), RM1 (corrupt remembered credentials → clear site data) | `support/troubleshooting.md` | `MODES.AUTH_EXPIRED` in `client/users/authentication.ts` |
| Bug reports via GitHub issues, Discord for urgent | `support/bug-report.md` | — |
| Autosave (no manual save) | changelog implicit; source toast `toast.no-save` on Ctrl+S | `client/app/keyboard_commands.ts` |
| Keyboard shortcuts | changelog 2025-12-20 (Shift = fine resolution), 2025-04-23 (resize/delete under pointer), 2025-05-21 (building height keys) | Source: Ctrl+Z undo; Shift+Ctrl+Z / Ctrl+Y redo; Ctrl+S → toast; Shift+F feature-flag dialog (non-prod or ADMIN); `?` About dialog; `-`/`_` and `+`/`=` resize hovered slice (Shift = fine increment); Backspace/Delete remove hovered slice (Shift+Delete clears all); Left/Right (+Shift) scroll street; Esc closes dialogs/menus/gallery/welcome panel, cancels resize drag (`keyboard_commands.ts`, `Segment.tsx`, `ScrollIndicators.tsx`, `Scrollable.tsx`, `Dialog.tsx`, `MenusContainer.tsx`, `Gallery.tsx`, `WelcomePanel.tsx`, `HelpMenu.tsx`) |
| Units: metric internal; imperial resolution 0.25 ft, click increment 0.5 ft; metric resolution 0.05 m, click 0.1 m; street width 3–120 m (10–400 ft); segment width 0.25–120 m; US → imperial units by geo-IP; left-hand-traffic country list | changelog 2024-03-22, 2025-12-20 | `client/segments/constants.ts`, `client/streets/constants.ts`, `client/users/localization.ts` (`COUNTRIES_IMPERIAL_UNITS = ['US']`) |
| Sharing: copy link; Mastodon, Twitter, Facebook; Export to 3DStreet; Export to Streetmeter; Print; Save as image (hidden in Coastmix/offline modes); sign-in promo for anonymous | changelog 2023-03-23, 2023-04-22, 2025-04-23 | `client/menubar/menus/ShareMenu/ShareMenu.tsx` |
| Save-as-image options: transparent sky, segment names/widths, street name, watermark (Streetmix+), custom scale (Streetmix+), experimental server pipeline flag `SAVE_AS_IMAGE_NEW_EXPORT_PIPELINE` → `GET /api/v1/streets/:id/image?...&experimental=1` | changelog 2022-10-25 | `SaveAsImageDialog.tsx`; server `@streetmix/export-image` uses `@napi-rs/canvas` |
| Gallery: "My streets" requires sign-in; paginated 100/page (max 200); global gallery; `GALLERY_SEARCH` flag (beta testers) | changelog 2018-08-20, 2026-07-14 | `client/gallery/*`, `app/resources/v1/users_streets.ts` |
| Remix: editing someone else's street auto-remixes, "(remix)" suffix; promote street on sign-in; `GET /api/v1/streets/:id/remixes` | changelog 2020-11-19 (no forking via analytics) | `client/streets/remix.ts`, `app/api_routes.ts` |
| Street templates: default, empty, copy-last, stroad (signed-in, flag `NEW_STREET_TEMPLATES`), Coastmix: beach, coastal_road, empty_waterfront, harborwalk | changelog 2025-12-20 | `app/data/templates/*.yaml` served at `/assets/data/templates/`, `client/menubar/menus/NewStreetMenu.tsx`, `client/streets/templates.ts` (`LATEST_SCHEMA_VERSION = 35`) |
| Street schema migration (server-side on load) | — | `app/lib/street_schema_update.js` (versions up to 35; no test file) |
| Geolocation/geotag: Pelias geocoding, Carto basemap, Leaflet; map centers on user position | changelog 2025-12-20, 2020-05-27 | `PELIAS_*`, `CARTO_API_KEY`, `GEOTAG` flag |
| Capacity analytics with switchable data sources; hide counts | changelog 2019-09-24, 2020-05-19, 2020-11-19 | `ANALYTICS` flag, `client/segments/capacity_data.json`, `AnalyticsDialog` |
| Sentiment survey / votes | changelog 2020-07-15 | `SENTIMENT_SURVEY` flag (default false), `/api/v1/votes` |
| Display name editing | changelog 2023-06-20 | `updateDisplayName` in user slice |
| Settings menu, language menu; locale levels 1–3 gating via flags | changelog 2022-09-08 | `LOCALES_LEVEL_1/2/3` flags, `MenuBar.tsx` |
| Analytics provider Plausible; Sentry error reporting | changelog 2020-10-22 | `PLAUSIBLE_ID`, `@sentry/browser` |
| Dark mode | — | `COLOR_MODE_TOGGLE` flag (admin/beta only) — not documented |
| Offline mode | `contributing/code/local-setup.md` | `OFFLINE_MODE` env |

### A4. `docs/contributing/code/*` key technical facts

**`local-setup.md`**
- Prereqs: Node.js (production uses "Active LTS"; locally any Current/Active), **PostgreSQL**, **PostGIS**. Mac via Homebrew (`brew install nodejs postgres postgis`), Windows (limited testing; Git Bash/PowerShell), Linux (nvm recommended; Debian/Ubuntu needs a DB user: `createuser streetmix_user; ALTER USER … WITH CREATEDB SUPERUSER; ALTER USER … WITH PASSWORD`; SUPERUSER needed only for migration).
- Steps: `git clone https://github.com/streetmix/streetmix.git` → `cd streetmix && npm install` (**not Yarn**) → optional `.env` with `PGUSER`/`PGPASSWORD` → `npx sequelize db:create && npx sequelize db:migrate` and again with `NODE_ENV=test` (two DBs required) → `npm start` → `http://localhost:8000`. Update: `git pull`, `npm install`, `npx sequelize db:migrate`. Debug: `DEBUG=sequelize* npx sequelize db:migrate`.
- Env vars: copy `.env.example` → `.env`. **Required**: `AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET` ("Streetmix will run without this, but … you will need these keys to sign in"; get your own free-tier Auth0 keys; production keys from maintainers). Server: `NODE_ENV` (development), `APP_DOMAIN` (localhost), `APP_PROTOCOL` (http for localhost else https), `PORT` (8000). Optional third-party: `CLOUDINARY_API_KEY/SECRET`, `FACEBOOK_APP_ID`, `NEW_RELIC_LICENSE_KEY`, `PELIAS_API_KEY`, `PELIAS_HOST_NAME`, `CARTO_API_KEY`, `PLAUSIBLE_ID`, `TRANSIFEX_API_TOKEN`, `WEB_MONETIZATION_PAYMENT_POINTER`. Postgres: `PGUSER` (system user), `PGPASSWORD`, `PGDATABASE` (`streetmix_dev`), `PGHOST` (127.0.0.1), `PGPORT` (5432), `DATABASE_URL` (takes precedence). Additional: `COOKIE_SESSION_SECRET`, `DEBUG`, `OFFLINE_MODE`, `STREETMIX_INSTANCE`.
- Not in the doc but in `.env.example`: `PATREON_CLIENT_ID`, `PATREON_CLIENT_SECRET`, `PATREON_WEBHOOK_SECRET`, `USERBACK_TOKEN`, `SPONSOR_BANNER`. Not in either: `STRIPE_TIER1_PLAN_ID`, `COIL_CLIENT_ID/SECRET`, `SENTRY_ALLOW_FAILURE`, `CYPRESS_INSTALL_BINARY`, `HUSKY`.
- Offline mode: `OFFLINE_MODE=true npm start`; no Auth0 needed. "Not a well-supported feature".
- `.env.test` (committed): `NODE_ENV=test`, `PGDATABASE=streetmix_test`, `PELIAS_API_KEY=ge-iampelias2`, `PELIAS_HOST_NAME=api.geocode.earth`.

**`overview.md`**: GitHub Flow; branch `username/feature-name`; semantic commits enforced by hooks (husky + commitlint conventional); PRs small; CI must pass. **`troubleshooting.md`**: match Node/npm to `package.json`; remove `node_modules`/`.cache`; use npm not Yarn; `EADDRINUSE` loop (issue #983).

**`reference/segments.md`** (draft spec): glossary segment / segment component / sprite; four component types — Lanes (surface material, surface height delta from grade where +1 = curb lip, intent, min/max desired speed; every segment has one lane), Vehicles (label, weight, footprint, speed, emissions, capacity, automation), Objects/furniture (point-mappable), Markings (transitional category). Components in `components.json` (actual: `packages/parts/data/components.yaml`); segments in `segment-lookup.json` (actual: `packages/parts/data/segment-lookup.yaml`). Rationale: old format duplicated definitions and variants multiply combinatorially (why raised bike lanes were delayed). Legacy spec `client/src/segments/README.md`: properties `name`, `owner`, `zIndex`, `defaultWidth {metric, imperial}`, `variants`, `enableWithFlag`, `description {prompt,image,imageCaption,lede,text}`, `details` per variant (`name`, `minWidth`, `maxWidth`, `graphics {center,repeat,left,right,scatter}`), tilesheet scale "24 pixels equals one foot", scatter `pool: people`, `minSpacing`/`maxSpacing` (default 0/3 ft).

**`reference/skybox.md`** (draft): "skybox" internal term, "environment" in UI; defs in `skybox-defs.json` (doc path `assets/scripts/streets/skybox-defs.json` is stale; actual under `client/src/sky/`). Properties: `name` (required), `enabled` (default true), `iconImage`, `backgroundImage` (tiled 1:1), `backgroundGradient` (array of CSS colors or `[color, stop]`), `backgroundColor`, `backgroundObjects[] {image,width,height,top 0–1,left 0–1}`, `foregroundGradient`, `cloudOpacity` (0–1, default 1), `invertUITextColor`; `_comment*` keys ignored.

**`reference/i18n.md`**: locale files "in `assets/locales`" (stale; actual `packages/i18n/locales/<code>/{main.json, segment-info.json}`, 29 dirs); generated by script, do not edit except `en` (source language, mirrored to Transifex within a day); modifying strings resets other languages; deleting strings destroys history (so deprecated strings are kept). Live preview from Transifex when `TRANSIFEX_API_TOKEN` is set (`GET /api/v1/translate/:locale/:resource`). Snapshot command documented as `node ./packages/i18n/download_translations.js` (stale; actual `npm run translations:download` = `tsx --env-file=.env packages/i18n/src/download_translations.ts`).

**`reference/tests.md`**: `npm test` = lint + unit; `npm run cypress:run` for e2e; Vitest + React Testing Library; tests colocated as `*.test.ts(x)`; prefer integration over unit; helpers in `./test/helpers/` wrap `render()` with Redux `<Provider>` and `<IntlProvider>`; snapshots used cautiously (`client/src/app/StreetEditable.test.tsx` cited); global mocks (`load_resources`); Cypress sparingly, CI only by default; ESLint + Stylelint + Prettier via commit hook; TypeScript migration in progress; no device/browser testing (Browserstack account); GitHub Actions CI; `[skip ci]`; auto-deploy to staging on `main`, production manual; Codecov informational (threshold 1%).

**`reference/csp.md`**: CSP via helmet HTTP headers; most restrictive directives; inline scripts need a nonce (uuid; no SHA hashes); violations blocked in production, allowed-but-reported in development (`NODE_ENV=development`); reports to `/services/csp-report`; single CSP for dev and prod except `ws:` for Parcel HMR (source also adds `'unsafe-eval'` in dev). Source `app.ts` whitelists e.g. `static.userback.io`, `static.cloudflareinsights.com`, plausible nonce.

**`reference/project.md`**: stack Express, PostgreSQL, PostGIS, **Parcel**, React, Redux (Toolkit), PostCSS; dependencies pinned (Dependabot noise); browser support last two major evergreen versions; tablets ok; mobile limited. **`reference/helpers.md`**: seeded PRNG via `generateRandSeed()` + `seedrandom`; Axios preferred over fetch (`util/api`).

### A5. Illustrations docs

- **`illustrations/overview.md`**: contribute via `#illustrations` on Discord; inspiration on Pinterest.
- **`illustrations/library.md`**: reference gallery of SVGs served from `https://streetmix.github.io/illustrations/images/...` (canonical repo `github.com/streetmix/illustrations`). Sections and image counts: bikes 10, buildings 14, construction 4, curb 4, dividers 4, furniture 5, lamps 8, parklet 2, people 35, plants 7, scooters 6, secret 1, transit 19, trees 2, utilities 2, vehicles 36, wayfinding 3 (162 images; "not all" illustrations; "not drawn to scale").
- **`illustrations/design-principles.mdx`**: simplified forms; sharp angles, minimal perfect circles; few orthogonal lines (trapezoidal; exception: building walls must be vertical); recurring 45° angles, the "brick" and "platter" trapezoids; no letters/words (except route identifiers); no brands/logos; palette with hex swatches — skin tones (#553f37…#e1c5b5), beiges, off-whites/greiges, greens (#35813f, #679a45, #89ba6a), browns, grayscale, indigos, blues, reds/oranges, brights (#e7673c, #f8bb1c, #fcd157, #109ba8); ASE and GPL swatch downloads; one solid color + highlight + lowlight, no gradients/drop shadows (sky excepted); extra contrast for small objects; workflow in illustrations repo; optimize via SVGOMG.
- **Licensing**: design-principles/library pages state no license. `packages/illustrations/README.md`: "licensed under a Attribution-ShareAlike 4.0 International (CC BY-SA 4.0) License"; `user-guide/support/faq.md`: content CC-BY-SA, code AGPL-3.0 (formerly BSD-3). Credits: art direction Katie Lewis; contributors Marcin Wichary, Lou Huang, Doneliza Joaquin, Jon Reese, Brian Wamsley, Claudio Olivares Medina, Enrico Ferreguti.
- **Scale/grid rules**: *not stated in `docs/`*. From source: `packages/illustrations/README.md` "Illustrations use a scale of **1 pixel = 1 centimeter**"; legacy `client/src/segments/README.md` "**24 pixels equals one foot**" on tilesheets; `client/src/segments/constants.ts`: `TILESET_POINT_PER_PIXEL = 2.0 * 1.27` (= 2.54, "1-inch to 1cm conversion"), `TILE_SIZE = 12 / 0.3048` ≈ 39.37 px per metre at render scale (12 px per foot), `TILE_SIZE_ACTUAL = TILE_SIZE * 2.54` = 100 px per metre in sprite space (consistent with 1 px = 1 cm); `CANVAS_HEIGHT = 600`, `MAX_CANVAS_HEIGHT = 2048`, `GROUND_BASELINE_HEIGHT = 45`, `BOUNDARY_WIDTH = 360` px, `MAX_BUILDING_HEIGHT = 20` floors, `ELEVATION_INCREMENT = 0.15 m` (= curb height), imperial 0.5 ft. Same `TILE_SIZE` in `packages/export-image/src/constants.ts`. Also sprite layer naming `lower-case-with-dashes`, export from Affinity Designer, no raw text/raster/strokes, SVGO pipeline.

### A6. Translations docs

- **`translations/overview.md`**: volunteer translators; join Discord + email hello@streetmix.net.
- **`translations/new-translator-guide.md`**: **Transifex** project `transifex.com/streetmix/streetmix`; two resources — "Main application" (`main.json`) and "Segment info" (`segment-info.json`); staging server `streetmix-staging.herokuapp.com` fetches Transifex live; "translator" role on staging unlocks in-progress languages in Settings; Transifex pulls English source from GitHub twice a day; placeholders, plurals (CLDR), history, issues/comments.
- **`translations/faq.md`**: friendly/informal tone; sentence case; punctuation matches English; "(en)" for English links.
- **Locales and levels are NOT listed in docs**; source `packages/i18n/src/locales.ts` (levels: 1 in progress/translators only, 2 complete/QA, 3 production, 4 default English; `ENABLED_LOCALE_LEVEL = 3`; flags `LOCALES_LEVEL_1/2/3` lower the bar — level 1 for ADMIN/BETA_TESTER/TRANSLATOR roles):

| Level | Locales |
|---|---|
| 4 (default) | en |
| 3 (production) | am, ar, ca, cs, de, es-419, es-ES, es-MX, fi, fr, id, it, ja, ko, nb-NO, pl, pt-BR, ru, sv, tr, zh-Hans, zh-Hant |
| 2 (QA) | nl-NL |
| 1 (in progress) | en-GB, es, fil, ro-RO, sk |

29 locale directories in `packages/i18n/locales/`, each with `main.json` and `segment-info.json`. Automated daily download at 07:30 UTC via `.github/workflows/update-translations.yml` (opens PR "chore(translations): automated update", reviewer louh). Changelog-mentioned languages (ja, pt-BR, nl-NL, es-MX, fil, sk, ro-RO) have no changelog announcement — UNVERIFIED when added.

---

## Part B — Test infrastructure

### B1. Vitest configuration

| File | Content |
|---|---|
| `vitest.config.ts` (root) | `test.projects: ['app/vitest.config.ts', 'client/vitest.config.ts', 'packages/*', '!packages/tsconfig.base.json']` — workspace projects; no root coverage config (coverage via CLI `vitest run --coverage` using `@vitest/coverage-v8` 5.0.1; thresholds not set; Codecov `codecov.yml` project threshold 1%, patch informational) |
| `client/vitest.config.ts` | name `client` (green); plugin `@modyfi/vite-plugin-yaml`; `globals: true`; **environment `happy-dom`**; `setupFiles: ./test/vitest.setup.ts`; aliases: image files → `__mocks__/fileMock.ts`, `~` → `client/` |
| `app/vitest.config.ts` | name `server` (cyan); `globals: true`; **environment `node`**; `setupFiles: ./test/vitest.setup.ts`; `include: ['**/*.test.ts']` |
| `packages/parts/vitest.config.ts` | name `@streetmix/parts` (yellow); node; `exclude: ['build']` |
| `packages/utils/vitest.config.ts` | present (similar; not read) |
| `client/test/vitest.setup.ts` | `@testing-library/jest-dom/vitest`, `vitest-canvas-mock`; `process.loadEnvFile('.env.test')`; **MSW** server (`client/test/server/index.ts`, `handlers.ts` mocking `/api/v1/users/`, `/api/v1/translate/:lang/:resource`, `/assets/data/templates/*`, Pelias `autocomplete`/`search`, catch-all `https://*`); stubs `print`, `confirm`, `prompt`, `navigator.geolocation`; global `vi.mock('../src/ui/Icon.tsx')`, `vi.mock('react-transition-group')` |
| `app/test/vitest.setup.ts` | `process.loadEnvFile('.env.test')`; `NODE_ENV=test`; `vi.mock('../lib/logger.ts')` |
| Client test helpers | `client/test/helpers/render.tsx` (RTL render with Redux + IntlProvider), `helpers/store.ts`, `factories/street.ts`, `fixtures/{street.json,user.json,geocode,templates}`; `client/__mocks__/{fileMock.ts, react-transition-group.ts}`; `app/lib/__mocks__` |
| Other test deps | `happy-dom` 20.14.5, `msw` 2.15.0, `react-dnd-test-backend`, `vitest-localstorage-mock`, `axios-mock-adapter`, `supertest` 7.2.2, `sequelize-mock`, `@faker-js/faker` |

### B2. Test file counts and notable suites

Counts (`*.test.ts|tsx|js`, excluding `.snap`): **client 105**, **app (server) 11**, **packages 4** (`parts`: `info.test.ts`, `segment-dict.test.js`; `utils`: `dimensions.test.ts`, `number.test.ts`). 45 snapshot files. Client by directory: store 20 (18 slices + `__tests__/street.integration.test.js`), streets 13, app 12, segments 11, menubar 10, dialogs 10, ui 6, info_bubble 6, palette 4, gallery 4, sky 3, util 2, users/plugins/locales/boundary 1 each. Only two `__tests__` dirs on the client (`segments/__tests__`, `store/__tests__`); server uses `app/__tests__`, `app/resources/v1/__tests__`, `app/db/models/__tests__`.

| Area | Suites (tests) | What they check |
|---|---|---|
| Width / units | `client/util/width_units.test.ts` (34), `client/streets/width.test.ts` (10), `packages/utils/src/dimensions.test.ts` (14), `client/ui/MeasurementText.test.tsx` (5), `client/streets/StreetMeta/StreetMetaWidth.test.tsx` (8), `client/info_bubble/PopupControls/WidthControl.test.tsx` (3), `client/segments/__tests__/resizing.test.ts` (5), `client/boundary/boundary.test.ts` (2) | `processWidthInput()` parsing (primes, fractions, units); `normalizeStreetWidth` min/max/rounding per unit system; `roundToNearestEighth`, `prettifyWidth`, vulgar fractions; metric/imperial/French display; width menu; `normalizeSegmentWidth`/`normalizeAllSegmentWidths`; building height formatting |
| Undo / redo | `client/store/slices/history.test.ts` (9), `client/streets/undo_stack.test.ts` (2), `client/palette/UndoRedo.test.tsx` (2), `client/app/keypress.test.ts` (9, incl. redo key combos) | reducer `createNewUndo` truncation/trim; `finishUndoOrRedo` restores street; buttons dispatch |
| Segments | `client/segments/__tests__/capacity.test.ts` (12), `labels.test.ts` (16), `slope.test.ts` (8), `scatter.test.ts` (4), `variant_utils.test.ts` (3), `Segment.test.tsx`, `EmptySegment*.test.tsx`, `ResizeGuides.test.tsx`, `SegmentLabelContainer.test.tsx`, `client/streets/warnings.test.ts` (5), `client/store/slices/warnings.test.ts` (1), `client/info_bubble/PopupLower/Warnings.test.tsx`, `client/app/StreetEditable.test.tsx` (snapshot of warnings), `packages/parts/src/info.test.ts` (9), `segment-dict.test.js` (7) | capacity inheritance/zeroing; locale slice names & `editSliceLabel`; slope/rise-run; scatter density; segment info/lookup/overrides |
| Serialization / street data | `client/store/slices/street.test.ts` (45: reducer, name, location, buildings, floors…), `client/store/__tests__/street.integration.test.js` (15: addSegment, clearSegments, incrementSegmentWidth by resolution…), `client/streets/templates.test.ts` (4: metric/US template creation, mirroring), `client/streets/thumbnail.test.ts`, `client/app/page_url.test.ts` (4: street URLs incl. reserved names/slugs) | **No test for `app/lib/street_schema_update.js`** (server schema migration to v35) and none for `client/streets/data_model.ts` |
| API routes | `app/__tests__/api_routes.test.ts` (8, router wiring), `app/resources/v1/__tests__/streets.test.ts` (5: POST/GET/PUT/DELETE/GET-by-id), `street_images.test.ts` (5: 201/403/204/200), `users.test.ts` (4), `user.test.ts` (7: PUT 204/401, admin, GET, DELETE), `user_session.test.ts` (1), `votes.test.ts` (4), `translate.test.ts` (3: local vs Transifex) | supertest against routers with mocked models; **DB not used in CI** (postgres service commented out in `ci.yml`) |
| Auth | `app/authentication.test.ts` (4: middleware), `app/__tests__/service_routes.test.ts` (5), `app/db/models/__tests__/user.test.ts` (7: default role USER, add/remove ADMIN, invalid roles), `client/store/slices/user.test.ts` (6: subscriber role, Coil plugin), `client/dialogs/SignIn/SignInDialog.test.tsx` (1), `client/menubar/AvatarMenu.test.tsx`, `IdentityMenu.test.tsx` | — |
| Other notable | `client/locales/locale.test.ts` (4 fuzzy locale matching), `client/gallery/Gallery.test.tsx` (8), `GalleryPagination.test.tsx` (5), `client/menubar/menus/ShareMenu/ShareMenu.test.tsx` (13), `client/dialogs/SaveAsImage/SaveAsImageDialog.test.tsx` (2), `client/sky/*` (3), `client/plugins/coastmix/sea_level.test.ts` (8), `client/store/slices/coastmix.test.ts` (12), `client/app/flag_utils.test.ts`, `client/dialogs/FeatureFlag/FeatureFlagDialog.test.tsx` | — |

### B3. Cypress

- `cypress.config.ts`: `projectId: '2bmjk3'`, viewport 1280×720, `video: false`, `defaultBrowser: 'chrome'`, `e2e.baseUrl: http://localhost:8000`, loads `.env` if present (not in CI), exposes `PELIAS_HOST_NAME` to tests via `config.env` and `expose.peliasHostName`. Cypress 16.1.0; `eslint-plugin-cypress`.
- Directory: `cypress/README.md` (one line), `cypress/e2e/street-save-new.cy.ts` (only spec), `cypress/fixtures/{reverse-location.json, street-post-response.json}`, `cypress/support/e2e.ts` (boilerplate comments only), `cypress/tsconfig.json`.
- Spec `street-save-new.cy.ts` — context "User saves a new street": intercepts `POST /api/v1/streets*` (fixture), `PUT /api/v1/streets/*` (204), Pelias `https://<peliasHostName>/v1/reverse*` (fixture); stubs `window.prompt` → `'my custom message'`. Test 1 "lets users create a new blank street": waits for POST+PUT, welcome panel contains "Welcome to Streetmix", closes it, clicks "Unnamed St" (prompt renames street), waits for PUT. Test 2 "Opens the GeotagDialog & confirms or clears location via the popup button": closes welcome panel, clicks "Add location" in `.street-meta`, clicks Leaflet map at (625,300), waits for reverse geocode, asserts label "12572 Fm 586 S, Brookesmith, TX, USA", clicks popup confirm button.
- Run: `npm run cypress:open` / `npm run cypress:run` (server must be running at :8000 — docs: "Full integration tests happen in our CI"). CI job `cypress` in `.github/workflows/ci.yml`: container `cypress/browsers:node-24.12.0-chrome-143…`, `cypress-io/github-action@v7` with `build: npm run build`, `start: npm run serve`, `wait-on http://localhost:8000`, browser chrome, `record: true` (`CYPRESS_RECORD_KEY`), env `PELIAS_API_KEY=ge-iampelias`, `PELIAS_HOST_NAME=dummy.pelias.com`, `NODE_ENV=test`, `SENTRY_ALLOW_FAILURE=true`. No database service in the job → the app runs without Postgres (**UNVERIFIED** how `/api/v1/streets` behaves; the spec intercepts those calls).

### B4. How to run; engines

| Task | Command (root `package.json`) |
|---|---|
| Dev (all) | `npm start` → `concurrently` `npm:dev-server` (nodemon `node --env-file-if-exists=.env index.ts`, watches app/lib/index.ts/app.ts/packages), `npm:dev-client` (`npm run -w @streetmix/client dev` = `parcel watch src/main.tsx --dist-dir ../build --public-url /assets`), `npm:dev-tsc` (`tsc -b --watch`) |
| Production serve | `npm run serve` → `nodemon --exec "node -r newrelic index.ts"` (Heroku `Procfile`: `web: npm run serve`, `release: ./bin/release_tasks.sh` = `npx sequelize db:migrate`) |
| Build | `npm run build` → `npm run build --workspaces --if-present` (client: `parcel build src/main.tsx --dist-dir ../build --public-url /assets`; `postbuild` uploads Sentry sourcemaps via `sentry-cli`, `SENTRY_ALLOW_FAILURE=true` in CI; packages build with tsc) |
| Clean | `npm run clean` (removes `.parcel-cache`, `build`, package `build` dirs, `tsconfig.tsbuildinfo`) |
| Lint | `npm run lint` = `lint:css` (`stylelint "./client/**/*.css"`) + `lint:js` (`eslint`, flat config `eslint.config.ts`; plugins import-x, n, promise, react, react-hooks, react-refresh, formatjs, typescript-eslint, cypress) |
| Tests | `npm test` = `npm run lint && npm run vitest`; `npm run vitest` (watch), `npm run vitest:server` (`--project server`), `npm run vitest:ci` (`vitest run --coverage`); `test:models` with `pretest:models`/`posttest:models` (DB migrate/reset; note `db:reset` script is not defined — stale) |
| DB | `npm run db:create`, `db:migrate`, `db:migrate:undo` (`sequelize-cli`) |
| Translations | `npm run translations:download` (needs `.env` `TRANSIFEX_API_TOKEN`), `translations:download:ci` |
| Git hooks | `prepare: husky`; `lint-staged`: prettier + eslint --fix on `*.{js,ts,tsx,cjs}`, prettier on `*.{json,css,md,yaml}`; commitlint conventional (`commitlint.config.cjs`, workflow `commitlint.yml`) |
| Docs site | in `docs/`: `npm run start|build|serve` (Docusaurus 3.10); Argos/Playwright screenshot workflow `docs-argos.yml` |

**Engines** (`package.json`): `"node": "^22.21.0 || ^24.10.0 || ^26.0.0"`, `"npm": ">=11.x"`. CI matrix: Node 22.x, 24.x (coverage reported), 26.x (experimental, allowed to fail); lint on Node 24. Workspaces: `packages/types`, `packages/utils`, `packages/i18n`, `packages/parts`, `packages/*` (also `export-image`, `feature-flags`, `illustrations`, `variant-icons`), `client`, `docs`. Root `"type": "module"`; TypeScript via `npm:@typescript/typescript6` (+ `@typescript/native` 7 preview); server runs `.ts` directly with Node (type stripping) — hence Node ≥22.21.

### B5. Client build, entry HTML, env vars, static serving

- **Bundler: Parcel 2.16.4** (not Vite; Vite 8 is a devDependency only for Vitest). `client/.parcelrc` extends `@parcel/config-default` with `@parcel/transformer-js` + `@parcel/transformer-react-refresh-wrap`; `@parcel/transformer-yaml` for `.yaml` imports (`variant_icons.yaml`, `segment-lookup.yaml`); root `package.json` has `alias.process.global = process` and `@parcel/resolver-default.packageExports: true`. PostCSS (`client/.postcssrc`, `postcss-nesting`, autoprefixer). Entry **`client/src/main.tsx`**; output `build/` at repo root with `--public-url /assets` (emits `main.js`, `main.css`, hashed assets). Docs `reference/project.md` and `csp.md` confirm Parcel.
- **Entry HTML**: server-rendered Handlebars `app/views/main.hbs` (and `error.hbs`), `app.set('views', 'app/views')`; catch-all `app.use((req,res) => res.render('main'))`. Template mounts `<div id="react-app">`, `<div id="svg">` (SVG sprite staging), loads `/assets/main.{{cacheTimestamp}}.css` and `<script src="/assets/main.{{cacheTimestamp}}.js" type="module">`; a middleware strips the numeric timestamp (`/main.123.js` → `/main.js`). Template variables: `STREETMIX_TITLE/DESCRIPTION/URL/IMAGE` (Coastmix variants when `STREETMIX_INSTANCE=coastmix`), `nonces.plausible`, `env.FACEBOOK_APP_ID`, `env.PLAUSIBLE_ID`, `env.WEB_MONETIZATION_PAYMENT_POINTER` (`app.locals.env` in `app.ts`). Viewport `initial-scale=.75`.
- **Env vars inlined into the client bundle by Parcel** (`process.env.*` in `client/src`): `AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`, `PELIAS_HOST_NAME`, `PELIAS_API_KEY`, `CARTO_API_KEY`, `FACEBOOK_APP_ID`, `TRANSIFEX_API_TOKEN` (presence check), `STREETMIX_INSTANCE`, `SPONSOR_BANNER` (JSON), `USERBACK_TOKEN`, `OFFLINE_MODE`, `NODE_ENV`. No `import.meta.env` usage. (Parcel reads `.env` at build time; `AUTH0_CLIENT_SECRET` is server-only.)
- **Server static paths** (`app.ts`): `app.use('/assets', express.static('<root>/build'))`; `app.use('/assets/data', express.static('<root>/app/data'))` (street templates YAML + `user_roles.json`); `app.use(express.static('<root>/public'))` (favicons, images); 404 for unmatched `/images/*` and `/assets/*`; `/:user_id/:namespacedId[/:street_name]` adds metatags then renders `main`; `/api` → `app/api_routes.ts`, `/services` → `app/service_routes.ts`, `/error`; Swagger UI at `/api/docs` when not production; redirects `/help/about`, `/map`, `/privacy-policy`, `/terms-of-service`; `/survey`. `PORT` from env (default 8000 per docs). Compression, cookie-session (`COOKIE_SESSION_SECRET`, fallback `'seger handrail'`), passport, helmet CSP with nonces, SVG sprites compiled at startup (`compileSVGSprites`), Cloudinary init.
- **API surface** (for parity): `POST/GET /v1/users`, `GET/PUT/PATCH/DELETE /v1/users/:user_id`, `DELETE /v1/users/:user_id/login-token`, `GET/DELETE /v1/users/:user_id/streets`, `POST/GET /v1/streets`, `GET/PUT/DELETE /v1/streets/:street_id`, `POST/GET/DELETE /v1/streets/:street_id/image`, `GET /v1/streets/:street_id/remixes`, `GET /v1/translate/:locale_code/:resource_name`, `GET/POST/PUT /v1/votes`. Services: `/changelog`, `/pay`, `/geoip`, `/images` (Cloudinary signature), `/auth0/refresh-login-token`, `/auth0/sign-in-callback`, `/auth0/just-signed-in/`, `/integrations/patreon[/callback|/webhook]`, `/integrations/coil[/callback]`, `/csp-report`. API documented in `apiary.apib` and JSDoc Swagger comments.

---

## Doc-vs-source discrepancies worth flagging

1. `streetmix-plus.md` omits Streetmix+-gated items present in source: drainage channel, mixed-use lanes (bus/bike), sidewalk elevation toggle, rain garden (Coastmix), sponsor-banner suppression, Userback widget; and still lists "Unlimited streets" which has no implementation.
2. No price anywhere in docs; "$5/month Enthusiast Plan" exists only in dead `UpgradeDialog` code.
3. Coil is "discontinued" in docs but client/server Coil + Web Monetization code paths remain active.
4. Stale paths in docs: `assets/locales` (→ `packages/i18n/locales`), `assets/scripts/streets/skybox-defs.json`, `client/src/segments/segment-lookup.json`/`components.json` (→ `packages/parts/data/*.yaml`), `node ./packages/i18n/download_translations.js` (→ `npm run translations:download`), `.assets/scripts/util/api.js`.
5. `local-setup.md` env table lacks `PATREON_*`, `USERBACK_TOKEN`, `SPONSOR_BANNER`, `STRIPE_TIER1_PLAN_ID`, `COIL_*`.
6. Changelog has no entry for Coastmix, dark mode (`COLOR_MODE_TOGGLE`), display of `InstanceBadge`, or locales ja/pt-BR/nl-NL/es-MX/fil/sk/ro-RO.
7. `reference/tests.md` says Cypress replaces some unit tests; in practice there is exactly one Cypress spec with two tests.
8. `package.json` `posttest:models` references a non-existent `db:reset` script.
