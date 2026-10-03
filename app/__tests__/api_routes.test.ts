import express from 'express'
import request from 'supertest'
import { vi } from 'vitest'

import apiRoutes from '../api_routes.ts'

import type { NextFunction, Request, Response } from 'express'

const {
  authMock,
  usersGetMock,
  usersPutMock,
  usersPatchMock,
  usersPutRolesMock,
  usersDeleteMock,
  userSessionDeleteMock,
  usersStreetsDeleteMock,
  usersStreetsGetMock,
  streetsPostMock,
  streetsFindMock,
  streetsDeleteMock,
  streetsGetMock,
  streetsPutMock,
  streetImagesGetMock,
  streetRemixesGetMock,
  translateGetMock,
  votesGetMock,
  votesPostMock,
  votesPutMock,
} = vi.hoisted(() => {
  const ok = (label: string) =>
    vi.fn((_req: Request, res: Response) => {
      res.status(200).json({ route: label })
    })

  return {
    authMock: vi.fn((credentialsRequired = true) => {
      return (req: Request, res: Response, next: NextFunction) => {
        if (!credentialsRequired) {
          next()
          return
        }

        if (!req.headers.authorization) {
          res.status(401).json({ status: 401, msg: 'Unauthorized request.' })
          return
        }

        next()
      }
    }),
    usersPutRolesMock: ok('users.putRoles'),
    usersGetMock: ok('users.get'),
    usersPutMock: ok('users.put'),
    usersPatchMock: ok('users.patch'),
    usersDeleteMock: ok('users.del'),
    userSessionDeleteMock: ok('userSession.del'),
    usersStreetsDeleteMock: ok('usersStreets.del'),
    usersStreetsGetMock: ok('usersStreets.get'),
    streetsPostMock: vi.fn((_req: Request, res: Response) => {
      res.status(201).json({ route: 'streets.post' })
    }),
    streetsFindMock: ok('streets.find'),
    streetsDeleteMock: vi.fn((_req: Request, res: Response) => {
      res.status(204).end()
    }),
    streetsGetMock: ok('streets.get'),
    streetsPutMock: vi.fn((_req: Request, res: Response) => {
      res.status(204).end()
    }),
    streetImagesGetMock: ok('streetImages.get'),
    streetRemixesGetMock: ok('streetRemixes.get'),
    translateGetMock: ok('translate.get'),
    votesGetMock: ok('votes.get'),
    votesPostMock: ok('votes.post'),
    votesPutMock: ok('votes.put'),
  }
})

vi.mock('../authentication.ts', () => ({
  auth: authMock,
}))


vi.mock('../resources/v1/index.ts', () => ({
  users: {
    putRoles: usersPutRolesMock,
    get: usersGetMock,
    put: usersPutMock,
    patch: usersPatchMock,
    del: usersDeleteMock,
  },
  userSession: {
    del: userSessionDeleteMock,
  },
  usersStreets: {
    del: usersStreetsDeleteMock,
    get: usersStreetsGetMock,
  },
  streets: {
    post: streetsPostMock,
    find: streetsFindMock,
    del: streetsDeleteMock,
    get: streetsGetMock,
    put: streetsPutMock,
  },
  streetImages: {
    get: streetImagesGetMock,
  },
  streetRemixes: {
    get: streetRemixesGetMock,
  },
  translate: {
    get: translateGetMock,
  },
  votes: {
    get: votesGetMock,
    post: votesPostMock,
    put: votesPutMock,
  },
}))

describe('api_routes router wiring', () => {
  const app = express()
  app.use('/api', apiRoutes)

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('routes to streets.post and supports optional auth', async () => {
    const response = await request(app).post('/api/v1/streets').send({})

    expect(response.statusCode).toBe(201)
    expect(response.body).toEqual({ route: 'streets.post' })
    expect(streetsPostMock).toHaveBeenCalledTimes(1)
  })

  it('routes to user profile endpoint with optional auth', async () => {
    const response = await request(app).get('/api/v1/users/user-123')

    expect(response.statusCode).toBe(200)
    expect(response.body).toEqual({ route: 'users.get' })
    expect(usersGetMock).toHaveBeenCalledTimes(1)
  })

  it('routes street image export with optional auth', async () => {
    const response = await request(app).get('/api/v1/streets/street-123/image')

    expect(response.statusCode).toBe(200)
    expect(response.body).toEqual({ route: 'streetImages.get' })
    expect(streetImagesGetMock).toHaveBeenCalledTimes(1)
  })

  it('does not expose a public user-creation endpoint', async () => {
    const response = await request(app)
      .post('/api/v1/users')
      .set('Authorization', 'Bearer test-token')
      .send({})

    expect(response.statusCode).toBe(404)
  })

  it('requires auth for role management', async () => {
    const response = await request(app)
      .put('/api/v1/users/user-123/roles')
      .send({ roles: ['SUBSCRIBER_1'] })

    expect(response.statusCode).toBe(401)
    expect(usersPutRolesMock).not.toHaveBeenCalled()
  })

  it('returns router-level 404 for unknown api routes', async () => {
    const response = await request(app).get('/api/does-not-exist')

    expect(response.statusCode).toBe(404)
    expect(response.body).toEqual({
      status: 404,
      error: 'Not found. Did you mispell something?',
    })
  })

  it('blocks unauthenticated access on auth-required routes', async () => {
    const response = await request(app).delete('/api/v1/streets/street-123')

    expect(response.statusCode).toBe(401)
    expect(response.body).toEqual({
      status: 401,
      msg: 'Unauthorized request.',
    })
    expect(streetsDeleteMock).not.toHaveBeenCalled()
  })

  it('allows authenticated access on auth-required routes', async () => {
    const response = await request(app)
      .delete('/api/v1/streets/street-123')
      .set('Authorization', 'Bearer test-token')

    expect(response.statusCode).toBe(204)
    expect(streetsDeleteMock).toHaveBeenCalledTimes(1)
  })

  it('allows anonymous access on auth-optional routes', async () => {
    const response = await request(app).get('/api/v1/users')

    expect(response.statusCode).toBe(200)
    expect(response.body).toEqual({ route: 'users.get' })
    expect(usersGetMock).toHaveBeenCalledTimes(1)
  })

  it('allows authenticated access on auth-optional routes', async () => {
    const response = await request(app)
      .get('/api/v1/users')
      .set('Authorization', 'Bearer test-token')

    expect(response.statusCode).toBe(200)
    expect(response.body).toEqual({ route: 'users.get' })
    expect(usersGetMock).toHaveBeenCalledTimes(1)
  })
})
