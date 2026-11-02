import type { ComponentChildren } from 'preact'
import { formatNumber } from '../format'

/** The signature "price plate": a white enamel plate with condensed tabular numerals,
 *  like the fare boards of a gare routière. `amount` renders as « 1 000 Ar ». */
export function Plate({ amount, children, size = 'm' }: { amount?: number; children?: ComponentChildren; size?: 's' | 'm' | 'l' }) {
  return (
    <span class={`plate plate-${size}`}>
      {amount !== undefined ? (
        <>
          <span class="plate-num">{formatNumber(amount)}</span>
          <span class="plate-unit">Ar</span>
        </>
      ) : children}
    </span>
  )
}
