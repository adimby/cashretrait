import type { FeeTable } from '../schema'

export class ParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ParseError'
  }
}

/** Lowercase, strip accents, unify apostrophes and collapse whitespace. */
export function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[‘’ʼ`´]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

export const isDash = (s: string) => /^[-\u2013\u2014]+$/.test(normalize(s))

const FREE = ['gratuit', 'maimaim-poana']
const AMOUNT = /^(\d{1,3}(?:[ .\u00a0\u202f]\d{3})+|\d+)(?: ?ar)?$/

/** Like parseAmount but never throws: anything that is not an amount gives null. */
export function tryParseAmount(s: string): number | null {
  try {
    return parseAmount(s)
  } catch {
    return null
  }
}

/**
 * « 1 000 » / « 1 000 Ar » → 1000 ; « Gratuit » / « Maimaim-poana » → 0 ; « – », « - », « » → null.
 * Any other non-empty text (« 1,5 », « 200 Ar/mois », « N/A »…) throws ParseError.
 */
export function parseAmount(s: string): number | null {
  const n = normalize(s)
  if (n === '' || isDash(n)) return null
  if (FREE.includes(n)) return 0
  const m = n.match(AMOUNT)
  if (!m) throw new ParseError(`montant illisible « ${s.trim()} »`)
  return Number(m[1].replace(/\D/g, ''))
}

export function rowsToTable(rows: { min: number; max: number; cell: string }[]): FeeTable {
  const out: FeeTable = []
  for (const r of rows) {
    const fee = parseAmount(r.cell)
    if (fee !== null) out.push({ min: r.min, max: r.max, fee })
  }
  return out
}

/** Index of the single header containing every needle (normalized substrings). Throws ParseError otherwise. */
export function findColumn(headers: string[], needles: string[], what: string): number {
  const ns = needles.map(normalize)
  const hits = headers.map((h, i) => [normalize(h), i] as const).filter(([h]) => ns.every((n) => h.includes(n)))
  if (hits.length !== 1) throw new ParseError(`${what}: colonne ${JSON.stringify(needles)} ${hits.length ? 'ambiguë' : 'introuvable'}`)
  return hits[0][1]
}

export function requireTiers(table: FeeTable, min: number, what: string): FeeTable {
  if (table.length < min) throw new ParseError(`${what}: ${table.length} paliers trouvés (< ${min})`)
  return table
}

/** Grid rows must chain without gap or overlap: each min === previous max + 1. */
export function checkContiguous(rows: { min: number; max: number }[], what: string): void {
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    if (r.min > r.max) throw new ParseError(`${what}: palier ${r.min}–${r.max} inversé`)
    if (i > 0 && r.min !== rows[i - 1].max + 1) throw new ParseError(`${what}: paliers non contigus (${rows[i - 1].max} → ${r.min})`)
  }
}

/** Every row must have at least as many cells as there are headers. */
export function checkRowWidths(headers: string[], rows: string[][], what: string): void {
  for (const r of rows) {
    if (r.length < headers.length) throw new ParseError(`${what}: ligne « ${r[0] ?? ''} » a ${r.length} cellules pour ${headers.length} en-têtes`)
  }
}
