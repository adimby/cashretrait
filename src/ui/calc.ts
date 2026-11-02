import { OPERATORS, type FeeTable, type OperationKey, type OperatorId, type Tariffs } from '../tariffs/schema'
import { optimizeSplit } from '../engine/optimize'
import { maxWithdrawable, type InverseResult, type MaxResult } from '../engine/inverse'
import { sendPaths, type PathKind } from '../engine/paths'
import { tierHint } from '../engine/hints'
import { optsFor, type BaseOpts } from '../engine/limits'
import type { Fail, SplitOk } from '../engine/types'
import type { CalcMode, FavParams } from './state/favorites'

export type Dest = OperatorId | 'none' | 'any'
export type CalcForm = { mode: CalcMode; op: OperatorId; to: Dest; amount: number | null; customer: boolean; incl: boolean }
export const DEFAULT_FORM: CalcForm = { mode: 'withdraw', op: 'mvola', to: 'mvola', amount: null, customer: true, incl: true }

type Ok<T> = Extract<T, { ok: true }>
export type Option = {
  kind: PathKind | null
  to: OperatorId | null
  total: number
  result: SplitOk | Ok<InverseResult> | Ok<MaxResult>
}
export type ChartData = { table: FeeTable; key: OperationKey; op: OperatorId; amount: number; splits: number[] }
export type Hint = { amount: number; fee: number; currentFee: number }
export type Outcome =
  | { status: 'empty' }
  | { status: 'fail'; reason: Fail['reason'] }
  | { status: 'ok'; best: Option; alternatives: Option[]; hint: Hint | null; chart: ChartData | null }

const isOp = (v: unknown): v is OperatorId => (OPERATORS as readonly unknown[]).includes(v)

/** Keeps `to` meaningful for the mode: send → operator or 'none'; receive → operator or 'any'. */
export function normalizeDest(mode: CalcMode, to: Dest, op: OperatorId): Dest {
  if (mode === 'send') return to === 'any' ? op : to
  if (mode === 'receive') return to === 'none' ? 'any' : to
  return to
}

/** Whether a withdrawal without account is offered by `op`. */
export const hasNonCustomer = (t: Tariffs, op: OperatorId) => !!t.operators[op].fees.withdrawal_non_customer

const splitHint = (table: FeeTable, amount: number, best: number, opts: ReturnType<typeof optsFor>): Hint | null => {
  const h = tierHint(table, amount, opts.step)
  if (!h) return null
  const r = optimizeSplit(table, h.amount, opts)
  // Compared with the best split, not the one-go fee: splitting usually already captures the saving
  // (then the hint stays quiet); it speaks when it still saves ≥ 20 %, e.g. with maxTx = 1.
  return r.ok && r.total <= 0.8 * best ? { amount: h.amount, fee: r.total, currentFee: best } : null
}

const SEND_KIND: Record<PathKind, OperationKey> = {
  same: 'transfer_same', same_app: 'transfer_same_app', other_op: 'transfer_other_op', non_customer: 'transfer_non_customer',
}

