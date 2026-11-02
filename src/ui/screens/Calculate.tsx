import { signal } from '@preact/signals'
import { useEffect, useMemo, useState } from 'preact/hooks'
import type { OperatorId } from '../../tariffs/schema'
import { t, lang } from '../i18n'
import { formatAr } from '../format'
import { settings } from '../state/settings'
import { tariffs } from '../state/tariffs'
import { favorites, pendingFavorite, CALC_MODES, type CalcMode, type Favorite } from '../state/favorites'
import { compute, DEFAULT_FORM, formFrom, hasNonCustomer, normalizeDest, paramsOf, type CalcForm, type Dest } from '../calc'
import { shareText } from '../share'
import { AmountInput } from '../components/AmountInput'
import { OperatorPicker } from '../components/OperatorPicker'
import { ResultCard, Alternatives, pathLabel } from '../components/ResultCard'
import { FeeStairChart } from '../components/FeeStairChart'
import { ShareButton } from '../components/ShareButton'
import { FavoriteButton } from '../components/FavoriteButton'
import { Icon } from '../components/Icon'
import { Plate } from '../components/Plate'
import { Disclaimer } from '../components/Disclaimer'
import { UpdateBanner } from '../components/UpdateBanner'

/** Form state lives outside the component so it survives a trip to another tab. */
const form = signal<CalcForm>(DEFAULT_FORM)
const update = (patch: Partial<CalcForm>) => {
  const next = { ...form.value, ...patch }
  form.value = { ...next, to: normalizeDest(next.mode, next.to, next.op) }
}

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms)
    return () => clearTimeout(id)
  }, [value, ms])
  return v
}

