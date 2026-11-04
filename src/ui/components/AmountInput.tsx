import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks'
import { t } from '../i18n'
import { formatAr, formatNumber } from '../format'

export const QUICK_AMOUNTS = [10000, 50000, 100000, 500000] as const
const MAX_DIGITS = 9 // up to 999 999 999 Ar

const digitsOf = (s: string) => s.replace(/\D/g, '').replace(/^0+/, '').slice(0, MAX_DIGITS)
const show = (n: number | null) => (n === null ? '' : formatNumber(n))

/** Ariary amount field: numeric keypad, accepts spaces, shows « 1 000 000 » as you type
 *  (caret kept after the same digit), plus quick-amount plates. */
export function AmountInput({ id, label, value, onChange, quick = true, help }: {
  id: string; label: string; value: number | null; onChange: (n: number | null) => void; quick?: boolean; help?: string
}) {
  const ref = useRef<HTMLInputElement>(null)
  // Quick amounts only while the field is empty or being edited (less scrolling once an amount is set).
  // Hiding is deferred: the tap that moved focus elsewhere (a checkbox, « Garder »…) must land
  // before the row disappears and the content below moves up.
  const [focused, setFocused] = useState(false)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const focusIn = () => { if (hideTimer.current) clearTimeout(hideTimer.current); setFocused(true) }
  const focusOut = (e: FocusEvent) => {
    if ((e.currentTarget as HTMLElement).contains(e.relatedTarget as Node | null)) return
    if (hideTimer.current) clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(() => setFocused(false), 600)
  }
  useEffect(() => () => { if (hideTimer.current) clearTimeout(hideTimer.current) }, [])
  // Keep the DOM value formatted when the amount changes from outside (quick amount, favorite, hint).
  useLayoutEffect(() => {
    const el = ref.current
    if (el && digitsOf(el.value) !== (value === null ? '' : String(value))) el.value = show(value)
  }, [value])

  const onInput = (e: Event) => {
    const el = e.currentTarget as HTMLInputElement
    const caret = el.selectionStart ?? el.value.length
    const raw = el.value.replace(/\D/g, '')
    const zeros = raw.length - raw.replace(/^0+/, '').length
    const d = digitsOf(el.value)
    const before = Math.min(d.length, Math.max(0, el.value.slice(0, caret).replace(/\D/g, '').length - zeros))
    const n = d ? Number(d) : null
    el.value = show(n)
    // Put the caret back after the same number of digits.
    let pos = 0
    for (let seen = 0; pos < el.value.length && seen < before; pos++) if (/\d/.test(el.value[pos])) seen++
    try { el.setSelectionRange(pos, pos) } catch { /* not focusable */ }
    onChange(n)
  }

  return (
    <div class="field amount-field" onFocusIn={focusIn} onFocusOut={focusOut}>
      <div class="amount-box">
        <label class="amount-label" for={id}>{label}</label>
        <div class="amount-row">
          <input ref={ref} id={id} class="amount-input" type="text" inputMode="numeric" autoComplete="off"
            aria-describedby={help ? `${id}-help` : undefined} enterKeyHint="done" pattern="[0-9  ]*" placeholder="0" defaultValue={show(value)} onInput={onInput} />
          <span class="amount-unit" aria-hidden="true">Ar</span>
        </div>
      </div>
      {help && <p class="field-help" id={`${id}-help`}>{help}</p>}
      {quick && (value === null || focused) && <div class="quick" role="group" aria-label={t('calc.quick')}>
        {QUICK_AMOUNTS.map((q) => (
          <button key={q} type="button" class="quick-btn" aria-pressed={value === q} aria-label={formatAr(q)}
            onPointerDown={(e) => e.preventDefault()} onClick={() => onChange(q)}>
            <span class="plate-num">{formatNumber(q)}</span>
          </button>
        ))}
      </div>}
    </div>
  )
}
