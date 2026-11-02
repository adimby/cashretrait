import { OPERATORS, type Operator, type OperatorId, type Tariffs } from '../src/tariffs/schema.js'
import { diffTariffs, mergeOperator, validateTariffs } from '../src/tariffs/validate.js'
import { parseAirtel } from '../src/tariffs/parsers/airtel.js'
import { parseMvola } from '../src/tariffs/parsers/mvola.js'
import { extractPdfItems, groupLines, parseOrange } from '../src/tariffs/parsers/orange.js'
import { ParseError } from '../src/tariffs/parsers/common.js'
import { parseGenericTables, type GenericTable } from '../src/tariffs/parsers/generic.js'
import { requireSession } from './_lib/session.js'
import { TARIFFS_PATH, githubFromEnv, type GitHubClient } from './_lib/github.js'
import { MAX_BYTES, SourceError, fetchSource, type FetchFn, type LookupFn } from './_lib/fetch-url.js'
import { ensurePdfWorker } from './_lib/pdf.js'
import { error, guarded, json, type Env } from './_lib/http.js'

export type ParseDeps = { env: Env; now: () => number; github?: () => GitHubClient; fetch?: FetchFn; lookup?: LookupFn }

type Kind = 'pdf' | 'html'
type Source = { bytes: Uint8Array; kind: Kind }

/** `%PDF-` within the first 1 KiB (PDF spec tolerance) → PDF; anything else is treated as an HTML/text page. */
export function detectKind(bytes: Uint8Array): Kind {
  const head = new TextDecoder('latin1').decode(bytes.subarray(0, 1024))
  return head.includes('%PDF-') ? 'pdf' : 'html'
}

const text = (b: Uint8Array) => new TextDecoder('utf-8').decode(b)

const PARSERS: Record<OperatorId, { kind: Kind; parse: (b: Uint8Array) => Operator | Promise<Operator> }> = {
  mvola: { kind: 'html', parse: (b) => parseMvola(text(b)) },
  airtel: { kind: 'html', parse: (b) => parseAirtel(text(b)) },
  orange: { kind: 'pdf', parse: (b) => parseOrange(b) },
}

async function genericTables(src: Source): Promise<GenericTable[]> {
  if (src.kind === 'html') return parseGenericTables(text(src.bytes))
  await ensurePdfWorker()
  const lines = groupLines(await extractPdfItems(src.bytes)).map((l) => l.map((i) => i.str.trim()).join('\t'))
  return parseGenericTables(lines.join('\n'))
}

async function readInput(req: Request, fetchDeps: { fetch?: FetchFn; lookup?: LookupFn }): Promise<{ operator: OperatorId; src: Source } | Response> {
  const type = req.headers.get('content-type') ?? ''
  const isOperator = (o: unknown): o is OperatorId => typeof o === 'string' && (OPERATORS as readonly string[]).includes(o)
  if (type.startsWith('multipart/form-data')) {
    let form: FormData
    try {
      form = await req.formData()
    } catch {
      return error(400, 'Formulaire illisible')
    }
    const operator = form.get('operator')
    if (!isOperator(operator)) return error(400, 'Opérateur inconnu')
    const file = form.get('file')
    if (!file || typeof file === 'string') return error(400, 'Fichier manquant')
    if (file.size > MAX_BYTES) return error(413, 'Fichier trop volumineux (> 5 Mo)')
    const bytes = new Uint8Array(await file.arrayBuffer())
    return { operator, src: { bytes, kind: detectKind(bytes) } }
  }
  let body: { operator?: unknown; url?: unknown }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return error(400, 'Corps JSON ou multipart attendu')
  }
  if (!isOperator(body?.operator)) return error(400, 'Opérateur inconnu')
  if (typeof body.url !== 'string') return error(400, 'URL manquante')
  try {
    const { bytes } = await fetchSource(body.url, fetchDeps)
    return { operator: body.operator, src: { bytes, kind: detectKind(bytes) } }
  } catch (e) {
    if (e instanceof SourceError) return error(e.status, e.message)
    throw e
  }
}

/**
 * POST /api/parse (session) — multipart `{operator, file}` (PDF or saved HTML page) or JSON `{operator, url}`.
 * → `{ operator, validation, changes, baseSha }`, or `{ generic, error, baseSha }` when the operator's parser fails.
 */
export function createParse(deps: ParseDeps): (req: Request) => Promise<Response> {
  return guarded(async (req) => {
    const denied = requireSession(req, deps.env, deps.now())
    if (denied) return denied
    const gh = deps.github ? deps.github() : githubFromEnv(deps.env)
    if (!gh) return error(503, 'GITHUB_TOKEN / GITHUB_REPO non configurés')

    const input = await readInput(req, { fetch: deps.fetch, lookup: deps.lookup })
    if (input instanceof Response) return input
    const { operator: id, src } = input

    const file = await gh.getFile(TARIFFS_PATH)
    const prev = JSON.parse(file.content) as Tariffs

    let parsed: Operator
    try {
      const p = PARSERS[id]
      if (src.kind !== p.kind) throw new ParseError(`${id} : document ${src.kind.toUpperCase()} reçu, ${p.kind.toUpperCase()} attendu`)
      if (src.kind === 'pdf') await ensurePdfWorker()
      parsed = await p.parse(src.bytes)
    } catch (e) {
      const message = (e as Error).message
      let generic: GenericTable[] = []
      try {
        generic = await genericTables(src)
      } catch {
        /* unreadable document: empty table list, manual editing from scratch */
      }
      return json(200, { generic, error: message, baseSha: file.sha })
    }

    const next = mergeOperator(prev, id, parsed, new Date(deps.now()))
    return json(200, { operator: parsed, validation: validateTariffs(next, prev), changes: diffTariffs(prev, next), baseSha: file.sha })
  })
}

export function POST(req: Request): Promise<Response> {
  return createParse({ env: process.env, now: Date.now })(req)
}