function ModeTabs({ value }: { value: CalcMode }) {
  return (
    <fieldset class="field mode-field">
      <legend class="visually-hidden">{t('calc.mode.label')}</legend>
      <div class="segmented mode-tabs">
        {CALC_MODES.map((m) => (
          <label key={m} class="segment">
            <input type="radio" name="mode" value={m} checked={m === value} onChange={() => update({ mode: m })} />
            <span>{t(`calc.mode.${m}`)}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

function YesNo({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <fieldset class="field">
      <legend class="field-label">{t('calc.customer')}</legend>
      <div class="segmented">
        {[true, false].map((v) => (
          <label key={String(v)} class="segment">
            <input type="radio" name="customer" checked={v === value} onChange={() => onChange(v)} />
            <span>{t(v ? 'calc.customer.yes' : 'calc.customer.no')}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

function FavoriteChips({ items }: { items: Favorite[] }) {
  if (!items.length) return null
  return (
    <nav class="fav-strip" aria-label={t('fav.list')}>
      <p class="fav-strip-title"><Icon name="star" size={18} filled />{t('fav.list')}</p>
      <ul class="fav-chips">
        {items.slice(0, 6).map((f) => (
          <li key={f.id}><button type="button" class="chip" onClick={() => { form.value = formFrom(f.mode, f.params) }}>{f.label}</button></li>
        ))}
      </ul>
    </nav>
  )
}

const opName = (op: OperatorId) => t(`op.${op}`)

function favLabel(f: CalcForm): string {
  const amount = formatAr(f.amount ?? 0)
  const to = f.to
  const op = f.mode === 'send' || f.mode === 'receive'
    ? t('fav.path', { from: opName(f.op), to: to === 'none' ? t('calc.to.none') : to === 'any' ? t('calc.to.any') : opName(to as OperatorId) })
    : opName(f.op)
  return t(`fav.label.${f.mode}`, { op, amount })
}

export function Calculate() {
  const tf = tariffs.value
  const s = settings.value
  const l = lang.value
  const f = form.value
  const amount = useDebounced(f.amount, 150)

  // A favorite opened from another screen (Plus › Favoris) fills the form.
  const pending = pendingFavorite.value
  useEffect(() => {
    if (pending) { form.value = formFrom(pending.mode, pending.params); pendingFavorite.value = null }
  }, [pending])

  const calcForm = useMemo(() => ({ ...f, amount }), [f.mode, f.op, f.to, f.customer, f.incl, amount])
  const outcome = useMemo(
    () => (tf ? compute(tf, calcForm, { step: s.step, maxTx: s.maxTx }) : null),
    [tf, calcForm, s.step, s.maxTx],
  )
  const settled = amount === f.amount

  const nonCustomer = tf ? hasNonCustomer(tf, f.op) : false
  const params = paramsOf(calcForm)

  return (
    <section class="screen calc" aria-labelledby="screen-title">
      <UpdateBanner />
      <h1 id="screen-title" class="screen-title" tabIndex={-1}>{t('calculer.title')}</h1>
      <FavoriteChips items={favorites.value} />
      <ModeTabs value={f.mode} />

      <form class="calc-form" onSubmit={(e) => { e.preventDefault(); (document.activeElement as HTMLElement | null)?.blur() }}>
        {f.mode === 'send' || f.mode === 'receive' ? (
          <>
            <OperatorPicker name="from" legend={t('calc.from')} value={f.op} onChange={(op) => update({ op: op as OperatorId })} />
            <OperatorPicker<Dest> name="to" legend={t('calc.to')} value={f.to}
              onChange={(to) => update({ to })}
              extra={f.mode === 'send' ? { value: 'none', label: t('calc.to.none'), icon: 'user' } : { value: 'any', label: t('calc.to.any'), icon: 'any' }} />
          </>
        ) : (
          <OperatorPicker name="op" legend={t('calc.op')} value={f.op} onChange={(op) => update({ op: op as OperatorId })} />
        )}

        <AmountInput id="amount" label={t(`calc.amount.${f.mode}`)} value={f.amount} onChange={(n) => update({ amount: n })} />

        {f.mode === 'withdraw' && nonCustomer && <YesNo value={f.customer} onChange={(customer) => update({ customer })} />}
        {f.mode === 'receive' && (
          <div class="field">
            <label class="check">
              <input type="checkbox" checked={f.incl} onChange={(e) => update({ incl: (e.currentTarget as HTMLInputElement).checked })} aria-describedby="incl-help" />
              <span class="check-label">{t('calc.incl')}</span>
            </label>
            <p class="field-help" id="incl-help">{t('calc.incl.help')}</p>
          </div>
        )}
      </form>

      <div class={`calc-out${settled ? '' : ' is-pending'}`} aria-busy={!settled}>
        {!tf ? <p class="notice">{t('header.loading')}</p>
          : !outcome || outcome.status === 'empty' ? <p class="calc-empty">{t('calc.empty')}</p>
          : outcome.status === 'fail' ? <p class="notice notice-error" role="alert">{t(`error.${outcome.reason}`)}</p>
          : (
            <>
              {outcome.hint && (
                <div class="hint" role="note">
                  <Icon name="bulb" />
                  <div class="hint-body">
                    <p>{t('hint.text', { amount: formatAr(outcome.hint.amount), current: formatAr(amount!), fee: formatAr(outcome.hint.fee), currentFee: formatAr(outcome.hint.currentFee) })}</p>
                    <button type="button" class="btn btn-outline" onClick={() => update({ amount: outcome.hint!.amount })}>
                      {t('hint.use', { amount: '' }).trim()} <Plate amount={outcome.hint.amount} size="s" />
                    </button>
                  </div>
                </div>
              )}
              <ResultCard mode={f.mode} best={outcome.best} notIncl={f.mode === 'receive' && !f.incl} canSplit={s.maxTx > 1}
                senderPaid={f.mode === 'withdraw' && outcome.chart?.key === 'withdrawal_non_customer' && outcome.best.total === 0}
                actions={(
                  <div class="result-actions-row" key={JSON.stringify(params) + f.mode}>
                    <ShareButton text={() => shareText(f.mode, outcome.best.result, l, {
                      op: f.op, path: outcome.best.kind ? pathLabel(outcome.best.kind, outcome.best.to) : undefined,
                    })} />
                    <FavoriteButton mode={f.mode} params={params} label={favLabel(calcForm)} />
                  </div>
                )} />
              <p class="visually-hidden" role="status">{t('result.total')} {formatAr(outcome.best.total)}</p>
              <Alternatives items={outcome.alternatives} best={outcome.best.total} />
              {outcome.chart && (
                <FeeStairChart table={outcome.chart.table} amount={outcome.chart.amount} splits={outcome.chart.splits}
                  subtitle={t('chart.sub', { table: t(`table.${outcome.chart.key}`), op: opName(outcome.chart.op) })} />
              )}
            </>
          )}
      </div>
      {outcome?.status !== 'ok' && <Disclaimer />}
    </section>
  )
}
