/**
 * STS identity service configuration.
 *
 * All values come from environment variables so that deployments never
 * contain hard-coded secrets. See `.env.example` and docs/operations.md.
 */
import { appURL } from '../lib/url.ts'

const isProduction = process.env.NODE_ENV === 'production'

function envNumber(name: string, fallback: number): number {
  const raw = process.env[name]
  if (raw === undefined || raw === '') return fallback
  const value = Number(raw)
  return Number.isFinite(value) && value > 0 ? value : fallback
}

export const authConfig = {
  isProduction,

  // Token issuer and audience, used in the `iss` and `aud` claims.
  issuer: process.env.AUTH_ISSUER || `${appURL.origin}/`,
  audience: process.env.AUTH_AUDIENCE || 'sts-street',

  // Lifetimes (seconds)
  idTokenTtl: envNumber('AUTH_ID_TOKEN_TTL', 60 * 60 * 24 * 7), // 7 days
  refreshTokenTtl: envNumber('AUTH_REFRESH_TOKEN_TTL', 60 * 60 * 24 * 90), // 90 days
  magicLinkTtl: envNumber('AUTH_MAGIC_LINK_TTL', 60 * 15), // 15 minutes
  passwordResetTtl: envNumber('AUTH_PASSWORD_RESET_TTL', 60 * 60), // 1 hour

  // Password policy
  passwordMinLength: envNumber('AUTH_PASSWORD_MIN_LENGTH', 10),
  passwordMaxLength: 256,
  maxFailedAttempts: envNumber('AUTH_MAX_FAILED_ATTEMPTS', 10),
  lockoutSeconds: envNumber('AUTH_LOCKOUT_SECONDS', 60 * 15),

  // Which sign-in methods are offered. Password sign-in is always available.
  // Magic links require a mail transport (see mailer.ts).
  passwordSignInEnabled: process.env.AUTH_PASSWORD_SIGN_IN !== 'false',
  signUpEnabled: process.env.AUTH_SIGN_UP !== 'false',

  // Cookie settings. Cookies are readable by the client bundle (the client
  // decodes the id token to schedule refreshes), matching upstream behavior.
  cookieMaxAgeMs: envNumber('AUTH_REFRESH_TOKEN_TTL', 60 * 60 * 24 * 90) * 1000,
  cookieSecure: isProduction,
} as const

export const AUTH_SUBJECT_PREFIX_LOCAL = 'sts'
export const AUTH_SUBJECT_PREFIX_OIDC = 'oidc'

export const COOKIE_LOGIN_TOKEN = 'login_token'
export const COOKIE_REFRESH_TOKEN = 'refresh_token'
export const COOKIE_USER_ID = 'user_id'

export const JUST_SIGNED_IN_PATH = '/services/auth/just-signed-in'
