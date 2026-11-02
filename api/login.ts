import { checkPassword, sessionCookie, sessionSecret, signSession } from './_lib/session.js'
import { clientIp, empty, error, guarded, type Env } from './_lib/http.js'

export type LoginDeps = { env: Env; now: () => number; sleep: (ms: number) => Promise<void> }

const MAX_TRACKED = 1000
const FORGET_AFTER_MS = 3600_000

/** POST /api/login `{ password }` → 204 + session cookie; failure → 401 after min(2^n, 30) s (n = consecutive failures of this IP). */
export function createLogin(deps: LoginDeps): (req: Request) => Promise<Response> {
  // Per-instance memory: enough to slow down guessing; resets on cold start.
  const failures = new Map<string, { count: number; until: number; last: number }>()
  const prune = (now: number) => {
    if (failures.size < MAX_TRACKED) return
    for (const [ip, f] of failures) if (now - f.last > FORGET_AFTER_MS) failures.delete(ip)
    if (failures.size >= MAX_TRACKED) failures.delete(failures.keys().next().value!)
  }

  return guarded(async (req) => {
    const password = deps.env.ADMIN_PASSWORD
    const secret = sessionSecret(deps.env)
    if (!password || !secret) return error(503, 'Administration non configurée')

    let input: unknown
    try {
      input = ((await req.json()) as { password?: unknown } | null)?.password
    } catch {
      return error(400, 'Corps JSON attendu')
    }

    // From here to failures.set there is no await: parallel requests cannot all pass the lockout check.
    const ip = clientIp(req)
    const now = deps.now()
    const prev = failures.get(ip)
    if (prev && now < prev.until) return error(429, 'Patientez avant de réessayer', { 'Retry-After': String(Math.ceil((prev.until - now) / 1000)) })

    if (typeof input === 'string' && checkPassword(input, password)) {
      failures.delete(ip)
      return empty(204, { 'Set-Cookie': sessionCookie(signSession(secret, now)) })
    }

    const count = (prev && now - prev.last <= FORGET_AFTER_MS ? prev.count : 0) + 1
    const delay = Math.min(2 ** count, 30) * 1000
    prune(now)
    failures.set(ip, { count, until: now + delay, last: now })
    await deps.sleep(delay)
    return error(401, 'Mot de passe incorrect')
  })
}

let handler: ((req: Request) => Promise<Response>) | null = null

export function POST(req: Request): Promise<Response> {
  handler ??= createLogin({ env: process.env, now: Date.now, sleep: (ms) => new Promise((r) => setTimeout(r, ms)) })
  return handler(req)
}
