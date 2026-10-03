/**
 * STS identity service HTTP routes. Mounted at `/services/auth`.
 *
 * Sign-in methods:
 *   - Email + password (sign up, sign in, forgot/reset password)
 *   - Email magic link (passwordless), when a mail transport is configured
 *   - Federated OpenID Connect providers, when configured (see oidc.ts)
 *
 * Session contract with the client is unchanged from upstream: on success the
 * server sets `login_token`, `refresh_token` and `user_id` cookies and the
 * client continues at `/services/auth/just-signed-in`.
 */
import { Router, type Request, type Response } from 'express'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'

import { brand } from '@sts-street/branding'
import { AuthCredential, User } from '../db/models/index.ts'
import { logger } from '../lib/logger.ts'
import { appURL } from '../lib/url.ts'
import { requestIp } from '../lib/util.ts'
import { authConfig, JUST_SIGNED_IN_PATH } from './config.ts'
import {
  deriveNickname,
  findOrCreateUser,
  findUserByEmail,
  isValidEmail,
  isValidNickname,
  makeLocalSubject,
  makeOidcSubject,
  normalizeEmail,
} from './identity.ts'
import { getPublicJwks } from './keys.ts'
import {
  escapeHtml,
  isMailAvailable,
  MailUnavailableError,
  renderEmailHtml,
  sendMail,
} from './mailer.ts'
import {
  completeOidcSignIn,
  getOidcProvider,
  getOidcProviders,
  startOidcSignIn,
} from './oidc.ts'
import { checkPasswordPolicy, hashPassword, verifyPassword } from './password.ts'
import {
  clearSessionCookies,
  setLoginTokenCookie,
  signInUser,
} from './session.ts'
import {
  consumeToken,
  createOpaqueToken,
  findLiveToken,
  issueIdToken,
  revokeAllUserTokens,
  revokeToken,
} from './tokens.ts'

const router = Router()

// ---------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------
const isTest = process.env.NODE_ENV === 'test'

const credentialLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: isTest ? 1000 : 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { status: 429, msg: 'Too many attempts. Please try again later.' },
})

const emailLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: isTest ? 1000 : 8,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { status: 429, msg: 'Too many emails requested. Please try again later.' },
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const emailSchema = z
  .string()
  .trim()
  .max(254)
  .refine(isValidEmail, { message: 'Invalid email address.' })

const passwordSchema = z.string().max(authConfig.passwordMaxLength)

function badRequest(res: Response, msg: string, extra: object = {}) {
  res.status(400).json({ status: 400, msg, ...extra })
}

function sessionMetadata(req: Request) {
  return {
    ip: requestIp(req),
    userAgent: (req.headers['user-agent'] ?? '').slice(0, 200),
  }
}

async function sendMagicLink(user: User, email: string): Promise<void> {
  const token = await createOpaqueToken('magic_link', user.id, authConfig.magicLinkTtl)
  const link = `${appURL.origin}/services/auth/email/callback?token=${encodeURIComponent(token)}`
  const minutes = Math.round(authConfig.magicLinkTtl / 60)
  await sendMail({
    to: email,
    subject: `Sign in to ${brand.productName}`,
    text: `Use this link to sign in to ${brand.productName}:\n\n${link}\n\nThe link expires in ${minutes} minutes. If you did not request it, you can ignore this email.`,
    html: renderEmailHtml(
      `Sign in to ${brand.productName}`,
      `<p>Use the button below to sign in. The link expires in ${minutes} minutes.</p>
       <p style="margin:24px 0;"><a href="${escapeHtml(link)}" style="background:${brand.themeColor};color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;display:inline-block;">Sign in to ${escapeHtml(brand.productName)}</a></p>
       <p style="font-size:12px;color:#5b6b7c;">If the button does not work, copy this address into your browser:<br>${escapeHtml(link)}</p>
       <p style="font-size:12px;color:#5b6b7c;">If you did not request this email, you can ignore it.</p>`
    ),
  })
}

// ---------------------------------------------------------------------------
// Discovery
// ---------------------------------------------------------------------------

/** Public description of the sign-in methods currently available. */
router.get('/config', (_req, res) => {
  res.json({
    password: authConfig.passwordSignInEnabled,
    signUp: authConfig.signUpEnabled && authConfig.passwordSignInEnabled,
    magicLink: isMailAvailable(),
    passwordReset: isMailAvailable(),
    passwordMinLength: authConfig.passwordMinLength,
    providers: getOidcProviders().map(({ key, label }) => ({ key, label })),
  })
})

router.get('/jwks', async (_req, res) => {
  res.set('Cache-Control', 'public, max-age=3600')
  res.json(await getPublicJwks())
})

