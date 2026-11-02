import type { OperatorId } from '../tariffs/schema'
import type { SplitOk, Tx } from '../engine/types'
import type { InverseResult, MaxResult } from '../engine/inverse'
import type { CalcMode } from './state/favorites'
import { tl, type Lang } from './i18n'
import { formatAr } from './format'

export type ShareContext = { op?: OperatorId; path?: string }
type Ok<T> = Extract<T, { ok: true }>

const sum = (txs: Tx[]) => txs.reduce((s, x) => s + x.amount, 0)

/** Plain-text summary of a result, for WhatsApp/SMS. Never contains USSD codes. */
export function shareText(mode: CalcMode, result: SplitOk | InverseResult | MaxResult, lang: Lang, ctx: ShareContext = {}): string {
  const t = (k: string, v?: Record<string, string | number>) => tl(lang, k, v)
  if (!result.ok) return ''
  const txLines = (txs: Tx[]) => txs.map((x, i) => t('share.tx', { i: i + 1, amount: formatAr(x.amount), fee: formatAr(x.fee) }))
  const count = (base: string, n: number) => t(`${base}.${n === 1 ? 'one' : 'many'}`, { n })
  const op = ctx.op ? t('share.with', { op: t(`op.${ctx.op}`) }) : ''
  const lines: string[] = []

  if (mode === 'withdraw' || mode === 'send') {
    const r = result as SplitOk
    lines.push(t(`share.title.${mode}`, { amount: formatAr(sum(r.transactions)) }) + op)
    if (ctx.path) lines.push(ctx.path)
    lines.push(count(`result.do.${mode}`, r.transactions.length), ...txLines(r.transactions))
    lines.push(t('share.total', { amount: formatAr(r.total) }))
    if (r.savings > 0) lines.push(t('result.savings', { amount: formatAr(r.savings) }))
  } else if (mode === 'receive') {
    const r = result as Ok<InverseResult>
    lines.push(t('share.title.receive', { amount: formatAr(sum(r.withdrawal.transactions)) }) + op)
    if (ctx.path) lines.push(ctx.path)
    lines.push(t('share.send', { amount: formatAr(r.send) }))
    lines.push(count('result.do.send', r.transfer.transactions.length), ...txLines(r.transfer.transactions))
    lines.push(count('result.recipient', r.withdrawal.transactions.length), ...txLines(r.withdrawal.transactions))
    lines.push(t('share.total', { amount: formatAr(r.total) }))
  } else {
    const r = result as Ok<MaxResult>
    lines.push(t('share.title.max', { amount: formatAr(r.amount + r.withdrawal.total + r.remaining) }) + op)
    lines.push(t('share.max', { amount: formatAr(r.amount) }))
    lines.push(count('result.do.withdraw', r.withdrawal.transactions.length), ...txLines(r.withdrawal.transactions))
    lines.push(t('share.total', { amount: formatAr(r.withdrawal.total) }))
    lines.push(t('result.remaining', { amount: formatAr(r.remaining) }))
  }
  lines.push('', t('share.footer'))
  return lines.join('\n')
}

/** Native share sheet when available, otherwise copy to the clipboard. */
export async function share(text: string): Promise<'shared' | 'copied' | 'failed'> {
  const r = await shareDetailed(text)
  return r === 'cancelled' ? 'failed' : r
}

/** Like `share`, but tells a closed share sheet ('cancelled') from a real failure. */
export async function shareDetailed(text: string): Promise<'shared' | 'copied' | 'cancelled' | 'failed'> {
  const nav = globalThis.navigator as (Navigator & { share?: (d: ShareData) => Promise<void> }) | undefined
  if (nav && typeof nav.share === 'function') {
    try {
      await nav.share({ text })
      return 'shared'
    } catch (e) {
      // The person closed the share sheet: nothing to do.
      if ((e as { name?: string })?.name === 'AbortError') return 'cancelled'
    }
  }
  try {
    if (nav?.clipboard?.writeText) {
      await nav.clipboard.writeText(text)
      return 'copied'
    }
  } catch {
    /* clipboard blocked */
  }
  return 'failed'
}
