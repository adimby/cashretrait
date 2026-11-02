import { TariffsSchema, type Tariffs } from '../src/tariffs/schema.js'
import { validateTariffs } from '../src/tariffs/validate.js'
import { requireSession } from './_lib/session.js'
import { GitHubConflictError, TARIFFS_PATH, githubFromEnv, type GitHubClient } from './_lib/github.js'
import { error, guarded, json, type Env } from './_lib/http.js'

export type CommitDeps = { env: Env; now: () => number; github?: () => GitHubClient }

export const COMMIT_MESSAGE = 'chore(tarifs): mise à jour via /zadmin'

/** POST /api/commit (session) `{ tariffs, baseSha? }` → validation (invalid → 422) → commit of public/tarifs.json on main → `{ commitUrl, validation }`. */
export function createCommit(deps: CommitDeps): (req: Request) => Promise<Response> {
  return guarded(async (req) => {
    const denied = requireSession(req, deps.env, deps.now())
    if (denied) return denied
    const gh = deps.github ? deps.github() : githubFromEnv(deps.env)
    if (!gh) return error(503, 'GITHUB_TOKEN / GITHUB_REPO non configurés')

    let body: { tariffs?: unknown; baseSha?: unknown }
    try {
      body = (await req.json()) as typeof body
    } catch {
      return error(400, 'Corps JSON attendu')
    }

    let file: { content: string; sha: string }
    try {
      file = await gh.getFile(TARIFFS_PATH)
    } catch (e) {
      console.error('github getFile', e)
      return error(502, 'Lecture de tarifs.json sur GitHub impossible')
    }
    // An unreadable current file only disables the « suspect » comparison: committing is how it gets repaired.
    let prev: Tariffs | null = null
    try {
      prev = JSON.parse(file.content) as Tariffs
    } catch {
      prev = null
    }
    const validation = validateTariffs(body?.tariffs, prev)
    if (validation.status === 'invalid') return json(422, { validation })

    // Committing on the sha the admin's preview was computed against turns concurrent edits into a 409.
    const sha = typeof body.baseSha === 'string' && body.baseSha ? body.baseSha : file.sha
    // Commit the schema-parsed data (strict schemas), never the raw request body.
    const content = JSON.stringify(TariffsSchema.parse(body.tariffs), null, 2) + '\n'
    try {
      const { commitUrl } = await gh.putFile(TARIFFS_PATH, content, sha, COMMIT_MESSAGE)
      return json(200, { commitUrl, validation })
    } catch (e) {
      if (e instanceof GitHubConflictError) return error(409, 'tarifs.json a changé entre-temps : rechargez puis recommencez')
      console.error('github putFile', e)
      return error(502, 'Commit GitHub impossible')
    }
  })
}

export function POST(req: Request): Promise<Response> {
  return createCommit({ env: process.env, now: Date.now })(req)
}
