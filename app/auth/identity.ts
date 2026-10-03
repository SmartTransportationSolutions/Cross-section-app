/**
 * Identity resolution: maps an authenticated identity (local account or
 * federated OIDC identity) to a User row, creating one if necessary.
 *
 * Ported from the upstream `POST /api/v1/users` handler, which created users
 * from Auth0 profile data. STS Street does this in-process instead of via an
 * HTTP call to its own API, and the public user-creation endpoint is removed.
 */
import crypto from 'node:crypto'

import { User } from '../db/models/index.ts'
import { logger } from '../lib/logger.ts'
import { AUTH_SUBJECT_PREFIX_LOCAL, AUTH_SUBJECT_PREFIX_OIDC } from './config.ts'

export interface ExternalIdentity {
  subject: string // Full subject string, e.g. `sts|<uuid>` or `oidc:google|<sub>`
  email?: string | null
  nickname?: string | null
  displayName?: string | null
  profileImageUrl?: string | null
}

const RESERVED_IDS = new Set([
  'new',
  'gallery',
  'error',
  'help',
  'services',
  'streets',
  'api',
  'docs',
  'source',
  'map',
  'survey',
  'admin',
  'sts',
  'terms-of-service',
  'privacy-policy',
  'survey-finished',
])

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function isValidEmail(email: unknown): email is string {
  if (typeof email !== 'string') return false
  const value = email.trim()
  if (value.length < 3 || value.length > 254) return false
  // Pragmatic check; the authoritative validation is message delivery.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export function makeLocalSubject(): string {
  return `${AUTH_SUBJECT_PREFIX_LOCAL}|${crypto.randomUUID()}`
}

export function makeOidcSubject(provider: string, sub: string): string {
  return `${AUTH_SUBJECT_PREFIX_OIDC}:${provider}|${sub}`
}

/**
 * User IDs are public usernames (they appear in street URLs). Derive a
 * candidate from the requested nickname or the email local part.
 */
export function deriveNickname(input: {
  nickname?: string | null
  email?: string | null
}): string {
  let candidate = (input.nickname ?? '').trim()
  if (!candidate && input.email) {
    candidate = input.email.split('@')[0]
  }
  candidate = candidate
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24)
  if (!candidate || RESERVED_IDS.has(candidate)) {
    candidate = 'user'
  }
  return candidate
}

export function isValidNickname(nickname: unknown): nickname is string {
  return (
    typeof nickname === 'string' &&
    /^[a-z0-9][a-z0-9_-]{1,23}$/.test(nickname) &&
    !RESERVED_IDS.has(nickname)
  )
}

function randomSuffix(): string {
  return Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, '0')
}

async function pickAvailableId(base: string): Promise<string> {
  const existing = await User.findOne({ where: { id: base } })
  if (!existing) return base
  for (let i = 0; i < 20; i++) {
    const candidate = `${base}-${randomSuffix()}`
    const taken = await User.findOne({ where: { id: candidate } })
    if (!taken) return candidate
  }
  return `${base}-${crypto.randomUUID().slice(0, 8)}`
}

export async function findUserBySubject(subject: string): Promise<User | null> {
  return User.findOne({ where: { authSubject: subject } })
}

export async function findUserByEmail(email: string): Promise<User | null> {
  return User.findOne({ where: { email: normalizeEmail(email) } })
}

/**
 * Finds the user for an identity, or creates a new one.
 * Returns the user and whether it was newly created.
 */
export async function findOrCreateUser(
  identity: ExternalIdentity
): Promise<{ user: User; created: boolean }> {
  const existing = await findUserBySubject(identity.subject)

  if (existing) {
    const updates: Partial<{
      email: string
      profileImageUrl: string
    }> = {}
    if (identity.email && !existing.email) {
      updates.email = normalizeEmail(identity.email)
    }
    if (identity.profileImageUrl && identity.profileImageUrl !== existing.profileImageUrl) {
      updates.profileImageUrl = identity.profileImageUrl
    }
    if (Object.keys(updates).length > 0) {
      await existing.update(updates)
    }
    logger.info(`[auth] Existing user '${existing.id}' signed in.`)
    return { user: existing, created: false }
  }

  // Federated identities may match an existing account by verified email.
  if (identity.email) {
    const byEmail = await findUserByEmail(identity.email)
    if (byEmail && !byEmail.authSubject) {
      await byEmail.update({ authSubject: identity.subject })
      return { user: byEmail, created: false }
    }
  }

  const id = await pickAvailableId(deriveNickname(identity))
  const user = await User.create({
    id,
    authSubject: identity.subject,
    email: identity.email ? normalizeEmail(identity.email) : undefined,
    displayName: identity.displayName?.slice(0, 30) || undefined,
    profileImageUrl: identity.profileImageUrl || undefined,
    roles: ['USER'],
  })
  logger.info(`[auth] New user '${user.id}' created.`)
  return { user, created: true }
}
