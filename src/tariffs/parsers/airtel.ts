import type { FeeTable, OperationKey, Operator } from '../schema'
import { ParseError, checkContiguous, checkRowWidths, findColumn, normalize, parseAmount, requireTiers, rowsToTable } from './common'
import { parseGenericTables } from './generic'

export const AIRTEL_URL = 'https://www.airtel.mg/airtelmoney/transaction_fees'

const COLUMNS: [OperationKey, string[]][] = [
  ['withdrawal', ['retrait', 'ayant un compte']],
  ['withdrawal_non_customer', ['retrait', "n'ayant pas"]],
  ['transfer_same', ['transfert', 'vers les abonnes']],
  ['transfer_other_op', ['transfert', 'autres operateurs']],
]

export function parseAirtel(html: string): Operator {
  const table = parseGenericTables(html).find((t) => t.headers.some((h) => normalize(h).includes('montant minimum')))
  if (!table) throw new ParseError('Airtel: tableau des frais introuvable')
  const iMin = findColumn(table.headers, ['montant minimum'], 'Airtel')
  const iMax = findColumn(table.headers, ['montant maximum'], 'Airtel')
  const cols = COLUMNS.map(([key, needles]) => [key, findColumn(table.headers, needles, 'Airtel')] as const)

  checkRowWidths(table.headers, table.rows, 'Airtel')
  const bounds = table.rows.map((r) => {
    const min = parseAmount(r[iMin] ?? '')
    const max = parseAmount(r[iMax] ?? '')
    if (min === null || max === null) throw new ParseError(`Airtel: bornes illisibles « ${r[iMin]} » / « ${r[iMax]} »`)
    return { min, max, row: r }
  })
  if (bounds.length < 15) throw new ParseError(`Airtel: ${bounds.length} lignes de paliers (< 15)`)
  checkContiguous(bounds, 'Airtel')

  const fees: Partial<Record<OperationKey, FeeTable>> = {}
  for (const [key, i] of cols) {
    fees[key] = requireTiers(rowsToTable(bounds.map((b) => ({ min: b.min, max: b.max, cell: b.row[i] ?? '' }))), 1, `Airtel ${key}`)
  }
  return {
    name: 'Airtel Money',
    source: { url: AIRTEL_URL, type: 'html', publishedAt: null },
    limits: { minTx: bounds[0].min, maxTx: bounds[bounds.length - 1].max, maxBalance: 20000000 },
    fees,
  }
}
