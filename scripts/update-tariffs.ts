import { readFileSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { OPERATORS } from '../src/tariffs/schema'
import type { Operator, OperatorId, Tariffs } from '../src/tariffs/schema'
import { diffTariffs, formatChange, mergeOperator, validateTariffs } from '../src/tariffs/validate'
import type { FeeChange } from '../src/tariffs/validate'
import { parseAirtel } from '../src/tariffs/parsers/airtel'
import { parseMvola } from '../src/tariffs/parsers/mvola'
import { parseOrange } from '../src/tariffs/parsers/orange'

export type Fetcher = (url: string) => Promise<Uint8Array>
export type UpdateOutcome = { operator: OperatorId; status: 'unchanged' | 'ok' | 'suspect' | 'failed'; changes: FeeChange[]; reasons: string[] }

const html = (b: Uint8Array) => new TextDecoder('utf-8').decode(b)
const PARSERS: Record<OperatorId, (b: Uint8Array) => Operator | Promise<Operator>> = {
  airtel: (b) => parseAirtel(html(b)),
  mvola: (b) => parseMvola(html(b)),
  orange: (b) => parseOrange(b),
}

/**
 * `next` holds only the `ok` operators merged; `withSuspect` also merges the
 * `suspect` ones (used for the review PR branch, never for main).
 */
export async function runUpdate(current: Tariffs, fetcher: Fetcher): Promise<{ next: Tariffs; withSuspect: Tariffs; outcomes: UpdateOutcome[] }> {
  let next = current
  let withSuspect = current
  const outcomes: UpdateOutcome[] = []
  for (const id of OPERATORS) {
    try {
      const bytes = await fetcher(current.operators[id].source.url)
      const parsed = await PARSERS[id](bytes)
      const merged = mergeOperator(current, id, parsed)
      const changes = diffTariffs(current, merged)
      if (changes.length === 0) {
        outcomes.push({ operator: id, status: 'unchanged', changes: [], reasons: [] })
        continue
      }
      const v = validateTariffs(merged, current)
      if (v.status === 'invalid') outcomes.push({ operator: id, status: 'failed', changes, reasons: v.reasons })
      else if (v.status === 'suspect') {
        withSuspect = mergeOperator(withSuspect, id, parsed)
        outcomes.push({ operator: id, status: 'suspect', changes, reasons: v.reasons })
      } else {
        next = mergeOperator(next, id, parsed)
        withSuspect = mergeOperator(withSuspect, id, parsed)
        outcomes.push({ operator: id, status: 'ok', changes, reasons: [] })
      }
    } catch (e) {
      outcomes.push({ operator: id, status: 'failed', changes: [], reasons: [e instanceof Error ? e.message : String(e)] })
    }
  }
  return { next, withSuspect, outcomes }
}

const httpFetcher: Fetcher = async (url) => {
  const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (compatible; CashRetraitBot/1.0)' }, signal: AbortSignal.timeout(60_000) })
  if (!res.ok) throw new Error(`HTTP ${res.status} pour ${url}`)
  return new Uint8Array(await res.arrayBuffer())
}

const isPdf = (b: Uint8Array) => b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46 // %PDF

/**
 * Some operator pages (Airtel) are rendered client-side: a plain HTTP fetch
 * returns an empty shell without the fee table. In that case, retry with a
 * headless browser and return the rendered DOM.
 */
export function withBrowserFallback(http: Fetcher, browser: Fetcher): Fetcher {
  return async (url) => {
    let first: Uint8Array | null = null
    try {
      first = await http(url)
      if (isPdf(first) || /<table[\s>]/i.test(new TextDecoder().decode(first))) return first
    } catch {
      // fall through to the browser
    }
    try {
      return await browser(url)
    } catch (e) {
      if (first) return first // let the parser report the missing table
      throw e
    }
  }
}

const browserFetcher: Fetcher = async (url) => {
  const { chromium } = await import('@playwright/test')
  const b = await chromium.launch(process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {})
  try {
    const page = await b.newPage({ locale: 'fr-FR' })
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 })
    await page.waitForSelector('table td', { timeout: 45_000 })
    return new TextEncoder().encode(await page.content())
  } finally {
    await b.close()
  }
}

function summary(outcomes: UpdateOutcome[], tariffs: Tariffs): string {
  const lines: string[] = ['# Mise à jour des tarifs', '']
  for (const o of outcomes) {
    if (o.status === 'unchanged' || o.status === 'failed') continue
    lines.push(`## ${tariffs.operators[o.operator].name} — ${o.status}`, '')
    for (const c of o.changes) lines.push(`- ${formatChange(c, 'fr', tariffs)}`)
    if (o.reasons.length) lines.push('', 'Raisons :', ...o.reasons.map((r) => `- ${r}`))
    lines.push('')
  }
  const failed = outcomes.filter((o) => o.status === 'failed')
  if (failed.length) {
    lines.push('## Échecs', '')
    for (const o of failed) lines.push(`- ${tariffs.operators[o.operator].name} :`, ...o.reasons.map((r) => `  - ${r}`))
    lines.push('')
  }
  return lines.join('\n')
}

async function main() {
  const current = JSON.parse(readFileSync('public/tarifs.json', 'utf8')) as Tariffs
  const { next, withSuspect, outcomes } = await runUpdate(current, withBrowserFallback(httpFetcher, browserFetcher))
  if (outcomes.some((o) => o.status === 'ok')) writeFileSync('public/tarifs.json', JSON.stringify(next, null, 2) + '\n')
  writeFileSync('update-suspect.json', JSON.stringify(withSuspect, null, 2) + '\n')
  writeFileSync('update-report.json', JSON.stringify(outcomes, null, 2) + '\n')
  writeFileSync('update-summary.md', summary(outcomes, withSuspect))
  for (const o of outcomes) console.log(`${o.operator}: ${o.status}${o.reasons.length ? ` (${o.reasons.join('; ')})` : ''}`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
