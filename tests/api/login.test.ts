import { describe, expect, it } from 'vitest'
import { createLogin } from '../../api/login'
import { verifySession } from '../../api/_lib/session'
import { ENV, NOW, SECRET, expectAdminHeaders } from './helpers'

function setup(env: Record<string, string | undefined> = ENV) {
  let now = NOW
  const sleeps: number[] = []
  const handler = createLogin({ env, now: () => now, sleep: async (ms) => { sleeps.push(ms); now += ms } })
  return { handler, sleeps, advance: (ms: number) => (now += ms) }
}
const req = (password: unknown, ip = '1.2.3.4') =>
  new Request('https://x.test/api/login', { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': `${ip}, 10.0.0.1` }, body: JSON.stringify({ password }) })

describe('POST /api/login', () => {
  it('good password → 204 + signed session cookie', async () => {
    const { handler, sleeps } = setup()
    const res = await handler(req('correct horse'))
    expect(res.status).toBe(204)
    expectAdminHeaders(res)
    const cookie = res.headers.get('set-cookie')!
    expect(cookie).toMatch(/^cr_admin=[^;]+; HttpOnly; Secure; SameSite=Strict; Path=\/; Max-Age=28800$/)
    expect(verifySession(cookie.split(';')[0].slice('cr_admin='.length), SECRET, NOW)).toBe(true)
    expect(sleeps).toEqual([])
  })

  it('wrong password → 401 after a delay, no cookie', async () => {
    const { handler, sleeps } = setup()
    const res = await handler(req('nope'))
    expect(res.status).toBe(401)
    expectAdminHeaders(res)
    expect(res.headers.get('set-cookie')).toBeNull()
    expect(sleeps).toEqual([2000])
  })

  it('delay doubles per failure from the same IP, capped at 30 s', async () => {
    const { handler, sleeps } = setup()
    for (let i = 0; i < 6; i++) expect((await handler(req('nope'))).status).toBe(401)
    expect(sleeps).toEqual([2000, 4000, 8000, 16000, 30000, 30000])
  })

  it('counter is per IP (first x-forwarded-for entry)', async () => {
    const { handler, sleeps } = setup()
    await handler(req('nope', '1.1.1.1'))
    await handler(req('nope', '1.1.1.1'))
    await handler(req('nope', '2.2.2.2'))
    expect(sleeps).toEqual([2000, 4000, 2000])
  })

  it('attempt during the lockout → 429 without checking the password', async () => {
    let now = NOW
    // sleep does not advance the clock: simulates a parallel request arriving during the delay
    const handler = createLogin({ env: ENV, now: () => now, sleep: async () => {} })
    expect((await handler(req('nope'))).status).toBe(401)
    const res = await handler(req('correct horse'))
    expect(res.status).toBe(429)
    expectAdminHeaders(res)
    expect(res.headers.get('retry-after')).toBe('2')
    now += 2000
    expect((await handler(req('correct horse'))).status).toBe(204)
  })

  it('success resets the counter', async () => {
    const { handler, sleeps } = setup()
    await handler(req('nope'))
    await handler(req('correct horse'))
    await handler(req('nope'))
    expect(sleeps).toEqual([2000, 2000])
  })

  it.each([
    ['ADMIN_PASSWORD missing', { ...ENV, ADMIN_PASSWORD: undefined }],
    ['ADMIN_PASSWORD empty', { ...ENV, ADMIN_PASSWORD: '' }],
    ['ADMIN_SESSION_SECRET missing', { ...ENV, ADMIN_SESSION_SECRET: undefined }],
  ])('%s → 503, never logs in (even with empty password)', async (_, env) => {
    const { handler } = setup(env)
    for (const pw of ['', 'correct horse']) {
      const res = await handler(req(pw))
      expect(res.status).toBe(503)
      expectAdminHeaders(res)
      expect(res.headers.get('set-cookie')).toBeNull()
    }
  })

  it('malformed body → 400 / non-string password → 401', async () => {
    const { handler } = setup()
    const bad = new Request('https://x.test/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{' })
    const res = await handler(bad)
    expect(res.status).toBe(400)
    expectAdminHeaders(res)
    expect((await handler(req(123))).status).toBe(401)
  })
})
