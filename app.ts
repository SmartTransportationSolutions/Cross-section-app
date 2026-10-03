import './app/globals.ts'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { styleText } from 'node:util'
import compression from 'compression'
import cookieParser from 'cookie-parser'
import cookieSession from 'cookie-session'
import express, {
  type NextFunction,
  type Request,
  type Response,
} from 'express'
import helmet, { type HelmetOptions } from 'helmet'
import hbs from 'hbs'
import swaggerUi from 'swagger-ui-express'
import swaggerJSDoc from 'swagger-jsdoc'

import { brand } from '@sts-street/branding'
import * as controllers from './app/controllers/index.ts'
import * as requestHandlers from './app/lib/request_handlers/index.ts'
import { serveErrorPage } from './app/lib/errorPage.ts'
import { logger } from './app/lib/logger.ts'
import { compileSVGSprites } from './app/lib/svg_sprite.ts'
import { appURL } from './app/lib/url.ts'
import { sequelize } from './app/db/db.ts'
import { getPublicJwks, getSigningKeys } from './app/auth/keys.ts'
import {
  getSourceInfo,
  SOURCE_ARCHIVE_DIR,
} from './app/resources/services/source.ts'
import apiRoutes from './app/api_routes.ts'
import serviceRoutes from './app/service_routes.ts'
import errorRoutes from './app/error_routes.ts'
import { auth } from './app/authentication.ts'

import type { User } from './app/db/models/user.ts'

const isProduction = process.env.NODE_ENV === 'production'

// Fail fast on missing production secrets instead of falling back to
// development defaults.
if (isProduction && !process.env.COOKIE_SESSION_SECRET) {
  throw new Error('COOKIE_SESSION_SECRET must be set in production.')
}

// Load (or generate, outside production) the identity service signing keys
// before accepting requests.
await getSigningKeys()

// Build SVG sprites before starting Express server
await Promise.all([
  compileSVGSprites('packages/variant-icons/icons/', 'icons', 'icon'),
  compileSVGSprites('packages/illustrations/images/', 'images', 'image'),
])

const app = express()
export default app

// Behind a reverse proxy (Docker, load balancer), trust the first proxy so
// that `req.ip`, `secure` cookies and rate limiting see the real client.
if (process.env.TRUST_PROXY) {
  app.set('trust proxy', process.env.TRUST_PROXY === 'true' ? 1 : process.env.TRUST_PROXY)
}

// Get the timestamp of this server's start time to use as a cachebusting filename.
const cacheTimestamp = Date.now()
app.locals.cacheTimestamp = cacheTimestamp
app.locals.brand = brand

process.on('uncaughtException', function (error) {
  logger.error(
    '[process] ' + styleText(['red', 'bold'], 'Uncaught exception: ') + error
  )

  console.trace()
  process.exit(1)
})

// Provide a message after a Ctrl-C
// Note: various sources tell us that this does not work on Windows
process.on('SIGINT', function () {
  if (process.env.NODE_ENV === 'development') {
    logger.info(
      '[express] ' +
        styleText(['yellow', 'bold'], `Stopping ${brand.productName}!`)
    )
  }
  process.exit()
})

// Pass environment variables to handlebars templates
app.locals.env = {
  FACEBOOK_APP_ID: process.env.FACEBOOK_APP_ID,
  PLAUSIBLE_ID: process.env.PLAUSIBLE_ID,
  PLAUSIBLE_HOST: process.env.PLAUSIBLE_HOST || 'plausible.io',
}

// Not all headers from `helmet` are on by default. These turns on specific
// off-by-default headers for better security as recommended by https://securityheaders.io/
const helmetConfig = {
  frameguard: false, // Allow the editor to be iframed in 3rd party sites
  contentSecurityPolicy: false, // These are set explicitly later
  crossOriginEmbedderPolicy: false, // Load external assets
  hsts: {
    maxAge: 5184000, // 60 days
    includeSubDomains: false,
  },
  referrerPolicy: {
    policy: 'strict-origin-when-cross-origin' as const,
  },
}

// Generate nonces for inline scripts
const nonces = {
  plausible: crypto.randomBytes(16).toString('hex'),
}

// Extract the type of the `csp` object shape from Helmet, but we will not
// yet attach the type until we are ready to pass it to Helmet. This allows us
// to do additional transformations on the object before it's type checked.
type ContentSecurityPolicyOptions = Exclude<
  HelmetOptions['contentSecurityPolicy'],
  boolean | undefined
