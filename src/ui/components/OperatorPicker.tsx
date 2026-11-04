import { OPERATORS, type OperatorId } from '../../tariffs/schema'
import { OperatorBadge } from './OperatorBadge'
import { Icon } from './Icon'

/** Operator choice as a segmented control of neutral badges (monogram above name).
 *  `extra` adds a last option such as « Sans compte » or « N'importe lequel ». */
export function OperatorPicker<V extends string>({ name, legend, value, onChange, extra }: {
  name: string; legend: string; value: V | OperatorId; onChange: (v: V | OperatorId) => void
  extra?: { value: V; label: string; icon: string }
}) {
  const opts: (V | OperatorId)[] = [...OPERATORS, ...(extra ? [extra.value] : [])]
  return (
    <fieldset class="field">
      <legend class="field-label">{legend}</legend>
      <div class={`segmented op-picker cols-${opts.length}`}>
        {opts.map((o) => (
          <label key={o} class="segment">
            <input type="radio" name={name} value={o} checked={o === value} onChange={() => onChange(o)} />
            <span>
              {extra && o === extra.value ? (
                <span class="op-badge op-extra"><span class="op-mono op-mono-icon" aria-hidden="true"><Icon name={extra.icon} size={18} /></span><span class="op-name">{extra.label}</span></span>
              ) : <OperatorBadge op={o as OperatorId} short />}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}
