# Streetmix web client — user-facing feature inventory

- Source: upstream Streetmix checkout at `/tmp/claude-0/-home-user-Cross-section-app/f74f35ff-b0c8-5ef3-a990-bed7efaa0dfb/scratchpad/upstream-streetmix` (commit `f17578eec760d3c7b41216823ec32c7e8d04e8bc`, AGPL-3.0-or-later).
- All file paths below are relative to that checkout root (e.g. `client/src/menubar/MenuBar.tsx`).
- Method: source reading only (no network to streetmix.net / docs.streetmix.net). Anything that could not be confirmed from source is marked **UNVERIFIED**.
- Each item has a stable ID suggestion (e.g. `EDIT-RESIZE-01`). Counts per section are at the end.
- Terminology: the code calls street components "segments" or "slices" interchangeably; "boundary" = the left/right building/edge; "Streetmix+" = paid subscription (`isSubscriber`).

Global gating conventions referenced throughout:

| Gate | Meaning | Evidence |
|---|---|---|
| `offline` | `state.system.offline`, true when `OFFLINE_MODE=true` env or `?debug-force-offline` URL param | `client/src/preinit/system_capabilities.ts`, `client/src/app/config.ts` |
| `readOnly` | `state.app.readOnly`, true with `?debug-force-read-only` | `client/src/preinit/debug_settings.ts` |
| `isSubscriber` | signed in with role `SUBSCRIBER_1`, or Coil web-monetization active while signed in | `client/src/store/slices/user.ts` |
| `COASTMIX_MODE` | feature flag for the Boston "Coastmix" variant | `packages/feature-flags/flags.json` |
| `isOwnedByCurrentUser()` | street creator == signed-in user, or anonymous street in same session (not yet "remix on first edit"); always true in Coastmix | `client/src/streets/owner.ts` |

---

## 1. Menubar (`client/src/menubar`)

### 1.1 Menu bar structure

| ID | Feature | Details | Gating | Evidence |
|---|---|---|---|---|
| MENU-BAR-01 | Logo + app title | `<img>` logo (`images/logo_horizontal.svg`) and `<h1>Streetmix</h1>`; in Coastmix: Coastmix logo, title "Coastmix by Streetmix", plus City of Boston logo linking to `https://www.boston.gov/coastmix/` (new tab) | Coastmix variant only when `COASTMIX_MODE` | `client/src/menubar/MenuBar.tsx` |
| MENU-BAR-02 | Left menu triggers | "Help" (always), "Contact" (hidden when offline or Coastmix), "Get Streetmix+" button (hidden when subscriber, offline, or Coastmix) | see Details | `client/src/menubar/MenuBar.tsx` |
| MENU-BAR-03 | Right menu triggers | "New street" (Coastmix: "New waterfront"), "Share", Language icon button (tooltip "Language"; only if any of `LOCALES_LEVEL_1/2/3` flags true — `LOCALES_LEVEL_3` default true so normally visible), then Avatar menu (signed in) or "Sign in" primary button (not signed in); avatar/sign-in hidden when offline or Coastmix | | `client/src/menubar/MenuBar.tsx`, `SignInButton.tsx`, `AvatarMenu.tsx` |
| MENU-BAR-04 | Streetmix+ upgrade button | Icon + "Get Streetmix+"; `window.open('https://docs.streetmix.net/user-guide/streetmix-plus','_blank')`; the in-app UPGRADE dialog dispatch is commented out | not subscriber | `client/src/menubar/UpgradeButton.tsx` |
| MENU-BAR-05 | Avatar menu trigger | Shows `<Avatar userId>`; adds Streetmix+ badge image with title "Streetmix+ member" when subscriber | signed in | `client/src/menubar/AvatarMenu.tsx` |
| MENU-BAR-06 | Instance badge | Label "Demo" when offline; otherwise by `STREETMIX_INSTANCE ?? NODE_ENV`: `development`→"Dev", `staging`→"Staging", `sandbox`→"Sandbox"; nothing in production | | `client/src/menubar/InstanceBadge.tsx` |
| MENU-BAR-07 | Menu open/close behaviour | Clicking a trigger toggles its menu; menus close on `Esc`, pointerdown outside `.menu, .menu-trigger`, page `visibilitychange` hidden, opening gallery, showing any dialog, or starting print; body gets focus when no menu open; menus positioned under their trigger, right-aligned if overflowing, RTL-aware | | `client/src/menubar/MenusContainer.tsx`, `menus/Menu.tsx`, `client/src/store/slices/menus.ts` |
| MENU-BAR-08 | Nameplate avoidance | Menu bar dispatches `stmx:menu_bar_resized` with left/right bar extents so the street nameplate can move itself below the bar when overlapping | | `client/src/menubar/MenuBar.tsx`, `client/src/streets/StreetNameplateContainer.tsx` |

### 1.2 Help menu (`menus/HelpMenu.tsx`)

| ID | Item | Action / destination | Gating |
|---|---|---|---|
| MENU-HELP-01 | "About Streetmix…" (Coastmix: "About Coastmix…") | `showDialog('ABOUT')`; also keyboard `?` (shift optional) | always |
| MENU-HELP-02 | "What's new?" | `showDialog('WHATS_NEW')` | hidden in Coastmix |
| MENU-HELP-03 | "Guidebook" | external link `https://docs.streetmix.net/user-guide/intro` | hidden offline |
| MENU-HELP-04 | "Coastmix tutorial" | starts Shepherd onboarding tour (`CoastmixOnboardingTour`) | Coastmix, not offline |
| MENU-HELP-05 | "Coastmix practice scenario" | starts Shepherd practice tour (`CoastmixPracticeTour`) | Coastmix, not offline |
| MENU-HELP-06 | "Store" | external link `https://cottonbureau.com/people/streetmix` | not offline, not Coastmix |
| MENU-HELP-07 | Keyboard shortcuts table | Backspace = remove segment pointed at (hold Shift to remove all); − / + = change width of pointed segment (hold Shift for precision); ← / → = move around street (hold Shift to jump to edges) | always (`menus/KeyboardShortcuts.tsx`) |

### 1.3 Contact menu (`menus/ContactMenu.tsx`) — hidden offline / Coastmix

| ID | Item | Destination |
|---|---|---|
| MENU-CONTACT-01 | "Join Discord chat" | `https://strt.mx/discord` |
| MENU-CONTACT-02 | "View source code on GitHub" | `https://github.com/streetmix/streetmix/` |
| MENU-CONTACT-03 | "Subscribe to our newsletter" | `showDialog('NEWSLETTER')` |

### 1.4 New street menu (`menus/NewStreetMenu.tsx`)

All template items open `/new?type=<template>` in a **new tab** (`window.open(..., '_blank')`).

| ID | Item | Action | Gating |
|---|---|---|---|
| MENU-NEW-01 | "New example street" | `/new?type=default` | not Coastmix |
| MENU-NEW-02 | "New empty street" | `/new?type=empty` | not Coastmix |
| MENU-NEW-03 | "Make a copy" | `/new?type=copy` (copies last street via `priorLastStreetId`, adds "(remix)" suffix) | always |
| MENU-NEW-04 | "Street templates" section label + BETA tag | header only | `NEW_STREET_TEMPLATES` flag (default true), not Coastmix |
| MENU-NEW-05 | "Stroad" template | `/new?type=stroad`; `disabled` unless signed in | `NEW_STREET_TEMPLATES`, not Coastmix |
| MENU-NEW-06 | Sign-in promo "Sign in for access to templates." | link opens SIGN_IN dialog | templates on, not signed in (`ShareMenu/SignInPromo.tsx` type `template`) |
| MENU-NEW-07 | "New empty waterfront" | `/new?type=empty_waterfront` | Coastmix |
| MENU-NEW-08 | "From examples..." | `openGallery({ userId: 'examples' })` (opens gallery of user `examples`) | Coastmix |
| MENU-NEW-09 | "New from template…" (BETA) | **commented out** in source, not rendered | n/a |

### 1.5 Share menu — see §7 (SHARE-*)

### 1.6 Locale menu (`menus/LocaleMenu.tsx`)

| ID | Feature | Details |
|---|---|---|
| MENU-LOCALE-01 | Locale list | `getAvailableLocales()` filtered by locale level flags and sorted alphabetically by native label; each item `role="menuitemradio"` with native label (`&lrm;` appended) and sub-label translated language name |
| MENU-LOCALE-02 | Selection state | Check icon on current locale; small spinner on the locale being loaded (`requestedLocale`) |
| MENU-LOCALE-03 | Switch | `changeLocale(value)` fetches `/api/v1/translate/{locale}/main` and `/segment-info`, sets `<html lang>`, sets RTL direction for `ar`,`dv`,`fa`,`he`, persists `settings.locale`; menu then cleared |

### 1.7 Identity (avatar) menu (`menus/IdentityMenu.tsx`)

| ID | Item | Details | Gating |
|---|---|---|---|
| MENU-ID-01 | Identity header | Avatar, display name (or id), id as subtext when display name set; role badges: "Streetmix+" (subscriber), "Admin" (role ADMIN); "Beta tester"/"Translator" badges commented out | not offline |
| MENU-ID-02 | "My streets" | `history.pushState('/{userId}')` + `openGallery({userId})` | not offline |
| MENU-ID-03 | "Settings" | `showDialog('SETTINGS')` | always |
| MENU-ID-04 | "Sign out" | `signOut(false)`: clears last-street settings, DELETE `/api/v1/users/{id}/login-token`, removes cookies `login_token`,`refresh_token`,`user_id` and localStorage `sign-in`, shows "You are now signed out." blocking screen with "Return to Streetmix" | always |

---

## 2. Dialogs (`client/src/dialogs`)

### 2.1 Dialog framework

| ID | Feature | Details | Evidence |
|---|---|---|---|
| DLG-FW-01 | Registry | `DialogRoot` maps names → components: ABOUT, ANALYTICS, FEATURE_FLAGS, GEOTAG, SAVE_AS_IMAGE, SETTINGS, SIGN_IN, WHATS_NEW, NEWSLETTER, UPGRADE, SENTIMENT_SURVEY, COASTMIX_TUTORIAL_COMPLETE; wrapped in `ErrorBoundary` with `ErrorDialog` fallback | `client/src/dialogs/DialogRoot.tsx` |
| DLG-FW-02 | Common behaviour | Modal with backdrop; closes on `Esc`, click outside, or close (X) button; 80 ms transition; one dialog at a time; opening a dialog closes menus | `client/src/dialogs/Dialog.tsx`, `store/slices/menus.ts` |
| DLG-FW-03 | Error dialog | "Oops!" + "Something unexpected happened…" with link `https://github.com/streetmix/streetmix/issues/new`; Close button | `client/src/dialogs/ErrorDialog.tsx` |

### 2.2 About (`About/AboutDialog.tsx`) — trigger: Help › About, key `?`

| ID | Content |
|---|---|
| DLG-ABOUT-01 | Logo, heading "About Streetmix.", description text; Coastmix prepends `AboutCoastmix` block (Boston Office of Climate Resilience / Emerging Technology logos linking `https://www.boston.gov/departments/climate-resilience`, `https://www.boston.gov/departments/emerging-technology`; project team; special thanks) |
| DLG-ABOUT-02 | Social links: GitHub `https://github.com/streetmix/`, Discord `https://strt.mx/discord`, Bluesky `https://bsky.app/profile/streetmix.app`, Mastodon `https://urbanists.social/@streetmix` (`rel="me"`) (`About/SocialLinks.tsx`) |
| DLG-ABOUT-03 | Stewards: Bad Idea Factory `https://biffud.com/`, Code for America `https://codeforamerica.org/`; Partners: NUMO `https://numo.global/`; Sponsors: Mozilla MOSS `https://www.mozilla.org/en-US/moss/` |
| DLG-ABOUT-04 | Terms of service `https://streetmix.net/terms-of-service/`, Privacy policy `https://streetmix.net/privacy-policy/` (hidden offline) |
| DLG-ABOUT-05 | Credits (`About/Credits.tsx` from `credits.json`): "Original project team" & "Core contributors" (16 team members with mugshots `/images/team/*`), contributors (additional-illustrations, additional-code, additional-contributors, special-thanks), translators per locale (am, ar, ca, cs, zh, fi, fr, de, id, it, ja, ko, nb-no, pl, pt-br, ru, es-419, es-es, es-mx, sv, tr) |
| DLG-ABOUT-06 | Acknowledgements: fonts Manrope (`https://manropefont.com/`, Mikhail Shiranda `https://gent.media/`), Rubik (`https://hubertfischer.com/work/type-rubik`), Overpass (`https://delvefonts.com/fonts/overpass/`), OFL license links (`https://scripts.sil.org/...OFL`, `https://github.com/RedHatOfficial/Overpass/blob/master/OFL.txt`); icons Tabler `https://tabler.io/icons`, Font Awesome `https://fontawesome.com/` (license `https://fontawesome.com/license/free`); emoji OpenMoji `https://openmoji.org/` (CC BY-SA `https://creativecommons.org/licenses/by-sa/4.0/#`) |