>

// Hosts of optional third-party services that STS operates or has chosen.
// Each one is only added to the policy when it is configured.
function hostOf(url: string | undefined): string | undefined {
  if (!url) return undefined
  try {
    return new URL(url.replace(/\{[sxyz]\}/g, 'a')).host.replace(/^a\./, '*.')
  } catch {
    return undefined
  }
}
const mapTilesHost = hostOf(process.env.MAP_TILES_URL) ?? 'tile.openstreetmap.org'
const sentryHost = hostOf(process.env.SENTRY_DSN)
const plausibleHost = process.env.PLAUSIBLE_ID ? app.locals.env.PLAUSIBLE_HOST : ''
const peliasHost = process.env.PELIAS_HOST_NAME ?? ''

// This object cannot have undefined values, so `process.env` values which
// can be undefined must be nullish-coalesced to an empty string, which will
// be ignored by Helmet.
const csp = {
  directives: {
    defaultSrc: ["'self'"],
    styleSrc: ["'self'", "'unsafe-inline'"],
    scriptSrc: ["'self'", plausibleHost, `'nonce-${nonces.plausible}'`],
    workerSrc: ["'self'"],
    frameAncestors: ["'self'", 'https:'],
    frameSrc: ["'self'"],
    imgSrc: [
      "'self'",
      // Save-as-image
      'blob:',
      'data:',
      // Map tiles
      mapTilesHost,
      // Profile images from federated identity providers
      'https:',
    ],
    objectSrc: ["'none'"],
    fontSrc: ["'self'"],
    connectSrc: ["'self'", peliasHost, sentryHost ?? '', plausibleHost],
    reportUri: '/services/csp-report/',
  },
  // Report (but do not block) CSP violations in development mode.
  // This allows developers to work on new or experimental features without
  // worrying about modifying CSP headers.
  // !! WARNING !!
  // Reported CSP violations should be addressed before releasing to
  // production. IF A NEW FEATURE IS REPORTING A CSP VIOLATION, IT WILL
  // FAIL IN PRODUCTION, EVEN THOUGH IT WORKS IN DEVELOPMENT MODE.
  reportOnly: process.env.NODE_ENV === 'development',
}

// Allows websockets for hot-module reloading
// (note: ports are assigned randomly by Parcel)
if (process.env.NODE_ENV === 'development') {
  csp.directives.scriptSrc.push("'unsafe-eval'")
  csp.directives.connectSrc.push('ws:')
}

app.use(helmet(helmetConfig))
app.use(express.json())
app.use(compression())
app.use(cookieParser())
app.use(
  cookieSession({
    name: 'sts_session',
    secret: process.env.COOKIE_SESSION_SECRET || 'development-only-session-secret',
    sameSite: 'lax',
    secure: isProduction,
    httpOnly: true,
    maxAge: 15 * 60 * 1000, // only used for short-lived sign-in state
  })
)

app.use(requestHandlers.requestLog)
app.use(requestHandlers.requestIdEcho)

const metatagImage = `${appURL.origin}${brand.socialImagePath}`

// Set variables for use in view templates
app.use((req, res, next) => {
  // Send nonces to template
  res.locals.nonces = nonces

  // Set default metatag information for social sharing cards
  res.locals.STREETMIX_IMAGE = {
    image: metatagImage,
    width: brand.socialImageWidth,
    height: brand.socialImageHeight,
  }

  res.locals.STREETMIX_TITLE = brand.productName
  res.locals.STREETMIX_DESCRIPTION = brand.description
  res.locals.STREETMIX_URL = appURL.href

  next()
})

// Set CSP directives
app.use(
  helmet.contentSecurityPolicy(csp satisfies ContentSecurityPolicyOptions)
)

// Rewrite requests with timestamp
app.use((req, res, next) => {
  // Matches a filename like styles.2395934243.css
  // Accepts optional `?29090424` query string used by Parcel's hot-module reloader
  req.url = req.url.replace(/\/([^/]+)\.[0-9]+\.(css|js)(\?[0-9]+)?$/, '/$1.$2')
  next()
})

// Set Handlebars as the template engine
app.set('view engine', 'hbs')
app.set('views', path.join(import.meta.dirname, '/app/views'))
hbs.registerPartials(path.join(import.meta.dirname, '/app/views/partials'))

