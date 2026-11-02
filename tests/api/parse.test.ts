import { beforeAll, describe, expect, it, vi } from 'vitest'
import { GlobalWorkerOptions } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { createParse, type ParseDeps } from '../../api/parse'
import { isPrivateAddress } from '../../api/_lib/fetch-url'
import { ENV, NOW, authCookie, current, expectAdminHeaders, fakeGitHub, fixture } from './helpers'

// Make pdfjs' default fake-worker path (`./pdf.worker.mjs`, a dynamic import Vercel's tracer cannot follow) unusable:
// Orange parsing must then succeed only through the worker the API imports explicitly.
beforeAll(() => { GlobalWorkerOptions.workerSrc = 'file:///nonexistent/pdf.worker.mjs' })

type FetchFn = NonNullable<ParseDeps['fetch']>
function setup(over: Partial<ParseDeps> = {}) {
  const gh = fakeGitHub()
  const fetch = vi.fn<FetchFn>(async () => new Response('not used', { status: 500 }))
  const lookup = vi.fn(async (_host: string) => ['93.184.216.34'])
  const deps: ParseDeps = { env: ENV, now: () => NOW, github: () => gh.client, fetch, lookup, ...over }
  return { handler: createParse(deps), fetch: (deps.fetch ?? fetch) as typeof fetch, lookup: (deps.lookup ?? lookup) as typeof lookup }
}
const upload = (operator: string, bytes: Uint8Array, type: string, name = 'f', cookie = authCookie()) => {
  const form = new FormData()
  form.set('operator', operator)
  form.set('file', new Blob([bytes as BlobPart], { type }), name)
  return new Request('https://x.test/api/parse', { method: 'POST', headers: { cookie }, body: form })
}
const byUrl = (operator: string, url: string, cookie = authCookie()) =>
  new Request('https://x.test/api/parse', { method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify({ operator, url }) })

describe('POST /api/parse — auth', () => {
  it('no cookie → 401', async () => {
    const { handler } = setup()
    const res = await handler(upload('mvola', fixture('mvola.html'), 'text/html', 'm.html', ''))
    expect(res.status).toBe(401)
    expectAdminHeaders(res)
  })
  it('expired cookie → 401', async () => {
    const { handler } = setup()
    const res = await handler(byUrl('mvola', 'https://mvola.mg/tarifs/', authCookie(NOW - 9 * 3600_000)))
    expect(res.status).toBe(401)
  })
  it('ADMIN_SESSION_SECRET missing → 503', async () => {
    const { handler } = setup({ env: { ...ENV, ADMIN_SESSION_SECRET: undefined } })
    const res = await handler(byUrl('mvola', 'https://mvola.mg/tarifs/'))
    expect(res.status).toBe(503)
    expectAdminHeaders(res)
  })
  it('ADMIN_SESSION_SECRET shorter than 32 chars → 503', async () => {
    const { handler } = setup({ env: { ...ENV, ADMIN_SESSION_SECRET: 'z'.repeat(20) } })
    expect((await handler(byUrl('mvola', 'https://mvola.mg/tarifs/'))).status).toBe(503)
  })
  it('current tarifs.json unreadable → 502 JSON error', async () => {
    const gh = fakeGitHub()
    gh.client.getFile = async () => ({ content: '{ broken', sha: 's' })
    const { handler } = setup({ github: () => gh.client })
    const res = await handler(upload('mvola', fixture('mvola.html'), 'text/html'))
    expect(res.status).toBe(502)
    expectAdminHeaders(res)
    expect((await res.json()).error).toMatch(/tarifs\.json/)
  })
  it('GitHub env missing → 503', async () => {
    const { handler } = setup({ env: { ...ENV, GITHUB_TOKEN: undefined }, github: undefined })
    const res = await handler(upload('mvola', fixture('mvola.html'), 'text/html'))
    expect(res.status).toBe(503)
  })
})