### 2.3 What's New (`WhatsNew/WhatsNewDialog.tsx`)

| ID | Feature | Details |
|---|---|---|
| DLG-WHATSNEW-01 | Content | Fetches markdown from `/services/changelog`; renders with `react-markdown` (allowed: p, em, strong, ol, ul, li, blockquote, h1–h3, a, img); image URLs `/img/`→`/images/`; external links open new tab |
| DLG-WHATSNEW-02 | States | Loading spinner; generic error "We're sorry – something went wrong."; scroll shade after 30 px |
| DLG-WHATSNEW-03 | Non-English banner | "This information is provided in English only." when locale doesn't start with `en` |
| DLG-WHATSNEW-04 | Auto-display | On load in modes EXISTING_STREET/CONTINUE if welcome panel previously dismissed (LS `settings-welcome-dismissed`), locale `en`, not Coastmix, and LS `whatsnew-last-timestamp` < hard-coded `1784041552632` (or missing); or always if flag `ALWAYS_DISPLAY_WHATS_NEW`; timestamp then stored (`client/src/app/initialization.js`) |

### 2.4 Save as image (`SaveAsImage/SaveAsImageDialog.tsx`, `CustomScale.tsx`) — trigger: Share › "Save as image…"

| ID | Control / behaviour | Details | Gating |
|---|---|---|---|
| DLG-SAVE-01 | "Segment names and widths" checkbox | setting `saveAsImageSegmentNamesAndWidths` (default false); adds 65 px label band | |
| DLG-SAVE-02 | "Street name" checkbox | setting `saveAsImageStreetName` (default false); nameplate drawn; min height 550 instead of 400 | |
| DLG-SAVE-03 | "Transparent sky" checkbox | setting `saveAsImageTransparentSky` (default false); skips sky drawing | |
| DLG-SAVE-04 | "Watermark" checkbox | setting `saveAsImageWatermark` (default true). Non-subscribers: checkbox disabled, lock icon, tooltip "Upgrade to Streetmix+ to use!" and watermark **forced on** (`watermark = setting \|\| !isSubscriber`) | Streetmix+ |
| DLG-SAVE-05 | "New export pipeline (WIP)" checkbox | Only shown when flag `SAVE_AS_IMAGE_NEW_EXPORT_PIPELINE`; preview/download via server `GET /api/v1/streets/{id}/image?transparentSky=&labels=&streetName=&watermark=&locale=&scale=&experimental=1` | flag (default false) |
| DLG-SAVE-06 | Weather warning | "Weather effects will not be exported." when `street.weather !== null` | |
| DLG-SAVE-07 | Preview | Canvas rendered client-side at DPI 2 (`DEFAULT_IMAGE_DPI`), shown as blob URL; "Loading…" overlay; 100 ms debounce on option change; errors "There was an error displaying a preview image." / "Saving to image is not available on this browser." | |
| DLG-SAVE-08 | Custom scale slider | Range 1–5 (100%–500%), step 0.25; shows "{n}% — Digital size: W px ⨯ H px — Print size: X″ ⨯ Y″ (300 dpi)" (cm when user units metric); popover description "Download image up to 500% of original size." Disabled + `StreetmixPlusPrompt` ("Locked"/"Get Streetmix+") unless flag `SAVE_AS_IMAGE_CUSTOM_DPI` (granted by role `SUBSCRIBER_1`) | Streetmix+ via flag |
| DLG-SAVE-09 | "Save to your computer…" | Re-renders at `2 × scale` DPI, `canvas.toBlob` → `file-saver` `saveAs(blob, '<slug>.png' \|\| 'street.png')`; error "This image is too big and we were not able to create it…" | |
| DLG-SAVE-10 | License footer | `Terms` component: "This Streetmix-created image may be reused anywhere, for any purpose, under the {CC BY-SA 4.0} license." with locale-specific deed URL (ar, ca, de, es/es-MX/es-419, fi, fr, it, ja, ko, pl, pt, pt-BR, ru, sv, zh, zh-Hant/zh-TW, default en) | `client/src/app/Terms.tsx` |
| DLG-SAVE-11 | Image geometry | width = `TILE_SIZE × street.width + 2×360` px (×dpi); height = max(left/right boundary image height, 400) (+150 if street name) + 60 bottom padding (+65 if labels) | `client/src/streets/image.ts` |
| DLG-SAVE-12 | Rendering content | sky (color/gradient/image/objects/clouds per skybox def), earth, boundaries, slices by z-index, label background `rgb(216,211,203)` + labels (Rubik Variable 12px 400; server pipeline uses Geist Sans), nameplate (Overpass Variable 700 70px, letter-spacing −0.125), watermark "Made with {wordmark}" (Rubik Variable 600 24px, `#333333`, or `#cccccc` inverted when no labels; wordmark `/images/wordmark_black.svg` or `_white.svg`, 15 px margins) | `client/src/streets/thumbnail.ts`, `packages/export-image/src/labels.ts`, `nameplate.ts` |
| DLG-SAVE-13 | Setting persistence | All four checkbox settings live in `settings` slice → localStorage `settings` + `PUT /api/v1/users/{id}` (signed in), debounced 500 ms | `client/src/users/settings.ts` |

### 2.5 Sign in (`SignIn/SignInDialog.tsx`) — trigger: Sign in button, sign-in promos/toasts, auth-expired screen

| ID | Feature | Details |
|---|---|---|
| DLG-SIGNIN-01 | Heading/description | "Sign in / Sign up" — "Save your first design or sign in to access your past designs." |
| DLG-SIGNIN-02 | Email (passwordless) | `<input type=email required>` autofocused; "Continue with email" → Auth0 `passwordlessStart({send:'link', connection:'email', redirectUri: /services/auth0/sign-in-callback, responseType:'code'})`; note "We'll send you a link to sign in. No password is required."; then "Signing you in…" spinner, then "We've sent an email to {email}…" with "Didn't receive it? Resend email" |
| DLG-SIGNIN-03 | Social providers | "Continue with Twitter" (`connection: 'twitter'`), "Continue with Google" (`google-oauth2`), "Continue with Facebook" (`facebook`) via Auth0 `authorize` → `/services/auth0/sign-in-callback`; scope `openid profile screen_name offline_access email` (`client/src/app/routing.ts`, `auth0.ts`) |
| DLG-SIGNIN-04 | Footer | "By clicking one of these buttons, I agree to the terms of service and privacy policy." → `/terms-of-service`, `/privacy-policy` (new tab) |
| DLG-SIGNIN-05 | Invalid email message | "Oops! That didn't look like a valid email address…" (state exists; HTML5 validation does actual checking) |

### 2.6 Geotag (`Geotag/*`) — trigger: street meta location item (requires `GEOTAG` flag, default true, and not readOnly)

| ID | Feature | Details |
|---|---|---|
| DLG-GEO-01 | Map | Leaflet via react-leaflet; tiles `https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png?key=CARTO_API_KEY` (`@2x` when devicePixelRatio > 1); attribution OpenStreetMap + CARTO + Leaflet prefix (with Ukrainian flag SVG); zoom controls (tooltips "Zoom in"/"Zoom out"); marker icons `/images/marker-icon*.png` |
| DLG-GEO-02 | Initial view | Street location (zoom 18) → else previously searched unconfirmed marker (`state.map`) → else world view lat 10.45 lng −10.78 zoom 2; on first open requests browser geolocation (`map.locate()`) and `fitBounds` if no location |
| DLG-GEO-03 | Search | Pelias autocomplete (`downshift-pelias`) against `https://{PELIAS_HOST_NAME}` with API key; focus point/boundary circle (radius 10) at map center; placeholder "Search for a location"; query highlighting; "×" clear (title "Clear search") |
| DLG-GEO-04 | Click / drag | Click on map → `flyTo` + reverse geocode `https://{PELIAS_HOST_NAME}/v1/reverse?api_key=…&point.lat=&point.lon=`; marker draggable (dragend reverse-geocodes); popup shows label |
| DLG-GEO-05 | "Confirm location" | Saves `{latlng, wofId, label, hierarchy{country,region,locality,neighbourhood,street}}` to street and sets street name from `hierarchy.street` (non-user-updated), closes dialog. Allowed if owner, or no creator, or no saved location |
| DLG-GEO-06 | "Clear location" | Shown instead when the marker equals the saved location; `clearLocation()` also resets a non-user-updated street name; map state reset |
| DLG-GEO-07 | Unavailable banner | "Geocoding services are currently unavailable…" when no Pelias key/host or offline; marker not draggable, no confirm/clear |

### 2.7 Analytics (`Analytics/*`) — trigger: street meta "{n} people/hr" item (flag `ANALYTICS`, default true)

| ID | Feature | Details |
|---|---|---|
| DLG-ANA-01 | Summary | "Your street has an estimated average traffic of {avg} people per hour, and potential for up to {potential} people per hour." + "Capacity values are based on {laneWidth}-wide lanes." |
| DLG-ANA-02 | Per-type bars | Rolled-up by segment type, sorted ascending; animated bars (react-spring); icons for magic-carpet, drive-lane, bike-lane, brt-lane, sidewalk, scooter, light-rail, bus-lane, streetcar; "{avg} — {potential} people/hour" or single value |
| DLG-ANA-03 | Source citation | "Source: {title}, {author}" with link |
| DLG-ANA-04 | "Capacity data source" select | `giz` (TUMI, default; 3.5 m/11.5 ft lanes; `https://www.transformative-mobility.org/publications/passenger-capacity-of-different-transport-modes`), `nacto` (3 m/10 ft; `https://nacto.org/publication/transit-street-design-guide/...`), `vancouver` (3 m/10 ft; `https://twitter.com/BrentToderian/status/953085021744611328`); disabled unless owner |
| DLG-ANA-05 | "Show capacity counts in segment labels" checkbox | sets `street.showAnalytics`; disabled unless owner; notice "Street owners can change these settings." |
| DLG-ANA-06 | "Export as CSV" | downloads `{streetName}_capacity.csv` (BOM-prefixed; columns type, averageCapacity, potentialCapacity) |
| DLG-ANA-07 | License footer | `Terms` CC BY-SA |

### 2.8 Newsletter (`Newsletter/NewsletterDialog.tsx`) — trigger: Contact › newsletter

| ID | Feature | Details |
|---|---|---|
| DLG-NEWS-01 | Form | Email input (autofocus, `required`), hidden `tag="via app"`, `embed="1"`; POST form-urlencoded to `https://buttondown.email/api/emails/embed-subscribe/streetmix` |
| DLG-NEWS-02 | States | "Subscribe" → "Please wait..." → OK: "Thank you! You're almost subscribed…" + Close; ERROR: "Uh oh! Something went wrong…" + retry Subscribe |

### 2.9 Sentiment survey "about" (`SentimentSurvey/SentimentSurveyDialog.tsx`) — trigger: "Why am I seeing this?" in survey

| ID | Feature | Details |
|---|---|---|
| DLG-SENT-01 | Content | "We want to understand how people feel about streets"; NUMO link `https://www.numo.global/`; share link `https://streetmix.net/survey/`; "Okay!" button |

### 2.10 Upgrade (`Upgrade/UpgradeDialog.tsx`)

| ID | Feature | Details |
|---|---|---|
| DLG-UPG-01 | Content | "Upgrade" heading; body "…For only $5/month, the Enthusiast Plan…"; states loading/error/success; if role `SUBSCRIBER_1`: "Thanks for supporting Streetmix!"; `onToken` would POST `/services/pay` |
| DLG-UPG-02 | Reachability | **No live trigger**: both `showDialog('UPGRADE')` calls are commented out (`UpgradeButton.tsx`, `StreetmixPlusPrompt.tsx`); flag `MEMBER_UPGRADE` has no client reference. Dialog is dead UI in this commit. |

### 2.11 Settings (`Settings/*`) — trigger: avatar menu › Settings