// Callback route after signing in. The client bundle handles this URL.
router.get('/just-signed-in', (_req, res) => res.render('main'))
router.get('/just-signed-in/', (_req, res) => res.render('main'))

// ---------------------------------------------------------------------------
// Email + password
// ---------------------------------------------------------------------------

const signUpSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  nickname: z.string().trim().max(24).optional(),
})

router.post('/signup', credentialLimiter, async (req, res) => {
  if (!authConfig.passwordSignInEnabled || !authConfig.signUpEnabled) {
    res.status(403).json({ status: 403, msg: 'Sign-up is disabled.' })
    return
  }

  const parsed = signUpSchema.safeParse(req.body ?? {})
  if (!parsed.success) {
    badRequest(res, 'Invalid request.', {
      errors: z.flattenError(parsed.error).fieldErrors,
    })
    return
  }

  const { password, nickname } = parsed.data
  const email = normalizeEmail(parsed.data.email)

  const policy = checkPasswordPolicy(password)
  if (!policy.ok) {
    badRequest(res, 'Password does not meet the requirements.', {
      code: `password_${policy.reason}`,
      passwordMinLength: authConfig.passwordMinLength,
    })
    return
  }

  if (nickname && !isValidNickname(nickname)) {
    badRequest(res, 'Username may contain lowercase letters, numbers, "-" and "_" (2-24 characters).', {
      code: 'nickname_invalid',
    })
    return
  }

  const existing = await findUserByEmail(email)
  if (existing) {
    res.status(409).json({
      status: 409,
      msg: 'An account with this email already exists. Please sign in.',
      code: 'email_taken',
    })
    return
  }

  if (nickname) {
    const taken = await User.findOne({ where: { id: nickname } })
    if (taken) {
      res.status(409).json({
        status: 409,
        msg: 'This username is already taken.',
        code: 'nickname_taken',
      })
      return
    }
  }

  try {
    const { user } = await findOrCreateUser({
      subject: makeLocalSubject(),
      email,
      nickname: nickname || deriveNickname({ email }),
    })
    await AuthCredential.create({
      userId: user.id,
      passwordHash: await hashPassword(password),
      passwordUpdatedAt: new Date(),
    })
    await signInUser(res, user, sessionMetadata(req))
    res.status(201).json({ id: user.id, redirect: JUST_SIGNED_IN_PATH })
  } catch (err) {
    logger.error(err)
    res.status(500).json({ status: 500, msg: 'Could not create account.' })
  }
})

const loginSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
})

router.post('/login', credentialLimiter, async (req, res) => {
  if (!authConfig.passwordSignInEnabled) {
    res.status(403).json({ status: 403, msg: 'Password sign-in is disabled.' })
    return
  }

  const parsed = loginSchema.safeParse(req.body ?? {})
  if (!parsed.success) {
    badRequest(res, 'Invalid request.')
    return
  }

  const email = normalizeEmail(parsed.data.email)
  const invalid = () =>
    res.status(401).json({
      status: 401,
      msg: 'Incorrect email or password.',
      code: 'invalid_credentials',
    })

  try {
    const user = await findUserByEmail(email)
    const credential = user
      ? await AuthCredential.findOne({ where: { userId: user.id } })
      : null

    if (!user || !credential) {
      // Perform a dummy verification to keep timing comparable.
      await verifyPassword(parsed.data.password, 'scrypt$32768$8$1$AAAAAAAAAAAAAAAAAAAAAA$' + 'A'.repeat(86))
      invalid()
      return
    }

    if (credential.lockedUntil && credential.lockedUntil > new Date()) {
      res.status(423).json({
        status: 423,
        msg: 'Too many failed attempts. This account is temporarily locked.',
        code: 'locked',
      })
      return
    }

    const ok = await verifyPassword(parsed.data.password, credential.passwordHash)
    if (!ok) {
      const attempts = credential.failedAttempts + 1
      const lock = attempts >= authConfig.maxFailedAttempts
      await credential.update({
        failedAttempts: lock ? 0 : attempts,
        lockedUntil: lock
          ? new Date(Date.now() + authConfig.lockoutSeconds * 1000)
          : null,
      })
      invalid()
      return
    }

    if (credential.failedAttempts > 0 || credential.lockedUntil) {
      await credential.update({ failedAttempts: 0, lockedUntil: null })
    }

    await signInUser(res, user, sessionMetadata(req))
    res.status(200).json({ id: user.id, redirect: JUST_SIGNED_IN_PATH })
  } catch (err) {
    logger.error(err)
    res.status(500).json({ status: 500, msg: 'Could not sign in.' })
  }
})