describe('POST /api/parse — uploads', () => {
  it('MVola fixture (HTML upload) → changes [], validation ok', async () => {
    const { handler } = setup()
    const res = await handler(upload('mvola', fixture('mvola.html'), 'text/html', 'mvola.html'))
    expect(res.status).toBe(200)
    expectAdminHeaders(res)
    const body = await res.json()
    expect(body.changes).toEqual([])
    expect(body.validation).toEqual({ status: 'ok', reasons: [] })
    expect(body.operator).toEqual(current().operators.mvola)
    expect(body.baseSha).toBe('sha-current')
    expect(body.current).toEqual(current()) // the GitHub copy the preview merges onto
  })
  it('Airtel saved web page (HTML upload, no content-type) → ok', async () => {
    const { handler } = setup()
    const res = await handler(upload('airtel', fixture('airtel.html'), '', 'airtel.htm'))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.changes).toEqual([])
    expect(body.validation.status).toBe('ok')
    expect(body.operator).toEqual(current().operators.airtel)
  })
  it('Orange PDF upload works from the handler (explicit pdfjs worker) → ok', async () => {
    const { handler } = setup()
    const res = await handler(upload('orange', fixture('orange.pdf'), 'application/octet-stream', 'tarifs.pdf'))
    const body = await res.json()
    expect(res.status, JSON.stringify(body)).toBe(200)
    expect(body.changes).toEqual([])
    expect(body.validation.status).toBe('ok')
    expect(body.operator).toEqual(current().operators.orange)
    expect((globalThis as { pdfjsWorker?: { WorkerMessageHandler?: unknown } }).pdfjsWorker?.WorkerMessageHandler).toBeDefined()
  })
  it('a changed fee is reported as a change', async () => {
    const { handler } = setup()
    const html = new TextDecoder().decode(fixture('mvola.html')).replace('<td width="157">1 300</td>', '<td width="157">1 400</td>')
    const body = await (await handler(upload('mvola', new TextEncoder().encode(html), 'text/html'))).json()
    expect(body.changes).toHaveLength(1)
    expect(body.changes[0]).toMatchObject({ operator: 'mvola', before: 1300, after: 1400 })
  })
  it('parser failure → generic tables for manual editing', async () => {
    const { handler } = setup()
    const html = '<table><tr><th>Montant</th><th>Frais</th></tr><tr><td>1 - 100</td><td>50</td></tr></table>'
    const res = await handler(upload('mvola', new TextEncoder().encode(html), 'text/html'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.generic).toEqual([{ headers: ['Montant', 'Frais'], rows: [['1 - 100', '50']] }])
    expect(body.error).toMatch(/MVola/)
    expect(body.operator).toBeUndefined()
    expect(body.current).toEqual(current())
  })
  it('PDF given for an HTML operator → generic tables from the PDF text', async () => {
    const { handler } = setup()
    const body = await (await handler(upload('mvola', fixture('orange.pdf'), 'application/pdf'))).json()
    expect(body.generic.length).toBeGreaterThan(0)
    expect(body.generic[0].rows.length).toBeGreaterThan(10)
  })
  it('HTML given for Orange → generic', async () => {
    const { handler } = setup()
    const body = await (await handler(upload('orange', fixture('mvola.html'), 'text/html'))).json()
    expect(body.generic.length).toBeGreaterThan(0)
  })
  it('upload > 5 MB → 413', async () => {
    const { handler } = setup()
    const res = await handler(upload('mvola', new Uint8Array(5 * 1024 * 1024 + 1), 'text/html'))
    expect(res.status).toBe(413)
    expectAdminHeaders(res)
  })
  it('unknown operator / missing file → 400', async () => {
    const { handler } = setup()
    expect((await handler(upload('wave', fixture('mvola.html'), 'text/html'))).status).toBe(400)
    const form = new FormData()
    form.set('operator', 'mvola')
    expect((await handler(new Request('https://x.test/api/parse', { method: 'POST', headers: { cookie: authCookie() }, body: form }))).status).toBe(400)
  })
})

