import { t } from '../i18n'
import { formatDate } from '../format'
import { tariffs, tariffsStale } from '../state/tariffs'
import { tariffsError, retryTariffs } from '../state/boot'
import { Icon } from './Icon'
import { online, tariffStatus } from '../state/network'

/** Renders 'Tarifs du {date}' with the date set on a price plate (the signature element). */
function DateLabel({ template, date }: { template: string; date: string }) {
  const [before, after = ''] = template.split('{date}')
  return (
    <>
      {before.trim() && <span>{before.trim()}</span>}
      <span class="plate plate-s">{date}</span>
      {after.trim() && <span>{after.trim()}</span>}
    </>
  )
}

export function Header() {
  const tf = tariffs.value
  const status = tariffStatus(tariffsStale.value, online.value)
  return (
    <header class="appbar">
      <div class="appbar-row">
        <a class="wordmark" href="#/calculer">
          <span class="wordmark-cash">Cash</span><span class="wordmark-retrait">Retrait</span>
        </a>
        {tf ? (
          <span class={`appbar-status is-${status}`} role="status">
            {status === 'offline' && <Icon name="offline" size={18} />}
            <DateLabel template={t(`header.${status === 'fresh' ? 'tariffsOf' : status}`)} date={formatDate(tf.updatedAt)} />
          </span>
        ) : !tariffsError.value ? (
          <span class="appbar-status" role="status">{t('header.loading')}</span>
        ) : null}
      </div>
      {tariffsError.value && !tf && (
        <div class="appbar-alert" role="alert">
          <p>{t('header.error')}</p>
          <button type="button" class="btn btn-on-board" onClick={retryTariffs}>{t('action.retry')}</button>
        </div>
      )}
    </header>
  )
}
