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

/** « 1 000 » / « 1 000 Ar » → 1000 ; « Gratuit » → 0 ; « – », « - », « » → null. */
export function parseAmount(s: string): number | null {
  const n = normalize(s)
  if (n === '' || /^[-–—]+$/.test(n)) return null
  if (n.startsWith('gratuit')) return 0
  const m = n.match(/^(\d{1,3}(?:[ .  ]\d{3})+|\d+)(?:\s*ar)?\b/)
  if (!m) return null
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
