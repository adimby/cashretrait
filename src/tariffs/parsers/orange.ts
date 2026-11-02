import type { FeeTable, OperationKey, Operator } from '../schema'
import { ParseError, checkContiguous, isDash, normalize, parseAmount, rowsToTable, tryParseAmount } from './common'

export const ORANGE_URL = 'https://www.orange.mg/omg-b2c/resources/other/PLAN_TARIFS_ORANGE_MONEY_MAJ_1_A4.pdf'

const MONTHS = ['janoary', 'febroary', 'martsa', 'aprily', 'mey', 'jona', 'jolay', 'aogositra', 'septambra', 'oktobra', 'novambra', 'desambra']

/** Header label needles (normalized substrings) → column. `null` = column read but not mapped to an operation. */
const VALUE_COLUMNS: { key: OperationKey | null; needles: string[] }[] = [
  { key: 'withdrawal', needles: ['fisintonam-bola', 'retrait'] },
  { key: 'transfer_same', needles: ['#144#'] },
  { key: 'transfer_same_app', needles: ['appli'] },
  { key: 'transfer_other_op', needles: ['tambazotra', 'autres reseaux'] },
  { key: null, needles: ['microfinance'] },
  { key: 'transfer_non_customer', needles: ['izycash'] },
]

export type PdfItem = { x: number; y: number; width: number; str: string }

const LINE_TOLERANCE = 2

export async function extractPdfItems(pdf: Uint8Array): Promise<PdfItem[]> {
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs')
  // Plain Uint8Array copy: pdfjs rejects Node Buffers and may detach the buffer it is given.
  const task = getDocument({ data: new Uint8Array(pdf), isEvalSupported: false, useSystemFonts: false, verbosity: 0 })
  try {
    const doc = await task.promise
    const items: PdfItem[] = []
    for (let p = 1; p <= doc.numPages; p++) {
      const content = await (await doc.getPage(p)).getTextContent()
      for (const it of content.items) {
        if (!('str' in it) || !it.str.trim()) continue
        // Offset y per page so lines of different pages never merge.
        items.push({ x: it.transform[4], y: it.transform[5] - p * 10000, width: it.width, str: it.str })
      }
    }
    return items
  } catch (e) {
    throw new ParseError(`Orange: PDF illisible (${(e as Error).message})`)
  } finally {
    await task.destroy()
  }
}

/** Cluster items into lines (top to bottom): an item joins the current line if within ±LINE_TOLERANCE of its first item's y. */
export function groupLines(items: PdfItem[]): PdfItem[][] {
  const sorted = [...items].sort((a, b) => b.y - a.y)
  const lines: PdfItem[][] = []
  for (const it of sorted) {
    const cur = lines[lines.length - 1]
    if (cur && Math.abs(cur[0].y - it.y) <= LINE_TOLERANCE) cur.push(it)
    else lines.push([it])
  }
  return lines.map((l) => l.sort((a, b) => a.x - b.x))
}

const center = (i: PdfItem) => i.x + i.width / 2

export function parseOrangeItems(items: PdfItem[]): Operator {
  const find = (needles: string[], pool: PdfItem[], what: string) => {
    const hits = pool.filter((i) => needles.some((n) => normalize(i.str).includes(n)))
    if (hits.length !== 1) throw new ParseError(`Orange: en-tête « ${what} » ${hits.length ? 'ambigu' : 'introuvable'}`)
    return hits[0]
  }

  // The « Mpiara miasa » (partners) block sits in a right-hand column, beyond IzyCash.
  const izy = find(['izycash'], items, 'IzyCash')
  const partners = items.find((i) => normalize(i.str).includes('mpiara miasa'))
  const xLimit = partners && partners.x > izy.x ? (center(izy) + partners.x) / 2 + 20 : Infinity
  const left = items.filter((i) => i.x < xLimit)

  const minHead = find(['minimum'], left, 'Minimum')
  const headerBand = left.filter((i) => i.y >= minHead.y - 20)
  const maxHead = find(['maximum'], headerBand, 'Maximum')
  const columns = [
    { key: 'min' as const, x: center(minHead) },
    { key: 'max' as const, x: center(maxHead) },
    ...VALUE_COLUMNS.map((c, idx) => ({ key: idx, x: center(find(c.needles, headerBand, c.needles[0])) })),
  ]
  const nearest = (i: PdfItem) => columns.reduce((a, b) => (Math.abs(b.x - center(i)) < Math.abs(a.x - center(i)) ? b : a)).key

  const tiers: { min: number; max: number; values: string[] }[] = []
  for (const line of groupLines(left.filter((i) => i.y < minHead.y - LINE_TOLERANCE))) {
    const cells = new Map<string | number, string>()
    let conflict: string | null = null
    for (const it of line) {
      const k = nearest(it)
      if (cells.has(k)) conflict = `« ${cells.get(k)} » / « ${it.str.trim()} »`
      cells.set(k, it.str.trim())
    }
    const min = tryParseAmount(cells.get('min') ?? '')
    const max = tryParseAmount(cells.get('max') ?? '')
    if (min == null || max == null) continue // not a tier line (footnotes, titles)
    if (conflict) throw new ParseError(`Orange: deux valeurs dans la même colonne (${conflict})`)
    const values = VALUE_COLUMNS.map((_, idx) => cells.get(idx) ?? '')
    if (values.every((v) => v === '' || isDash(v))) throw new ParseError(`Orange: palier ${min}–${max} sans aucune valeur`)
    values.forEach((v) => parseAmount(v)) // throws on garbage
    tiers.push({ min, max, values })
  }
  if (tiers.length < 15) throw new ParseError(`Orange: ${tiers.length} lignes de paliers trouvées (< 15)`)
  checkContiguous(tiers, 'Orange')

  const fees: Partial<Record<OperationKey, FeeTable>> = {}
  VALUE_COLUMNS.forEach(({ key }, i) => {
    if (key) fees[key] = rowsToTable(tiers.map((t) => ({ min: t.min, max: t.max, cell: t.values[i] })))
  })

  const text = normalize(groupLines(items).map((l) => l.map((i) => i.str).join(' ')).join(' '))
  const d = text.match(new RegExp(`manomboka ny\\b.{0,200}?\\b(\\d{1,2}) (${MONTHS.join('|')}) (\\d{4})\\b`))
  const publishedAt = d ? `${d[3]}-${String(MONTHS.indexOf(d[2]) + 1).padStart(2, '0')}-${d[1].padStart(2, '0')}` : null

  // « Tetibola ambony indrindra : 20 000 000Ar » = maximum balance.
  const bal = text.match(/tetibola ambony indrindra\s*:\s*([\d .]+?)\s*ar\b/)
  const maxBalance = (bal && tryParseAmount(bal[1])) || 20000000

  return {
    name: 'Orange Money',
    source: { url: ORANGE_URL, type: 'pdf', publishedAt },
    limits: { minTx: tiers[0].min, maxTx: maxBalance, maxBalance },
    fees,
  }
}

export async function parseOrange(pdf: Uint8Array): Promise<Operator> {
  return parseOrangeItems(await extractPdfItems(pdf))
}
