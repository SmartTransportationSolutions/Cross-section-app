<p align="center">
  <img width="420" alt="STS Street" src="client/images/logo_horizontal.svg">
</p>

<p align="center">
  <b>STS Street</b> is the street cross-section design tool of
  <a href="https://www.sts.com.ge/">Smart Transportation Solutions</a> (Tbilisi, Georgia).<br>
  Design, remix, and share street sections with a drag-and-drop editor, precise widths,
  galleries, image export and 29 languages.
</p>

STS Street is a modified version of [Streetmix](https://github.com/streetmix/streetmix)
(imported at commit `f17578eec760d3c7b41216823ec32c7e8d04e8bc`, 2026-09-24) and is
free software under the **GNU Affero General Public License v3.0 or later**.
STS Street is not affiliated with or endorsed by the Streetmix project.

## What is different from upstream

| Area | STS Street |
| --- | --- |
| Identity | Built-in identity service: email + password, email sign-in links, password reset, optional OpenID Connect providers (replaces Auth0) |
| Membership | "STS Street Plus" tier granted by STS administrators (API + CLI); server-side entitlement checks |
| Images | Server-rendered street images for exports and link previews (replaces Cloudinary); Georgian script support |
| Privacy | No upstream telemetry or third-party services by default; first-party newsletter list; configurable map/geocoder |
| Branding | STS logo, palette and copy; legal pages, source offer and user guide served by the app |
| Operations | Docker/Compose deployment, GitHub Actions CI, admin CLI, demo seed |

Details: [docs/architecture.md](docs/architecture.md), [docs/feature-parity.md](docs/feature-parity.md),
[docs/reference-baseline.md](docs/reference-baseline.md), [docs/brand.md](docs/brand.md),
[docs/operations.md](docs/operations.md), [docs/acceptance-report.md](docs/acceptance-report.md).

## Quick start

Requirements: Node.js 22 or 24, npm 11, PostgreSQL 14+ with PostGIS.

```bash
cp .env.example .env            # defaults match a local PostgreSQL user "streetmix"/"streetmix"
createdb -O streetmix sts_street_dev
npm ci
npx sequelize-cli db:migrate
npm run db:seed:demo            # optional demo accounts (see docs/operations.md)
npm start                       # http://localhost:8000
```

Or with Docker: `docker compose up --build` (see docs/operations.md for the
production checklist: secrets, signing key, SMTP, reverse proxy).

Sign-in emails in development are written to `data/mail-outbox/` as JSON files.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm start` | Development server with client rebuild on change |
| `npm run build:app` | Production build of packages and client |
| `npm test` | Lint and unit/integration tests |
| `npm run test:e2e` | Browser acceptance journeys (Playwright) against a running server |
| `npm run sts:admin -- …` | User, role and membership administration |
| `npm run source:archive` | Build the corresponding-source archive served at `/source` |

## Source code offer

The application serves its own complete corresponding source at `/source`
(HTML), `/services/source` (JSON) and `/source/sts-street-source.tar.gz`
(archive built at deploy time), as required by AGPL-3.0 §13.

## Copyright and licenses

- Code: Copyright (c) 2013-2018 Code for America and contributors.
  Copyright (c) 2019-2026 Streetmix LLC. Copyright (c) 2026 Smart
  Transportation Solutions (STS Street modifications). Licensed under
  AGPL-3.0-or-later; see [LICENSE](LICENSE).
- Street illustrations and variant icons (`packages/illustrations`,
  `packages/variant-icons`): Creative Commons Attribution-ShareAlike 4.0
  International, by the Streetmix illustrators (see
  `packages/illustrations/README.md`).
- Fonts: Rubik, Manrope, Overpass, Geist Sans, Noto Sans Georgian (SIL OFL 1.1).
  UI icons: Tabler Icons (MIT), Font Awesome Free (CC BY 4.0), OpenMoji (CC BY-SA 4.0).
