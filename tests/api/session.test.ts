import { describe, expect, it } from 'vitest'
import { checkPassword, sessionCookie, signSession, verifySession } from '../../api/_lib/session'

const S = 'secret-abc'
const now = 1_800_000_000_000

describe('session', () => {
  it('fresh session verifies', () => {
    expect(verifySession(signSession(S, now), S, now + 1000)).toBe(true)
  })
  it('expired session (> 8 h) → false', () => {
    const c = signSession(S, now)
    expect(verifySession(c, S, now + 8 * 3600_000 - 1)).toBe(true)
    expect(verifySession(c, S, now + 8 * 3600_000 + 1)).toBe(false)
  })
  it('tampered signature → false', () => {
    const c = signSession(S, now)
    const [exp, sig] = c.split('.')
    const flipped = sig.slice(0, -1) + (sig.endsWith('A') ? 'B' : 'A')
    expect(verifySession(`${exp}.${flipped}`, S, now)).toBe(false)
  })
  it('tampered expiry → false', () => {
    const [exp, sig] = signSession(S, now).split('.')
    expect(verifySession(`${Number(exp) + 3600_000}.${sig}`, S, now)).toBe(false)
  })
  it('other secret, garbage, empty, undefined → false', () => {
    const c = signSession(S, now)
    expect(verifySession(c, 'other', now)).toBe(false)
    for (const bad of [undefined, '', 'x', '.', 'abc.def', `${now + 1000}.`]) expect(verifySession(bad, S, now)).toBe(false)
  })
  it('empty secret never verifies', () => {
    expect(verifySession(signSession('', now), '', now)).toBe(false)
  })
  it('checkPassword true / false', () => {
    expect(checkPassword('correct horse', 'correct horse')).toBe(true)
    expect(checkPassword('correct hors', 'correct horse')).toBe(false)
    expect(checkPassword('', 'correct horse')).toBe(false)
    expect(checkPassword('Correct horse', 'correct horse')).toBe(false)
  })
  it('checkPassword never accepts an empty expected password', () => {
    expect(checkPassword('', '')).toBe(false)
  })
  it('cookie attributes', () => {
    const c = sessionCookie('v')
    expect(c).toBe('cr_admin=v; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=28800')
  })
})
