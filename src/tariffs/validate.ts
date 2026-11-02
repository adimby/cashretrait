import { OPERATIONS, OPERATORS, TariffsSchema } from './schema'
import type { FeeTable, Operator, OperatorId, OperationKey, Tariffs, Tier } from './schema'

export type Validation = { status: 'ok' | 'suspect' | 'invalid'; reasons: string[] }
export type FeeChange = {
  operator: OperatorId
  operation: OperationKey
  min: number
  max: number
  before: number | null
  after: number | null
}

const value = (t: Tier): number => ('fee' in t && t.fee !== undefined ? t.fee : (t as { feePercent: number }).feePercent)
const kind = (t: Tier): string => ('fee' in t && t.fee !== undefined ? 'fee' : 'pct')
const fmt = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')

export function validateTariffs(next: unknown, prev: Tariffs | null): Validation {
  const parsed = TariffsSchema.safeParse(next)
  if (!parsed.success) {
    return { status: 'invalid', reasons: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`) }
  }
  const t = parsed.data
  const invalid: string[] = []
  const suspect: string[] = []

  for (const id of OPERATORS) {
    const op = t.operators[id]
    for (const key of OPERATIONS) {
      const table = op.fees[key]
      if (!table) continue
      table.forEach((tier, i) => {
        const where = `${id} ${key} ${tier.min}–${tier.max}`
        if (tier.min < op.limits.minTx || tier.max > op.limits.maxTx) invalid.push(`${where}: hors des limites`)
        if (i > 0) {
          const p = table[i - 1]
          if (tier.min !== p.max + 1) invalid.push(`${where}: palier non contigu ou non trié (précédent se termine à ${p.max})`)
          else if (kind(tier) === kind(p) && value(tier) < value(p)) suspect.push(`${where}: frais décroissant (${value(p)} → ${value(tier)})`)
        }
      })
    }
  }

  if (prev) {
    for (const id of OPERATORS) {
      const po = prev.operators[id]
      const no = t.operators[id]
      if (!po) continue
      if (!no) {
        suspect.push(`${id}: opérateur disparu`)
        continue
      }
      for (const key of OPERATIONS) {
        const pt = po.fees[key]
        if (!pt || pt.length === 0) continue
        const nt = no.fees[key]
        if (!nt || nt.length === 0) {
          suspect.push(`${id} ${key}: opération disparue`)
          continue
        }
        for (const old of pt) {
          const cur = nt.find((x) => x.min === old.min && x.max === old.max)
          if (!cur || kind(cur) !== kind(old)) continue
          const a = value(old)
          const b = value(cur)
          if (a === b) continue
          if (a === 0 || Math.abs(b - a) / a > 0.5) suspect.push(`${id} ${key} ${old.min}–${old.max}: variation > 50 % (${a} → ${b})`)
        }
      }
    }
  }

  if (invalid.length) return { status: 'invalid', reasons: invalid }
  if (suspect.length) return { status: 'suspect', reasons: suspect }
  return { status: 'ok', reasons: [] }
}

export function diffTariffs(prev: Tariffs, next: Tariffs): FeeChange[] {
  const out: FeeChange[] = []
  for (const operator of OPERATORS) {
    for (const operation of OPERATIONS) {
      const pt: FeeTable = prev.operators[operator]?.fees[operation] ?? []
      const nt: FeeTable = next.operators[operator]?.fees[operation] ?? []
      const ranges = new Map<string, [number, number]>()
      for (const x of [...pt, ...nt]) ranges.set(`${x.min}-${x.max}`, [x.min, x.max])
      const sorted = [...ranges.values()].sort((a, b) => a[0] - b[0] || a[1] - b[1])
      for (const [min, max] of sorted) {
        const p = pt.find((x) => x.min === min && x.max === max)
        const n = nt.find((x) => x.min === min && x.max === max)
        const before = p ? value(p) : null
        const after = n ? value(n) : null
        if (before !== after || (p && n && kind(p) !== kind(n))) out.push({ operator, operation, min, max, before, after })
      }
    }
  }
  return out
}

const OP_NAMES: Record<'fr' | 'mg', Record<OperationKey, string>> = {
  fr: {
    withdrawal: 'retrait',
    withdrawal_non_customer: 'retrait non-abonné',
    transfer_same: 'transfert',
    transfer_same_app: 'transfert appli',
    transfer_other_op: 'transfert autres opérateurs',
    transfer_non_customer: 'transfert non-abonné',
  },
  mg: {
    withdrawal: 'fisintonana',
    withdrawal_non_customer: 'fisintonana tsy mpanjifa',
    transfer_same: 'fandefasana',
    transfer_same_app: 'fandefasana appli',
    transfer_other_op: 'fandefasana tambazotra hafa',
    transfer_non_customer: 'fandefasana tsy mpanjifa',
  },
}
const OPERATOR_NAMES: Record<OperatorId, string> = { mvola: 'MVola', airtel: 'Airtel Money', orange: 'Orange Money' }

export function formatChange(c: FeeChange, lang: 'fr' | 'mg', tariffs?: Tariffs): string {
  const name = tariffs?.operators[c.operator]?.name ?? OPERATOR_NAMES[c.operator]
  const v = (n: number | null) => (n === null ? '—' : fmt(n))
  return `${name} ${OP_NAMES[lang][c.operation]} ${fmt(c.min)}–${fmt(c.max)} : ${v(c.before)} → ${v(c.after)}`
}

export function mergeOperator(prev: Tariffs, id: OperatorId, op: Operator, now: Date = new Date()): Tariffs {
  return { ...prev, updatedAt: now.toISOString(), operators: { ...prev.operators, [id]: op } }
}
