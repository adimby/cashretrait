import { lookup as dnsLookup } from 'node:dns/promises'
import { isIP } from 'node:net'

export const MAX_BYTES = 5 * 1024 * 1024
const TIMEOUT_MS = 15_000
const MAX_REDIRECTS = 3

export type FetchFn = (input: string, init?: RequestInit) => Promise<Response>
export type LookupFn = (host: string) => Promise<string[]>

/** Error with the HTTP status the API should answer with (400 refused URL, 413 too large, 502 upstream failure). */
export class SourceError extends Error {
  constructor(readonly status: 400 | 413 | 502, message: string) {
    super(message)
    this.name = 'SourceError'
  }
}

export const defaultLookup: LookupFn = async (host) => (await dnsLookup(host, { all: true, verbatim: true })).map((a) => a.address)

function ipv4Private(ip: string): boolean {
  const [a, b, c] = ip.split('.').map(Number)
  return (
    a === 0 || a === 10 || a === 127 || a >= 224 || // this-network, private, loopback, multicast/reserved
    (a === 100 && b >= 64 && b <= 127) || // CGNAT
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0 && c === 0) || // IETF protocol assignments
    (a === 198 && (b === 18 || b === 19)) // benchmarking 198.18.0.0/15
  )
}

/** IPv6 → 8 numeric groups (handles `::` and an embedded dotted IPv4 tail). */
function ipv6Groups(ip: string): number[] {
  let s = ip.split('%')[0].toLowerCase()
  const v4 = s.match(/(\d+\.\d+\.\d+\.\d+)$/)
  if (v4) {
    const [a, b, c, d] = v4[1].split('.').map(Number)
    s = s.slice(0, -v4[1].length) + `${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`
  }
  const [head, tail] = s.split('::')
  const h = head ? head.split(':') : []
  const t = tail !== undefined && tail !== '' ? tail.split(':') : []
  const fill = tail !== undefined ? Array(8 - h.length - t.length).fill('0') : []
  return [...h, ...fill, ...t].map((g) => parseInt(g, 16))
}

/** Loopback, private, link-local, unspecified, CGNAT, multicast and IPv4-mapped/-compatible forms of those. */
export function isPrivateAddress(ip: string): boolean {
  const kind = isIP(ip)
  if (kind === 4) return ipv4Private(ip)
  if (kind !== 6) return true // not an IP: refuse
  const g = ipv6Groups(ip)
  if (g.slice(0, 7).every((x) => x === 0)) return g[7] <= 1 // :: and ::1
  if (g.slice(0, 5).every((x) => x === 0) && (g[5] === 0xffff || g[5] === 0)) {
    return ipv4Private(`${g[6] >> 8}.${g[6] & 255}.${g[7] >> 8}.${g[7] & 255}`) // ::ffff:a.b.c.d / ::a.b.c.d
  }
  const v4 = (hi: number, lo: number) => `${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`
  if (g[0] === 0x64 && g[1] === 0xff9b) return ipv4Private(v4(g[6], g[7])) // NAT64
  if (g[0] === 0x2002) return ipv4Private(v4(g[1], g[2])) // 6to4: 2002:AABB:CCDD::/48
  if (g[0] === 0x2001 && g[1] === 0) return ipv4Private(v4(g[6] ^ 0xffff, g[7] ^ 0xffff)) // Teredo: client IPv4 inverted in the last 32 bits
  return (
    (g[0] & 0xfe00) === 0xfc00 || // unique local fc00::/7
    (g[0] & 0xffc0) === 0xfe80 || // link-local fe80::/10
    (g[0] & 0xffc0) === 0xfec0 || // site-local fec0::/10 (deprecated)
    (g[0] & 0xff00) === 0xff00 // multicast
  )
}

async function checkUrl(raw: string, lookup: LookupFn): Promise<URL> {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new SourceError(400, 'URL invalide')
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new SourceError(400, 'Seules les URL http(s) sont acceptées')
  if (url.username || url.password) throw new SourceError(400, 'URL avec identifiants refusée')
  const host = url.hostname.replace(/^\[|\]$/g, '').replace(/\.$/, '').toLowerCase()
  if (!host || host === 'localhost' || host.endsWith('.localhost')) throw new SourceError(400, 'Hôte local refusé')
  let addrs: string[]
  if (isIP(host)) addrs = [host]
  else {
    try {
      addrs = await lookup(host)
    } catch {
      throw new SourceError(502, `Hôte introuvable : ${host}`)
    }
  }
  if (!addrs.length || addrs.some(isPrivateAddress)) throw new SourceError(400, 'Adresse privée ou locale refusée')
  return url
}

async function readCapped(res: Response): Promise<Uint8Array> {
  const declared = Number(res.headers.get('content-length') ?? NaN)
  if (declared > MAX_BYTES) {
    await res.body?.cancel().catch(() => {})
    throw new SourceError(413, 'Document trop volumineux (> 5 Mo)')
  }
  if (!res.body) return new Uint8Array(0)
  const reader = res.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > MAX_BYTES) {
      await reader.cancel().catch(() => {})
      throw new SourceError(413, 'Document trop volumineux (> 5 Mo)')
    }
    chunks.push(value)
  }
  const out = new Uint8Array(size)
  let off = 0
  for (const c of chunks) {
    out.set(c, off)
    off += c.byteLength
  }
  return out
}

/**
 * Download an operator page/PDF with SSRF protection: http(s) only, every hop's host resolved and refused if
 * private/loopback/link-local, redirects followed manually (max 3, each re-checked), 15 s timeout, 5 MB cap.
 * Residual risk: DNS rebinding between our lookup and fetch's own resolution.
 */
export async function fetchSource(raw: string, deps: { fetch?: FetchFn; lookup?: LookupFn } = {}): Promise<{ bytes: Uint8Array; contentType: string }> {
  const doFetch = deps.fetch ?? ((u, i) => fetch(u, i))
  const lookup = deps.lookup ?? defaultLookup
  const signal = AbortSignal.timeout(TIMEOUT_MS)
  let url = await checkUrl(raw, lookup)
  for (let hop = 0; ; hop++) {
    let res: Response
    try {
      res = await doFetch(url.href, { redirect: 'manual', signal, headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CashRetrait-admin)' } })
    } catch (e) {
      const name = (e as Error).name
      throw new SourceError(502, name === 'TimeoutError' || name === 'AbortError' ? 'Délai dépassé (15 s)' : `Téléchargement impossible : ${(e as Error).message}`)
    }
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location')
      await res.body?.cancel().catch(() => {})
      if (!loc) throw new SourceError(502, `Redirection ${res.status} sans destination`)
      if (hop >= MAX_REDIRECTS) throw new SourceError(502, 'Trop de redirections')
      let next: string
      try {
        next = new URL(loc, url).href
      } catch {
        throw new SourceError(400, 'Redirection invalide')
      }
      url = await checkUrl(next, lookup)
      continue
    }
    if (!res.ok) {
      await res.body?.cancel().catch(() => {})
      throw new SourceError(502, `La source a répondu HTTP ${res.status}`)
    }
    try {
      return { bytes: await readCapped(res), contentType: res.headers.get('content-type') ?? '' }
    } catch (e) {
      if (e instanceof SourceError) throw e
      throw new SourceError(502, `Lecture interrompue : ${(e as Error).message}`)
    }
  }
}
