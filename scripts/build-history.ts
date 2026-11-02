import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { TariffsSchema } from '../src/tariffs/schema'
import type { Tariffs } from '../src/tariffs/schema'
import { diffTariffs } from '../src/tariffs/validate'
import type { FeeChange } from '../src/tariffs/validate'

export type HistoryEntry = { date: string; changes: FeeChange[] }

/** Chronological history of fee changes; versions with no change are omitted. */
export function buildHistory(versions: { date: string; tariffs: Tariffs }[]): HistoryEntry[] {
  const sorted = [...versions].sort((a, b) => Date.parse(a.date) - Date.parse(b.date))
  const out: HistoryEntry[] = []
  for (let i = 1; i < sorted.length; i++) {
    const changes = diffTariffs(sorted[i - 1].tariffs, sorted[i].tariffs)
    if (changes.length) out.push({ date: sorted[i].date, changes })
  }
  return out
}

const git = (...args: string[]) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] })

function loadVersions(): { date: string; tariffs: Tariffs }[] {
  const versions: { date: string; tariffs: Tariffs }[] = []
  for (const line of git('log', '--format=%H%x09%cI', '--', 'public/tarifs.json').split('\n')) {
    const [sha, date] = line.split('\t')
    if (!sha || !date) continue
    try {
      const parsed = TariffsSchema.safeParse(JSON.parse(git('show', `${sha}:public/tarifs.json`)))
      if (parsed.success) versions.push({ date, tariffs: parsed.data })
    } catch {
      // unreadable or invalid version: skip
    }
  }
  return versions
}

function main() {
  let history: HistoryEntry[] = []
  try {
    if (git('rev-parse', '--is-shallow-repository').trim() === 'true') console.warn('build-history: clone superficiel, historique incomplet')
    history = buildHistory(loadVersions())
  } catch (e) {
    console.warn('build-history: historique Git indisponible, écriture de []', e instanceof Error ? e.message : e)
  }
  mkdirSync('public', { recursive: true })
  writeFileSync('public/tarifs-history.json', JSON.stringify(history) + '\n')
  console.log(`build-history: ${history.length} entrée(s)`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main()
