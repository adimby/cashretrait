import type { FeeTable, OperationKey, Operator } from '../schema'
import { ParseError, normalize, parseAmount, rowsToTable } from './common'

export const ORANGE_URL = 'https://www.orange.mg/omg-b2c/resources/other/PLAN_TARIFS_ORANGE_MONEY_MAJ_1_A4.pdf'

const MONTHS = ['janoary', 'febroary', 'martsa', 'aprily', 'mey', 'jona', 'jolay', 'aogositra', 'septambra', 'oktobra', 'novambra', 'desambra']

/** Value columns after (min, max), in PDF order. `null` = column not mapped to an operation. */
const VALUE_COLUMNS: (OperationKey | null)[] = [
  'withdrawal', // Fisintonam-bola
  'transfer_same', // Mankany @ Orange Money #144#
  'transfer_same_app', // Mankany @ Orange Money @ Appli
  'transfer_other_op', // Mankany @ tambazotra hafa
  null, // Mankany @ microfinances
  'transfer_non_customer', // IzyCash
]

type Item = { x: number; y: number; str: string }

async function textItems(pdf: Uint8Array): Promise<Item[]> {
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs')
  try {
    // pdfjs takes ownership of (and may detach) the buffer: hand it a copy.
    const doc = await getDocument({ data: pdf.slice(), isEvalSupported: false, useSystemFonts: false, verbosity: 0 }).promise
    const items: Item[] = []
    for (let p = 1; p <= doc.numPages; p++) {
      const content = await (await doc.getPage(p)).getTextContent()
      for (const it of content.items) {
        if (!('str' in it) || !it.str.trim()) continue
        // Offset y per page so lines of different pages never merge.
        items.push({ x: it.transform[4], y: Math.round(it.transform[5]) - p * 10000, str: it.str })
      }
    }
    await doc.destroy()
    return items
  } catch (e) {
    throw new ParseError(`Orange: PDF illisible (${(e as Error).message})`)
  }
}

function groupLines(items: Item[]): Item[][] {
  const lines = new Map<number, Item[]>()
  for (const it of items) {
    const line = lines.get(it.y)
    if (line) line.push(it)
    else lines.set(it.y, [it])
  }
  return [...lines.entries()].sort((a, b) => b[0] - a[0]).map(([, l]) => l.sort((a, b) => a.x - b.x))
}

export async function parseOrange(pdf: Uint8Array): Promise<Operator> {
  const items = await textItems(pdf)
  const lines = groupLines(items)

  // The « Mpiara miasa » (partners) block sits in a right-hand column, beyond IzyCash.
  const izy = items.find((i) => normalize(i.str).includes('izycash'))
  const partners = items.find((i) => normalize(i.str).includes('mpiara miasa'))
  if (!izy) throw new ParseError('Orange: colonne IzyCash introuvable')
  const xLimit = partners && partners.x > izy.x ? (izy.x + partners.x) / 2 + 20 : Infinity

  const tiers: { min: number; max: number; values: string[] }[] = []
  for (const line of lines) {
    const cells = line.filter((i) => i.x < xLimit).map((i) => i.str.trim())
    if (cells.length !== 2 + VALUE_COLUMNS.length) continue
    const min = parseAmount(cells[0])
    const max = parseAmount(cells[1])
    if (min === null || max === null || min > max) continue
    if (!cells.slice(2).every((c) => parseAmount(c) !== null || /^[-–—]$/.test(c))) continue
    tiers.push({ min, max, values: cells.slice(2) })
  }
  if (tiers.length < 15) throw new ParseError(`Orange: ${tiers.length} lignes de paliers trouvées (< 15)`)

  const fees: Partial<Record<OperationKey, FeeTable>> = {}
  VALUE_COLUMNS.forEach((key, i) => {
    if (key) fees[key] = rowsToTable(tiers.map((t) => ({ min: t.min, max: t.max, cell: t.values[i] })))
  })

  const text = normalize(lines.map((l) => l.map((i) => i.str).join(' ')).join(' '))
  const d = text.match(new RegExp(`manomboka ny\\b.{0,200}?\\b(\\d{1,2}) (${MONTHS.join('|')}) (\\d{4})\\b`))
  const publishedAt = d ? `${d[3]}-${String(MONTHS.indexOf(d[2]) + 1).padStart(2, '0')}-${d[1].padStart(2, '0')}` : null

  // « Tetibola ambony indrindra : 20 000 000Ar » = maximum balance.
  const bal = text.match(/tetibola ambony indrindra\s*:\s*([\d .]+?)\s*ar\b/)
  const maxBalance = (bal && parseAmount(bal[1])) || 20000000

  return {
    name: 'Orange Money',
    source: { url: ORANGE_URL, type: 'pdf', publishedAt },
    limits: { minTx: tiers[0].min, maxTx: maxBalance, maxBalance },
    fees,
  }
}