// A Handlebars block helper for string replacement. For TypeScript, we must
// also pass a synthetic `this` as the first argument. The synthetic `this` is
// stripped after parsing. Handlebars still receives a 3-arg function.
hbs.registerHelper(
  'replace',
  function (this: unknown, source: string = '', token: string, options) {
    return new hbs.handlebars.SafeString(
      source.replace(token, options.fn(this))
    )
  }
)

// Health check for container orchestration and uptime monitoring.
app.get('/healthz', async (_req, res) => {
  try {
    await sequelize.authenticate()
    res.status(200).json({ status: 'ok', database: 'ok', commit: getSourceInfo().commit })
  } catch (err) {
    logger.error(err)
    res.status(503).json({ status: 'error', database: 'unavailable' })
  }
})

// OpenID Connect-style key discovery for the STS identity service.
app.get('/.well-known/jwks.json', async (_req, res) => {
  res.set('Cache-Control', 'public, max-age=3600')
  res.json(await getPublicJwks())
})

// Redirect old help URL to the operator's website
app.get('/help/about', (req, res) => res.redirect(brand.companyUrl))

// Redirects /help and all its other sub paths to 404
app.get('/help', (req, res, next) => {
  next({ status: 404 })
})
app.get('/help/{*splat}', (req, res, next) => {
  next({ status: 404 })
})

app.get('/survey', auth(false), controllers.survey.get)

// Legal pages are served by this application (see app/views/legal/).
app.get('/privacy-policy', (req, res) =>
  res.render('legal/privacy-policy', { pageTitle: 'Privacy policy' })
)
app.get('/terms-of-service', (req, res) =>
  res.render('legal/terms-of-service', { pageTitle: 'Terms of service' })
)

// Corresponding source offer (AGPL-3.0 §13)
app.get('/source', (req, res) =>
  res.render('source', { pageTitle: 'Source code', source: getSourceInfo() })
)
app.use('/source', express.static(SOURCE_ARCHIVE_DIR, { index: false }))

// User guide (Docusaurus build), when built with `npm run build:docs`.
const docsBuildDir = path.join(import.meta.dirname, 'docs', 'build')
if (fs.existsSync(docsBuildDir)) {
  app.use('/docs', express.static(docsBuildDir, { extensions: ['html'] }))
} else {
  app.get(['/docs', '/docs/{*splat}'], (req, res) =>
    res.render('docs-unavailable', { pageTitle: 'User guide' })
  )
}

// Password reset landing page is handled by the client bundle
app.get('/reset-password', (req, res) => res.render('main'))

// Attach API docs in non-production environments
if (process.env.NODE_ENV !== 'production') {
  const options = {
    definition: {
      info: {
        title: brand.productName,
        version: process.env.npm_package_version,
      },
    },
    apis: ['app/api_routes.ts', 'app/service_routes.ts'],
  }
  const displayOptions = {
    customCss: '.swagger-ui .topbar { display: none }',
  }
  const swaggerSpec = swaggerJSDoc(options)

  // This route must be defined before the catch-all handler of `/api/*`
  app.use(
    '/api/docs',
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, displayOptions)
  )
}

// API routes
app.use('/api', apiRoutes)
app.use('/services', serviceRoutes)

// Error routes
app.use('/error', errorRoutes)

// Assets and images
app.use('/assets', express.static(path.join(import.meta.dirname, '/build')))
// Not sure if this sticks around forever, but it's a good way to serve static files
// for templates, this can go away once the responsibility for making new streets and
// processing template data entirely happens server side, which it may as well
app.use(
  '/assets/data',
  express.static(path.join(import.meta.dirname, '/app/data'))
)
app.use(express.static(path.join(import.meta.dirname, '/public')))

// Catch-all for broken asset paths.
// Matches '/images/*'
app.all(/\/images\/.*/, (req, res, next) => {
  next({ status: 404 })
})
// Matches '/assets/*'
app.all(/\/assets\/.*/, (req, res, next) => {
  next({ status: 404 })
})

app.get(
  ['/:user_id/:namespacedId', '/:user_id/:namespacedId/:street_name'],
  requestHandlers.metatags
)

// Catch-all -- client handles all other URLs.
app.use((req, res) => {
  res.render('main')
})

interface AppErrorObject {
  status: 401 | 404 | 410 | 500 | 503
  user?: User | null
}

// Catch-all error handling
app.use(
  (
    err: AppErrorObject,
    req: Request,
    res: Response,
    _next: NextFunction
  ) => {
    const status = err.status || 500
    serveErrorPage(req, res, status, err.user ?? null)
  }
)
