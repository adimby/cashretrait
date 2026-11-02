import { useEffect, useMemo, useState } from 'preact/hooks'
import { t, lang } from '../i18n'
import { tariffs } from '../state/tariffs'
import { lastSeen, markSeen, pendingChanges } from '../state/lastSeen'
import { formatChange } from '../../tariffs/validate'
import { Icon } from './Icon'

const SHOWN = 5
/** formatChange uses plain spaces; amounts must never wrap mid-number (« 1 300 »), nor the arrow start a line. */
const keepTogether = (s: string) => s.replace(/(\d) (?=\d{3}\b)/g, '$1\u00a0').replace(/ →/g, '\u00a0→')

/** « Tarifs mis à jour »: what changed since the tariffs the user last acknowledged.
 *  On a first visit the current tariffs simply become the reference (nothing to announce). */
export function UpdateBanner() {
  const tf = tariffs.value
  const seen = lastSeen.value
  const [all, setAll] = useState(false)
  const changes = useMemo(() => (tf && seen ? pendingChanges(tf, seen) : []), [tf, seen])
  useEffect(() => {
    // First visit, or same grids under a new date: quietly move the reference forward.
    if (tf && (!seen || (!changes.length && seen.updatedAt !== tf.updatedAt))) markSeen(tf)
  }, [tf, seen, changes])
  if (!tf || !changes.length) return null
  const l = lang.value
  const shown = all ? changes : changes.slice(0, SHOWN)
  return (
    <section class="update-banner" role="status" aria-labelledby="update-title">
      <div class="update-head">
        <span class="update-icon"><Icon name="refresh" /></span>
        <div class="update-text">
          <h2 id="update-title" class="update-title">{t('banner.title')}</h2>
          <p class="update-intro">{changes.length === 1 ? t('banner.intro.one') : t('banner.intro.many', { n: changes.length })}</p>
        </div>
      </div>
      <ul class="update-list">
        {shown.map((c) => <li key={`${c.operator}${c.operation}${c.min}-${c.max}`}>{keepTogether(formatChange(c, l, tf))}</li>)}
      </ul>
      <div class="update-actions">
        {changes.length > SHOWN && (
          <button type="button" class="btn btn-outline" aria-expanded={all} onClick={() => setAll(!all)}>
            {all ? t('banner.less') : t('banner.all', { n: changes.length })}
          </button>
        )}
        <button type="button" class="btn btn-solid" onClick={() => markSeen(tf)}>
          <Icon name="check" size={20} />{t('banner.ok')}
        </button>
      </div>
    </section>
  )
}
