import express from 'express'
import request from 'supertest'
import { vi } from 'vitest'

import serviceRoutes from '../service_routes.ts'

import type { NextFunction, Request, Response } from 'express'

const {
  changelogGetMock,
  geoipGetMock,
  newsletterPostMock,
  sourceGetMock,
  cspReportPostMock,
} = vi.hoisted(() => {
  const ok = (label: string) =>
    vi.fn((_req: Request, res: Response) => {
      res.status(200).json({ route: label })
    })

  return {
    changelogGetMock: ok('services.changelog.get'),
    geoipGetMock: ok('services.geoip.get'),
    newsletterPostMock: ok('services.newsletter.post'),
    sourceGetMock: ok('services.source.get'),
    cspReportPostMock: vi.fn((_req: Request, res: Response) => {
      res.status(204).end()
    }),
  }
})

vi.mock('../resources/services/index.ts', () => ({
  changelog: { get: changelogGetMock },
  geoip: { get: geoipGetMock },
  newsletter: { post: newsletterPostMock },
  source: { get: sourceGetMock },
  cspReport: { post: cspReportPostMock },
}))

vi.mock('../auth/routes.ts', () => {
  const router = express.Router()
  router.get('/config', (_req: Request, res: Response) => {
    res.status(200).json({ route: 'auth.config' })
  })
  router.post(
    '/refresh-login-token',
    (_req: Request, res: Response, _next: NextFunction) => {
      res.status(200).json({ route: 'auth.refresh' })
    }
  )
  return { default: router }
})

function makeApp() {
  const app = express()
  app.use(express.json())
  // Minimal view engine stub for routes that render the client shell
  app.set('view engine', 'hbs')
  app.engine('hbs', (_path, _options, callback) => callback(null, 'main'))
  app.use('/services', serviceRoutes)
  return app
}

describe('service routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('GET /services/changelog', async () => {
    const response = await request(makeApp()).get('/services/changelog')
    expect(response.statusCode).toBe(200)
    expect(changelogGetMock).toHaveBeenCalledTimes(1)
  })

  it('GET /services/geoip', async () => {
    const response = await request(makeApp()).get('/services/geoip')
    expect(response.statusCode).toBe(200)
    expect(geoipGetMock).toHaveBeenCalledTimes(1)
  })

  it('POST /services/newsletter', async () => {
    const response = await request(makeApp())
      .post('/services/newsletter')
      .send({ email: 'a@b.co' })
    expect(response.statusCode).toBe(200)
    expect(newsletterPostMock).toHaveBeenCalledTimes(1)
  })

  it('GET /services/source', async () => {
    const response = await request(makeApp()).get('/services/source')
    expect(response.statusCode).toBe(200)
    expect(sourceGetMock).toHaveBeenCalledTimes(1)
  })

  it('mounts the STS identity service at /services/auth', async () => {
    const response = await request(makeApp()).get('/services/auth/config')
    expect(response.statusCode).toBe(200)
    expect(response.body.route).toBe('auth.config')
  })

  it('keeps the legacy refresh-login-token path working', async () => {
    const response = await request(makeApp())
      .post('/services/auth0/refresh-login-token')
      .send({ token: 'x' })
    expect(response.statusCode).toBe(200)
    expect(response.body.route).toBe('auth.refresh')
  })

  it('POST /services/csp-report', async () => {
    const response = await request(makeApp())
      .post('/services/csp-report')
      .set('Content-Type', 'application/csp-report')
      .send(JSON.stringify({ 'csp-report': {} }))
    expect(response.statusCode).toBe(204)
    expect(cspReportPostMock).toHaveBeenCalledTimes(1)
  })

  it('responds 404 for unknown service paths', async () => {
    const response = await request(makeApp()).get('/services/nope')
    expect(response.statusCode).toBe(404)
  })
})
