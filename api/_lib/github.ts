import type { Env } from './http.js'

export interface GitHubClient {
  getFile(path: string): Promise<{ content: string; sha: string }>
  putFile(path: string, content: string, sha: string, message: string): Promise<{ commitUrl: string }>
}

export const TARIFFS_PATH = 'public/tarifs.json'
const BRANCH = 'main'

export class GitHubConflictError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'GitHubConflictError'
  }
}

type FetchLike = (url: string, init?: RequestInit) => Promise<Response>

/** GitHub REST « contents » API client for one repository (`owner/name`), on branch main. */
export function githubClient(token: string, repo: string, fetchImpl: FetchLike = fetch): GitHubClient {
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo) || repo.includes('..')) throw new Error(`GITHUB_REPO invalide : ${repo}`)
  const base = `https://api.github.com/repos/${repo}/contents/`
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'cashretrait-admin',
  }
  const url = (path: string) => base + path.split('/').map(encodeURIComponent).join('/')
  const fail = async (res: Response, what: string) => {
    const detail = (await res.text().catch(() => '')).slice(0, 200)
    return new Error(`GitHub ${what}: HTTP ${res.status} ${detail}`)
  }

  return {
    async getFile(path) {
      const res = await fetchImpl(`${url(path)}?ref=${BRANCH}`, { headers })
      if (!res.ok) throw await fail(res, `GET ${path}`)
      const body = (await res.json()) as { content?: string; sha?: string; encoding?: string }
      if (typeof body.content !== 'string' || typeof body.sha !== 'string' || (body.encoding && body.encoding !== 'base64')) {
        throw new Error(`GitHub GET ${path}: réponse inattendue`)
      }
      return { content: Buffer.from(body.content.replace(/\s/g, ''), 'base64').toString('utf8'), sha: body.sha }
    },
    async putFile(path, content, sha, message) {
      const res = await fetchImpl(url(path), {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, content: Buffer.from(content, 'utf8').toString('base64'), sha, branch: BRANCH }),
      })
      if (res.status === 409) throw new GitHubConflictError(`GitHub PUT ${path}: le fichier a changé (sha)`)
      if (!res.ok) throw await fail(res, `PUT ${path}`)
      const body = (await res.json()) as { commit?: { html_url?: string } }
      return { commitUrl: body.commit?.html_url ?? '' }
    },
  }
}

/** Client from GITHUB_TOKEN / GITHUB_REPO, or null when either is missing. */
export function githubFromEnv(env: Env): GitHubClient | null {
  if (!env.GITHUB_TOKEN || !env.GITHUB_REPO) return null
  return githubClient(env.GITHUB_TOKEN, env.GITHUB_REPO)
}