| ID | Panel / control | Details | Gating |
|---|---|---|---|
| DLG-SET-01 | Left nav | Profile, General, Language, Feature flags (last only when `NODE_ENV !== 'production'` or role ADMIN) | |
| DLG-SET-02 | Profile › Username | read-only id; "Edit" button permanently disabled | signed in (panel returns null otherwise) |
| DLG-SET-03 | Profile › Display name | Edit/Save/Cancel; max 30 chars; "Characters remaining: n (30 maximum)" from 20 chars; `PATCH /api/v1/users/{id} {displayName}`; error "Display name could not be saved"; "You have not added a display name yet." | signed in |
| DLG-SET-04 | General › Units | Radio "Metric (meters)" / "U.S. customary / imperial (feet and inches)" → `settings.units` (user-level; affects new streets only) | |
| DLG-SET-05 | General › Appearance › Theme | Radio "Light theme" / "Dark theme" / "Use system preference" → `settings.colorMode`; applied as `<html data-color-mode>` | flag `COLOR_MODE_TOGGLE` (default false; ADMIN/BETA_TESTER roles) |
| DLG-SET-06 | General › Miscellaneous › "Silly clowns" switch | toggles flag `SILLY_CLOWNS` ("Enables Easter eggs.") — no other client reference to the flag found | |
| DLG-SET-07 | Language | Radio group of available locales (native label + translated name) → `changeLocale` | |
| DLG-SET-08 | Feature flags | Switch per flag (label, modified flags styled; `enabled:false` flags disabled) → `setFeatureFlag` (source `session`, persisted to LS `flags`) | admin / non-prod |

### 2.12 Feature flags dialog (`FeatureFlag/FeatureFlagDialog.tsx`)

| ID | Feature | Details |
|---|---|---|
| DLG-FLAGS-01 | Trigger | Keyboard `Shift+F` when `NODE_ENV !== 'production'` or signed in with role ADMIN (`client/src/app/keyboard_commands.ts`) |
| DLG-FLAGS-02 | Content | Checkbox list of all flags (same semantics as DLG-SET-08), untranslated, `dir="ltr"` |

### 2.13 Coastmix tutorial complete (`CoastmixTutorial.tsx`)

| ID | Feature | Details |
|---|---|---|
| DLG-COAST-01 | Content | "Tutorial complete!" with resilience strategies text; buttons "Explore on my own" (close) and "Practice scenario" (starts practice tour); triggered at end of onboarding tour (`ui/Tours/coastmix-onboarding.ts`) |

---

## 3. Street editing interactions (`client/src/segments`, `streets`, `app`, `boundary`)

### 3.1 Drag & drop

| ID | Feature | Details | Evidence |
|---|---|---|---|
| EDIT-DND-01 | Drag from palette | react-dnd (`react-dnd-multi-backend`, HTML5 + touch); item carries type, default variant (`defaultVariant` or first variant), default width (metric/imperial), default elevation/slope; `canDrag` false in readOnly | `client/src/segments/drag_and_drop.ts` `createPaletteItemDragSpec`, `client/src/app/App.tsx` |
| EDIT-DND-02 | Drop position | Hover over a slice: left/right half decides insertion before/after; hover over street edges (empty space) → insert at start/end; 40 px "hole" gap opens between slices during drag | `createSliceDropTargetSpec`, `createStreetDropTargetSpec`, `StreetEditable.tsx` `makeSpaceBetweenSlices` |
| EDIT-DND-03 | Auto-width on drop | New palette item narrower-fits: if `remainingWidth > 0` and item wider than remaining, width snaps to remaining width (if ≥ 0.25 m and ≥ variant minWidth) | `doDropHeuristics` |
| EDIT-DND-04 | Auto-variant heuristics | On drop, variants auto-set from neighbours: direction (copy neighbour), parking-lane-orientation, parklet orientation, turn-lane-orientation, transit-shelter orientation + light-rail elevation, brt-station orientation, bike-rack orientation, lamp-orientation (left/right/both) | `doDropHeuristics` |
| EDIT-DND-05 | Auto-elevation on drop (Coastmix) | Dropped slice takes highest adjacent elevation (slopes use max value; boundary elevation at ends) unless sloped | `doDropHeuristics` |
| EDIT-DND-06 | Reorder existing slice | Drag a slice (`DragTypes.SLICE`) to a new index (`moveSegment`); dropping in same position just re-activates | `handleSegmentCanvasDrop` |
| EDIT-DND-07 | Remove by dragging out | Existing slice dropped outside the canvas is removed (`removeSegmentAction`); palette trashcan "Drag here to remove" appears only while dragging an existing slice | `createSliceDragSpec.end`, `client/src/palette/PaletteTrashcan.tsx` |
| EDIT-DND-08 | Drag layer | Floating `SegmentCanvas` follows pointer, rotates up to ±20° with horizontal velocity; body classes `segment-move-dragging`/`not-within-canvas` | `client/src/segments/SegmentDragLayer.tsx`, `initDragTypeSubscriber` |
| EDIT-DND-09 | New slice id | `nanoid()` for dropped slices (palette items use `generateRandSeed()` for preview) | `drag_and_drop.ts` |

### 3.2 Resizing

| ID | Feature | Details | Evidence |
|---|---|---|---|
| EDIT-RESIZE-01 | Resize handles | Left/right chevron buttons appear on the active (hovered) slice; aria labels "Resize left"/"Resize right"; hidden while info bubble hovered; handles pulled inward when slice < 60 px wide | `client/src/segments/ResizeHandles.tsx` |
| EDIT-RESIZE-02 | Drag-resize | Pointer down on a handle starts resize; movement changes width by `2 × Δx / TILE_SIZE` (symmetric growth); global `pointermove`/`pointerup` listeners; **Shift** = precise drag resolution | `drag_and_drop.ts` `handleSegmentResizeStart/Move`, `client/src/app/event_listeners.ts` |
| EDIT-RESIZE-03 | Cancel | `Esc` during drag-resize restores original width | `client/src/app/keyboard_commands.ts` `onGlobalKeyDown`, `resizing.ts` `handleSegmentResizeCancel` |
| EDIT-RESIZE-04 | Resolutions | Metric: typing/precise 0.05 m, click/keyboard increment 0.1 m, drag 0.1 m. Imperial: typing/precise 0.25 ft (0.0762 m), click/keyboard 0.5 ft, drag 0.5 ft. Values rounded to 3 decimals | `client/src/segments/constants.ts`, `resizing.ts` `resolutionForResizeType` |
| EDIT-RESIZE-05 | Min / max segment width | clamp 0.25 m … 120 m (`MIN_SEGMENT_WIDTH`, `MAX_SEGMENT_WIDTH`) | `constants.ts`, `normalizeSegmentWidth` |
| EDIT-RESIZE-06 | Resize guides | While drag-resizing, "« Min / Min »" guide at variant `minWidth` and "Max » / « Max" guide at variant `maxWidth` or remaining street width (whichever applies) centred on slice | `client/src/segments/ResizeGuides.tsx` |
| EDIT-RESIZE-07 | Keyboard increment | While hovering a slice: `-`/`_` decrease, `+`/`=` increase by click increment; **Shift** uses precise resolution; ignored with Ctrl/Meta/Alt, in readOnly, or when pointer is inside info bubble | `client/src/segments/Segment.tsx` `handleKeyDown` |
| EDIT-RESIZE-08 | Info-bubble width control | −/+ buttons (Shift = precise) and text input (see INFO-WIDTH-*) | `client/src/info_bubble/PopupControls/WidthControl.tsx` |
| EDIT-RESIZE-09 | Street extent/margins | Canvas margins grow when occupied width exceeds street+boundaries; boundary width grows to fill viewport | `resizing.ts` `updateStreetMargin`, `client/src/app/StreetView.tsx` |

### 3.3 Width input parsing (`client/src/util/width_units.ts`)

| ID | Feature | Details |
|---|---|---|
| EDIT-WIDTHIN-01 | Normalisation | strips spaces; commas → periods; vulgar fractions ⅛ ¼ ⅜ ½ ⅝ ¾ ⅞ → decimals; dashes removed (`3'-6"` works) |
| EDIT-WIDTHIN-02 | Feet-inches | `X'Y` / `X'Y"` split on `'`; inches assumed for second part |
| EDIT-WIDTHIN-03 | Unit suffixes | `m`, `м`, `dm`, `cm`, `mm`, `"`, `″`, `in`, `in.`, `inch`, `inches`, `'`, `′`, `ft`, `ft.`, `feet`; unitless numbers are metres in metric streets, feet in imperial streets; result in metres rounded to 3 decimals; non-numeric → 0 |

### 3.4 Remove / clear / undo-redo

| ID | Feature | Details | Evidence |
|---|---|---|---|
| EDIT-REMOVE-01 | Remove slice | Info bubble "Remove" button (trash icon, tooltip "Remove segment"); keyboard `Backspace`/`Delete` on hovered slice; drag out of canvas; toast "The segment has been removed." with **Undo** action | `PopupHeader/RemoveButton.tsx`, `Segment.tsx`, `store/actions/street.ts` |
| EDIT-REMOVE-02 | Remove all | **Shift**+Remove button or **Shift**+Backspace/Delete → `clearSegmentsAction`; toast "All segments have been removed." with Undo | same |
| EDIT-UNDO-01 | Undo/redo buttons | Palette right side, tooltips "Undo"/"Redo"; disabled unless available and street owned by current user | `client/src/palette/UndoRedo.tsx`, `client/src/streets/undo_stack.ts` |
| EDIT-UNDO-02 | Undo/redo keys | `Ctrl/Cmd+Z` undo; `Shift+Ctrl/Cmd+Z` or `Ctrl/Cmd+Y` redo (focus must be on body); toasts "Nothing to undo." / "Nothing to redo." (4 s) | `client/src/app/keyboard_commands.ts`, `store/actions/history.ts` |
| EDIT-UNDO-03 | Undo model | jsondiffpatch deltas of trimmed street data; max 100 entries; name-only changes do not create undo steps; stack reset when loading a street; optional server save of history when flag `SAVE_UNDO` (disabled) | `undo_stack.ts`, `store/slices/history.ts`, `streets/xhr.ts` |

### 3.5 Keyboard shortcuts — complete list of bindings found

| ID | Key(s) | Action | Conditions | Evidence |
|---|---|---|---|---|
| EDIT-KEY-01 | `Ctrl/Cmd+S` | Toast "No need to save by hand; Streetmix automatically saves your street!"; default prevented everywhere | | `app/keyboard_commands.ts` |
| EDIT-KEY-02 | `Backspace`, `Delete` | default prevented (no browser back); remove hovered slice (Shift = all) | focus on body / hovering slice | `keyboard_commands.ts`, `segments/Segment.tsx` |
| EDIT-KEY-03 | `Shift+F` | Feature flags dialog | non-production or ADMIN | `keyboard_commands.ts` |
| EDIT-KEY-04 | `Ctrl/Cmd+Z` | Undo | focus on body | `keyboard_commands.ts` |
| EDIT-KEY-05 | `Shift+Ctrl/Cmd+Z`, `Ctrl/Cmd+Y` | Redo | focus on body | `keyboard_commands.ts` |
| EDIT-KEY-06 | `Esc` | cancel resize drag; close menus; close dialog; dismiss welcome panel; close gallery; close debug panel | context | `keyboard_commands.ts`, `MenusContainer.tsx`, `Dialog.tsx`, `WelcomePanel.tsx`, `Gallery.tsx`, `DebugInfo.tsx` |
| EDIT-KEY-07 | `-` `_` / `+` `=` | decrease / increase hovered slice width (Shift precise) | hovering slice | `Segment.tsx` |
| EDIT-KEY-08 | `-` / `+` `=` | remove / add building floor on hovered boundary (only boundaries with floors) | hovering editable boundary | `boundary/BoundaryComponent.tsx` |
| EDIT-KEY-09 | `←` / `→` | scroll street half a screen; `Shift+←/→` jump to extents | focus on body | `app/ScrollIndicators.tsx` |
| EDIT-KEY-10 | `←` / `→` | scroll gallery strip (when gallery open, `allowKeyboardScroll`) | | `ui/Scrollable.tsx`, `gallery/GalleryContents.tsx` |
| EDIT-KEY-11 | `?` (Shift optional) | About dialog | | `menus/HelpMenu.tsx` |
| EDIT-KEY-12 | `Shift+D` (capital D) | Debug panel (JSON of street/user/settings/flags/history in a textarea); Esc or click outside closes | not in input/textarea | `app/DebugInfo.tsx` |
| EDIT-KEY-13 | `Enter` / `Esc` in UpDownInput | commit / revert typed value | input focused | `info_bubble/PopupControls/UpDownInput.tsx` |

### 3.6 Street name

