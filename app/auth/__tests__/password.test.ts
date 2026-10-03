import { checkPasswordPolicy, hashPassword, verifyPassword } from '../password.ts'

describe('password hashing', () => {
  it('hashes and verifies a password with scrypt', async () => {
    const hash = await hashPassword('correct horse battery staple')
    expect(hash.startsWith('scrypt$')).toBe(true)
    expect(await verifyPassword('correct horse battery staple', hash)).toBe(true)
    expect(await verifyPassword('wrong password', hash)).toBe(false)
  })

  it('produces different hashes for the same password (random salt)', async () => {
    const a = await hashPassword('same password here')
    const b = await hashPassword('same password here')
    expect(a).not.toEqual(b)
  })

  it('rejects malformed stored hashes', async () => {
    expect(await verifyPassword('x', 'not-a-hash')).toBe(false)
    expect(await verifyPassword('x', 'scrypt$1$2$3$AAAA$BBBB')).toBe(false)
  })
})

describe('password policy', () => {
  it('enforces the minimum length', () => {
    expect(checkPasswordPolicy('short')).toEqual({ ok: false, reason: 'too_short' })
    expect(checkPasswordPolicy('long enough password')).toEqual({ ok: true })
  })

  it('rejects very common passwords', () => {
    expect(checkPasswordPolicy('password123')).toEqual({ ok: false, reason: 'too_common' })
  })

  it('rejects absurdly long passwords', () => {
    expect(checkPasswordPolicy('a'.repeat(300))).toEqual({ ok: false, reason: 'too_long' })
  })
})
