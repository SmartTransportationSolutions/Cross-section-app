/**
 * Password hashing for the STS identity service.
 *
 * Uses Node's built-in scrypt (no native dependencies). Hash format:
 *   scrypt$N$r$p$<salt base64url>$<hash base64url>
 */
import crypto from 'node:crypto'

import { authConfig } from './config.ts'

const SCRYPT_N = 1 << 15
const SCRYPT_R = 8
const SCRYPT_P = 1
const KEY_LENGTH = 64
const SALT_LENGTH = 16

function scryptAsync(
  password: string,
  salt: Buffer,
  N: number,
  r: number,
  p: number
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    crypto.scrypt(
      password.normalize('NFKC'),
      salt,
      KEY_LENGTH,
      { N, r, p, maxmem: 128 * N * r * 2 },
      (err, derivedKey) => {
        if (err) reject(err)
        else resolve(derivedKey)
      }
    )
  })
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(SALT_LENGTH)
  const hash = await scryptAsync(password, salt, SCRYPT_N, SCRYPT_R, SCRYPT_P)
  return [
    'scrypt',
    SCRYPT_N,
    SCRYPT_R,
    SCRYPT_P,
    salt.toString('base64url'),
    hash.toString('base64url'),
  ].join('$')
}

export async function verifyPassword(
  password: string,
  stored: string
): Promise<boolean> {
  const parts = stored.split('$')
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false
  const N = Number(parts[1])
  const r = Number(parts[2])
  const p = Number(parts[3])
  const salt = Buffer.from(parts[4], 'base64url')
  const expected = Buffer.from(parts[5], 'base64url')
  if (![N, r, p].every(Number.isFinite) || expected.length !== KEY_LENGTH) {
    return false
  }
  const actual = await scryptAsync(password, salt, N, r, p)
  return crypto.timingSafeEqual(actual, expected)
}

export interface PasswordPolicyResult {
  ok: boolean
  reason?: 'too_short' | 'too_long' | 'too_common'
}

// A tiny deny list of the most common passwords. Not exhaustive; length is
// the primary defense.
const COMMON_PASSWORDS = new Set([
  'password',
  'password1',
  'password123',
  '1234567890',
  'qwertyuiop',
  '1q2w3e4r5t',
  'iloveyou123',
  'letmein123',
  'stsstreet123',
  'streetmix123',
])

export function checkPasswordPolicy(password: string): PasswordPolicyResult {
  if (typeof password !== 'string') return { ok: false, reason: 'too_short' }
  if (password.length < authConfig.passwordMinLength) {
    return { ok: false, reason: 'too_short' }
  }
  if (password.length > authConfig.passwordMaxLength) {
    return { ok: false, reason: 'too_long' }
  }
  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    return { ok: false, reason: 'too_common' }
  }
  return { ok: true }
}
