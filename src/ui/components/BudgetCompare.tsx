import type { SameBudget } from '../../engine/budget'
import { t } from '../i18n'
import { formatAr, formatNumber } from '../format'
import { Plate } from './Plate'
import { Icon } from './Icon'

/**
 * « Même budget, plus d'argent » (Retirer only): the classic one-go withdrawal next to the largest
 * amount the same debit buys when split. A real table: rows Retiré / Frais / Débité, two columns.
 */
export function BudgetCompare({ data }: { data: SameBudget }) {
  const { classic, better } = data
  const n = better.withdrawal.transactions.length
  const betterHead = t(`budget.col.better.${n === 1 ? 'one' : 'many'}`, { n })
  const rows: [string, number, number][] = [
    [t('budget.row.take'), classic.amount, better.amount],
    [t('budget.row.fee'), classic.fee, better.withdrawal.total],
    [t('budget.row.debited'), classic.debited, better.debited],
  ]
  const [before, after = ''] = t('budget.extra', { amount: '{a}' }).split('{a}')
  return (
    <section class="budget" aria-labelledby="budget-title" data-testid="budget">
      <h2 id="budget-title" class="budget-title">{t('budget.title')}</h2>
      <p class="budget-intro">{t('budget.intro', { amount: formatAr(classic.amount), debited: formatAr(classic.debited) })}</p>
      <table class="budget-table">
        <caption class="visually-hidden">{t('budget.title')}</caption>
        <thead>
          <tr>
            <td />
            <th scope="col">{t('budget.col.classic')}</th>
            <th scope="col" class="is-better">{betterHead}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, a, b], i) => (
            <tr key={i} class={i === 0 ? 'is-take' : undefined}>
              <th scope="row">{label}</th>
              <td><Plate amount={a} size="s" /></td>
              <td class="is-better"><Plate amount={b} size="s" /></td>
            </tr>
          ))}
        </tbody>
      </table>
      <p class="budget-extra"><Icon name="check" size={20} />
        <span>{before}<strong class="savings-num">{formatAr(better.extra)}</strong>{after}</span></p>
      <p class="budget-note">
        {t('budget.split', { list: `${better.withdrawal.transactions.map((x) => formatNumber(x.amount)).join(' + ')} Ar` })}
        {better.left > 0 && <> {t('budget.left', { amount: formatAr(better.left) })}</>}
      </p>
    </section>
  )
}
