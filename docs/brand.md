# STS Street — brand and identity notes

## Sources and limits of the evidence

- Company: **Smart Transportation Solutions (STS)**, Tbilisi, Georgia —
  transportation engineering and transport planning consultancy (founded 2017;
  services: transportation analysis and policy, traffic safety, traffic
  engineering, transportation planning; recent work includes bus-lane planning
  and design for Tbilisi). Contact published publicly: 7 Otar Chkheidze Street,
  Office 2B, Tbilisi 0177; +995 (577) 155-575; info@sts.com.ge.
  Sources: public search results for sts.com.ge (company LinkedIn page and
  business directories), retrieved 2026-10-03.
- **The STS website (sts.com.ge / www.sts.com.ge) could not be opened from the
  build environment**: outbound requests to that host are denied by the
  environment's network policy, and the LinkedIn page was likewise denied.
  Consequently the official logo file, exact brand colors and typography were
  **not** inspected. The repository contained no STS assets (it was empty).
- Everything below is therefore a **provisional STS Street identity** designed
  to be professional and distinct from Streetmix, with every value centralized
  so that STS can swap in official assets in one place:
  - names and destinations: `packages/branding/index.js`
  - colors: `client/styles/_brand.css`
  - logo/wordmark SVGs: `client/images/logo_horizontal.svg`,
    `client/images/logo_icon.svg`, `public/images/wordmark_{black,white}.svg`,
    `packages/export-image/assets/wordmark_{black,white}.svg`
  - raster icons / social preview: regenerate with `npm run brand:assets`

**Action for STS:** provide the official logo (SVG) and brand guide; replacing
the files above and re-running `npm run brand:assets` completes the handover.
No code changes are needed.

## Naming

| Context | Value |
| --- | --- |
| Product | STS Street |
| Membership tier | STS Street Plus (replaces "Streetmix+") |
| Operator | Smart Transportation Solutions |
| Support email | info@sts.com.ge |
| Company site | https://www.sts.com.ge/ |

Names are applied at three layers: React `defaultMessage` strings (edited in
source), server-rendered views (`app/views`, via `brand`), and all 29 translated
locales (runtime substitution in `client/src/store/slices/locale.ts`, with a
unit test). Internal identifiers were deliberately kept (see "Retained upstream
names" below).

## Palette (provisional)

Chosen for a transport-engineering context: a deep "asphalt navy", a mid
"signal blue", a teal for interactive elements, and an amber accent reminiscent
of road markings. Contrast was checked for white text on the primary button
color (#2e78a8 on white: 4.9:1) and amber used only for icons/badges.

| Token (upstream name kept) | STS value | Use |
| --- | --- | --- |
| `--color-emerald-500/600` | `#2e78a8` / `#255f86` | primary buttons, brand |
| `--color-emerald-800` | `#143a66` | navy, theme color, logo background |
| `--color-turquoise-500..800` | `#3ea4b8` → `#1b4f5a` | links, interactive text, form borders |
| `--sts-accent` | `#f2a900` | membership badge, highlights, logo lanes |
| `--color-copper-*` | unchanged | warnings, locked states |
| theme-color / tile color | `#143a66` | browser UI |

The sky, earth and illustration colors are **not** changed: they are part of the
CC BY-SA illustration system and of the editor's visual fidelity.

## Typography

Unchanged from upstream (Rubik Variable for UI, Manrope Variable for headings,
Overpass Variable for street nameplates), all SIL OFL. **Noto Sans Georgian**
was added as a fallback in the client font stacks and registered in the
server-side exporter so Georgian street names and labels render in exports.

## Logo and marks

- Icon: rounded navy tile with a simplified street cross-section (two amber
  sidewalks, a light carriageway, a blue building and a green tree).
- Horizontal logo: icon + "STS Street" wordmark (STS in navy, Street in blue).
- Watermark wordmark (exports): monochrome variant of the same mark, in black
  and white versions, replacing the Streetmix wordmark. Non-members' exports
  carry "Made with [STS Street]"; Plus members can disable it (server-enforced).
- Favicons, Apple/Android icons, Windows tile and a 1200×630 social preview are
  generated from the SVGs by `bin/generate-brand-assets.mjs`.

## Where the brand is applied

Header/menubar, About dialog, What's new, sign-in and membership dialogs, share
messages, export watermark and license footer, page titles and metadata
(Open Graph/Twitter cards, manifest, theme color), error pages, legal pages,
`/source`, transactional emails (magic link, password reset), loading/error
states, in-app user guide (`/docs`), README and operations docs.

## Retained upstream names (branding audit)

| Name | Where | Why retained |
| --- | --- | --- |
| `@streetmix/*` package names | `packages/*`, imports | Internal module names; renaming would touch hundreds of imports for no user-visible benefit and complicate upstream merges. |
| `StreetmixPlusPrompt`, `streetmixApi`, `stmx:*` DOM events, `x-streetmix-request-id` header | client source | Internal identifiers, not shown to users. |
| `STREETMIX_INSTANCE`, `STREETMIX_TITLE` locals | server/env | Upstream config names used by the Coastmix instance mode; kept for merge compatibility. |
| `{streetmixWordmark}` | translation placeholder | Message syntax across 29 locales; the rendered image is the STS wordmark. |
| Street JSON schema keys, `/api/v1/*` paths, `/{user}/{id}` URLs | data/API | Required for saved-street compatibility and for 3DStreet / Streetmeter, which read the public street URL. |
| "Streetmix" in attribution text | About dialog, `/source`, `LICENSE`, `README` | Legally required authorship/license notices. |
| Coastmix plugin code | `client/src/plugins/coastmix` | Upstream instance mode (off by default); untouched to ease merges, not branded as STS. |