describe('POST /api/parse — URL', () => {
  it('fetches an http(s) URL without following redirects automatically, with a timeout', async () => {
    const fetch = vi.fn<FetchFn>(async () => new Response(fixture('mvola.html') as BodyInit, { headers: { 'content-type': 'text/html; charset=utf-8' } }))
    const { handler, lookup } = setup({ fetch })
    const res = await handler(byUrl('mvola', 'https://mvola.mg/tarifs/'))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.changes).toEqual([])
    expect(lookup).toHaveBeenCalledWith('mvola.mg')
    const [url, init] = fetch.mock.calls[0]
    expect(String(url)).toBe('https://mvola.mg/tarifs/')
    expect(init?.redirect).toBe('manual')
    expect(init?.signal).toBeInstanceOf(AbortSignal)
  })
  it('PDF by URL (magic bytes, wrong content-type) → Orange parser', async () => {
    const fetch = vi.fn<FetchFn>(async () => new Response(fixture('orange.pdf') as BodyInit, { headers: { 'content-type': 'text/plain' } }))
    const { handler } = setup({ fetch })
    const body = await (await handler(byUrl('orange', 'https://www.orange.mg/x.pdf'))).json()
    expect(body.validation?.status).toBe('ok')
  })
  it.each(['ftp://mvola.mg/x', 'file:///etc/passwd', 'javascript:alert(1)', 'not a url', 'https://user:pw@mvola.mg/'])('rejects %s → 400', async (u) => {
    const { handler, fetch } = setup()
    const res = await handler(byUrl('mvola', u))
    expect(res.status).toBe(400)
    expectAdminHeaders(res)
    expect(fetch).not.toHaveBeenCalled()
  })
  it.each([
    'http://localhost/', 'http://LOCALHOST./', 'http://foo.localhost/', 'http://127.0.0.1/', 'http://127.1.2.3:8080/', 'http://10.1.2.3/',
    'http://172.16.0.1/', 'http://172.31.255.255/', 'http://192.168.1.1/', 'http://169.254.169.254/latest/meta-data/',
    'http://[::1]/', 'http://0.0.0.0/', 'http://[::ffff:127.0.0.1]/', 'http://2130706433/', 'http://0x7f000001/',
  ])('SSRF: blocks %s → 400', async (u) => {
    const { handler, fetch } = setup()
    const res = await handler(byUrl('mvola', u))
    expect(res.status).toBe(400)
    expect(fetch).not.toHaveBeenCalled()
  })
  it('SSRF: hostname resolving to a private address → 400', async () => {
    const { handler, fetch } = setup({ lookup: async () => ['93.184.216.34', '10.0.0.5'] })
    expect((await handler(byUrl('mvola', 'https://evil.example/'))).status).toBe(400)
    expect(fetch).not.toHaveBeenCalled()
  })
  it('SSRF: redirect to a private host → 400', async () => {
    const fetch = vi.fn<FetchFn>(async () => new Response(null, { status: 302, headers: { location: 'http://169.254.169.254/' } }))
    const { handler } = setup({ fetch })
    expect((await handler(byUrl('mvola', 'https://mvola.mg/tarifs/'))).status).toBe(400)
    expect(fetch).toHaveBeenCalledTimes(1)
  })
  it('redirect to non-http(s) → 400', async () => {
    const fetch = vi.fn<FetchFn>(async () => new Response(null, { status: 301, headers: { location: 'file:///etc/passwd' } }))
    const { handler } = setup({ fetch })
    expect((await handler(byUrl('mvola', 'https://mvola.mg/tarifs/'))).status).toBe(400)
  })
  it('follows a safe redirect (re-checked)', async () => {
    const fetch = vi.fn<FetchFn>(async (u) =>
      String(u) === 'http://mvola.mg/tarifs' ? new Response(null, { status: 301, headers: { location: '/tarifs/' } }) : new Response(fixture('mvola.html') as BodyInit))
    const { handler, lookup } = setup({ fetch })
    const res = await handler(byUrl('mvola', 'http://mvola.mg/tarifs'))
    expect(res.status).toBe(200)
    expect(String(fetch.mock.calls[1][0])).toBe('http://mvola.mg/tarifs/')
    expect(lookup).toHaveBeenCalledTimes(2)
  })
  it('response > 5 MB → 413 (content-length or streamed)', async () => {
    const big = () => new Uint8Array(5 * 1024 * 1024 + 1)
    const declared = setup({ fetch: async () => new Response(big() as BodyInit, { headers: { 'content-length': String(5 * 1024 * 1024 + 1) } }) })
    expect((await declared.handler(byUrl('mvola', 'https://mvola.mg/'))).status).toBe(413)
    const streamed = setup({
      fetch: async () => new Response(new ReadableStream({ start(c) { for (let i = 0; i < 6; i++) c.enqueue(new Uint8Array(1024 * 1024)); c.close() } })),
    })
    expect((await streamed.handler(byUrl('mvola', 'https://mvola.mg/'))).status).toBe(413)
  })
  it('upstream error / timeout → 502', async () => {
    const e404 = setup({ fetch: async () => new Response('x', { status: 404 }) })
    expect((await e404.handler(byUrl('mvola', 'https://mvola.mg/'))).status).toBe(502)
    const timeout = setup({ fetch: async () => { throw new DOMException('timed out', 'TimeoutError') } })
    expect((await timeout.handler(byUrl('mvola', 'https://mvola.mg/'))).status).toBe(502)
  })
})

describe('isPrivateAddress', () => {
  it.each(['127.0.0.1', '10.0.0.1', '172.16.5.5', '172.31.0.1', '192.168.0.1', '169.254.1.1', '0.0.0.0', '::1', '::', 'fe80::1', 'fc00::1', 'fd12::1', '::ffff:10.0.0.1', '::ffff:7f00:1',
    '198.18.0.1', '198.19.255.255', '192.0.0.8', 'fec0::1', 'feff::1', '2002:c0a8:0101::1', '2002:7f00:1::', '2001:0:4136:e378:8000:63bf:f5ff:fffe', '64:ff9b::a00:1'])('%s is private', (ip) => {
    expect(isPrivateAddress(ip)).toBe(true)
  })
  it.each(['8.8.8.8', '172.15.0.1', '172.32.0.1', '192.169.0.1', '93.184.216.34', '2606:4700::1111', '198.20.0.1', '198.17.255.255', '192.0.1.1', '2002:5db8:d822::1', '2001:0:4136:e378:8000:63bf:a247:27dd', '2001:db8::1'])('%s is public', (ip) => {
    expect(isPrivateAddress(ip)).toBe(false)
  })
})