/** Runs the engine for one form state. Pure: no signals, no DOM. */
export function compute(t: Tariffs, f: CalcForm, base: BaseOpts): Outcome {
  if (f.amount === null || f.amount <= 0) return { status: 'empty' }
  const amount = f.amount
  const fees = t.operators[f.op].fees
  const opts = optsFor(t, f.op, base)

  if (f.mode === 'withdraw') {
    const key: OperationKey = f.customer || !hasNonCustomer(t, f.op) ? 'withdrawal' : 'withdrawal_non_customer'
    const table = fees[key]
    if (!table) return { status: 'fail', reason: 'unavailable' }
    const r = optimizeSplit(table, amount, opts)
    if (!r.ok) return { status: 'fail', reason: r.reason }
    return {
      status: 'ok', best: { kind: null, to: null, total: r.total, result: r }, alternatives: [],
      hint: splitHint(table, amount, r.total, opts),
      chart: { table, key, op: f.op, amount, splits: r.transactions.map((x) => x.amount) },
    }
  }

  if (f.mode === 'send') {
    const to = normalizeDest('send', f.to, f.op)
    const kinds: PathKind[] = to === 'none' ? ['non_customer'] : to === f.op ? ['same', 'same_app'] : ['other_op']
    let reason: Fail['reason'] = 'unavailable'
    const found: (Option & { key: OperationKey; table: FeeTable })[] = []
    for (const kind of kinds) {
      const key = SEND_KIND[kind]
      const table = fees[key]
      if (!table) continue
      const r = optimizeSplit(table, amount, opts)
      if (!r.ok) { reason = r.reason; continue }
      found.push({ kind, to: isOp(to) ? to : null, total: r.total, result: r, key, table })
    }
    if (!found.length) return { status: 'fail', reason }
    found.sort((a, b) => a.total - b.total)
    const [b, ...rest] = found
    const best = b.result as SplitOk
    return {
      status: 'ok', best: b, alternatives: rest, hint: splitHint(b.table, amount, b.total, opts),
      chart: { table: b.table, key: b.key, op: f.op, amount, splits: best.transactions.map((x) => x.amount) },
    }
  }

  if (f.mode === 'receive') {
    const to = normalizeDest('receive', f.to, f.op)
    const paths = sendPaths(t, f.op, to === 'any' || to === 'none' ? null : to, amount, f.incl, base)
    if (!paths.length) {
      // Tell why: try the recipient's own withdrawal first, it is the usual blocker.
      const dest = isOp(to) ? to : f.op
      const w = t.operators[dest].fees.withdrawal
      const r = w ? optimizeSplit(w, amount, optsFor(t, dest, base)) : null
      return { status: 'fail', reason: r && !r.ok ? r.reason : 'unavailable' }
    }
    const opts_ = paths.map((p): Option => {
      const r = p.result as Ok<InverseResult>
      return { kind: p.kind, to: p.to, total: r.total, result: r }
    })
    const [b, ...rest] = opts_
    const r = b.result as Ok<InverseResult>
    const key = SEND_KIND[b.kind!]
    const table = fees[key]!
    return {
      status: 'ok', best: b, alternatives: rest, hint: null,
      chart: { table, key, op: f.op, amount: r.send, splits: r.transfer.transactions.map((x) => x.amount) },
    }
  }

  const table = fees.withdrawal
  if (!table) return { status: 'fail', reason: 'unavailable' }
  const r = maxWithdrawable(table, amount, opts)
  if (!r.ok) return { status: 'fail', reason: r.reason }
  return {
    status: 'ok', best: { kind: null, to: null, total: r.withdrawal.total, result: r }, alternatives: [], hint: null,
    chart: { table, key: 'withdrawal', op: f.op, amount: r.amount, splits: r.withdrawal.transactions.map((x) => x.amount) },
  }
}

/** The fields of the form that matter for a mode (favorites, equality). */
export function paramsOf(f: CalcForm): FavParams {
  const p: FavParams = { op: f.op, amount: f.amount ?? 0 }
  if (f.mode === 'withdraw') p.customer = f.customer
  if (f.mode === 'send' || f.mode === 'receive') p.to = normalizeDest(f.mode, f.to, f.op)
  if (f.mode === 'receive') p.incl = f.incl
  return p
}

/** Form from a stored favorite; anything unexpected falls back to the defaults. */
export function formFrom(mode: CalcMode, p: FavParams): CalcForm {
  const op = isOp(p.op) ? p.op : DEFAULT_FORM.op
  const to: Dest = isOp(p.to) || p.to === 'none' || p.to === 'any' ? p.to : op
  const amount = typeof p.amount === 'number' && Number.isInteger(p.amount) && p.amount > 0 ? p.amount : null
  return {
    mode, op, to: normalizeDest(mode, to, op), amount,
    customer: typeof p.customer === 'boolean' ? p.customer : true,
    incl: typeof p.incl === 'boolean' ? p.incl : true,
  }
}
