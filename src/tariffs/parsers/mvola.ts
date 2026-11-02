import { load } from 'cheerio'
import type { FeeTable, OperationKey, Operator } from '../schema.js'
import { ParseError, checkContiguous, checkRowWidths, findColumn, normalize, parseAmount, requireTiers, rowsToTable } from './common.js'
import { parseGenericTables, type GenericTable } from './generic.js'

export const MVOLA_URL = 'https://mvola.mg/tarifs/'

/** « Entre 10 001 et 20 000 Ar » → { min, max } */
function parseRange(label: string): { min: number; max: number } | null {
  const m = normalize(label).match(/entre\s+([\d .  ]+?)\s+et\s+([\d .  ]+?)\s*ar\b/)
  if (!m) return null
  const min = parseAmount(m[1])
  const max = parseAmount(m[2])
  return min === null || max === null ? null : { min, max }
}

function pickTable(tables: GenericTable[], title: string, needles: string[][]): GenericTable {
  const t = tables.find((t) => normalize(t.headers[0] ?? '').startsWith(title) && needles.every((n) => t.headers.some((h) => n.every((x) => normalize(h).includes(x)))))
  if (!t) {
    const titled = tables.find((t) => normalize(t.headers[0] ?? '').startsWith(title))
    if (!titled) throw new ParseError(`MVola: tableau « ${title} » introuvable`)
    // Let findColumn report which column is missing.
    for (const n of needles) findColumn(titled.headers, n, `MVola ${title}`)
    throw new ParseError(`MVola: tableau « ${title} » incomplet`)
  }
  return t
}

/** Tier rows of a table; rows that are not « Entre X et Y Ar » must be explicitly allowed. */
function tiers(t: GenericTable, what: string, allow: (label: string) => boolean = () => false) {
  checkRowWidths(t.headers, t.rows, what)
  const rows = t.rows.flatMap((r) => {
    const range = parseRange(r[0] ?? '')
    if (range) return [{ ...range, row: r }]
    if (allow(normalize(r[0] ?? ''))) return []
    throw new ParseError(`${what}: ligne inattendue « ${r[0] ?? ''} »`)
  })
  checkContiguous(rows, what)
  return rows
}

const column = (rows: ReturnType<typeof tiers>, i: number): FeeTable =>
  rowsToTable(rows.map((r) => ({ min: r.min, max: r.max, cell: r.row[i] ?? '' })))

/** Footnote « (n) Transfert à partir de X Ar » referenced by a header label; a reference without its footnote throws. */
function footnoteMin(header: string, pageText: string): number | null {
  const ref = header.match(/\((\d+)\)\s*$/)
  if (!ref) return null
  const m = normalize(pageText).match(new RegExp(`\\(${ref[1]}\\)[^(]*?a partir de\\s+([\\d .]+?)\\s*ar\\b`))
  const min = m ? parseAmount(m[1]) : null
  if (min === null) throw new ParseError(`MVola: note (${ref[1]}) « à partir de X Ar » introuvable pour « ${header} »`)
  return min
}

export function parseMvola(html: string): Operator {
  const $ = load(html)
  const pageText = $('body').text()
  const date = normalize(pageText).match(/\bau (\d{2})-(\d{2})-(\d{4})\b/)
  const publishedAt = date ? `${date[3]}-${date[2]}-${date[1]}` : null

  const tables = parseGenericTables(html)
  const wd = pickTable(tables, "retrait d'argent", [['cash point']])
  const tr = pickTable(tables, "transfert d'argent", [['vers un abonne mvola'], ['autres operateurs'], ['non abonne mobile money']])

  const wdRows = tiers(wd, 'MVola retrait', (l) => l.includes('non abonne'))
  const trRows = tiers(tr, 'MVola transfert')
  if (wdRows.length < 15) throw new ParseError(`MVola retrait: ${wdRows.length} paliers (< 15)`)
  if (trRows.length < 15) throw new ParseError(`MVola transfert: ${trRows.length} paliers (< 15)`)

  const iCash = findColumn(wd.headers, ['cash point'], 'MVola retrait')
  const iSame = findColumn(tr.headers, ['vers un abonne mvola'], 'MVola transfert')
  const iOther = findColumn(tr.headers, ['autres operateurs'], 'MVola transfert')
  const iNon = findColumn(tr.headers, ['non abonne mobile money'], 'MVola transfert')

  const withdrawal = requireTiers(column(wdRows, iCash), 15, 'MVola withdrawal')
  const transfer_same = requireTiers(column(trRows, iSame), 15, 'MVola transfer_same')
  const transfer_other_op = requireTiers(column(trRows, iOther), 1, 'MVola transfer_other_op')
  const transfer_non_customer = requireTiers(column(trRows, iNon), 1, 'MVola transfer_non_customer')

  const otherMin = footnoteMin(tr.headers[iOther], pageText)
  if (otherMin !== null && transfer_other_op[0].min < otherMin) transfer_other_op[0] = { ...transfer_other_op[0], min: otherMin }

  // « Retrait par un non abonné MVola | GRATUIT » : withdrawing a coupon received via transfer_non_customer,
  // so it spans the amounts that can be sent to a non-customer.
  const nonRow = wd.rows.find((r) => normalize(r[0] ?? '').includes('non abonne'))
  const nonFee = nonRow ? parseAmount(nonRow[iCash] ?? '') : null
  if (nonFee === null) throw new ParseError('MVola: ligne « Retrait par un non abonné » introuvable')
  const withdrawal_non_customer: FeeTable = [
    { min: withdrawal[0].min, max: transfer_non_customer[transfer_non_customer.length - 1].max, fee: nonFee },
  ]

  return {
    name: 'MVola',
    source: { url: MVOLA_URL, type: 'html', publishedAt },
    limits: { minTx: withdrawal[0].min, maxTx: withdrawal[withdrawal.length - 1].max, maxBalance: 20000000 },
    fees: { withdrawal, withdrawal_non_customer, transfer_same, transfer_other_op, transfer_non_customer } satisfies Partial<Record<OperationKey, FeeTable>>,
  }
}
