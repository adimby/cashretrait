import { useState } from 'preact/hooks'
import { OPERATIONS, OPERATORS } from '../../tariffs/schema'
import type { FeeChange } from '../../tariffs/validate'
import { t } from '../i18n'
import { formatAr, formatDate } from '../format'
import { Plate } from './Plate'
import { OperatorBadge } from './OperatorBadge'
import { Icon } from './Icon'
import { pct } from './TariffTable'

export type HistoryEntry = { date: string; changes: FeeChange[] }

const num = (v: unknown) => typeof v === 'number' && Number.isFinite(v)
const isChange = (c: unknown): c is FeeChange => {
  const o = c as Record<string, unknown> | null
  return !!o && OPERATORS.includes(o.operator as never) && OPERATIONS.includes(o.operation as never)
    && num(o.min) && num(o.max) && (o.before === null || num(o.before)) && (o.after === null || num(o.after))
}

/** tarifs-history.json is generated at build time: accept only well-formed entries, newest first. */
export function parseHistory(raw: unknown): HistoryEntry[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((e): e is HistoryEntry => !!e && typeof e.date === 'string' && !Number.isNaN(Date.parse(e.date)) && Array.isArray(e.changes))
    .map((e) => ({ date: e.date, changes: e.changes.filter(isChange) }))
    .filter((e) => e.changes.length)
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
}

function Fee({ v, isPct }: { v: number | null; isPct?: boolean }) {
  if (v === null) return <span class="hist-none">{t('unavailable')}</span>
  return isPct ? <Plate size="s">{pct(v)}</Plate> : <Plate amount={v} size="s" />
}

const feeText = (v: number | null, isPct?: boolean) => (v === null ? t('unavailable') : isPct ? pct(v) : formatAr(v))

const FIRST = 3

/** Dated list of fee changes. `entries` null = still loading. */
export function HistoryList({ entries }: { entries: HistoryEntry[] | null }) {
  const [all, setAll] = useState(false)
  if (entries === null) return <p class="field-help">{t('hist.loading')}</p>
  if (!entries.length) {
    return (
      <div class="hist-empty">
        <span class="hist-empty-icon"><Icon name="history" /></span>
        <p>{t('hist.empty')}</p>
      </div>
    )
  }
  const shown = all ? entries : entries.slice(0, FIRST)
  return (
    <div class="hist">
      <ol class="hist-list">
        {shown.map((e, ei) => (
          <li key={`${e.date}|${ei}`} class="hist-entry">
            <h3 class="hist-date">{t('hist.date', { date: formatDate(e.date) })}</h3>
            <ul class="board-list">
              {e.changes.map((c, ci) => {
                const range = t('hist.range', { min: formatAr(c.min), max: formatAr(c.max) })
                return (
                  <li key={`${c.operator}|${c.operation}|${c.min}|${c.max}|${ci}`} class="hist-row">
                    <p class="visually-hidden">{t(`op.${c.operator}`)}, {t(`table.${c.operation}`)}. {t('hist.change', { range, before: feeText(c.before, c.beforePercent), after: feeText(c.after, c.afterPercent) })}</p>
                    <div class="hist-what" aria-hidden="true">
                      <OperatorBadge op={c.operator} />
                      <span class="hist-op">{t(`table.${c.operation}`)}</span>
                    </div>
                    <p class="hist-range" aria-hidden="true">{range}</p>
                    <p class="hist-fees" aria-hidden="true">
                      <span class="hist-before"><Fee v={c.before} isPct={c.beforePercent} /></span>
                      <Icon name="chevron" size={18} />
                      <Fee v={c.after} isPct={c.afterPercent} />
                    </p>
                  </li>
                )
              })}
            </ul>
          </li>
        ))}
      </ol>
      {entries.length > FIRST && (
        <button type="button" class="btn btn-outline btn-wide" aria-expanded={all} onClick={() => setAll(!all)}>
          {all ? t('hist.less') : t('hist.more', { n: entries.length })}
        </button>
      )}
    </div>
  )
}
