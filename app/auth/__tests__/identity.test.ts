import { vi } from 'vitest'

import {
  deriveNickname,
  isValidEmail,
  isValidNickname,
  makeLocalSubject,
  makeOidcSubject,
  normalizeEmail,
} from '../identity.ts'

vi.mock('../../db/models/index.ts', () => ({ User: { findOne: vi.fn(), create: vi.fn() } }))

describe('identity helpers', () => {
  it('normalizes and validates email addresses', () => {
    expect(normalizeEmail('  Giorgi@Example.GE ')).toBe('giorgi@example.ge')
    expect(isValidEmail('giorgi@example.ge')).toBe(true)
    expect(isValidEmail('not an email')).toBe(false)
    expect(isValidEmail('')).toBe(false)
  })

  it('derives a safe username from a nickname or email', () => {
    expect(deriveNickname({ email: 'Giorgi.K@example.ge' })).toBe('giorgi-k')
    expect(deriveNickname({ nickname: 'Nino ბერიძე' })).toBe('nino')
    expect(deriveNickname({ email: 'new@example.ge' })).toBe('user') // reserved
    expect(deriveNickname({ nickname: '!!!' })).toBe('user')
    expect(deriveNickname({ nickname: 'a'.repeat(40) })).toHaveLength(24)
  })

  it('validates explicit usernames', () => {
    expect(isValidNickname('giorgi-k')).toBe(true)
    expect(isValidNickname('Giorgi')).toBe(false)
    expect(isValidNickname('gallery')).toBe(false)
    expect(isValidNickname('a')).toBe(false)
  })

  it('builds subjects for local and federated identities', () => {
    expect(makeLocalSubject()).toMatch(/^sts\|[0-9a-f-]{36}$/)
    expect(makeOidcSubject('google', '123')).toBe('oidc:google|123')
  })
})
