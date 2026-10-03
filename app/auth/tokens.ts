/**
 * Token issuance and verification for the STS identity service.
 *
 * - ID tokens: RS256 JWTs (short-lived, stored in the `login_token` cookie).
 * - Refresh tokens, magic-link tokens and password-reset tokens: random
 *   opaque strings whose SHA-256 hash is stored in the AuthTokens table.
 */
import crypto from 'node:crypto'
import { SignJWT, jwtVerify, type JWTPayload } from 'jose'
import { Op } from 'sequelize'

import { AuthToken, type AuthTokenType } from '../db/models/authtoken.ts'
import { authConfig } from './config.ts'
import { getSigningKeys } from './keys.ts'
import type { User } from '../db/models/user.ts'

export interface IdTokenClaims extends JWTPayload {
  sub: string
  nickname?: string
  email?: string
  picture?: string
}

export async function issueIdToken(user: User): Promise<string> {
  const { privateKey, kid } = await getSigningKeys()
  const now = Math.floor(Date.now() / 1000)

  return new SignJWT({
    nickname: user.id,
    email: user.email ?? undefined,
    picture: user.profileImageUrl ?? undefined,
  })
    .setProtectedHeader({ alg: 'RS256', kid, typ: 'JWT' })
    .setSubject(user.authSubject)
    .setIssuer(authConfig.issuer)
    .setAudience(authConfig.audience)
    .setIssuedAt(now)
    .setExpirationTime(now + authConfig.idTokenTtl)
    .sign(privateKey)
}

export class TokenExpiredError extends Error {
  name = 'TokenExpiredError'
}

export class TokenInvalidError extends Error {
  name = 'TokenInvalidError'
}

export async function verifyIdToken(token: string): Promise<IdTokenClaims> {
  const { publicKey } = await getSigningKeys()
  try {
    const { payload } = await jwtVerify(token, publicKey, {
      issuer: authConfig.issuer,
      audience: authConfig.audience,
      algorithms: ['RS256'],
    })
    if (typeof payload.sub !== 'string') {
      throw new TokenInvalidError('Token has no subject')
    }
    return payload as IdTokenClaims
  } catch (err) {
    if (err instanceof TokenInvalidError) throw err
    const code = (err as { code?: string }).code
    if (code === 'ERR_JWT_EXPIRED') {
      throw new TokenExpiredError('Access token expired.')
    }
    throw new TokenInvalidError('Invalid token.')
  }
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

function generateOpaqueToken(): string {
  return crypto.randomBytes(48).toString('base64url')
}

export async function createOpaqueToken(
  type: AuthTokenType,
  userId: string | null,
  ttlSeconds: number,
  metadata: Record<string, unknown> = {}
): Promise<string> {
  const token = generateOpaqueToken()
  await AuthToken.create({
    id: crypto.randomUUID(),
    userId,
    type,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + ttlSeconds * 1000),
    metadata,
  })
  return token
}

/**
 * Finds a live (unexpired, unused, unrevoked) token record for a token value.
 */
export async function findLiveToken(
  type: AuthTokenType,
  token: string
): Promise<AuthToken | null> {
  if (typeof token !== 'string' || token.length < 16 || token.length > 256) {
    return null
  }
  const record = await AuthToken.findOne({
    where: {
      type,
      tokenHash: hashToken(token),
      usedAt: null,
      revokedAt: null,
      expiresAt: { [Op.gt]: new Date() },
    },
  })
  return record
}

/** Marks a single-use token as used. Returns false if it was already used. */
export async function consumeToken(record: AuthToken): Promise<boolean> {
  const [count] = await AuthToken.update(
    { usedAt: new Date() },
    { where: { id: record.id, usedAt: null } }
  )
  return count === 1
}

export async function revokeToken(
  type: AuthTokenType,
  token: string
): Promise<void> {
  await AuthToken.update(
    { revokedAt: new Date() },
    { where: { type, tokenHash: hashToken(token), revokedAt: null } }
  )
}

export async function revokeAllUserTokens(
  userId: string,
  type?: AuthTokenType
): Promise<void> {
  await AuthToken.update(
    { revokedAt: new Date() },
    { where: { userId, revokedAt: null, ...(type ? { type } : {}) } }
  )
}

/** Deletes expired or consumed tokens older than the given age. */
export async function pruneTokens(olderThanMs = 7 * 24 * 60 * 60 * 1000) {
  const cutoff = new Date(Date.now() - olderThanMs)
  return AuthToken.destroy({
    where: {
      [Op.or]: [
        { expiresAt: { [Op.lt]: cutoff } },
        { usedAt: { [Op.lt]: cutoff } },
        { revokedAt: { [Op.lt]: cutoff } },
      ],
    },
  })
}