router.post('/password/forgot', emailLimiter, async (req, res) => {
  const parsed = z.object({ email: emailSchema }).safeParse(req.body ?? {})
  if (!parsed.success) {
    badRequest(res, 'Invalid email address.')
    return
  }
  if (!isMailAvailable()) {
    res.status(503).json({
      status: 503,
      msg: 'Email delivery is not configured on this server.',
      code: 'mail_unavailable',
    })
    return
  }

  const email = normalizeEmail(parsed.data.email)
  try {
    const user = await findUserByEmail(email)
    // Always respond 202 so that the endpoint does not reveal whether an
    // account exists.
    if (user) {
      const credential = await AuthCredential.findOne({ where: { userId: user.id } })
      if (credential) {
        const token = await createOpaqueToken(
          'password_reset',
          user.id,
          authConfig.passwordResetTtl
        )
        const link = `${appURL.origin}/reset-password?token=${encodeURIComponent(token)}`
        await sendMail({
          to: email,
          subject: `Reset your ${brand.productName} password`,
          text: `Use this link to choose a new password:\n\n${link}\n\nIf you did not request a password reset, you can ignore this email.`,
          html: renderEmailHtml(
            'Reset your password',
            `<p>Use the button below to choose a new password.</p>
             <p style="margin:24px 0;"><a href="${escapeHtml(link)}" style="background:${brand.themeColor};color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;display:inline-block;">Choose a new password</a></p>
             <p style="font-size:12px;color:#5b6b7c;">If you did not request a password reset, you can ignore this email.</p>`
          ),
        })
      }
    }
    res.status(202).json({ status: 202, msg: 'If an account exists, an email has been sent.' })
  } catch (err) {
    if (err instanceof MailUnavailableError) {
      res.status(503).json({ status: 503, msg: err.message, code: 'mail_unavailable' })
      return
    }
    logger.error(err)
    res.status(500).json({ status: 500, msg: 'Could not process request.' })
  }
})

router.post('/password/reset', credentialLimiter, async (req, res) => {
  const parsed = z
    .object({ token: z.string().min(16).max(256), password: passwordSchema })
    .safeParse(req.body ?? {})
  if (!parsed.success) {
    badRequest(res, 'Invalid request.')
    return
  }

  const policy = checkPasswordPolicy(parsed.data.password)
  if (!policy.ok) {
    badRequest(res, 'Password does not meet the requirements.', {
      code: `password_${policy.reason}`,
      passwordMinLength: authConfig.passwordMinLength,
    })
    return
  }

  try {
    const record = await findLiveToken('password_reset', parsed.data.token)
    if (!record || !record.userId || !(await consumeToken(record))) {
      res.status(400).json({
        status: 400,
        msg: 'This password reset link is invalid or has expired.',
        code: 'token_invalid',
      })
      return
    }

    const user = await User.findOne({ where: { id: record.userId } })
    if (!user) {
      res.status(400).json({ status: 400, msg: 'Account not found.' })
      return
    }

    const passwordHash = await hashPassword(parsed.data.password)
    const [count] = await AuthCredential.update(
      { passwordHash, passwordUpdatedAt: new Date(), failedAttempts: 0, lockedUntil: null },
      { where: { userId: user.id } }
    )
    if (count === 0) {
      await AuthCredential.create({ userId: user.id, passwordHash, passwordUpdatedAt: new Date() })
    }
    // Changing the password signs out all other sessions.
    await revokeAllUserTokens(user.id, 'refresh')
    await signInUser(res, user, sessionMetadata(req))
    res.status(200).json({ id: user.id, redirect: JUST_SIGNED_IN_PATH })
  } catch (err) {
    logger.error(err)
    res.status(500).json({ status: 500, msg: 'Could not reset password.' })
  }
})

// ---------------------------------------------------------------------------
// Email magic link
// ---------------------------------------------------------------------------

router.post('/email/start', emailLimiter, async (req, res) => {
  const parsed = z.object({ email: emailSchema }).safeParse(req.body ?? {})
  if (!parsed.success) {
    badRequest(res, 'Invalid email address.', { code: 'email_invalid' })
    return
  }
  if (!isMailAvailable()) {
    res.status(503).json({
      status: 503,
      msg: 'Email sign-in is not available on this server.',
      code: 'mail_unavailable',
    })
    return
  }

  const email = normalizeEmail(parsed.data.email)
  try {
    let user = await findUserByEmail(email)
    if (!user) {
      if (!authConfig.signUpEnabled) {
        // Respond as if sent, to avoid account enumeration.
        res.status(202).json({ status: 202, msg: 'Email sent.' })
        return
      }
      const result = await findOrCreateUser({
        subject: makeLocalSubject(),
        email,
        nickname: deriveNickname({ email }),
      })
      user = result.user
    }
    await sendMagicLink(user, email)
    res.status(202).json({ status: 202, msg: 'Email sent.' })
  } catch (err) {
    if (err instanceof MailUnavailableError) {
      res.status(503).json({ status: 503, msg: err.message, code: 'mail_unavailable' })
      return
    }
    logger.error(err)
    res.status(500).json({ status: 500, msg: 'Could not send sign-in email.' })
  }
})

