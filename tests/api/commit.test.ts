import { describe, expect, it } from 'vitest'
import { createCommit } from '../../api/commit'
import { TariffsSchema, type Tariffs } from '../../src/tariffs/schema'
import { signSession } from '../../api/_lib/session'
import { ENV, NOW, SECRET, authCookie, current, expectAdminHeaders, fakeGitHub } from './helpers'

const req = (body: unknown, cookie = authCookie()) =>
  new Request('https://x.test/api/commit', { method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify(body) })
function setup(opts: { conflict?: boolean; env?: Record<string, string | undefined> } = {}) {
  const gh = fakeGitHub(opts)
  return { handler: createCommit({ env: opts.env ?? ENV, now: () => NOW, github: () => gh.client }), puts: gh.puts }
}
const changed = (): Tariffs => {
  const t = current()
  t.updatedAt = '2026-11-02T12:00:00.000Z'
  t.operators.mvola.fees.withdrawal![3] = { ...t.operators.mvola.fees.withdrawal![3], fee: (t.operators.mvola.fees.withdrawal![3] as { fee: number }).fee + 100 }
  return t
}

describe('POST /api/commit', () => {
  it('no cookie → 401, nothing committed', async () => {
    const { handler, puts } = setup()
    const res = await handler(req({ tariffs: changed() }, ''))
    expect(res.status).toBe(401)
    expectAdminHeaders(res)
    expect(puts).toHaveLength(0)
  })
  it.each([
    ['tampered cookie', () => authCookie().slice(0, -2) + 'xx', ENV, 401],
    ['expired cookie', () => authCookie(NOW - 8 * 3600_000 - 1), ENV, 401],
    ['cookie signed with another secret', () => `cr_admin=${signSession('y'.repeat(40), NOW)}`, ENV, 401],
    ['ADMIN_SESSION_SECRET missing', () => authCookie(), { ...ENV, ADMIN_SESSION_SECRET: undefined }, 503],
    ['ADMIN_SESSION_SECRET too short', () => `cr_admin=${signSession(SECRET.slice(0, 31), NOW)}`, { ...ENV, ADMIN_SESSION_SECRET: SECRET.slice(0, 31) }, 503],
  ] as const)('%s → %i, nothing committed', async (_, cookie, env, status) => {
    const { handler, puts } = setup({ env })
    const res = await handler(req({ tariffs: changed() }, cookie()))
    expect(res.status).toBe(status)
    expectAdminHeaders(res)
    expect(puts).toHaveLength(0)
  })
  it.each([
    ['top level', (t: any) => { t.evil = 1 }],
    ['operators', (t: any) => { t.operators.wave = t.operators.mvola }],
    ['operator', (t: any) => { t.operators.mvola.script = '<script>' }],
    ['source', (t: any) => { t.operators.mvola.source.extra = 'x' }],
    ['limits', (t: any) => { t.operators.mvola.limits.extra = 1 }],
    ['tier', (t: any) => { t.operators.mvola.fees.withdrawal[0].note = 'x' }],
  ])('unknown key (%s) → 422, nothing committed', async (_, mutate) => {
    const { handler, puts } = setup()
    const t = changed()
    mutate(t)
    const res = await handler(req({ tariffs: t }))
    expect(res.status).toBe(422)
    expect(puts).toHaveLength(0)
  })
  it.each(['javascript:alert(1)', 'data:text/html,x', 'ftp://mvola.mg/', 'mvola.mg/tarifs'])('source.url %s → 422, nothing committed', async (u) => {
    const { handler, puts } = setup()
    const t = changed()
    t.operators.mvola.source.url = u
    const res = await handler(req({ tariffs: t }))
    expect(res.status).toBe(422)
    expect((await res.json()).validation.reasons.join()).toMatch(/source\.url/)
    expect(puts).toHaveLength(0)
  })
  it('GitHub read failure → 502 JSON error', async () => {
    const gh = fakeGitHub()
    gh.client.getFile = async () => { throw new Error('HTTP 500') }
    const res = await createCommit({ env: ENV, now: () => NOW, github: () => gh.client })(req({ tariffs: changed() }))
    expect(res.status).toBe(502)
    expectAdminHeaders(res)
    expect((await res.json()).error).toBeTruthy()
  })
  it('invalid tariffs → 422 with validation, nothing committed', async () => {
    const { handler, puts } = setup()
    const t = changed() as unknown as { operators: { mvola: { limits: { minTx: number } } } }
    t.operators.mvola.limits.minTx = -5
    const res = await handler(req({ tariffs: t }))
    expect(res.status).toBe(422)
    expectAdminHeaders(res)
    const body = await res.json()
    expect(body.validation.status).toBe('invalid')
    expect(puts).toHaveLength(0)
  })
  it('missing tariffs → 422', async () => {
    const { handler, puts } = setup()
    expect((await handler(req({}))).status).toBe(422)
    expect(puts).toHaveLength(0)
  })
  it('valid → putFile called once with content passing TariffsSchema', async () => {
    const { handler, puts } = setup()
    const t = changed()
    const res = await handler(req({ tariffs: t }))
    expect(res.status).toBe(200)
    expectAdminHeaders(res)
    expect(await res.json()).toMatchObject({ commitUrl: 'https://github.com/adimby/cashretrait/commit/abc', validation: { status: 'ok' } })
    expect(puts).toHaveLength(1)
    expect(puts[0].path).toBe('public/tarifs.json')
    expect(puts[0].message).toBe('chore(tarifs): mise à jour via /zadmin')
    expect(puts[0].sha).toBe('sha-current')
    expect(puts[0].content.endsWith('}\n')).toBe(true)
    const parsed = TariffsSchema.safeParse(JSON.parse(puts[0].content))
    expect(parsed.success).toBe(true)
    expect(JSON.parse(puts[0].content)).toEqual(t)
  })
  it('suspect tariffs are committable (admin reviewed the warnings)', async () => {
    const { handler, puts } = setup()
    const t = current()
    const tier = t.operators.mvola.fees.withdrawal![3] as { fee: number }
    tier.fee *= 3
    const res = await handler(req({ tariffs: t }))
    expect(res.status).toBe(200)
    expect((await res.json()).validation.status).toBe('suspect')
    expect(puts).toHaveLength(1)
  })
  it('uses the baseSha from /api/parse when given', async () => {
    const { handler, puts } = setup()
    await handler(req({ tariffs: changed(), baseSha: 'sha-seen-by-admin' }))
    expect(puts[0].sha).toBe('sha-seen-by-admin')
  })
  it('sha conflict → 409', async () => {
    const { handler } = setup({ conflict: true })
    const res = await handler(req({ tariffs: changed() }))
    expect(res.status).toBe(409)
    expectAdminHeaders(res)
  })
  it('GITHUB_TOKEN / GITHUB_REPO missing → 503', async () => {
    for (const k of ['GITHUB_TOKEN', 'GITHUB_REPO'] as const) {
      const res = await createCommit({ env: { ...ENV, [k]: undefined }, now: () => NOW })(req({ tariffs: changed() }))
      expect(res.status).toBe(503)
    }
  })
})
