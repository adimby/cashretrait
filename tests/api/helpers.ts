import { readFileSync } from 'node:fs'
import { signSession } from '../../api/_lib/session'
import type { GitHubClient } from '../../api/_lib/github'
import type { Tariffs } from '../../src/tariffs/schema'

export const SECRET = 'test-secret-0123456789abcdef-0123456789'
export const NOW = Date.UTC(2026, 10, 2, 12, 0, 0)
export const ENV = { ADMIN_PASSWORD: 'correct horse', ADMIN_SESSION_SECRET: SECRET, GITHUB_TOKEN: 'ghp_test', GITHUB_REPO: 'adimby/cashretrait' }
export const tariffsText = () => readFileSync('public/tarifs.json', 'utf8')
export const current = (): Tariffs => JSON.parse(tariffsText())
export const fixture = (n: string) => new Uint8Array(readFileSync(`tests/fixtures/${n}`))
export const authCookie = (now = NOW) => `cr_admin=${signSession(SECRET, now)}`

export function fakeGitHub(opts: { conflict?: boolean } = {}) {
  const puts: { path: string; content: string; sha: string; message: string }[] = []
  const client: GitHubClient = {
    async getFile(path) {
      if (path !== 'public/tarifs.json') throw new Error(`unexpected ${path}`)
      return { content: tariffsText(), sha: 'sha-current' }
    },
    async putFile(path, content, sha, message) {
      puts.push({ path, content, sha, message })
      if (opts.conflict) {
        const { GitHubConflictError } = await import('../../api/_lib/github')
        throw new GitHubConflictError('sha mismatch')
      }
      return { commitUrl: 'https://github.com/adimby/cashretrait/commit/abc' }
    },
  }
  return { client, puts }
}

export function expectAdminHeaders(res: Response) {
  if (res.headers.get('x-robots-tag') !== 'noindex, nofollow') throw new Error(`X-Robots-Tag: ${res.headers.get('x-robots-tag')}`)
  if (res.headers.get('cache-control') !== 'no-store') throw new Error(`Cache-Control: ${res.headers.get('cache-control')}`)
}
