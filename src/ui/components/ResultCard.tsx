import type { ComponentChildren } from 'preact'
import type { OperatorId } from '../../tariffs/schema'
import type { PathKind } from '../../engine/paths'
import type { SplitOk, Tx } from '../../engine/types'
import type { InverseResult, MaxResult } from '../../engine/inverse'
import type { CalcMode } from '../state/favorites'
import type { Option } from '../calc'
import { t } from '../i18n'
import { formatAr } from '../format'
import { Plate } from './Plate'
import { OperatorBadge } from './OperatorBadge'
import { Icon } from './Icon'
import { Disclaimer } from './Disclaimer'

type Ok<T> = Extract<T, { ok: true }>

export function pathLabel(kind: PathKind | null, to: OperatorId | null): string {
  if (!kind) return ''
  return kind === 'non_customer' ? t('path.non_customer') : t(`path.${kind}`, { op: t(`op.${to}`) })
}

function PathLine({ kind, to }: { kind: PathKind | null; to: OperatorId | null }) {
  if (!kind) return null
  return (
    <p class="path-line">
      {kind === 'non_customer' || !to
        ? <span class="op-mono op-mono-icon" aria-hidden="true"><Icon name="user" size={18} /></span>
        : <OperatorBadge op={to} withName={false} />}
      <span>{pathLabel(kind, to)}</span>
    </p>
  )
}

/** One group of transactions, read like the lines of a fare board: amount … fee. */
function TxList({ title, txs }: { title: string; txs: Tx[] }) {
  return (
    <div class="tx-group">
      <h3 class="tx-head">{title}</h3>
      <ol class="tx-list">
        {txs.map((x, i) => (
          <li key={i} class="tx-row" aria-label={`${t('result.tx', { i: i + 1 })} : ${formatAr(x.amount)}, ${t('result.fee')} ${formatAr(x.fee)}`}>
            <span class="tx-n" aria-hidden="true">{i + 1}</span>
            <Plate amount={x.amount} size="m" />
            <span class="tx-leader" aria-hidden="true" />
            <span class="tx-fee" aria-hidden="true"><span class="tx-fee-label">{t('result.fee')}</span><Plate amount={x.fee} size="s" /></span>
          </li>
        ))}
      </ol>
    </div>
  )
}

const count = (base: string, n: number) => t(`${base}.${n === 1 ? 'one' : 'many'}`, { n })

function Savings({ savings, single, n, canSplit = true }: { savings: number; single: number | null; n: number; canSplit?: boolean }) {
  if (savings > 0) {
    const [before, after = ''] = t('result.savings', { amount: '{a}' }).split('{a}')
    return (
      <p class="result-savings"><Icon name="check" size={22} />
        <span>{before}<strong class="savings-num">{formatAr(savings)}</strong>{after}</span></p>
    )
  }
  if (single === null && n > 1) return <p class="result-note">{t('result.noSingle')}</p>
  return n === 1 && canSplit ? <p class="result-note">{t('result.noSavings')}</p> : null
}

