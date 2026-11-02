import { t, lang } from '../i18n'
import { formatDate } from '../format'
import { tariffs } from '../state/tariffs'
import { OPERATORS } from '../../tariffs/schema'
import { OperatorBadge } from '../components/OperatorBadge'
import { Icon } from '../components/Icon'
import { BackLink } from './Plus'

declare const __APP_VERSION__: string

export function About() {
  const tf = tariffs.value
  return (
    <section class="screen" aria-labelledby="screen-title">
      <BackLink />
      <h1 id="screen-title" class="screen-title" tabIndex={-1}>{t('about.title')}</h1>
      <div class="prose">
        <p class="lead">{t('about.what')}</p>
        <p>{t('about.how')}</p>
        <p>{t('about.free')}</p>
        {lang.value === 'mg' && <p class="notice">{t('about.mgReview')}</p>}
      </div>

      <h2 class="section-title">{t('about.sources')}</h2>
      {tf && <p class="field-help">{t('about.updated', { date: formatDate(tf.updatedAt) })}</p>}
      <ul class="board-list">
        {OPERATORS.map((op) => (
          <li key={op}>
            {tf ? (
              <a class="board-row" href={tf.operators[op].source.url} target="_blank" rel="noopener noreferrer">
                <OperatorBadge op={op} />
                <span class="board-row-desc board-row-fill">{tf.operators[op].source.type === 'pdf' ? 'PDF' : 'Web'}</span>
                <span class="board-row-end"><Icon name="external" size={20} /></span>
              </a>
            ) : (
              <span class="board-row"><OperatorBadge op={op} /></span>
            )}
          </li>
        ))}
      </ul>

      <p class="meta">{t('about.version', { v: __APP_VERSION__ })}</p>
    </section>
  )
}