router.get('/email/callback', async (req, res) => {
  const token = typeof req.query.token === 'string' ? req.query.token : ''
  try {
    const record = token ? await findLiveToken('magic_link', token) : null
    if (!record || !record.userId || !(await consumeToken(record))) {
      res.redirect('/error/sign-in-link-expired')
      return
    }
    const user = await User.findOne({ where: { id: record.userId } })
    if (!user) {
      res.redirect('/error/access-denied')
      return
    }
    await signInUser(res, user, sessionMetadata(req))
    res.redirect(JUST_SIGNED_IN_PATH)
  } catch (err) {
    logger.error(err)
    res.redirect('/error/authentication-api-problem')
  }
})

// ---------------------------------------------------------------------------
// Federated OpenID Connect
// ---------------------------------------------------------------------------

router.get('/oidc/:provider', async (req, res) => {
  const provider = getOidcProvider(String(req.params.provider))
  if (!provider) {
    res.status(404).json({ status: 404, msg: 'Unknown sign-in provider.' })
    return
  }
  try {
    const start = await startOidcSignIn(provider)
    req.session = req.session ?? {}
    req.session.oidc = {
      provider: provider.key,
      state: start.state,
      codeVerifier: start.codeVerifier,
      nonce: start.nonce,
    }
    res.redirect(start.url)
  } catch (err) {
    logger.error(`[auth] OIDC start failed for ${provider.key}: ${err}`)
    res.redirect('/error/authentication-api-problem')
  }
})

router.get('/oidc/:provider/callback', async (req, res) => {
  const provider = getOidcProvider(String(req.params.provider))
  const pending = req.session?.oidc
  if (!provider || !pending || pending.provider !== provider.key) {
    res.redirect('/error/access-denied')
    return
  }
  if (req.session) req.session.oidc = null

  if (typeof req.query.error === 'string') {
    logger.error(`[auth] OIDC provider error: ${req.query.error}`)
    res.redirect('/error/access-denied')
    return
  }

  try {
    const currentUrl = new URL(req.originalUrl, appURL.origin)
    const claims = await completeOidcSignIn(provider, currentUrl, pending)
    const { user } = await findOrCreateUser({
      subject: makeOidcSubject(provider.key, claims.sub),
      email: claims.emailVerified ? claims.email : undefined,
      nickname: claims.preferredUsername ?? claims.email ?? undefined,
      displayName: claims.name ?? undefined,
      profileImageUrl: claims.picture ?? undefined,
    })
    await signInUser(res, user, { ...sessionMetadata(req), provider: provider.key })
    res.redirect(JUST_SIGNED_IN_PATH)
  } catch (err) {
    logger.error(`[auth] OIDC callback failed for ${provider.key}: ${err}`)
    res.redirect('/error/no-access-token')
  }
})

// ---------------------------------------------------------------------------
// Token refresh and sign-out
// ---------------------------------------------------------------------------

router.post('/refresh-login-token', credentialLimiter, async (req, res) => {
  const token = req.body?.token
  if (typeof token !== 'string' || !token) {
    res.status(401).json({ status: 401, msg: 'Refresh token is required.' })
    return
  }

  try {
    const record = await findLiveToken('refresh', token)
    if (!record || !record.userId) {
      res.status(401).json({ status: 401, msg: 'Unable to refresh token.' })
      return
    }
    const user = await User.findOne({ where: { id: record.userId } })
    if (!user) {
      res.status(401).json({ status: 401, msg: 'Unable to refresh token.' })
      return
    }
    const idToken = await issueIdToken(user)
    setLoginTokenCookie(res, idToken)
    res.status(200).json({ token: idToken })
  } catch (err) {
    logger.error(err)
    res.status(401).json({ status: 401, msg: 'Unable to refresh token.' })
  }
})

router.post('/logout', async (req, res) => {
  const refreshToken = req.cookies?.refresh_token
  try {
    if (typeof refreshToken === 'string' && refreshToken) {
      await revokeToken('refresh', refreshToken)
    }
  } catch (err) {
    logger.error(err)
  }
  clearSessionCookies(res)
  res.status(204).end()
})

export default router