/** The hero: the cheapest way, as plates, with total and savings. */
export function ResultCard({ mode, best, notIncl, senderPaid, canSplit, actions }: {
  mode: CalcMode; best: Option; notIncl?: boolean; senderPaid?: boolean; canSplit: boolean; actions: ComponentChildren
}) {
  let body: ComponentChildren
  if (mode === 'withdraw' || mode === 'send') {
    const r = best.result as SplitOk
    body = (
      <>
        <PathLine kind={best.kind} to={best.to} />
        <TxList title={count(`result.do.${mode}`, r.transactions.length)} txs={r.transactions} />
        <Total amount={r.total} />
        <Savings savings={r.savings} single={r.single} n={r.transactions.length} canSplit={canSplit} />
        {senderPaid && <p class="result-note">{t('result.senderPaid')}</p>}
      </>
    )
  } else if (mode === 'receive') {
    const r = best.result as Ok<InverseResult>
    const take = r.takeOut
    if (!take) {
      const savings = r.transfer.savings + r.withdrawal.savings
      body = (
        <>
          <PathLine kind={best.kind} to={best.to} />
          <Lead label={t('result.send')} amount={r.send} />
          <TxList title={count('result.do.send', r.transfer.transactions.length)} txs={r.transfer.transactions} />
          <TxList title={count('result.recipient', r.withdrawal.transactions.length)} txs={r.withdrawal.transactions} />
          <Total amount={r.total} />
          {savings > 0 && <Savings savings={savings} single={null} n={2} />}
          {notIncl && r.withdrawal.total > 0 && <p class="result-note">{t('result.notIncl')}</p>}
        </>
      )
    } else {
      // Fee not included: the recipient holds only the net, so the full-net withdrawal is shown as
      // information and only what he can really take out is listed as plates.
      const net = r.withdrawal.transactions.reduce((a, x) => a + x.amount, 0)
      body = (
        <>
          <PathLine kind={best.kind} to={best.to} />
          <Lead label={t('result.send')} amount={r.send} />
          <TxList title={count('result.do.send', r.transfer.transactions.length)} txs={r.transfer.transactions} />
          <Total amount={r.transfer.total} label={t('result.sendFees')} />
          {r.transfer.savings > 0 && <Savings savings={r.transfer.savings} single={null} n={2} />}
          {notIncl && <p class="result-note">{t('result.notIncl')}</p>}
          <p class="result-note" data-testid="notincl-fee">{t('result.notIncl.fee', { net: formatAr(net), fee: formatAr(r.withdrawal.total) })}</p>
          {take.ok
            ? (
              <>
                <TxList title={t('result.notIncl.canTake', { amount: formatAr(take.amount) })} txs={take.withdrawal.transactions} />
                <p class="result-note">{t('result.notIncl.left', { amount: formatAr(take.remaining) })}</p>
              </>
            )
            : <p class="result-note">{t('result.notIncl.none')}</p>}
        </>
      )
    }
  } else {
    const r = best.result as Ok<MaxResult>
    body = (
      <>
        <Lead label={t('result.max')} amount={r.amount} />
        <TxList title={count('result.do.withdraw', r.withdrawal.transactions.length)} txs={r.withdrawal.transactions} />
        <Total amount={r.withdrawal.total} />
        <p class="result-note">{t('result.remaining', { amount: formatAr(r.remaining) })}</p>
      </>
    )
  }
  return (
    <section class="result" aria-labelledby="result-title">
      <h2 id="result-title" class="result-title">{t('result.best')}</h2>
      {body}
      <div class="result-actions">{actions}</div>
      <Disclaimer compact />
    </section>
  )
}

function Lead({ label, amount }: { label: string; amount: number }) {
  return <p class="result-lead"><span class="result-lead-label">{label}</span><Plate amount={amount} size="l" /></p>
}

function Total({ amount, label }: { amount: number; label?: string }) {
  return <p class="result-total"><span class="result-total-label">{label ?? t('result.total')}</span><Plate amount={amount} size="l" /></p>
}

/** Next-cheapest ways, secondary: one row each with its total and the extra cost. */
export function Alternatives({ items, best }: { items: Option[]; best: number }) {
  if (!items.length) return null
  return (
    <section class="alts" aria-labelledby="alts-title">
      <h2 id="alts-title" class="section-title">{t('result.alternatives')}</h2>
      <ul class="board-list">
        {items.map((o, i) => (
          <li key={i} class="board-row alt-row">
            {o.kind === 'non_customer' || !o.to
              ? <span class="op-mono op-mono-icon" aria-hidden="true"><Icon name="user" size={18} /></span>
              : <OperatorBadge op={o.to} withName={false} />}
            <span class="board-row-text">
              <span class="board-row-title">{pathLabel(o.kind, o.to)}</span>
              {o.total > best && <span class="board-row-desc">{t('result.alt.more', { amount: formatAr(o.total - best) })}</span>}
            </span>
            <Plate amount={o.total} size="s" />
          </li>
        ))}
      </ul>
    </section>
  )
}
