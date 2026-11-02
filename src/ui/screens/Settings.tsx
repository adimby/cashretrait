import { t, LANGS } from '../i18n'
import { settings, updateSettings, STEPS, MAX_TX_MIN, MAX_TX_MAX } from '../state/settings'
import { formatAr } from '../format'
import { Icon } from '../components/Icon'
import { BackLink } from './Plus'

const LANG_NAMES = { fr: 'Français', mg: 'Malagasy' } as const

function Segmented<T extends string | number>({ name, legend, help, options, value, label, onChange }: {
  name: string; legend: string; help?: string; options: readonly T[]; value: T; label: (v: T) => string; onChange: (v: T) => void
}) {
  return (
    <fieldset class="field">
      <legend class="field-label">{legend}</legend>
      {help && <p class="field-help" id={`${name}-help`}>{help}</p>}
      <div class="segmented" role="radiogroup" aria-describedby={help ? `${name}-help` : undefined}>
        {options.map((o) => (
          <label key={String(o)} class="segment">
            <input type="radio" name={name} value={String(o)} checked={o === value} onChange={() => onChange(o)} />
            <span>{label(o)}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

export function Settings() {
  const s = settings.value
  return (
    <section class="screen" aria-labelledby="screen-title">
      <BackLink />
      <h1 id="screen-title" class="screen-title" tabIndex={-1}>{t('settings.title')}</h1>

      <Segmented name="lang" legend={t('settings.lang')} options={LANGS} value={s.lang}
        label={(l) => LANG_NAMES[l]} onChange={(lang) => updateSettings({ lang })} />

      <Segmented name="step" legend={t('settings.step')} help={t('settings.step.help')} options={STEPS} value={s.step}
        label={formatAr} onChange={(step) => updateSettings({ step })} />

      <div class="field" role="group" aria-labelledby="maxtx-label" aria-describedby="maxtx-help">
        <p class="field-label" id="maxtx-label">{t('settings.maxTx')}</p>
        <p class="field-help" id="maxtx-help">{t('settings.maxTx.help')}</p>
        <div class="stepper">
          <button type="button" class="stepper-btn" aria-label={t('settings.maxTx.less')}
            disabled={s.maxTx <= MAX_TX_MIN} onClick={() => updateSettings({ maxTx: s.maxTx - 1 })}>
            <Icon name="minus" />
          </button>
          <output class="plate plate-l stepper-value" aria-live="polite" aria-labelledby="maxtx-label">
            <span class="plate-num">{s.maxTx}</span>
          </output>
          <button type="button" class="stepper-btn" aria-label={t('settings.maxTx.more')}
            disabled={s.maxTx >= MAX_TX_MAX} onClick={() => updateSettings({ maxTx: s.maxTx + 1 })}>
            <Icon name="add" />
          </button>
        </div>
      </div>
    </section>
  )
}
