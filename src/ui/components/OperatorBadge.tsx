import type { OperatorId } from '../../tariffs/schema'
import { t } from '../i18n'

const MONOGRAM: Record<OperatorId, string> = { mvola: 'MV', airtel: 'AM', orange: 'OM' }

/** Neutral operator badge: same colour for every operator, told apart by monogram and name only.
 *  Never operator logos or brand colours (the app is independent). */
export function OperatorBadge({ op, withName = true }: { op: OperatorId; withName?: boolean }) {
  return (
    <span class="op-badge">
      <span class="op-mono" aria-hidden={withName ? 'true' : undefined}>{MONOGRAM[op]}</span>
      {withName && <span class="op-name">{t(`op.${op}`)}</span>}
    </span>
  )
}