| ID | Feature | Details | Evidence |
|---|---|---|---|
| EDIT-NAME-01 | Display | Nameplate shows name or "Unnamed St"; names trimmed and truncated to 50 chars + "…"; hover prompt "Click to rename" when editable | `client/src/streets/StreetName.tsx` |
| EDIT-NAME-02 | Rename | Click nameplate → `window.prompt("New street name:", current)`; empty string unsets name; cancel does nothing; `userUpdated` flag set so geotag won't overwrite | flag `EDIT_STREET_NAME` (default true) and not readOnly; `StreetNameplateContainer.tsx`, `store/slices/street.ts` |
| EDIT-NAME-03 | Side effects | Name changes update URL slug (`/{creator}/{namespacedId}/{slug}`) and document title "{name} – Streetmix" / "{name} (by {creator}) – Streetmix" (Coastmix instance: "Coastmix") | `client/src/streets/name.ts`, `app/page_url.ts`, `app/page_title.ts` |
| EDIT-NAME-04 | Remix suffix | Remixed/copied streets get " (remix)" appended unless renaming caused the remix | `client/src/streets/remix.ts` |

### 3.7 Street width & units (`client/src/streets/StreetMeta/StreetMetaWidth.tsx`)

| ID | Feature | Details |
|---|---|---|
| EDIT-SWIDTH-01 | Width display | "{width} width" with ruler icon, plus "({x} room)" (green) or "({x} over)" (red) remaining-width indicator; tooltip "Change width of the street" |
| EDIT-SWIDTH-02 | Dropdown | Radix dropdown: "Occupied width" (read-only), "Building-to-building width" radio presets — metric 12 m / 18 m / 24 m, imperial 40′ / 60′ / 80′ — plus current custom width if not a preset |
| EDIT-SWIDTH-03 | "Different width…" | `window.prompt("New street width (from {min} to {max}):", occupiedWidth)`; parsed with width parser; clamped 3–120 m (metric) or 10–400 ft (imperial); rounded to width resolution |
| EDIT-SWIDTH-04 | Units radio | "Metric" / "U.S. customary / imperial" — changes **street** units (`setUnits`) and saves; user-level default lives in Settings |
| EDIT-SWIDTH-05 | Gating | flag `EDIT_STREET_WIDTH` (default true) and not readOnly |
| EDIT-SWIDTH-06 | Imperial display | Widths shown as feet with vulgar fractions and prime mark (e.g. `9¼′`); metric " m" (ru: " м", ar: " م") | `packages/utils/src/dimensions.ts` |

### 3.8 Boundaries (`client/src/boundary`)

| ID | Feature | Details |
|---|---|---|
| EDIT-BND-01 | Boundary types | grass, fence ("Empty lot"), parking-lot, waterfront, residential ("Home", floors), narrow ("Building", floors), wide ("Building", floors), arcade (floors), compound-wall (SIGN_IN unlock); Coastmix-only (icons `enableWithFlag: COASTMIX_MODE`): waterfront2, beach, marsh, water, dock (height, no floor count), fishing-boat, cargo-ship; plain `waterfront` hidden in Coastmix | `packages/parts/data/boundary_defs.yaml`, `client/src/segments/variant_icons.yaml` |
| EDIT-BND-02 | Variant picker | Info bubble on boundary shows variant buttons; Coastmix groups "Land" / "Waterfront"; selecting a waterfront matching the other side copies its elevation | `info_bubble/PopupControls/VariantSet.tsx`, `store/slices/street.ts` `setBuildingVariant` |
| EDIT-BND-03 | Floors | 1–20 floors (`MAX_BUILDING_HEIGHT`); UpDownInput shows "{n} floors ({height})"; dock shows height `0.75 + n×0.25` m; keyboard −/+ on hover; `allowAutoUpdate` typing | `PopupControls/BuildingHeightControl.tsx`, `boundary/boundary.ts` |
| EDIT-BND-04 | Elevation | Coastmix: "Ground height" / "Sea level" UpDownInput (sea level applies to both waterfront boundaries) | `PopupControls/CoastmixControls.tsx`, `ElevationControlNew.tsx` |
| EDIT-BND-05 | Gating | flags `EDIT_BOUNDARY_LEFT` / `EDIT_BOUNDARY_RIGHT` (default true), not readOnly; boundary canvas shaded when street overflows | `BoundaryComponent.tsx` |

### 3.9 Empty space, warnings, elevation, scrolling

| ID | Feature | Details | Evidence |
|---|---|---|---|
| EDIT-EMPTY-01 | Empty segments | When `remainingWidth > 0`: one "Empty space" placeholder at full width if no slices, else two equal halves at both ends, each labelled with its width | `client/src/segments/EmptySegmentContainer.tsx`, `EmptySegment.tsx` |
| EDIT-WARN-01 | Overflow | Slices extending past street edges get `outOfBounds` (classes `warning outside`); nameplate shows "(x over)" | `client/src/streets/warnings.ts`, `Segment.tsx` |
| EDIT-WARN-02 | Too narrow / too wide | `tooNarrow` (< variant minWidth), `tooWide` (> variant maxWidth) | `warnings.ts` |
| EDIT-WARN-03 | Dangerous existing | `dangerousExisting` for variants flagged `dangerous: true` (mixed drive lane with bike) | `warnings.ts` |
| EDIT-WARN-04 | Slope warnings | `slopeBermExceeded` (ratio < 3H:1V on `berm` variants) and `slopePathExceeded` (ratio < 20:1 on `path` variants) | `client/src/segments/slope.ts`, `warnings.ts` |
| EDIT-WARN-05 | Capacity effect | outOfBounds / tooNarrow / slopePathExceeded zero the slice's capacity | `client/src/segments/capacity.ts` |
| EDIT-ELEV-01 | Elevation model | Slice `elevation` in metres; `MIN_ELEVATION 0`, max 5 m (metric) / 16 ft (imperial); increments 0.15 m / 0.5 ft (Shift: 0.05 m / 0.25 ft); curb height 0.15 m / 0.5 ft | `client/src/segments/constants.ts` |
| EDIT-ELEV-02 | Universal elevation control | "Elevation" row with "Sidewalk level"/"Street level" buttons (locked for non-subscribers unless flag `ELEVATION_CONTROLS_UNLOCKED`); replaces per-variant `elevation` buttons | flag `UNIVERSAL_ELEVATION_CONTROLS` (default false; BETA_TESTER), not Coastmix; `PopupControls/ElevationControl.tsx` |
| EDIT-ELEV-03 | Coastmix elevation & slope | Slope toggle switch (only `path`/`berm` variants; tooltip "This element cannot be sloped."), left/right ground-height inputs when sloped, ground-height UpDownInput otherwise; slope debug overlay with flag `DEBUG_SLICE_SLOPE` | `CoastmixControls.tsx`, `SlopeToggle.tsx`, `SlopeControl.tsx`, `segments/TestSlope.tsx` |
| EDIT-SCROLL-01 | Horizontal scroll | Street section scrolls; scroll indicator arrow buttons "‹"/"›" (2–6 arrows scaled by street width ÷ 120 m) with tooltips "Scroll street left/right"; click scrolls half a viewport (300 ms animation); keyboard ←/→ (Shift to edges); sky clouds parallax (rear 0.25×, front 0.5×) | `client/src/app/StreetView.tsx`, `ScrollIndicators.tsx`, `sky/SkyBox/SkyBox.tsx` |
| EDIT-HOVER-01 | Active slice | Hovering a slice/boundary sets `activeSegment` (highlight, resize handles, keyboard target); disabled in readOnly | `Segment.tsx`, `BoundaryComponent.tsx` |
| EDIT-VARIANT-01 | Variant switch animation | Changing variant cross-fades old/new canvas (250 ms) | `Segment.tsx` |
| EDIT-LABEL-01 | Custom slice label | Info bubble header click → `window.prompt("New segment label:")`; trimmed, max 50 chars + "…"; empty resets to default name | Streetmix+ or Coastmix; `client/src/segments/labels.ts`, `PopupHeader/EditableLabel.tsx` |

---

## 4. Info bubble / popup (`client/src/info_bubble`)

| ID | Feature | Details | Evidence |
|---|---|---|---|
| INFO-OPEN-01 | Trigger | Floating-ui popup above a slice/boundary on hover (mouse only, close delay 150 ms, safe-polygon), click, or focus; dismiss on outside click/Esc; not shown while dragging, in readOnly, or `disabled`; kept open during Shepherd tours; `stmx:dismiss_slice_popup` event closes it | `PopupContainer.tsx` |
| INFO-HEAD-01 | Header label | Slice: editable label (edit icon) if subscriber/Coastmix, else lock icon with tooltip "Upgrade to Streetmix+ to edit"; boundary labels not editable | `PopupHeader/PopupHeader.tsx`, `EditableLabel.tsx` |
| INFO-HEAD-02 | Remove button | "Remove" (Shift = remove all) — slices only | `PopupHeader/RemoveButton.tsx` |
| INFO-VAR-01 | Variant button sets | One row per variant set from `variant_icons.yaml` (e.g. direction, bike-direction, parking-lane-direction, tree-type, lamp-orientation, lamp-type, bench-orientation, turn-lane-orientation, divider-type, crosswalk-type, orientation, public-transit-asphalt, bus-asphalt, bus-type, brt-asphalt, brt-station-orientation, bike-asphalt, transit-shelter-elevation, bike-rack-elevation, car-type, sidewalk-density, parking-lane-orientation, wayfinding-type, flex-type, waiting-area, scooter-elevation, scooter-riders, magic-carpet-occupants, occupants, elevation, temporary-barrier-type, drainage-sides, bioswale-vegetation, vendor-type, beach-type, marsh-type, wall-height, guardrail-type, slope-type); `elevation` set hidden when universal elevation or Coastmix | `PopupControls/VariantSet.tsx`, `client/src/segments/variant_icons.yaml` |
| INFO-VAR-02 | Variant button | Tooltip = translated title; `variant-selected` state; icons from sprite or Tabler | `PopupControls/VariantButton.tsx` |
| INFO-VAR-03 | Locked variants | `unlockCondition: SIGN_IN` → disabled + lock + "Sign in to use!" (compound-wall boundary, twoway-left/right bike, av, motorcycle-sidecar, pedestrian car-types); `SUBSCRIBE` → "Upgrade to Streetmix+ to use!" (double-decker, av-shuttle buses; car-with-bus [unlockWithFlag `VARIANT_MIXED_DRIVE_LANES_1`], car-with-bike [`VARIANT_MIXED_DRIVE_LANES_2`], microvan; universal-elevation sidewalk/road [`ELEVATION_CONTROLS_UNLOCKED`]); `enableWithFlag`/`disableWithFlag` hide variants (Coastmix boundaries) | `VariantButton.tsx`, `variant_icons.yaml` |
| INFO-VAR-04 | Elevation follows variant | Changing a variant resets slice elevation to the variant's defined elevation unless the slice elevation was manually changed (`elevationChanged`) or segment `enableElevation` | `store/slices/street.ts` `changeSegmentVariant` |
| INFO-WIDTH-01 | Width control (slices) | Row with ruler icon (tooltip "Width"); UpDownInput: − (tooltip "Decrease width", sub "(hold Shift for more precision)"), text input (title "Change width of the segment"), + ("Increase width"); buttons disabled at 0.25 m / 120 m | `PopupControls/WidthControl.tsx`, `UpDownInput.tsx` |
| INFO-WIDTH-02 | Typing behaviour | On focus the input shows the raw editable value (imperial converted) and selects all; `Enter` commits and reselects; blur commits; `Esc` reverts to previous value; parsed by width parser, resolution 0.05 m / 0.25 ft | `UpDownInput.tsx`, `WidthControl.tsx` |
| INFO-HEIGHT-01 | Building height control (boundaries) | "Building height" / "Height" row; see EDIT-BND-03 | `BuildingHeightControl.tsx` |
| INFO-ELEV-01 | Elevation / slope controls | see EDIT-ELEV-02/03 | `PopupControls.tsx` |
| INFO-WARN-01 | Warnings list | alert icon "This is a dangerous existing condition."; error icons "This doesn't fit within the street.", "This may not be wide enough.", "This may be too wide.", slope: "This may be too steep for vegetation." (NATURE), "This may be too steep for people." (PEDESTRIAN), "This may be too steep." | `PopupLower/Warnings.tsx` |
| INFO-DESC-01 | "Learn more" prompt | Shown when segment/variant has a `description` and translated content exists (`descriptions.{key}.prompt`, default "Learn more"); hovering highlights arrow | `PopupLower/DescriptionPrompt.tsx` |
| INFO-DESC-02 | Description panel | Draggable floating panel (book icon, title "Learn more") with image `/images/descriptions/{image}`, credit, markdown text (links only when online), "Photo: {caption}" footer; closes via X | `DescriptionPanel.tsx`, `ui/FloatingPanels/FloatingPanel.tsx` |
| INFO-MISC-01 | Keyboard isolation | While pointer is inside the bubble, slice keyboard shortcuts are suppressed and resize handles hidden; leaving returns focus to body | `PopupContent.tsx`, `store/slices/infoBubble.ts` |
| INFO-MISC-02 | Printing | Starting print hides description panel and bubble hover state | `store/slices/infoBubble.ts` |

