import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { MANUAL_REASON, runUpdate, type Fetcher } from '../../scripts/update-tariffs'
import type { Tariffs } from '../../src/tariffs/schema'

const current = JSON.parse(readFileSync('tests/fixtures/tarifs.snapshot.json', 'utf8')) as Tariffs
const fx = (n: string) => new Uint8Array(readFileSync(`tests/fixtures/${n}`))
const enc = (s: string) => new TextEncoder().encode(s)
const mvolaHtml = readFileSync('tests/fixtures/mvola.html', 'utf8')

function fetcherWith(over: { mvola?: Uint8Array; orange?: Error } = {}): Fetcher {
  return async (url) => {
    if (url === current.operators.airtel.source.url) return fx('airtel.html')
    if (url === current.operators.mvola.source.url) return over.mvola ?? fx('mvola.html')
    if (url === current.operators.orange.source.url) {
      if (over.orange) throw over.orange
      return fx('orange.pdf')
    }
    throw new Error(`unexpected url ${url}`)
  }
}
const status = (o: { outcomes: { operator: string; status: string }[] }, id: string) => o.outcomes.find((x) => x.operator === id)!.status

describe('runUpdate', () => {
  it('fixtures inchangées → unchanged (Airtel skipped)', async () => {
    const r = await runUpdate(current, fetcherWith())
    expect(r.outcomes.map((o) => o.status)).toEqual(['unchanged', 'skipped', 'unchanged'])
    expect(r.next).toEqual(current)
  })

  it('un frais MVola 1 300 → 1 400 : ok, 1 changement', async () => {
    const html = mvolaHtml.replace('<td width="157">1 300</td>', '<td width="157">1 400</td>')
    expect(html).not.toBe(mvolaHtml)
    const r = await runUpdate(current, fetcherWith({ mvola: enc(html) }))
    const mv = r.outcomes.find((o) => o.operator === 'mvola')!
    expect(mv.status).toBe('ok')
    expect(mv.changes).toHaveLength(1)
    expect(status(r, 'airtel')).toBe('skipped')
    expect(status(r, 'orange')).toBe('unchanged')
    expect(r.next.operators.mvola).not.toEqual(current.operators.mvola)
    expect(r.next.operators.airtel).toEqual(current.operators.airtel)
  })

  it('frais ×3 → suspect, next garde l’ancien MVola', async () => {
    const html = mvolaHtml.replace('<td width="157">1 300</td>', '<td width="157">3 900</td>')
    const r = await runUpdate(current, fetcherWith({ mvola: enc(html) }))
    const mv = r.outcomes.find((o) => o.operator === 'mvola')!
    expect(mv.status).toBe('suspect')
    expect(mv.reasons.length).toBeGreaterThan(0)
    expect(r.next.operators.mvola).toEqual(current.operators.mvola)
    expect(r.withSuspect.operators.mvola).not.toEqual(current.operators.mvola)
  })

  it('Orange en échec n’empêche pas les autres', async () => {
    const html = mvolaHtml.replace('<td width="157">1 300</td>', '<td width="157">1 400</td>')
    const r = await runUpdate(current, fetcherWith({ mvola: enc(html), orange: new Error('HTTP 403') }))
    const or = r.outcomes.find((o) => o.operator === 'orange')!
    expect(or.status).toBe('failed')
    expect(or.reasons.join()).toContain('403')
    expect(status(r, 'airtel')).toBe('skipped')
    expect(status(r, 'mvola')).toBe('ok')
  })

  it('page illisible (ParseError) → failed', async () => {
    const r = await runUpdate(current, fetcherWith({ mvola: enc('<html></html>') }))
    expect(status(r, 'mvola')).toBe('failed')
  })

  it('Airtel (mise à jour manuelle) → skipped, jamais téléchargé ni signalé en échec', async () => {
    const seen: string[] = []
    const base = fetcherWith()
    const r = await runUpdate(current, async (url) => { seen.push(url); return base(url) })
    const a = r.outcomes.find((o) => o.operator === 'airtel')!
    expect(a).toEqual({ operator: 'airtel', status: 'skipped', changes: [], reasons: [MANUAL_REASON] })
    expect(seen).not.toContain(current.operators.airtel.source.url)
    expect(r.next.operators.airtel).toEqual(current.operators.airtel)
    expect(r.outcomes.filter((o) => o.status === 'failed')).toEqual([])
  })
})
