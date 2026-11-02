import { signal } from '@preact/signals'
import { useEffect } from 'preact/hooks'
import { OPERATIONS, type OperationKey, type OperatorId } from '../../tariffs/schema'
import { t } from '../i18n'
import { formatAr, formatDate } from '../format'
import { tariffs, loadHistory } from '../state/tariffs'
import { OperatorPicker } from '../components/OperatorPicker'
import { TariffTable } from '../components/TariffTable'
import { HistoryList, parseHistory, type HistoryEntry } from '../components/HistoryList'
import { UpdateBanner } from '../components/UpdateBanner'
import { Plate } from '../components/Plate'
import { Icon } from '../components/Icon'

/** Kept outside the component so the choice survives a trip to another tab. */
const op = signal<OperatorId>('mvola')
const operation = signal<OperationKey>('withdrawal')
/** undefined = not requested yet, null = loading. */
const history = signal<HistoryEntry[] | null | undefined>(undefined)

function useHistory(): HistoryEntry[] | null {
  useEffect(() => {
    if (history.value !== undefined) return
    history.value = null
    void loadHistory().then((raw) => { history.value = parseHistory(raw) })
  }, [])
  return history.value ?? null
}

export function Tariffs() {
  const tf = tariffs.value
  const hist = useHistory()
  const o = tf?.operators[op.value]
  const opName = t(`op.${op.value}`)
  const table = o?.fees[operation.value]

  return (
    <section class="screen" aria-labelledby="screen-title">
      <UpdateBanner />
      <h1 id="screen-title" class="screen-title" tabIndex={-1}>{t('tarifs.title')}</h1>
      <p class="lead">{t('tarifs.intro')}</p>

      <OperatorPicker name="trf-op" legend={t('trf.op')} value={op.value} onChange={(v) => { op.value = v as OperatorId }} />
      <fieldset class="field">
        <legend class="field-label">{t('trf.operation')}</legend>
        <div class="segmented trf-ops">
          {OPERATIONS.map((k) => (
            <label key={k} class="segment">
              <input type="radio" name="trf-operation" value={k} checked={operation.value === k} onChange={() => { operation.value = k }} />
              <span>
                {t(`table.${k}`)}
                {o && !o.fees[k]?.length && <small class="seg-sub">{t('unavailable')}</small>}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {!tf || !o ? <p class="notice">{t('header.loading')}</p> : (
        <div class="trf-grid">
          <div class="trf-head">
            <h2 class="section-title trf-title">{t(`table.${operation.value}`)}</h2>
            <p class="trf-sub">{opName}</p>
          </div>
          <div class="trf-meta">
            {o.source.publishedAt
              ? <p class="trf-date">{t('trf.published')} <Plate size="s">{formatDate(o.source.publishedAt)}</Plate></p>
              : <p class="field-help">{t('trf.published.none')}</p>}
            <p class="field-help">{t('trf.modified', { date: formatDate(tf.updatedAt) })}</p>
          </div>
          <TariffTable table={table} caption={t('trf.caption', { table: t(`table.${operation.value}`), op: opName })}
            noneText={t('trf.none', { op: opName })} />
          {table?.length ? (
            // The grid's real range: a table may stop below the operator's per-transaction limit.
            <p class="field-help">{t('trf.limits', {
              min: formatAr(Math.max(table[0].min, o.limits.minTx)),
              max: formatAr(Math.min(table[table.length - 1].max, o.limits.maxTx)),
            })}</p>
          ) : null}
          <ul class="board-list">
            <li>
              <a class="board-row" href={o.source.url} target="_blank" rel="noopener noreferrer">
                <span class="board-row-icon"><Icon name="tarifs" /></span>
                <span class="board-row-text">
                  <span class="board-row-title">{t('trf.source')}</span>
                  <span class="board-row-desc">{opName}, {t(`about.source.${o.source.type}`)}</span>
                </span>
                <span class="board-row-end"><Icon name="external" size={20} /></span>
              </a>
            </li>
          </ul>
        </div>
      )}

      <h2 class="section-title">{t('hist.title')}</h2>
      <HistoryList entries={hist} />
    </section>
  )
}
