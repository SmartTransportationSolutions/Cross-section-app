import { Router } from 'express'

// Base path of router is `/error` (see app.ts)
const errorRoutes = Router()

// Authentication errors are routed to URLs so that the identity service can
// redirect to them. The server renders the error page directly.
errorRoutes.get('/access-denied', (req, res, next) => {
  next({ status: 401 })
})

errorRoutes.get('/sign-in-link-expired', (req, res, next) => {
  next({ status: 401 })
})

errorRoutes.get('/authentication-api-problem', (req, res, next) => {
  next({ status: 503 })
})

errorRoutes.get('/no-access-token', (req, res, next) => {
  next({ status: 503 })
})

// Catch all for all other subpaths
errorRoutes.get(/.*/, (req, res, next) => {
  next({ status: 404 })
})

export default errorRoutes
