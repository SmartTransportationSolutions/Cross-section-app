import { getPublicJwks, getSigningKeys, resetSigningKeysForTests } from '../keys.ts'
import { issueIdToken, verifyIdToken, hashToken } from '../tokens.ts'

import type { User } from '../../db/models/user.ts'

describe('signing keys and id tokens', () => {
  beforeAll(() => resetSigningKeysForTests())

  it('generates an ephemeral key outside production and publishes a JWKS', async () => {
    const { kid } = await getSigningKeys()
    const jwks = await getPublicJwks()
    expect(jwks.keys).toHaveLength(1)
    expect(jwks.keys[0].kid).toBe(kid)
    expect(jwks.keys[0].alg).toBe('RS256')
    expect(jwks.keys[0]).not.toHaveProperty('d') // private material never exposed
  })

  it('issues tokens that verify with the expected claims', async () => {
    const user = { id: 'nino', authSubject: 'sts|abc', email: 'nino@example.ge' } as unknown as User
    const token = await issueIdToken(user)
    const claims = await verifyIdToken(token)
    expect(claims.sub).toBe('sts|abc')
    expect(claims.nickname).toBe('nino')
    expect(claims.email).toBe('nino@example.ge')
    expect(claims.exp! - claims.iat!).toBe(60 * 60 * 24 * 7)
  })

  it('hashes opaque tokens deterministically', () => {
    expect(hashToken('abc')).toBe(hashToken('abc'))
    expect(hashToken('abc')).toHaveLength(64)
  })
})
