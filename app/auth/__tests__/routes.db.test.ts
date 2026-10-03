/**
 * Database-backed integration tests for the STS identity service.
 * Requires PostgreSQL (NODE_ENV=test, .env.test) with migrations applied.
 * Skipped unless PG_INTEGRATION=true so that the unit suite stays hermetic.
 */
import fs from 'node:fs/promises'
import express from 'express'
import cookieParser from 'cookie-parser'
import request from 'supertest'

const enabled = process.env.PG_INTEGRATION === 'true'

describe.skipIf(!enabled)('identity service (database)', () => {
  let app: express.Express
  let agent: ReturnType<typeof request.agent>
  const email = `it-${Date.now()}@example.com`
  const password = 'integration test passphrase'
  let userId: string

  beforeAll(async () => {
    const { default: authRoutes } = await import('../routes.ts')
    const { auth } = await import('../../authentication.ts')
    app = express()
    app.use(express.json())
    app.use(cookieParser())
    app.use('/services/auth', authRoutes)
    app.get('/whoami', auth(), (req, res) => {
      res.json({ sub: req.auth?.sub })
    })
    agent = request.agent(app)
  })

  afterAll(async () => {
    const { User } = await import('../../db/models/index.ts')
    await User.destroy({ where: { email } })
    const { sequelize } = await import('../../db/db.ts')
    await sequelize.close()
  })

  it('signs up with email and password and sets session cookies', async () => {
    const res = await agent
      .post('/services/auth/signup')
      .send({ email, password, nickname: `it-${Date.now() % 100000}` })
    expect(res.status).toBe(201)
    userId = res.body.id
    const cookies = res.headers['set-cookie'].join(';')
    expect(cookies).toMatch(/login_token=/)
    expect(cookies).toMatch(/refresh_token=/)
    expect(cookies).toMatch(/user_id=/)
  })

  it('authenticates API requests with the issued cookie', async () => {
    const res = await agent.get('/whoami')
    expect(res.status).toBe(200)
    expect(res.body.sub).toMatch(/^sts\|/)
  })

  it('rejects a wrong password without revealing the account', async () => {
    const res = await request(app)
      .post('/services/auth/login')
      .send({ email, password: 'definitely wrong password' })
    expect(res.status).toBe(401)
    expect(res.body.code).toBe('invalid_credentials')
    const unknown = await request(app)
      .post('/services/auth/login')
      .send({ email: 'nobody@example.com', password: 'definitely wrong password' })
    expect(unknown.status).toBe(401)
    expect(unknown.body.code).toBe('invalid_credentials')
  })

  it('refreshes the id token with the refresh token and revokes it on logout', async () => {
    const login = await request(app).post('/services/auth/login').send({ email, password })
    expect(login.status).toBe(200)
    const refreshToken = login.headers['set-cookie']
      .map((c: string) => c.match(/^refresh_token=([^;]+)/)?.[1])
      .find(Boolean)
    expect(refreshToken).toBeTruthy()

    const refreshed = await request(app)
      .post('/services/auth/refresh-login-token')
      .send({ token: refreshToken })
    expect(refreshed.status).toBe(200)
    expect(refreshed.body.token).toMatch(/^eyJ/)

    const logout = await request(app)
      .post('/services/auth/logout')
      .set('Cookie', [`refresh_token=${refreshToken}`])
    expect(logout.status).toBe(204)

    const again = await request(app)
      .post('/services/auth/refresh-login-token')
      .send({ token: refreshToken })
    expect(again.status).toBe(401)
  })

  it('sends a magic link to the outbox and signs in through it once', async () => {
    const start = await request(app).post('/services/auth/email/start').send({ email })
    expect(start.status).toBe(202)

    const dir = process.env.MAIL_OUTBOX_DIR ?? './data/mail-outbox'
    const files = (await fs.readdir(dir)).filter((f) => f.endsWith('.json')).sort().reverse()
    let link: string | undefined
    for (const file of files) {
      const mail = JSON.parse(await fs.readFile(`${dir}/${file}`, 'utf8'))
      if (mail.to === email) {
        link = mail.text.match(/\/services\/auth\/email\/callback\?token=[^\s]+/)?.[0]
        break
      }
    }
    expect(link).toBeTruthy()

    const callback = await request(app).get(link as string)
    expect(callback.status).toBe(302)
    expect(callback.headers.location).toBe('/services/auth/just-signed-in')
    expect(callback.headers['set-cookie'].join(';')).toMatch(/login_token=/)

    // Single use
    const reuse = await request(app).get(link as string)
    expect(reuse.status).toBe(302)
    expect(reuse.headers.location).toBe('/error/sign-in-link-expired')
  })

  it('resets the password through an emailed token', async () => {
    const forgot = await request(app).post('/services/auth/password/forgot').send({ email })
    expect(forgot.status).toBe(202)
    const dir = process.env.MAIL_OUTBOX_DIR ?? './data/mail-outbox'
    const files = (await fs.readdir(dir)).filter((f) => f.endsWith('.json')).sort().reverse()
    let token: string | undefined
    for (const file of files) {
      const mail = JSON.parse(await fs.readFile(`${dir}/${file}`, 'utf8'))
      if (mail.to === email && /reset-password/.test(mail.text)) {
        token = decodeURIComponent(mail.text.match(/token=([^\s]+)/)?.[1] ?? '')
        break
      }
    }
    expect(token).toBeTruthy()
    const reset = await request(app)
      .post('/services/auth/password/reset')
      .send({ token, password: 'a brand new passphrase' })
    expect(reset.status).toBe(200)
    expect(reset.body.id).toBe(userId)

    const oldLogin = await request(app).post('/services/auth/login').send({ email, password })
    expect(oldLogin.status).toBe(401)
    const newLogin = await request(app).post('/services/auth/login').send({ email, password: 'a brand new passphrase' })
    expect(newLogin.status).toBe(200)
  })
})
