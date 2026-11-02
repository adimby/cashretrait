/** Shared response helpers for the admin API. Every response is non-indexable and never cached. */
export type Env = Record<string, string | undefined>

export const ADMIN_HEADERS: Record<string, string> = { 'X-Robots-Tag': 'noindex, nofollow', 'Cache-Control': 'no-store' }

export function json(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...ADMIN_HEADERS, 'Content-Type': 'application/json; charset=utf-8', ...headers } })
}

export function empty(status: number, headers: Record<string, string> = {}): Response {
  return new Response(null, { status, headers: { ...ADMIN_HEADERS, ...headers } })
}

export const error = (status: number, message: string, headers: Record<string, string> = {}) => json(status, { error: message }, headers)

export function readCookie(req: Request, name: string): string | undefined {
  for (const part of (req.headers.get('cookie') ?? '').split(';')) {
    const i = part.indexOf('=')
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim()
  }
  return undefined
}

/** Client IP: x-vercel-forwarded-for (set by Vercel, not spoofable), else x-real-ip, else first x-forwarded-for entry. */
export function clientIp(req: Request): string {
  const first = (name: string) => req.headers.get(name)?.split(',')[0]?.trim()
  return first('x-vercel-forwarded-for') || first('x-real-ip') || first('x-forwarded-for') || 'unknown'
}

/** Wraps a handler so an unexpected exception still answers with the admin headers and no internals. */
export function guarded(h: (req: Request) => Promise<Response>): (req: Request) => Promise<Response> {
  return async (req) => {
    try {
      return await h(req)
    } catch (e) {
      console.error('admin api error', e)
      return error(500, 'Erreur interne')
    }
  }
}