Segments with a "Learn more" description defined: sidewalk-wayfinding, parklet, bioswale, bike-lane, train, marsh (`packages/parts/data/segment-lookup.yaml`).

---

## 5. Palette (`client/src/palette`)

| ID | Feature | Details | Evidence |
|---|---|---|---|
| PAL-01 | Visibility | Whole palette hidden in readOnly | `PaletteContainer.tsx` |
| PAL-02 | Items | Flat, horizontally scrollable list (`Scrollable` with left/right chevron buttons, tooltips "Scroll left/right", overscroll contained); **no categories, no search, no filters**; order = `segment-lookup.yaml` order: sidewalk, sidewalk-tree, sidewalk-bike-rack, sidewalk-bench, outdoor-dining, sidewalk-wayfinding, sidewalk-lamp, utilities, parklet, street-vendor, divider ("Buffer"), crosswalk, temporary, drainage-channel, bioswale, scooter, scooter-drop-zone, bike-lane, bikeshare, food-truck, flex-zone, flex-zone-curb ("Waiting area"), parking-lane, drive-lane, turn-lane, bus-lane, streetcar, light-rail, transit-shelter, brt-station, brt-lane, train, magic-carpet, beach, marsh, wall, guardrail, slope | `PaletteItems.tsx`, `packages/parts/data/segment-lookup.yaml` |
| PAL-03 | Flag-gated items | Hidden unless flag true: crosswalk (`SEGMENT_CROSSWALK`), train (`SEGMENT_INCEPTION_TRAIN`), bioswale/beach/marsh/wall/guardrail/slope (`COASTMIX_MODE`) | `PaletteItems.tsx`, `segment-lookup.yaml` |
| PAL-04 | Coastmix ordering | Only items with `coastmixPaletteOrder` shown, sorted ascending (slope 1, divider 2, bioswale 3, beach 4, marsh 5, wall 10, guardrail 11, sidewalk 20 …, drainage-channel 50) | `PaletteItems.tsx` |
| PAL-05 | Locked items (sign in) | `unlockCondition: SIGN_IN` → greyed, lock icon, not draggable, tooltip sub-label "Sign in to use!": outdoor-dining, utilities, street-vendor, temporary, brt-station, brt-lane, magic-carpet | `PaletteItem.tsx` |
| PAL-06 | Locked items (Streetmix+) | `unlockCondition: SUBSCRIBE` → "Upgrade to Streetmix+ to use!": drainage-channel (unlockWithFlag `SEGMENT_DRAINAGE_CHANNEL_UNLOCKED`), bioswale ("Rain garden") | `PaletteItem.tsx` |
| PAL-07 | Tooltips | Each item tooltip = localized segment name (+ lock sub-label); thumbnail image `thumbnails--{id}` or `thumbnails--missing` | `PaletteItem.tsx` |
| PAL-08 | Environment button | Sun icon, tooltip "Environment editor" → toggles Sky picker panel | `EnvironmentButton.tsx` |
| PAL-09 | Flooding button | Boat icon, tooltip "Coastal flooding controls" → toggles Coastal flooding panel | Coastmix; `FloodingButton.tsx` |
| PAL-10 | Undo/redo | see EDIT-UNDO-01 | `UndoRedo.tsx` |
| PAL-11 | Trashcan | "Drag here to remove" shown while dragging an existing slice | `PaletteTrashcan.tsx` |

---

## 6. Gallery (`client/src/gallery`)

