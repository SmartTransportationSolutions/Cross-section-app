import { Router } from 'express'
import bodyParser from 'body-parser'
import cors from 'cors'

import authRoutes from './auth/routes.ts'
import * as services from './resources/services/index.ts'

// Base path of router is `/services` (see app.ts)
const router = Router()

/**
 * @swagger
 *
 * /services/changelog:
 *   get:
 *     description: Gets changelog in Markdown
 *     produces:
 *       - text/plain
 *     responses:
 *       200:
 *         description: Success
 */
router.get('/changelog', services.changelog.get)

/**
 * @swagger
 * /services/geoip:
 *   get:
 *     description: Returns geolocation data for the current user
 *     tags:
 *       - geolocation
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: Geolocation data
 *         schema:
 *           type: array
 *           items:
 *             $ref: '#/definitions/GeolocationResponse'
 */
router.get('/geoip', services.geoip.get)

/**
 * @swagger
 * /services/newsletter:
 *   post:
 *     description: Subscribes an email address to the STS Street newsletter
 *     responses:
 *       200:
 *         description: Subscribed
 */
router.post('/newsletter', services.newsletter.post)

/**
 * @swagger
 * /services/source:
 *   get:
 *     description: Describes the running version and where to obtain its source code (AGPL corresponding source offer)
 *     responses:
 *       200:
 *         description: Source information
 */
router.get('/source', cors(), services.source.get)

/******************************************************************************
 *  AUTHENTICATION SERVICES (STS identity service, see app/auth)
 *****************************************************************************/

router.use('/auth', authRoutes)

// Legacy upstream paths, kept so that stale bookmarks and older clients
// continue to work.
router.get('/auth0/just-signed-in/', (req, res) => res.render('main'))
router.get('/auth0/just-signed-in', (req, res) => res.render('main'))
router.post('/auth0/refresh-login-token', cors(), (req, res, next) => {
  req.url = '/auth/refresh-login-token'
  router.handle(req, res, next)
})

/******************************************************************************
 *  ERROR HANDLING
 *****************************************************************************/

/**
 * @swagger
 *
 * /services/csp-report:
 *   post:
 *     description: Receives a Content Security Policy violation report
 *     responses:
 *       204:
 *         description: Success (no response)
 */
router.post(
  '/csp-report',
  // As of this implementation, the latest versions of Chrome, Firefox, and
  // Safari all POST this content with the MIME type `application/csp-report`,
  // although it looks like a JSON. If any browser is still POSTing
  // `application/json`, Express should still be parsing that correctly, but
  // this has not been verified.
  bodyParser.json({ type: 'application/csp-report' }),
  services.cspReport.post
)

// Catch all for all broken api paths, direct to 404 response.
router.all(/.*/, (req, res) => {
  res
    .status(404)
    .json({ status: 404, error: 'Not found. Did you mispell something?' })
})

export default router
