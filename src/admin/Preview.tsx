import { useMemo, useState } from 'preact/hooks'
import { OPERATIONS, type FeeTable, type OperationKey, type Operator } from '../tariffs/schema'
import { diffTariffs, formatChange, mergeOperator, validateTariffs, type Validation } from '../tariffs/validate'
import type { GenericTable } from '../tariffs/parsers/generic'
import { Icon } from '../ui/components/Icon'
import { commit } from './api'
import type { Draft } from './draft'
import { TierEditor } from './TierEditor'
import { mapGenericTable, parseAmount, type ColumnMap } from './tiers'
import { OPERATION_NAMES, OPERATOR_NAMES, S } from './strings'

const STATUS_ICON = { ok: 'check', suspect: 'info', invalid: 'info' } as const

function ValidationBox({ v }: { v: Validation }) {
  return (
    <section class={`adm-check is-${v.status}`} aria-labelledby="check-title" role="status">
      <h2 id="check-title" class="adm-check-title">
        <Icon name={STATUS_ICON[v.status]} size={20} />
        {S.preview.validation} : {S.preview.status[v.status]}
      </h2>
      <p>{S.preview.statusHelp[v.status]}</p>
      {v.reasons.length > 0 && <ul class="adm-reasons">{v.reasons.map((r, i) => <li key={i}>{r}</li>)}</ul>}
    </section>
  )
}

