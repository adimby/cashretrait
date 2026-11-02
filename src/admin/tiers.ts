import type { FeeTable, Tier } from '../tariffs/schema'
import type { GenericTable } from '../tariffs/parsers/generic'

export type TierField = 'min' | 'max' | 'fee'
export type FeeKind = 'fee' | 'pct'

export const tierKind = (t: Tier): FeeKind => ('feePercent' in t && t.feePercent !== undefined ? 'pct' : 'fee')
export const tierValue = (t: Tier): number => (tierKind(t) === 'pct' ? (t as { feePercent: number }).feePercent : (t as { fee: number }).fee)

const withValue = (t: Tier, kind: FeeKind, v: number): Tier =>
  kind === 'pct' ? { min: t.min, max: t.max, feePercent: v } : { min: t.min, max: t.max, fee: v }

/** New table where only `field` of tier `index` changed. `fee` sets the tier's fee value: Ar, or % on a percentage tier. */
export function applyEdit(table: FeeTable, index: number, field: TierField, value: number): FeeTable {
  return table.map((t, i) => {
    if (i !== index) return t
    if (field === 'fee') return withValue(t, tierKind(t), value)
    return { ...t, [field]: value }
  })
}

/** Switch a tier between a fixed fee (Ar) and a percentage, keeping the number typed. */
export function setKind(table: FeeTable, index: number, kind: FeeKind): FeeTable {
  return table.map((t, i) => (i !== index || tierKind(t) === kind ? t : withValue(t, kind, tierValue(t))))
}

/** Append a tier starting right after the last one (or at `min` for an empty table). */
export function addTier(table: FeeTable, min: number): FeeTable {
  const start = table.length ? table[table.length - 1].max + 1 : min
  return [...table, { min: start, max: start, fee: 0 }]
}

export function removeTier(table: FeeTable, index: number): FeeTable {
  return table.filter((_, i) => i !== index)
}

/** « 1 000 000 », « 25.000 Ar », « 1,5 % » → number; null when no number is present. */
export function parseAmount(s: string): number | null {
  const pct = /%/.test(s)
  let c = s.replace(/[\s  ]|Ar|ariary|%/gi, '')
  if (/,\d{1,2}$/.test(c)) c = c.replace(/\./g, '').replace(',', '.') // « 1,5 » decimal comma
  else if (!pct || /\.\d{3}/.test(c)) c = c.replace(/[.,](?=\d{3}(\D|$))/g, '') // « 25.000 » thousands
  if (!/^\d+(\.\d+)?$/.test(c)) return null
  return Number(c)
}

const feeOf = (cell: string): { fee: number } | { feePercent: number } | null => {
  const v = parseAmount(cell)
  if (v === null) return null
  return /%/.test(cell) ? { feePercent: v } : { fee: Math.round(v) }
}

export type ColumnMap = { range?: number; min?: number; max?: number; fee: number }

/** Turn a raw table into tiers, from either a range column (« 100 - 1 000 », « 1 001 à 5 000 ») or min/max columns. Unreadable rows are skipped. */
export function mapGenericTable(g: GenericTable, map: ColumnMap): FeeTable {
  const out: FeeTable = []
  for (const row of g.rows) {
    let min: number | null = null
    let max: number | null = null
    if (map.range !== undefined) {
      const m = /^\D*?(\d[\d\s.,\u00a0\u202f]*?)\s*(?:-|–|—|à|au)\s*(\d[\d\s.,\u00a0\u202f]*)\D*$/i.exec(row[map.range] ?? '')
      if (m) {
        min = parseAmount(m[1])
        max = parseAmount(m[2])
      }
    } else if (map.min !== undefined && map.max !== undefined) {
      min = parseAmount(row[map.min] ?? '')
      max = parseAmount(row[map.max] ?? '')
    }
    const fee = feeOf(row[map.fee] ?? '')
    if (min === null || max === null || !fee) continue
    out.push({ min, max, ...fee } as Tier)
  }
  return out
}

/** Git blob sha-1 of a UTF-8 text, as GitHub reports it for a file's content. */
export async function gitBlobSha(text: string): Promise<string> {
  const body = new TextEncoder().encode(text)
  const head = new TextEncoder().encode(`blob ${body.length}\0`)
  const all = new Uint8Array(head.length + body.length)
  all.set(head)
  all.set(body, head.length)
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-1', all))
  return [...digest].map((b) => b.toString(16).padStart(2, '0')).join('')
}
