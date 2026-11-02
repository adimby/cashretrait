import { useMemo } from 'preact/hooks'
import { monthlyCost, type MonthlyRow, type Usage } from '../../engine/monthly'
import { t } from '../i18n'
import { formatAr } from '../format'
import { settings } from '../state/settings'
import { tariffs } from '../state/tariffs'
import { usages, setUsages, USAGE_OPS, MAX_USAGES, PER_MONTH_MAX, type UsageDraft } from '../state/usages'
import { AmountInput } from '../components/AmountInput'
import { OperatorBadge } from '../components/OperatorBadge'
import { Plate } from '../components/Plate'
import { Icon } from '../components/Icon'

const patch = (i: number, p: Partial<UsageDraft>) =>
  setUsages(usages.value.map((u, j) => (j === i ? { ...u, ...p } : u)))

function UsageCard({ u, i, removable }: { u: UsageDraft; i: number; removable: boolean }) {
  const n = i + 1
  return (
    <li class="usage" aria-labelledby={`usage-${i}-title`}>
      <div class="usage-head">
        <h3 id={`usage-${i}-title`} class="usage-title">{t('cmp.usage', { i: n })}</h3>
        {removable && (
          <button type="button" class="btn-text" aria-label={t('cmp.remove.aria', { i: n })}
            onClick={() => setUsages(usages.value.filter((_, j) => j !== i))}>
            <Icon name="trash" size={20} />{t('cmp.remove')}
          </button>
        )}
      </div>
      <fieldset class="field usage-field">
        <legend class="field-label">{t('cmp.kind')}</legend>
        <div class="segmented usage-ops">
          {USAGE_OPS.map((op) => (
            <label key={op} class="segment">
              <input type="radio" name={`usage-${i}-op`} value={op} checked={u.operation === op} onChange={() => patch(i, { operation: op })} />
              <span>{t(`cmp.op.${op}`)}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <AmountInput id={`usage-${i}-amount`} label={t('cmp.amount')} value={u.amount} quick={false}
        onChange={(amount) => patch(i, { amount })} />
      <div class="field" role="group" aria-labelledby={`usage-${i}-freq`}>
        <p class="field-label" id={`usage-${i}-freq`}>{t('cmp.perMonth')}</p>
        <div class="stepper stepper-compact">
          <button type="button" class="stepper-btn" aria-label={t('cmp.perMonth.less')}
            disabled={u.perMonth <= 0} onClick={() => patch(i, { perMonth: u.perMonth - 1 })}>
            <Icon name="minus" />
          </button>
          <output class="stepper-value" aria-live="polite" aria-labelledby={`usage-${i}-freq`}>
            <Plate size="m">{u.perMonth}</Plate>
          </output>
          <button type="button" class="stepper-btn" aria-label={t('cmp.perMonth.more')}
            disabled={u.perMonth >= PER_MONTH_MAX} onClick={() => patch(i, { perMonth: u.perMonth + 1 })}>
            <Icon name="add" />
          </button>
        </div>
      </div>
    </li>
  )
}

/** Ranked operators: total on a plate, a single-hue bar from zero for magnitude,
 *  the cheapest marked in Savings Green with a word (never colour alone). */
function Ranking({ rows }: { rows: MonthlyRow[] }) {
  const priced = rows.filter((r): r is MonthlyRow & { total: number } => r.total !== null)
  const best = priced[0]?.total ?? 0
  const max = Math.max(1, ...priced.map((r) => r.total))
  const worst = priced[priced.length - 1]
  return (
    <>
      <ol class="board-list rank">
        {rows.map((r) => {
          const isBest = r.total !== null && r.total === best
          return (
            <li key={r.operator} class={`rank-row${isBest ? ' is-best' : ''}`}>
              <div class="rank-line">
                <OperatorBadge op={r.operator} />
                {r.total === null
                  ? <span class="rank-none">{t('unavailable')}</span>
                  : <span class="rank-total"><Plate amount={r.total} size="m" /><span class="visually-hidden"> {t('cmp.perMonthUnit')}</span></span>}
              </div>
              {r.total !== null && (
                <div class="rank-bar" aria-hidden="true">
                  <span style={{ width: `${Math.max(2, (r.total / max) * 100)}%` }} />
                </div>
              )}
              <p class="rank-note">
                {r.total === null ? t('cmp.unavailable')
                  : isBest ? <span class="rank-best"><Icon name="check" size={18} />{t('cmp.cheapest')}</span>
                  : t('cmp.more', { amount: formatAr(r.total - best) })}
              </p>
            </li>
          )
        })}
      </ol>
      {priced.length > 1 && (
        <p class="rank-summary">
          {worst.total > best
            ? t('cmp.savings', { best: t(`op.${priced[0].operator}`), worst: t(`op.${worst.operator}`), amount: formatAr(worst.total - best) })
            : t('cmp.same')}
        </p>
      )}
    </>
  )
}

export function Compare() {
  const tf = tariffs.value
  const s = settings.value
  const list = usages.value
  const ready = list.every((u) => u.amount !== null)
  const anyUse = list.some((u) => u.perMonth > 0)
  const result = useMemo(
    () => (tf && ready && anyUse ? monthlyCost(tf, list as Usage[], { step: s.step, maxTx: s.maxTx }) : null),
    [tf, list, ready, anyUse, s.step, s.maxTx],
  )

  return (
    <section class="screen" aria-labelledby="screen-title">
      <h1 id="screen-title" class="screen-title" tabIndex={-1}>{t('comparer.title')}</h1>
      <p class="lead">{t('comparer.intro')}</p>

      <h2 class="section-title">{t('cmp.usages')}</h2>
      <ol class="usages">
        {list.map((u, i) => <UsageCard key={i} u={u} i={i} removable={list.length > 1} />)}
      </ol>
      {list.length < MAX_USAGES && (
        <button type="button" class="btn btn-outline btn-wide"
          onClick={() => setUsages([...list, { operation: 'withdrawal', amount: null, perMonth: 1 }])}>
          <Icon name="add" size={20} />{t('cmp.add')}
        </button>
      )}

      <section class="cmp-out" aria-labelledby="cmp-result">
        <h2 id="cmp-result" class="section-title">{t('cmp.result')}</h2>
        {!tf ? <p class="notice">{t('header.loading')}</p>
          : !ready ? <p class="calc-empty">{t('cmp.empty')}</p>
          : !anyUse ? <p class="calc-empty">{t('cmp.zero')}</p>
          : !result || !Array.isArray(result) ? <p class="notice notice-error" role="alert">{t('error.invalid_amount')}</p>
          : (
            <>
              <p class="chart-sub">{t('cmp.result.sub')}</p>
              <Ranking rows={result} />
              {result[0]?.total != null && (
                <p class="visually-hidden" role="status">{t('cmp.cheapest')} : {t(`op.${result[0].operator}`)}, {formatAr(result[0].total)} {t('cmp.perMonthUnit')}</p>
              )}
              <p class="field-help">{t('cmp.settings', { n: s.maxTx, step: formatAr(s.step) })}</p>
            </>
          )}
      </section>
    </section>
  )
}
