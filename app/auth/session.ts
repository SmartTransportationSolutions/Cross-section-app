/**
 * Session cookies for the STS identity service.
 *
 * Cookie contract (unchanged from upstream so the client keeps working):
 *   login_token   — RS256 id token (JWT)
 *   refresh_token — opaque refresh token
 *   user_id       — public username
 */
import {
  authConfig,
  COOKIE_LOGIN_TOKEN,
  COOKIE_REFRESH_TOKEN,
  COOKIE_USER_ID,
} from './config.ts'
import { createOpaqueToken, issueIdToken } from './tokens.ts'
import type { Response } from 'express'

import type { User } from '../db/models/user.ts'

export interface SessionTokens {
  idToken: string
  refreshToken: string
}

function cookieOptions() {
  return {
    maxAge: authConfig.cookieMaxAgeMs,
    sameSite: 'strict' as const,
    secure: authConfig.cookieSecure,
    path: '/',
  }
}

export async function createSessionTokens(
  user: User,
  metadata: Record<string, unknown> = {}
): Promise<SessionTokens> {
  const idToken = await issueIdToken(user)
  const refreshToken = await createOpaqueToken(
    'refresh',
    user.id,
    authConfig.refreshTokenTtl,
    metadata
  )
  return { idToken, refreshToken }
}

export function setSessionCookies(
  res: Response,
  user: User,
  tokens: SessionTokens
): void {
  const options = cookieOptions()
  res.cookie(COOKIE_USER_ID, user.id, options)
  res.cookie(COOKIE_REFRESH_TOKEN, tokens.refreshToken, options)
  res.cookie(COOKIE_LOGIN_TOKEN, tokens.idToken, options)
}

export function setLoginTokenCookie(res: Response, idToken: string): void {
  res.cookie(COOKIE_LOGIN_TOKEN, idToken, cookieOptions())
}

export function clearSessionCookies(res: Response): void {
  const options = { ...cookieOptions(), maxAge: 0 }
  res.cookie(COOKIE_USER_ID, '', options)
  res.cookie(COOKIE_REFRESH_TOKEN, '', options)
  res.cookie(COOKIE_LOGIN_TOKEN, '', options)
  // Legacy cookie name from upstream
  res.cookie('access_token', '', options)
}

/** Signs the user in: issues tokens and sets cookies. */
export async function signInUser(
  res: Response,
  user: User,
  metadata: Record<string, unknown> = {}
): Promise<SessionTokens> {
  const tokens = await createSessionTokens(user, metadata)
  setSessionCookies(res, user, tokens)
  return tokens
}
