import express from 'express'
import request from 'supertest'
import cookieParser from 'cookie-parser'
import { SignJWT } from 'jose'

import { auth } from './authentication.ts'
import { authConfig } from './auth/config.ts'
import { getSigningKeys, resetSigningKeysForTests } from './auth/keys.ts'
import { issueIdToken } from './auth/tokens.ts'

import type { User } from './db/models/user.ts'

const fakeUser = {
  id: 'user1',
  authSubject: 'sts|abc',
  email: 'user1@example.com',
  profileImageUrl: undefined,
} as unknown as User

function makeApp() {
  const app = express()
  app.use(cookieParser())
  app.get('/api/protected', auth(), (req, res) => {
    res.status(200).json({ sub: req.auth?.sub })
  })
  app.get('/api/optional', auth(false), (req, res) => {
    res.status(200).json({ sub: req.auth?.sub ?? null })
  })
  return app
}

describe('Authentication middleware', () => {
  beforeAll(() => {
    resetSigningKeysForTests()
  })

  it('responds with 401 when no credentials are provided', async () => {
    const response = await request(makeApp()).get('/api/protected')

    expect(response.statusCode).toBe(401)
    expect(response.body).toEqual({
      status: 401,
      msg: 'Unauthorized request.',
    })
  })

  it('responds with 401 for invalid tokens', async () => {
    const response = await request(makeApp())
      .get('/api/protected')
      .set('Cookie', ['login_token=not.a.jwt'])

    expect(response.statusCode).toBe(401)
    expect(response.body.msg).toBe('Unauthorized request.')
  })

  it('accepts a token issued by the identity service (cookie)', async () => {
    const token = await issueIdToken(fakeUser)
    const response = await request(makeApp())
      .get('/api/protected')
      .set('Cookie', [`login_token=${token}`])

    expect(response.statusCode).toBe(200)
    expect(response.body).toEqual({ sub: 'sts|abc' })
  })

  it('accepts a token in the Authorization header', async () => {
    const token = await issueIdToken(fakeUser)
    const response = await request(makeApp())
      .get('/api/protected')
      .set('Authorization', `Bearer ${token}`)

    expect(response.statusCode).toBe(200)
    expect(response.body).toEqual({ sub: 'sts|abc' })
  })

  it('responds with 401 for expired tokens', async () => {
    const { privateKey, kid } = await getSigningKeys()
    const now = Math.floor(Date.now() / 1000)
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'RS256', kid })
      .setSubject('sts|abc')
      .setIssuer(authConfig.issuer)
      .setAudience(authConfig.audience)
      .setIssuedAt(now - 7200)
      .setExpirationTime(now - 3600)
      .sign(privateKey)

    const response = await request(makeApp())
      .get('/api/protected')
      .set('Cookie', [`login_token=${token}`])

    expect(response.statusCode).toBe(401)
    expect(response.body).toEqual({
      status: 401,
      msg: 'Access token expired.',
    })
  })

  it('rejects tokens with the wrong audience', async () => {
    const { privateKey, kid } = await getSigningKeys()
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'RS256', kid })
      .setSubject('sts|abc')
      .setIssuer(authConfig.issuer)
      .setAudience('someone-else')
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(privateKey)

    const response = await request(makeApp())
      .get('/api/protected')
      .set('Cookie', [`login_token=${token}`])

    expect(response.statusCode).toBe(401)
  })

  it('allows requests without credentials when auth(false) is used', async () => {
    const response = await request(makeApp()).get('/api/optional')

    expect(response.statusCode).toBe(200)
    expect(response.body).toEqual({ sub: null })
  })

  it('treats invalid tokens as unauthenticated when auth(false) is used', async () => {
    const response = await request(makeApp())
      .get('/api/optional')
      .set('Cookie', ['login_token=garbage'])

    expect(response.statusCode).toBe(200)
    expect(response.body).toEqual({ sub: null })
  })
})