/** Raw tables from the document, and a column mapping that fills the selected grid. */
function GenericPanel({ tables, error, operation, onFill }: {
  tables: GenericTable[]; error?: string; operation: OperationKey; onFill: (t: FeeTable) => void
}) {
  const [ti, setTi] = useState(0)
  const [map, setMap] = useState<{ range: number; min: number; max: number; fee: number }>({ range: 0, min: -1, max: -1, fee: 1 })
  const [note, setNote] = useState<string | null>(null)
  const table = tables[ti]
  const width = table ? Math.max(table.headers.length, ...table.rows.map((r) => r.length)) : 0
  const cols = Array.from({ length: width }, (_, i) => i)
  const colName = (i: number) => table?.headers[i] || S.preview.column(i + 1)

  const fill = () => {
    if (!table) return
    const m: ColumnMap = map.range >= 0 ? { range: map.range, fee: map.fee } : { min: map.min, max: map.max, fee: map.fee }
    const tiers = mapGenericTable(table, m)
    if (!tiers.length) return setNote(S.preview.mapEmpty)
    onFill(tiers)
    setNote(S.preview.mapDone(tiers.length))
  }
  // Called as a function (not a component) so the selects keep their identity and focus across renders.
  const colSelect = (k: keyof typeof map, label: string, optional?: boolean) => (
    <label class="adm-field" for={`map-${k}`}>
      <span class="field-help">{label}</span>
      <select id={`map-${k}`} class="adm-select" value={map[k]}
        onChange={(e) => setMap({ ...map, [k]: Number(e.currentTarget.value) })}>
        {optional && <option value={-1}>{S.preview.mapNone}</option>}
        {cols.map((i) => <option key={i} value={i}>{colName(i)}</option>)}
      </select>
    </label>
  )

  return (
    <section class="adm-panel" aria-labelledby="raw-title">
      {error && <p class="notice notice-error">{S.preview.parserError} {error}</p>}
      <h2 id="raw-title" class="section-title">{S.preview.rawTitle}</h2>
      {tables.length === 0 ? <p class="field-help">{S.preview.rawNone}</p> : (
        <>
          {tables.map((t, i) => (
            <details key={i} class="adm-raw" open={i === ti}>
              <summary>{S.preview.rawTable(i + 1, t.rows.length)}</summary>
              <div class="adm-scroll" tabIndex={0}>
                <table class="tier-table adm-raw-table">
                  <thead><tr>{t.headers.map((h, j) => <th key={j} scope="col">{h}</th>)}</tr></thead>
                  <tbody>{t.rows.map((r, k) => <tr key={k}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody>
                </table>
              </div>
            </details>
          ))}
          <h3 class="adm-sub">{S.preview.mapTitle}</h3>
          <p class="field-help">{S.preview.mapHelp}</p>
          <div class="adm-map">
            {tables.length > 1 && (
              <label class="adm-field" for="map-table">
                <span class="field-help">{S.preview.mapTable}</span>
                <select id="map-table" class="adm-select" value={ti} onChange={(e) => setTi(Number(e.currentTarget.value))}>
                  {tables.map((_, i) => <option key={i} value={i}>{S.preview.rawTable(i + 1, tables[i].rows.length)}</option>)}
                </select>
              </label>
            )}
            {colSelect('range', S.preview.mapRange, true)}
            {map.range < 0 && colSelect('min', S.preview.mapMin, true)}
            {map.range < 0 && colSelect('max', S.preview.mapMax, true)}
            {colSelect('fee', S.preview.mapFee)}
          </div>
          <button type="button" class="btn btn-outline" onClick={fill}>{S.preview.mapApply(OPERATION_NAMES[operation])}</button>
          {note && <p class="field-help" role="status">{note}</p>}
        </>
      )}
    </section>
  )
}

function LimitField({ id, label, value, onCommit }: { id: string; label: string; value: number; onCommit: (v: number) => void }) {
  return (
    <label class="adm-field" for={id}>
      <span class="field-help">{label}</span>
      <input id={id} key={`${id}:${value}`} class="adm-input adm-input-num" type="text" inputMode="numeric" autoComplete="off"
        value={String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}
        onChange={(e) => {
          const v = parseAmount(e.currentTarget.value)
          if (v === null) e.currentTarget.value = String(value)
          else onCommit(v)
        }} />
    </label>
  )
}

export function Preview({ draft, onBack, onDone, onUnauthorized }: {
  draft: Draft; onBack: () => void; onDone: (commitUrl: string) => void; onUnauthorized: () => void
}) {
  const [op, setOp] = useState<Operator>(draft.edited)
  const first = OPERATIONS.find((k) => op.fees[k]) ?? 'withdrawal'
  const [operation, setOperation] = useState<OperationKey>(first)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<{ message: string; conflict?: boolean; validation?: Validation } | null>(null)

  const next = useMemo(() => mergeOperator(draft.current, draft.operator, op, draft.at), [op, draft])
  const validation = useMemo(() => validateTariffs(next, draft.current), [next, draft.current])
  const changes = useMemo(() => diffTariffs(draft.current, next), [next, draft.current])
  const invalid = validation.status === 'invalid'

  const setTable = (t: FeeTable | undefined) => {
    const fees = { ...op.fees }
    if (t) fees[operation] = t
    else delete fees[operation]
    setOp({ ...op, fees })
  }

  const publish = async () => {
    if (invalid || pending) return
    setPending(true)
    setError(null)
    const r = await commit(next, draft.baseSha)
    setPending(false)
    if (r.ok) return onDone(r.data.commitUrl)
    if (r.status === 401) return onUnauthorized()
    if (r.status === 409) return setError({ message: S.preview.conflict, conflict: true })
    setError({ message: r.message, validation: r.validation })
  }

  return (
    <section class="screen" aria-labelledby="screen-title">
      <button type="button" class="backlink adm-back" onClick={onBack}><Icon name="back" />{S.preview.back}</button>
      <h1 id="screen-title" tabIndex={-1} class="screen-title">{OPERATOR_NAMES[draft.operator]}</h1>
      <p class="trf-sub">{S.preview.origin[draft.origin]}</p>

      {draft.origin === 'generic' && (
        <GenericPanel tables={draft.generic ?? []} error={draft.parserError} operation={operation} onFill={setTable} />
      )}

      <section class="adm-panel" aria-labelledby="grid-title">
        <h2 id="grid-title" class="section-title">{S.preview.operation}</h2>
        <label class="adm-field" for="operation">
          <span class="visually-hidden">{S.preview.operation}</span>
          <select id="operation" class="adm-select" value={operation} onChange={(e) => setOperation(e.currentTarget.value as OperationKey)}>
            {OPERATIONS.map((k) => (
              <option key={k} value={k}>{S.preview.operationOption(OPERATION_NAMES[k], op.fees[k]?.length ?? null)}</option>
            ))}
          </select>
        </label>
        <TierEditor key={operation} idPrefix={`t-${operation}`} table={op.fees[operation]} minTx={op.limits.minTx}
          onChange={setTable} onDrop={() => setTable(undefined)} />
      </section>

      <details class="adm-panel adm-more">
        <summary class="section-title">{S.preview.limitsAndSource}</summary>
        <div class="adm-map">
          <LimitField id="lim-min" label={S.preview.minTx} value={op.limits.minTx} onCommit={(v) => setOp({ ...op, limits: { ...op.limits, minTx: v } })} />
          <LimitField id="lim-max" label={S.preview.maxTx} value={op.limits.maxTx} onCommit={(v) => setOp({ ...op, limits: { ...op.limits, maxTx: v } })} />
          <LimitField id="lim-bal" label={S.preview.maxBalance} value={op.limits.maxBalance} onCommit={(v) => setOp({ ...op, limits: { ...op.limits, maxBalance: v } })} />
        </div>
        <label class="adm-field" for="src-url">
          <span class="field-help">{S.preview.sourceUrl}</span>
          <input id="src-url" class="adm-input" type="url" value={op.source.url}
            onChange={(e) => setOp({ ...op, source: { ...op.source, url: e.currentTarget.value.trim() } })} />
        </label>
        <div class="adm-map">
          <label class="adm-field" for="src-type">
            <span class="field-help">{S.preview.sourceType}</span>
            <select id="src-type" class="adm-select" value={op.source.type}
              onChange={(e) => setOp({ ...op, source: { ...op.source, type: e.currentTarget.value as 'html' | 'pdf' } })}>
              <option value="html">HTML</option>
              <option value="pdf">PDF</option>
            </select>
          </label>
          <label class="adm-field" for="src-date">
            <span class="field-help">{S.preview.publishedAt}</span>
            <input id="src-date" class="adm-input" type="text" inputMode="numeric" placeholder="2026-11-02" value={op.source.publishedAt ?? ''}
              onChange={(e) => setOp({ ...op, source: { ...op.source, publishedAt: e.currentTarget.value.trim() || null } })} />
          </label>
        </div>
      </details>

      <ValidationBox v={validation} />

      <section class="adm-panel" aria-labelledby="changes-title">
        <h2 id="changes-title" class="section-title">{S.preview.changes} ({changes.length})</h2>
        {changes.length === 0 ? <p class="field-help">{S.preview.noChanges}</p> : (
          <ul class="update-list adm-changes">{changes.map((c, i) => <li key={i}>{formatChange(c, 'fr', next)}</li>)}</ul>
        )}
      </section>

      {error && (
        <div class="notice notice-error adm-error" role="alert">
          <p>{error.message}</p>
          {error.validation && <ul class="adm-reasons">{error.validation.reasons.map((r, i) => <li key={i}>{r}</li>)}</ul>}
          {error.conflict && <button type="button" class="btn btn-outline" onClick={() => location.reload()}>{S.preview.reload}</button>}
        </div>
      )}
      <div class="adm-publish">
        <a class="adm-publish-status" href="#check-title">
          <Icon name={STATUS_ICON[validation.status]} size={20} />{S.preview.status[validation.status]}
        </a>
        <button type="button" class="btn btn-solid" disabled={invalid || pending} aria-busy={pending}
          aria-describedby="check-title" onClick={publish}>
          {pending ? S.preview.publishing : S.preview.publish}
        </button>
      </div>
    </section>
  )
}