| ID | Feature | Details | Evidence |
|---|---|---|---|
| GAL-01 | Open/close | Opened via avatar "My streets", author link in street meta, Coastmix "From examples...", or URLs `/gallery` (all streets) and `/{userId}` (user gallery); closes on `Esc` or clicking the shield; closing restores street URL and re-verifies street | `Gallery.tsx`, `GalleryShield.tsx`, `store/actions/gallery.ts`, `app/page_url.ts` |
| GAL-02 | Header | Avatar + display name/id of gallery user, or "All streets" for the global gallery | `GalleryPanel.tsx` |
| GAL-03 | Search box | "Find in streets" input with clear button — **stub**: logs query to console after 300 ms, no API | flag `GALLERY_SEARCH` (default false; BETA_TESTER); `GallerySearch.tsx` |
| GAL-04 | Street count / pagination | "No streets yet / 1 street / n streets" when ≤ 1 page; otherwise "{start}–{end} of {total} streets" with Previous/Next page buttons (RTL-aware chevrons); page size 100 from API `GET /api/v1/users/{id}/streets?page=` or `/api/v1/streets?page=` | `GalleryPagination.tsx`, `store/slices/gallery.ts`, `util/api.ts` |
| GAL-05 | Street items | Thumbnail canvas 180×110 (drawn client-side at 0.2 multiplier, no labels/sky transparency), creator display name or "Anonymous" (hidden when viewing that user's own gallery), relative date ("A few seconds ago", "A few minutes ago", "Today at …", "Yesterday at …", "Month day", full date), street name | `GalleryStreetItem.tsx`, `app/DateTimeRelative.tsx` |
| GAL-06 | Selection | Click loads that street in the background (blocking shield "Loading…"), marks `gallery-selected` and scrolls it into view; modifier-click (Shift/Ctrl/Meta) falls through to the normal link `href` | `GalleryContents.tsx`, `gallery/index.ts` |
| GAL-07 | Delete | Trash button (title "Delete street") only in the signed-in user's own gallery; `window.confirm("Are you sure you want to permanently delete {name}? This cannot be undone.")`; `DELETE /api/v1/streets/{id}` + `DELETE …/image`; optimistic removal; deleting the currently shown street shows "No street selected." | `GalleryStreetItem.tsx`, `GalleryContents.tsx`, `streets/xhr.ts` |
| GAL-08 | Rename | **Not available** in the gallery (rename only via nameplate prompt) | n/a |
| GAL-09 | Loading / error | Placeholder skeleton while loading; "Failed to load the gallery." with "Try again"; 404 user → not-found page and gallery closed | `GalleryLoading.tsx`, `GalleryError.tsx`, `store/slices/gallery.ts` |
| GAL-10 | Auto-select first | When opened via gallery URL mode, the first street is loaded automatically | `gallery/index.ts` `fetchGalleryData` |
| GAL-11 | Thumbnail error | "Thumbnail image is not available." if drawing throws | `GalleryStreetItem.tsx` |

---

## 7. Sharing, exports and integrations

### 7.1 Share menu (`client/src/menubar/menus/ShareMenu`)

| ID | Item | Details | Gating |
|---|---|---|---|
| SHARE-01 | Sign-in promo | "Sign in for nicer links to your streets and your personal street gallery." | not signed in, online |
| SHARE-02 | Copy link | "Copy and paste this link to share:" read-only input with current `window.location.href` (auto-focused/selected on open) + clipboard button (tooltip "Copy to clipboard" → "Copied!") using `copy-to-clipboard` | online |
| SHARE-03 | Share message | "Check out my street, {name}, on Streetmix!" / "Check out my street on Streetmix!" / "Check out {name} by @{creator} on Streetmix!" / "Check out this street by @{creator} on Streetmix!" / "Check out {name} on Streetmix!" / "Check out this street on Streetmix!" | `helpers.ts` |
| SHARE-04 | Mastodon | `window.prompt('Enter your Mastodon instance domain', <LS 'share:mastodon-domain' or 'mastodon.social'>)`; opens `https://{domain}/share?text=…&url=…`; remembers domain in localStorage | online, not Coastmix |
| SHARE-05 | Twitter | `https://twitter.com/intent/tweet?text=…&url=…` | online, not Coastmix |
| SHARE-06 | Facebook | `https://www.facebook.com/dialog/feed?app_id={FACEBOOK_APP_ID}&redirect_uri={url}&link={url}&name={pageTitle}&description={text}` | online, not Coastmix |
| SHARE-07 | "Open in 3DStreet" | `https://3dstreet.app/#{window.location.href}` (street URL passed in the hash) | online, not Coastmix |
| SHARE-08 | "Open in Streetmeter" (BETA) | `https://streetmeter.net/#{window.location.href}` | online, not Coastmix |
| SHARE-09 | "Print…" | dispatch `startPrinting` then `window.print()`; `PrintContainer` renders street image (transparent sky, labels, no name) for print media; "Preparing print..." placeholder; `beforeprint`/`afterprint` handled | always |
| SHARE-10 | "Save as image…" | opens SAVE_AS_IMAGE dialog (see §2.4) | always |
| SHARE-11 | Embed | **No embed/iframe code feature exists** (no references found) | n/a |
| SHARE-12 | Short URLs | `getSharingUrl()` returns full page URL; comment notes a possible future `strt.mx` shortener — not implemented | `helpers.ts` |

### 7.2 Image export pipelines

| ID | Pipeline | Details | Evidence |
|---|---|---|---|
| EXPORT-01 | Client canvas (`getStreetImage`) | Used by Save-as-image preview/download, print; options transparentSky, labels, streetName, dpi, watermark, locale | `client/src/streets/image.ts`, `thumbnail.ts` |
| EXPORT-02 | Server pipeline | `GET /api/v1/streets/{id}/image?…&experimental=1`; behind flag `SAVE_AS_IMAGE_NEW_EXPORT_PIPELINE`; shared drawing code in `packages/export-image` | `SaveAsImageDialog.tsx` |
| EXPORT-03 | Gallery thumbnails | Client-side `drawStreetThumbnail` at multiplier 0.2; server thumbnail upload (`saveStreetThumbnail`) is **disabled** (body commented out); `DELETE /api/v1/streets/{id}/image` still called on delete | `GalleryStreetItem.tsx`, `image.ts` |
| EXPORT-04 | CSV | Analytics "Export as CSV" (DLG-ANA-06) | `segments/capacity.ts` |

### 7.3 Integrations (`client/src/integrations` and elsewhere)

| ID | Integration | Details | Evidence |
|---|---|---|---|
| INTEG-01 | 3DStreet | link-out with street URL in hash (SHARE-07) | `ShareMenu/Export3DStreet.tsx` |
| INTEG-02 | Streetmeter | link-out with street URL in hash (SHARE-08) | `ShareMenu/ExportStreetmeter.tsx` |
| INTEG-03 | Coil / Web Monetization (deprecated) | Listens for `document.monetization` events; `monetizationstart` sets `isCoilPluginSubscriber` (→ `isSubscriber` when signed in), shows toast "Thanks for your support!…Sign in now…" (not signed in; LS `wm-sign-in-notification`) or success toast "Your Web Monetization subscription gives you full access…"; deprecation notice linking `https://strt.mx/plus#coil`; reads cookie `btpToken`, refreshes every 30 min via `coilMonetizationPolyfill` | `client/src/integrations/coil.ts`, `ui/Toasts/ToastWebMonetization*.tsx` |
| INTEG-04 | Userback feedback widget | Lazily loaded `@userback/widget` with `USERBACK_TOKEN` only in Coastmix mode or for subscribers | `client/src/app/userback/client.ts`, `App.tsx` |
| INTEG-05 | Sentry | `@sentry/browser` initialised only when hostname is `streetmix.net`/`www.streetmix.net` (DSN `https://fac2c23600414d2fb78c128cdbdeaf6f@sentry.io/82756`); also used to log invalid JWTs | `client/src/main.tsx`, `users/authentication.ts` |
| INTEG-06 | Auth0 | sign-in flows (DLG-SIGNIN-02/03), token refresh `POST /services/auth0/refresh-login-token`, post-sign-in path `/services/auth0/just-signed-in` | `app/routing.ts`, `users/authentication.ts`, `app/constants.ts` |
| INTEG-07 | Buttondown | newsletter subscribe (DLG-NEWS-01) | `NewsletterDialog.tsx` |
| INTEG-08 | Pelias / geocode.earth + CARTO + Leaflet | geotagging (§2.6) | `GeotagDialog.tsx`, `GeoSearch.tsx` |
| INTEG-09 | GeoIP | `GET /services/geoip` on load → country code sets default units (US → imperial) and left-hand traffic (list of ~75 country codes) | `store/slices/user.ts`, `users/localization.ts` |
| INTEG-10 | Sponsor banner | Bottom banner from env `SPONSOR_BANNER` JSON `{lede,text,link,linkText}` with "(What are sponsors?)" → `https://about.streetmix.net/sponsorship/`; hidden for subscribers; English only | `client/src/app/SponsorBanner.tsx` |
| INTEG-11 | Notification bar | Top banner from `notification.json` (`display:false` in this commit; sample BLM text/link `https://blacklivesmatters.carrd.co/`); dismiss persists via optional localStorage key; English locale only | `client/src/app/NotificationBar/*` |

---

## 8. Users, auth, settings, roles (`client/src/users`, `store/slices/user.ts`)

| ID | Feature | Details | Evidence |
|---|---|---|---|
| USER-ANON-01 | Anonymous editing | Anyone can create/edit streets; anonymous streets have `creatorId: null` and URLs `/-/{namespacedId}`; ownership is session-only (`remixOnFirstEdit`) | `app/page_url.ts`, `streets/owner.ts` |
| USER-ANON-02 | Remix on first edit | Editing a street you don't own (or an anonymous street from another session) POSTs a copy (`/api/v1/streets`), appends " (remix)", shows toast "Now editing a freshly-made duplicate of the original street. The duplicate has been put in your gallery." (signed in) or "…Sign in to start your own gallery of streets." with Sign in action (12 s); blocking shield "Remixing…" | `streets/remix.ts`, `streets/xhr.ts` |
| USER-AUTH-01 | Sign-in bootstrap | Cookies `login_token`, `refresh_token`, `user_id` → sign-in state; mirrored to LS `sign-in`; invalid/expired JWT → "We automatically signed you out due to inactivity." screen with Sign in / Return buttons; token refreshed one day before expiry | `users/authentication.ts`, `app/BlockingError.tsx` |
| USER-AUTH-02 | Profile fetch | `GET /api/v1/users/{id}` → roles, flags, displayName, profileImageUrl, settings `data`; 401 → quiet sign-out + toast "We automatically signed you out due to inactivity. Please sign in again." with Sign in action; 503 → "Having trouble… (Error 15A)" | `authentication.ts` |
| USER-AUTH-03 | Post-sign-in hand-off | Mode `JUST_SIGNED_IN` (`/services/auth0/just-signed-in`): local last-street settings win over server; if the last street was anonymous, `promoteStreet` makes the signed-in user its owner via remix (no suffix, no toast); cookie `last_survey_url` redirects back to a survey street | `authentication.ts` `_signInLoaded`, `users/settings.ts`, `streets/remix.ts` |
| USER-AUTH-04 | Cross-tab sync | `storage` event: signed out elsewhere → "You signed out in another window." / signed in elsewhere → "You signed in in another window." with "Reload the page" | `authentication.ts` `onStorageChange`, `BlockingError.tsx` |
| USER-AUTH-05 | Sign out | see MENU-ID-04 | |
| USER-SET-01 | Settings model | `lastStreetId/NamespacedId/CreatorId`, `saveAsImage*` (4), `colorMode`, `locale`, `units`, deprecated `newStreetPreference`; merged local (LS `settings`) ← server (`details.data`, wins) on load; legacy `units: 2` → 0 | `store/slices/settings.ts`, `users/settings.ts` |
| USER-SET-02 | Persistence | Debounced 500 ms to localStorage `settings` and `PUT /api/v1/users/{id}` when signed in; also re-saved on window focus so "last street" tracks the active tab | `users/settings.ts`, `app/event_handlers/focus.ts` |
| USER-SET-03 | Units default | user `settings.units` if set, else US → imperial, else metric; Coastmix instance defaults imperial | `users/localization.ts`, `settings.ts` |
| USER-SET-04 | Color mode | light / dark / auto (DLG-SET-05) | `AppearanceSettings.tsx` |
| USER-ROLE-01 | Roles | USER (flag VARIANT_TWOWAY_BIKES — no client use), ADMIN (LOCALES_LEVEL_1, NEW_STREET_TEMPLATES, COLOR_MODE_TOGGLE, COASTMIX_MODE), BETA_TESTER (LOCALES_LEVEL_1, NEW_STREET_TEMPLATES, GALLERY_SEARCH, ELEVATION_CONTROLS_UNLOCKED, UNIVERSAL_ELEVATION_CONTROLS, SEGMENT_CROSSWALK, SEGMENT_DRAINAGE_CHANNEL_UNLOCKED, VARIANT_MIXED_DRIVE_LANES_1/2, COLOR_MODE_TOGGLE, COASTMIX_MODE), ITDP (ELEVATION_CONTROLS_UNLOCKED, SEGMENT_DRAINAGE_CHANNEL_UNLOCKED, VARIANT_MIXED_DRIVE_LANES_1/2), TRANSLATOR (LOCALES_LEVEL_1), SUBSCRIBER_1 (SAVE_AS_IMAGE_CUSTOM_DPI), SUBSCRIBER_2/3 (none) | `app/data/user_roles.json` |
| USER-ROLE-02 | Flag override order | defaults ← role flags (per role) ← user flags ← session (LS `flags`) | `authentication.ts`, `app/flag_utils.ts` |
| USER-PLUS-01 | Streetmix+ determination | `isSubscriber` = role `SUBSCRIBER_1` or Coil monetization while signed in | `store/slices/user.ts` |
| USER-PLUS-02 | Streetmix+ gated features (summary) | Watermark toggle (DLG-SAVE-04), custom export scale (via flag, DLG-SAVE-08), custom slice labels (EDIT-LABEL-01), environment/sky & weather picker (SKY-03), SUBSCRIBE-locked palette items (PAL-06) and variants (INFO-VAR-03), universal elevation buttons (EDIT-ELEV-02), no sponsor banner (INTEG-10), Userback widget (INTEG-04), badge in avatar/identity menu (MENU-BAR-05, MENU-ID-01), hides "Get Streetmix+" button | various |
| USER-PLUS-03 | Upgrade destination | all "Get Streetmix+" CTAs open `https://docs.streetmix.net/user-guide/streetmix-plus` | `UpgradeButton.tsx`, `StreetmixPlusPrompt.tsx`, `ToastWebMonetizationSuccess.tsx` |
| USER-AVATAR-01 | Avatar | `<object>` with `profileImageUrl` (jpg/png) falling back to `/images/avatar.svg`; user data via RTK Query `GET /api/v1/users/{id}` | `users/Avatar.tsx`, `store/services/api.ts` |

---

## 9. Sky/environment, sentiment survey, geotag, analytics

### 9.1 Sky / environment (`client/src/sky`)

| ID | Feature | Details | Evidence |
|---|---|---|---|
| SKY-01 | Skybox rendering | Background gradient/color/image, background objects (e.g. moon/sun), rear/front cloud layers with parallax, foreground gradient, weather canvas; dark skyboxes set body class `dark-skybox-invert-ui` | `sky/SkyBox/*`, `sky/index.ts` |
| SKY-02 | Available skyboxes | day (default), twilight, dusk (inverts UI), dawn, night (inverts), karl ("Fog"), holodeck (inverts); disabled in defs: sunset, sunrise, supermoon | `sky/skybox-defs.json` |
| SKY-03 | Environment picker panel | Draggable floating panel "Environment" (sun icon) toggled from palette; "Sky" option buttons (tooltip = name); locked (lock overlay, disabled) unless subscriber, flag `ENVIRONMENTS_UNLOCKED`, or Coastmix; locked state shows `StreetmixPlusPrompt` "This feature is only available to Streetmix+ users." | `sky/SkyPicker/*` |
| SKY-04 | Weather | "Weather" group: Clear / Rain / Snow (rain/snow locked like skies; Clear always allowed); animated canvas effects; not exported in images | flag `WEATHER_EFFECTS` (default false); `WeatherOptions.tsx`, `sky/Weather/*` |
| SKY-05 | Animated clouds | CSS animation class when flag `SKY_ANIMATED_CLOUDS` | `SkyBox.tsx` |
| SKY-06 | Persistence | `street.skybox` and `street.weather` saved with the street | `store/slices/street.ts`, `streets/data_model.ts` |

### 9.2 Sentiment survey (`client/src/sentiment`)

| ID | Feature | Details | Evidence |
|---|---|---|---|
| SENT-01 | Eligibility | flag `SENTIMENT_SURVEY` (default false); locale `en` or `es-419`; viewer is not the creator; gallery closed; street geolocated; `editCount > 10`; `remainingWidth === 0`; appears 5 s after load | `SentimentSurveyContainer.tsx` |
| SENT-02 | Prompt | "Pardon the interruption. We'd love your feedback on this street." / "Would you say this street feels joyful?" / "(choose one)"; 5 emoji votes: Absolutely not (−1), Not very much (−0.5), It's so-so (0), A little bit (0.5), Quite a lot (1) (OpenMoji images) | `SentimentSurvey.tsx`, `VoteButtons.tsx`, `scores.ts` |
| SENT-03 | Sign-in requirement | Not signed in: "Please sign in now to make your voice heard." + Sign in button; votes ignored | `SentimentSurvey.tsx` |
| SENT-04 | Vote submit | `POST /api/v1/votes {score, data: street, streetId}`; receipt "Thank you! You responded {answer}. Tell us why:" + comment input (max 280) `PUT /api/v1/votes {id, comment}` → "Got it!"; buttons "Vote on another!" (`/survey`) and "All done!" | `VoteReceipt.tsx`, `VoteComment.tsx`, `util/api.ts` |
| SENT-05 | "Why am I seeing this?" | opens SENTIMENT_SURVEY dialog (DLG-SENT-01) | |
| SENT-06 | Survey finished mode | URL `/survey-finished` → toast "Survey complete. Congratulations and thank you!" | `authentication.ts` |
| SENT-07 | Rendering caveat | `SentimentSurvey` only renders once `streetId` state is set, which happens after a vote response — so in this commit the prompt UI is effectively unreachable (**UNVERIFIED** whether intended) | `SentimentSurveyContainer.tsx` |

### 9.3 Geotag / map — see §2.6 (DLG-GEO-*) and:

| ID | Feature | Details |
|---|---|---|
| GEO-META-01 | Street meta location item | Location icon; text "{locality\|region\|neighbourhood}, {country}" or "Unknown location" or "Add location"; tooltip "Change location"; hidden if no location and not editable | `streets/StreetMeta/StreetMetaGeotag.tsx` |

### 9.4 Analytics / capacity — see §2.7 (DLG-ANA-*) and:

| ID | Feature | Details |
|---|---|---|
| ANA-META-01 | Street meta capacity item | Chart icon "{n} people/hr" (average), tooltip "Analytics", opens dialog; hidden when capacity 0 or flag `ANALYTICS` off | `StreetMetaAnalytics.tsx` |
| ANA-LABEL-01 | Per-slice capacity labels | "{n} people/hr" under slice name when `ANALYTICS` flag and `street.showAnalytics` (templates set `showAnalytics: true` for default/empty/stroad; Coastmix templates false) | `segments/SegmentLabelContainer.tsx`, `Segment.tsx` |
| ANA-DATA-01 | Capacity data | Sources giz/nacto/vancouver with per-type average/potential for bike-lane, brt-lane, bus-lane, drive-lane, light-rail, scooter, sidewalk, streetcar (+ magic-carpet in common); variants may override | `segments/capacity_data.json`, `capacity.ts` |

### 9.5 Other street meta

| ID | Feature | Details |
|---|---|---|
| META-AUTHOR-01 | "by {user}" with avatar linking to creator gallery (or "Anonymous"); hidden when viewing your own street | `StreetMetaAuthor.tsx` |
| META-DATE-01 | Relative "updated" time with clock icon; suppressed for 6 s after your own edits | `StreetMetaDate.tsx` |

---

## 10. Locales

| ID | Feature | Details | Evidence |
|---|---|---|---|
| LOC-01 | Locale levels | 1 = in progress (translators), 2 = complete/testing, 3 = production, 4 = default English (always on); client enables the lowest level whose flag is true: `LOCALES_LEVEL_1` (default false), `LOCALES_LEVEL_2` (false), `LOCALES_LEVEL_3` (true) | `packages/i18n/src/locales.ts`, `client/src/locales/locale.ts` |
| LOC-02 | Defined locales (29) | am (3), ar (3), ca (3), cs (3), de (3), en (4), en-GB (1), es (1), es-419 (3), es-ES (3), es-MX (3), fi (3), fil (1), fr (3), id (3), it (3), ja (3), ko (3), nl-NL (2), nb-NO (3), pl (3), pt-BR (3), ro-RO (1), ru (3), sk (1), sv (3), tr (3), zh-Hans (3), zh-Hant (3) | `packages/i18n/src/locales.ts` |
| LOC-03 | Locale files | `packages/i18n/locales/{locale}/main.json` and `segment-info.json` for all 29 locales; served via `/api/v1/translate/{locale}/main` and `/segment-info`; `client/src/locales/` contains only `locale.ts` + test (no JSON) | `packages/i18n/locales/*`, `util/api.ts` |
| LOC-04 | Locale resolution | `?lang=` param → LS `settings.locale` → `navigator.language` → `en`; exact → prefix (en-AU→en) → fuzzy same primary tag (pt-PT→pt-BR) → en | `locales/locale.ts` |
| LOC-05 | RTL | `ar`, `dv`, `fa`, `he` set `dir=rtl`; menus/toasts/pagination mirror | `store/slices/app.ts`, `menus/Menu.tsx` |
| LOC-06 | Non-React formatting | `formatMessage(key, fallback, {ns})` with IntlMessageFormat for toasts, labels, prompts | `locales/locale.ts` |
| LOC-07 | Untranslated areas | What's New (English only banner), Notification bar & Sponsor banner (English only), Feature flag UI, Coastmix text, debug UI | `WhatsNewDialog.tsx`, `NotificationBar.tsx`, `SponsorBanner.tsx` |

---

## 11. Persistence / autosave

| ID | Feature | Details | Evidence |
|---|---|---|---|
| SAVE-01 | Change detection | After each `segmentsChanged()` (and a store observer on boundary/name/location/skybox/weather) the trimmed street JSON is compared with the last saved snapshot; on change: `editCount++`, `updatedAt/clientUpdatedAt = now`, event `stmx:save_street`, undo delta created, save scheduled | `streets/data_model.ts`, `streets/street.ts`, `store/actions/street.ts` |
| SAVE-02 | Debounce | `scheduleSavingStreetToServer` → 500 ms timer → `PUT /api/v1/streets/{id}` (`SAVE_STREET_DELAY`); skipped in readOnly; axios retries 3× with exponential backoff; after max retries event `stmx:api_max_connection` → "no connection" toast | `streets/xhr.ts`, `util/api.ts`, `app/event_handlers/no_connection.ts` |
| SAVE-03 | Ignore windows | `setIgnoreStreetChanges(true)` during resize drags, undo/redo, gallery street load, template creation | `data_model.ts`, `drag_and_drop.ts`, `undo_stack.ts` |
| SAVE-04 | Save-status indicator | **None in UI**; `Ctrl+S` toast explains autosave; `StreetMetaDate` hides timestamp for 6 s after own edits | `keyboard_commands.ts`, `StreetMetaDate.tsx` |
| SAVE-05 | Unload guard | `beforeunload` prompts "Your changes have not been saved yet." if a save is incomplete (`saveStreetIncomplete`) | `app/event_handlers/window_unload.ts` |
| SAVE-06 | Stale/conflict handling | On window focus / visibility (gallery closed, no blocking request, not remix-pending): `GET /api/v1/streets/{id}` with header `x-streetmix-request-id`; stale responses discarded; if server `clientUpdatedAt` is newer → replaces local data, toast (warning) "Your street was reloaded from the server as it was modified elsewhere." without re-saving; 404/410 while signed in → "This street has been deleted elsewhere." screen | `streets/xhr.ts` `fetchStreetForVerification`, `app/event_handlers/focus.ts` |
| SAVE-07 | Payload | `{name, originalStreetId, clientUpdatedAt, data:{street:{schemaVersion, showAnalytics, capacitySource, width, id, namespacedId, units, location, userUpdated, skybox, weather, boundary, segments[{id,type,variantString,width,elevation,slope,label,elevationChanged?}], editCount}, plugins:{coastmix?}}, history?}` | `xhr.ts` `packServerStreetDataRaw`, `data_model.ts` `trimStreetData` |
| SAVE-08 | Blocking requests | Remix (`POST /api/v1/streets`) and copy-last (`GET /api/v1/streets/{id}`) use a blocking shield: darkens after 800 ms, "Streetmix wasn't able to connect…" after 10 s with Reload; errors offer "Try again"/"Cancel" | `util/fetch_blocking.ts`, `app/BlockingShield.tsx` |
| SAVE-09 | Error screens | NOT_FOUND "Page not found.", SIGN_OUT, NO_STREET, GALLERY_STREET_FAILURE "We're having trouble loading this street.", FORCE_RELOAD_SIGN_IN/OUT, AUTH_EXPIRED, STREET_DELETED_ELSEWHERE, NEW_STREET_SERVER_FAILURE, SIGN_IN_SERVER_FAILURE (15A), SIGN_IN_401 (RM1), STREET_DATA_FAILURE (9B), GENERIC_ERROR; help links `https://docs.streetmix.net/user-guide/support/troubleshooting`, `https://docs.streetmix.net/community` | `app/errors.ts`, `app/BlockingError.tsx` |
| SAVE-10 | Loading screen | Logo + spinner; after 10 s "Not loading? Troubleshooting tips" → `https://docs.streetmix.net/user-guide/support/troubleshooting` | `app/Loading.tsx` |
| SAVE-11 | Thumbnail save | Disabled (no-op) — `saveStreetThumbnail` body commented out; `isThumbnailSaved()` always true | `streets/image.ts` |

### 11.1 localStorage keys

| Key | Purpose | Evidence |
|---|---|---|
| `settings` | user settings mirror (units, locale, colorMode, saveAsImage*, last street ids) | `users/settings.ts`, `locales/locale.ts` |
| `sign-in` | serialized sign-in data; presence drives cross-tab sign-in/out detection | `users/authentication.ts` |
| `flags` | session feature-flag overrides | `app/flag_utils.ts` |
| `settings-welcome-dismissed` | returning-user marker (welcome panel variant, What's New eligibility) | `app/WelcomePanel/localstorage.ts`, `app/initialization.js` |
| `whatsnew-last-timestamp` | last shown What's New version timestamp | `app/initialization.js` |
| `share:mastodon-domain` | remembered Mastodon instance | `ShareMenu/PostOnMastodon.tsx` |
| `wm-sign-in-notification` | Web Monetization sign-in toast state | `integrations/coil.ts` |
| `notification-store-dismissed` (configurable `localStorageKey`) | notification bar dismissal (inactive config) | `NotificationBar/*` |

Cookies read/written: `login_token`, `refresh_token`, `user_id`, `last_survey_url`, `btpToken` (`users/authentication.ts`, `integrations/coil.ts`).

### 11.2 Welcome panel (`client/src/app/WelcomePanel`)

| ID | Variant | Content / conditions |
|---|---|---|
| WELCOME-01 | First-time new street | "Welcome to Streetmix." + "Design, remix, and share your neighborhood street…" + "Start by moving some segments around." — new-street modes, not signed in and not returning |
| WELCOME-02 | Returning/new street | "Here's your new street." + "Let's go!" — new-street modes, signed in or returning |
| WELCOME-03 | First-time existing street | "This is {name} made by {avatar creator}." / "This is {name}." + "Remix it by moving some segments around, or [Start your own street]" (navigates to `/new`) |
| WELCOME-04 | Coastmix first-time | "Welcome to Coastmix!" text with links `https://boston.gov/`, `https://streetmix.net/`; "Take a quick tour" (onboarding tour) / "Skip" |
| WELCOME-05 | Coastmix new waterfront | "Here's your new waterfront." + "Let's go!"; `?tour=true` auto-starts practice tour |
| WELCOME-06 | Dismissal | X button, Esc, first save (`stmx:save_street`), gallery street load; hidden in readOnly; marks LS returning-user |

---

## 12. Feature flags (`packages/feature-flags/flags.json`)

| Flag | Default | `enabled` | Client gating / UI effect | Evidence |
|---|---|---|---|---|
| COLOR_MODE_TOGGLE | false | — | Appearance/theme settings panel | `Settings/GeneralSettings.tsx` |
| GEOTAG | **true** | — | geotag meta item editable / Geotag dialog | `StreetMetaGeotag.tsx` |
| ANALYTICS | **true** | — | capacity meta item, dialog, per-slice capacity labels | `StreetMeta.tsx`, `Segment.tsx` |
| EDIT_STREET_WIDTH | **true** | — | width dropdown editable | `StreetMetaWidth.tsx` |
| EDIT_STREET_NAME | **true** | — | nameplate rename | `StreetNameplateContainer.tsx` |
| EDIT_BOUNDARY_LEFT | **true** | — | left boundary editable | `BoundaryComponent.tsx` |
| EDIT_BOUNDARY_RIGHT | **true** | — | right boundary editable | `BoundaryComponent.tsx` |
| NEW_STREET_TEMPLATES | **true** | — | "Street templates" section (Stroad) | `NewStreetMenu.tsx` |
| GALLERY_SEARCH | false | — | gallery search box (stub) | `GalleryPanel.tsx` |
| SENTIMENT_SURVEY | false | — | sentiment survey eligibility | `SentimentSurveyContainer.tsx` |
| SKY_ANIMATED_CLOUDS | false | — | cloud animation class | `SkyBox.tsx` |
| ENVIRONMENTS_UNLOCKED | false | — | unlock sky/weather picker without subscription | `SkyPicker.tsx` |
| WEATHER_EFFECTS | false | — | weather options + "Sky" heading | `SkyPicker.tsx`, `SkyOptions.tsx` |
| SAVE_UNDO | false | **false** | include undo history in save payload (toggle disabled) | `xhr.ts` |
| ELEVATION_CONTROLS_UNLOCKED | false | — | unlock universal-elevation buttons | `variant_icons.yaml` |
| UNIVERSAL_ELEVATION_CONTROLS | false | — | universal elevation control row; hides `elevation` variant set | `PopupControls.tsx`, `VariantSet.tsx` |
| TOAST_LIFE_BAR | false | — | debug toast countdown bar | `ToastContainer.tsx` |
| LOCALES_LEVEL_1 | false | — | enable level-1+ locales; locale menu visibility | `locale.ts`, `MenuBar.tsx` |
| LOCALES_LEVEL_2 | false | — | enable level-2+ locales | `locale.ts` |
| LOCALES_LEVEL_3 | **true** | — | enable level-3 locales (production set) | `locale.ts` |
| SEGMENT_3D_PARKING | false | **false** | no client reference found | — |
| SEGMENT_CROSSWALK | false | — | crosswalk palette item | `segment-lookup.yaml` |
| SEGMENT_DRAINAGE_CHANNEL_UNLOCKED | false | — | unlock drainage channel without subscription | `segment-lookup.yaml` |
| SEGMENT_INCEPTION_TRAIN | false | — | "Inception" train palette item | `segment-lookup.yaml` |
| VARIANT_MIXED_DRIVE_LANES_1 | false | — | unlock car-with-bus variant | `variant_icons.yaml` |
| VARIANT_MIXED_DRIVE_LANES_2 | false | — | unlock car-with-bike variant | `variant_icons.yaml` |
| DEBUG_SEGMENT_CANVAS_RECTANGLES | false | — | draw debug rects on canvases | `segments/view.ts` |
| DEBUG_SLICE_SLOPE | false | — | slope % / ratio overlay on slices | `segments/TestSlope.tsx` |
| SAVE_AS_IMAGE_CUSTOM_DPI | false | — | custom scale slider (granted to SUBSCRIBER_1) | `CustomScale.tsx` |
| SAVE_AS_IMAGE_NEW_EXPORT_PIPELINE | false | — | server export pipeline checkbox | `SaveAsImageDialog.tsx` |
| ALWAYS_DISPLAY_WHATS_NEW | false | — | force What's New on load | `initialization.js` |
| MEMBER_UPGRADE | false | — | no client reference found (Upgrade dialog unreachable) | — |
| COASTMIX_MODE | false | — | Coastmix UI everywhere (menus, palette, controls, tours, sea level) | many |
| SILLY_CLOWNS | false | — | user-editable in General settings; no other client reference | `GeneralSettings.tsx` |

Flags on by default: GEOTAG, ANALYTICS, EDIT_STREET_WIDTH, EDIT_STREET_NAME, EDIT_BOUNDARY_LEFT, EDIT_BOUNDARY_RIGHT, NEW_STREET_TEMPLATES, LOCALES_LEVEL_3 (8 of 34). Flag sources: `initial` → role → user → `session` (LS `flags`, edited via Shift+F dialog or Settings › Feature flags) (`client/src/store/slices/flags.ts`, `app/flag_utils.ts`).

---

## 13. New-street templates (`app/data/templates`, `client/src/streets/templates.ts`)

| ID | Template (`?type=`) | Width | Boundaries | Slices (summary) | Notes |
|---|---|---|---|---|---|
| TMPL-01 | `default` | 24 m | narrow bldg 4 floors / wide bldg 3 floors (elev 0.15 m / 0.5 ft) | sidewalk (dense), tree, transit shelter, lamp, bus lane (inbound, shared), drive lane in, divider bush, turn lane out (left-straight), parking out, planter box, bike lane out (green, road level), lamp, tree, sidewalk (normal) — 14 slices | "New example street"; also fallback for `/new` without type |
| TMPL-02 | `empty` | 24 m | grass / grass | none | "New empty street" |
| TMPL-03 | `copy` | — | — | copies `priorLastStreetId` with " (remix)" suffix, editCount 0 | "Make a copy"; falls back to default street if cancelled |
| TMPL-04 | `stroad` | 30 m / 100 ft | parking-lot / parking-lot | sidewalk (empty), lamp, parking in, 2× drive in, shared turn lane, 2× drive out, parking out, utilities, sidewalk — 11 slices | "Stroad" (templates flag, signed in) |
| TMPL-05 | `empty_waterfront` | 24 m | waterfront2 / waterfront2 (elev 0) | none | Coastmix "New empty waterfront" |
| TMPL-06 | `coastal_road` | 19.5 m / 64 ft | wide bldg 4 floors / waterfront2 | sidewalk, tree, lamp, BRT lane in, drive in, drive out, parking out, bike lane out, lamp, tree, sidewalk (dense) — 11 slices; `showAnalytics: false` | Coastmix default when no last street (constant marked "Deprecated") |
| TMPL-07 | `harborwalk` | 24 m | fence (elev 0.5 m) / dock | big-tree divider, flowers, big-tree ("Park"), two-way cycletrack, lamp, big-tree, planting-strip berm with slope 0.3→0 m, sidewalk "Harborwalk" — 8 slices; custom labels | Coastmix (constant "Deprecated"; used by practice tour via examples gallery — UNVERIFIED) |
| TMPL-08 | `beach` | 24 m | grass / water | sidewalk "Pedestrian walk", marsh dunes with slopes (3), beach (lounger) — 5 slices | Coastmix ("Deprecated") |
| TMPL-09 | Processing rules | Fetched from `/assets/data/templates/{id}.yaml` (Express static of `app/data`), validated with Zod (`StreetTemplate` strict schema); widths given as number are metres, converted ×(10/3)×0.3048 in imperial; `{metric, imperial}` objects used directly; left-hand-traffic countries mirror slice order and swap `left/right` in orientation variants; creator = signed-in user or null; `showAnalytics` default true; schemaVersion 35 | `templates.ts`, `app.ts` |

---

## 14. Outbound hostnames / URLs referenced in client code (grouped)

Grep of `https?://` in `client/src` (excluding tests, snapshots, mocks). Code-comment reference links (redux docs, codepen, etc.) are listed last.

| Group | URL | Where |
|---|---|---|
| **Streetmix properties** | `https://streetmix.net/` | Coastmix welcome/about |
| | `https://streetmix.net/terms-of-service/`, `https://streetmix.net/privacy-policy/` | About dialog |
| | `https://streetmix.net/survey/` | Sentiment about dialog |
| | `https://docs.streetmix.net/user-guide/intro` | Help › Guidebook |
| | `https://docs.streetmix.net/user-guide/streetmix-plus` | Upgrade button, StreetmixPlusPrompt, WM success toast |
| | `https://docs.streetmix.net/user-guide/support/troubleshooting` | error screens, loading screen |
| | `https://docs.streetmix.net/user-guide/support/faq#internet-explorer` | unsupported-browser error (deprecated) |
| | `https://docs.streetmix.net/community` | error screens |
| | `https://about.streetmix.net/sponsorship/` | sponsor banner |
| | `https://strt.mx/discord` | Contact menu, About social |
| | `https://strt.mx/plus#coil` | Web Monetization toasts |
| | `https://github.com/streetmix/`, `https://github.com/streetmix/streetmix/`, `https://github.com/streetmix/streetmix/issues/new` | Contact, About, Error dialog |
| | `https://opencollective.com/streetmix` | console welcome message |
| | `https://bsky.app/profile/streetmix.app`, `https://urbanists.social/@streetmix` | About social links |
| | `https://cottonbureau.com/people/streetmix` | Help › Store, notification.json sample |
| **Sharing / integrations** | `https://3dstreet.app/#{url}`, `https://streetmeter.net/#{url}` | Share menu |
| | `https://twitter.com/intent/tweet`, `https://www.facebook.com/dialog/feed`, `https://{mastodon-domain}/share` | Share menu |
| | `https://buttondown.email/api/emails/embed-subscribe/streetmix` | Newsletter dialog (POST) |
| **Maps / geocoding** | `https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}[@2x].png?key=` | Geotag tiles |
| | `https://{PELIAS_HOST_NAME}`, `https://{PELIAS_HOST_NAME}/v1/reverse` | Geotag search/reverse geocode |
| | `https://www.openstreetmap.org/copyright`, `https://carto.com/attribution`, `https://leafletjs.com` | map attribution |
| **Telemetry / auth / feedback** | `https://fac2c23600414d2fb78c128cdbdeaf6f@sentry.io/82756` | Sentry DSN (production hostnames only) |
| | Auth0 domain from env `AUTH0_DOMAIN` (not a literal URL) | `app/auth0.ts` |
| | Userback widget via `@userback/widget` + `USERBACK_TOKEN` | `app/userback/client.ts` |
| **Partners / sponsors / credits** | `https://biffud.com/`, `https://codeforamerica.org/`, `https://numo.global/`, `https://www.numo.global/`, `https://www.mozilla.org/en-US/moss/` | About, Sentiment dialog |
| | `https://www.boston.gov/coastmix/`, `https://www.boston.gov/coastmix`, `https://boston.gov/`, `https://www.boston.gov/departments/climate-resilience`, `https://www.boston.gov/departments/emerging-technology` | Coastmix UI |
| | Fonts/licenses: `https://manropefont.com/`, `https://gent.media/`, `https://hubertfischer.com/`, `https://hubertfischer.com/work/type-rubik`, `https://delvefonts.com/`, `https://delvefonts.com/fonts/overpass/`, `https://scripts.sil.org/cms/scripts/page.php?site_id=nrsi&id=OFL`, `https://github.com/RedHatOfficial/Overpass/blob/master/OFL.txt` | About |
| | Icons/emoji: `https://tabler.io/icons`, `https://fontawesome.com/`, `https://fontawesome.com/license/free`, `https://openmoji.org/` | About |
| | Creative Commons: `https://creativecommons.org/licenses/by-sa/4.0/` and `deed.{ar,ca,de,es,fi,fr,it,ja,ko,pl,pt,pt_BR,ru,sv,zh,zh_TW}`, `…/by-sa/4.0/#` | Terms, About |
| | Team member links in `credits.json`: `https://louhuang.com`, `https://aresluna.org`, `https://yesezra.com/`, `https://whitmanschorn.com`, `https://drew.dara-abrams.com`, `https://twitter.com/{shaunak,oluwaseunOmoya,klizlewis,anselmbradford}`, `https://www.linkedin.com/in/treyhahn/`, `https://www.linkedin.com/pub/marc-hebert/1/2bb/66` | About credits |
| | Capacity sources: `https://www.transformative-mobility.org/publications/passenger-capacity-of-different-transport-modes`, `https://nacto.org/publication/transit-street-design-guide/introduction/why/designing-move-people/`, `https://twitter.com/BrentToderian/status/953085021744611328` | Analytics dialog |
| | `https://blacklivesmatters.carrd.co/` | notification.json (display false) |
| **Browser download links (deprecated error)** | `https://www.google.com/chrome`, `https://www.mozilla.org/firefox`, `https://www.microsoft.com/en-us/windows/microsoft-edge` | `BlockingError.tsx` (UNSUPPORTED_BROWSER, deprecated) |
| **Comment-only references (not user-facing)** | `codepen.io/MillerTime/pen/oXmgJe`, `webmonetization.org`, `usehooks.com`, `redux.js.org`, `redux-toolkit.js.org`, `react.dev`, `react-leaflet.js.org`, `github.com/reduxjs/*`, `github.com/parcel-bundler/*`, `github.com/mswjs/*`, `github.com/mrded/is-url-external`, `github.com/madrobby/keymaster`, `github.com/dacioromero/types-wm`, `gist.github.com/penguinboy/762197`, `geocode.earth/docs/...`, `egghead.io`, `developers.google.com/web/updates/...`, `msdn.microsoft.com/...`, `beta.reactjs.org/...`, `dmauro.github.io/Keypress/`, `craig.is/killing/mice`, `codesandbox.io/s/v1i1t`, `www.radix-ui.com/...`, `urbanists.social/settings/profile`, `twitter.com/dan_abramov/status/...`, `github.com/streetmix/streetmix/issues/2324`, `www.w3.org/2000/svg`, `www.w3.org/1999/xlink` | code comments / SVG namespaces |

Same-origin endpoints used by the client (for completeness): `/api/v1/streets[/{id}][/image]`, `/api/v1/users/{id}[/streets][/login-token]`, `/api/v1/translate/{locale}/{main|segment-info}`, `/api/v1/votes`, `/services/changelog`, `/services/geoip`, `/services/pay` (unreachable), `/services/auth0/{sign-in-callback,just-signed-in,refresh-login-token}`, `/assets/data/templates/{id}.yaml`, `/assets/icons.svg`, `/assets/images.svg`, `/images/*`, `/new`, `/gallery`, `/survey`, `/survey-finished`, `/terms-of-service`, `/privacy-policy`, `/error`.

---

## 15. Items noted as UNVERIFIED or dead

- DLG-UPG-02 / MEMBER_UPGRADE: Upgrade dialog has no live trigger; `/services/pay` behaviour not verified.
- SENT-07: sentiment prompt appears unreachable due to `streetId` gating; intent unverified.
- TMPL-07/08: `harborwalk`/`beach`/`coastal_road` constants are marked deprecated; which Coastmix flows still load them (beyond `coastal_road` default) not verified from client source alone (the practice tour selects from the `examples` gallery).
- SILLY_CLOWNS / VARIANT_TWOWAY_BIKES / SEGMENT_3D_PARKING: no client behaviour found behind these flags.
- Exact server-side behaviour of `/api/v1/streets/{id}/image` (new export pipeline) not examined.
- Server static route serves `app/data` at `/assets/data` (confirmed in `app.ts`), but `/terms-of-service`, `/privacy-policy`, `/survey` pages are server-rendered and outside this client inventory.

---

## 16. Counts by section

| Section | IDs |
|---|---|
| 1 Menubar (MENU-*) | 8 bar + 7 help + 3 contact + 9 new + 3 locale + 4 identity = **34** |
| 2 Dialogs (DLG-*) | 3 framework + 6 about + 4 whatsnew + 13 save + 5 signin + 7 geotag + 7 analytics + 2 newsletter + 1 sentiment + 2 upgrade + 8 settings + 2 flags + 1 coastmix = **61** |
| 3 Street editing (EDIT-*) | 9 dnd + 9 resize + 3 width input + 2 remove + 3 undo + 13 keys + 4 name + 6 street width + 5 boundary + 13 misc (1 empty, 5 warn, 3 elev, 1 scroll, 1 hover, 1 variant, 1 label) = **67** |
| 4 Info bubble (INFO-*) | 1 open + 2 header + 4 variant + 2 width + 1 height + 1 elevation + 1 warnings + 2 description + 2 misc = **16** |
| 5 Palette (PAL-*) | **11** |
| 6 Gallery (GAL-*) | **11** |
| 7 Sharing/exports/integrations (SHARE-/EXPORT-/INTEG-*) | 12 + 4 + 11 = **27** |
| 8 Users/auth (USER-*) | **17** |
| 9 Sky/sentiment/geo/analytics/meta (SKY-/SENT-/GEO-/ANA-/META-*) | 6 + 7 + 1 + 3 + 2 = **19** |
| 10 Locales (LOC-*) | **7** |
| 11 Persistence (SAVE-*, WELCOME-*) + storage keys | 11 + 6 = **17** (+ 8 localStorage keys, 5 cookies) |
| 12 Feature flags | **34** flags (8 default-on) |
| 13 Templates (TMPL-*) | **9** |
| 14 Outbound URLs | ~**95** distinct URLs/hosts (≈60 user-facing, ≈35 comment-only) |
| **Total feature IDs (sections 1–13)** | **330** (34 + 61 + 67 + 16 + 11 + 11 + 27 + 17 + 19 + 7 + 17 + 34 + 9) |
