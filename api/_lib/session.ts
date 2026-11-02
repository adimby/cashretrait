import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import { error, readCookie, type Env } from './http.js'

export const SESSION_COOKIE = 'cr_admin'
export const SESSION_MAX_AGE = 8 * 3600 // seconds
export const MIN_SECRET_LENGTH = 32

/** ADMIN_SESSION_SECRET when set and long enough (≥ 32 chars), else null (→ 503: administration not configured). */
export function sessionSecret(env: Env): string | null {
  const s = env.ADMIN_SESSION_SECRET
  return s && s.length >= MIN_SECRET_LENGTH ? s : null
}

const mac = (secret: string, payload: string) => createHmac('sha256', secret).update(`cr_admin:${payload}`).digest('base64url')

/** Cookie value `<expiresAtMs>.<HMAC-SHA256(expiresAtMs)>`, valid 8 h from `now`. */
export function signSession(secret: string, now: number): string {
  const exp = String(now + SESSION_MAX_AGE * 1000)
  return `${exp}.${mac(secret, exp)}`
}

export function verifySession(cookie: string | undefined, secret: string, now: number): boolean {
  if (!cookie || !secret) return false
  const m = /^(\d{1,16})\.([A-Za-z0-9_-]{43})$/.exec(cookie)
  if (!m) return false
  const expected = Buffer.from(mac(secret, m[1]))
  const given = Buffer.from(m[2])
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return false
  return now <= Number(m[1])
}

/** Constant-time comparison on SHA-256 digests (equal lengths whatever the inputs). An empty expected password never matches. */
export function checkPassword(input: string, expected: string): boolean {
  if (!expected) return false
  const h = (s: string) => createHash('sha256').update(s, 'utf8').digest()
  return timingSafeEqual(h(input), h(expected))
}

export function sessionCookie(value: string): string {
  return `${SESSION_COOKIE}=${value}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${SESSION_MAX_AGE}`
}

/** null when the request carries a valid session; otherwise the response to send (503 if not configured, 401). */
export function requireSession(req: Request, env: Env, now: number): Response | null {
  const secret = sessionSecret(env)
  if (!secret) return error(503, 'Administration non configurée')
  if (!verifySession(readCookie(req, SESSION_COOKIE), secret, now)) return error(401, 'Session requise')
  return null
}
