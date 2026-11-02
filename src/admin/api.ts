import type { Operator, OperatorId, Tariffs } from '../tariffs/schema'
import type { FeeChange, Validation } from '../tariffs/validate'
import type { GenericTable } from '../tariffs/parsers/generic'
import { gitBlobSha } from './tiers'
import { S } from './strings'

export type ApiError = { ok: false; status: number; message: string; retryAfter?: number; validation?: Validation }
export type ApiResult<T> = { ok: true; data: T } | ApiError

export type ParseResult =
  | { operator: Operator; validation: Validation; changes: FeeChange[]; baseSha: string; current: Tariffs }
  | { generic: GenericTable[]; error: string; baseSha: string; current: Tariffs }

async function call<T>(path: string, init: RequestInit): Promise<ApiResult<T>> {
  let res: Response
  try {
    res = await fetch(path, { credentials: 'same-origin', cache: 'no-store', ...init, method: 'POST' })
  } catch {
    return { ok: false, status: 0, message: S.error.network }
  }
  if (res.status === 204) return { ok: true, data: undefined as T }
  let body: unknown = null
  try {
    body = await res.json()
  } catch {
    /* non-JSON error page (platform 413, 504…) */
  }
  if (res.ok) return { ok: true, data: body as T }
  const b = (body ?? {}) as { error?: string; validation?: Validation }
  const retry = Number(res.headers.get('Retry-After'))
  return {
    ok: false,
    status: res.status,
    message: b.error ?? (res.status === 413 ? S.error.tooBig : S.error.generic(res.status)),
    ...(Number.isFinite(retry) && retry > 0 ? { retryAfter: retry } : {}),
    ...(b.validation ? { validation: b.validation } : {}),
  }
}

const jsonInit = (body: unknown): RequestInit => ({ headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

export const login = (password: string) => call<void>('/api/login', jsonInit({ password }))

export function parseFile(operator: OperatorId, file: File) {
  const form = new FormData()
  form.set('operator', operator)
  form.set('file', file)
  return call<ParseResult>('/api/parse', { body: form })
}

export const parseUrl = (operator: OperatorId, url: string) => call<ParseResult>('/api/parse', jsonInit({ operator, url }))

export const commit = (tariffs: Tariffs, baseSha?: string) =>
  call<{ commitUrl: string; validation: Validation }>('/api/commit', jsonInit({ tariffs, ...(baseSha ? { baseSha } : {}) }))

/**
 * The deployed tarifs.json for manual editing. Its git blob sha goes back to the commit as `baseSha`:
 * if the deployment lags behind main (or main moved), GitHub refuses with 409 instead of overwriting.
 */
export async function loadDeployed(): Promise<{ current: Tariffs; baseSha: string } | null> {
  try {
    // 'reload' bypasses both the HTTP cache and the public app's service worker (see vite.config.ts).
    const res = await fetch('/tarifs.json', { cache: 'reload' })
    if (!res.ok) return null
    const text = await res.text()
    return { current: JSON.parse(text) as Tariffs, baseSha: await gitBlobSha(text) }
  } catch {
    return null
  }
}
