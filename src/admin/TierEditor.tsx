import type { FeeTable } from '../tariffs/schema'
import { formatNumber } from '../ui/format'
import { Icon } from '../ui/components/Icon'
import { addTier, applyEdit, parseAmount, removeTier, setKind, tierKind, tierValue, type FeeKind, type TierField } from './tiers'
import { S } from './strings'

export { applyEdit } from './tiers'

const show = (n: number, kind: FeeKind = 'fee') =>
  kind === 'pct' ? String(n).replace('.', ',') : Number.isInteger(n) ? formatNumber(n) : String(n)

/** A number field that commits on change (blur / Enter); unreadable input snaps back to the last value. */
function NumField({ id, label, value, kind, onCommit }: { id: string; label: string; value: number; kind?: FeeKind; onCommit: (v: number) => void }) {
  return (
    <label class="adm-num" for={id}>
      <span class="adm-num-label">{label}</span>
      <input
        id={id}
        key={`${id}:${value}`}
        class="adm-num-input"
        type="text"
        inputMode={kind === 'pct' ? 'decimal' : 'numeric'}
        autoComplete="off"
        value={show(value, kind)}
        onChange={(e) => {
          const el = e.currentTarget
          const v = parseAmount(el.value)
          if (v === null) el.value = show(value, kind)
          else if (v !== value) onCommit(v)
          else el.value = show(value, kind)
        }}
      />
    </label>
  )
}

/** Editable fee grid: one ruled row per tier (De / À on top, Frais + unit + Retirer below) so it fits 360 px. */
export function TierEditor({ table, idPrefix, minTx, onChange, onDrop }: {
  table: FeeTable | undefined
  idPrefix: string
  minTx: number
  onChange: (t: FeeTable) => void
  onDrop: () => void
}) {
  if (!table) {
    return (
      <div class="tariff-none">
        <p class="tariff-none-text">{S.tiers.absent}</p>
        <button type="button" class="btn btn-outline" onClick={() => onChange(addTier([], minTx))}>
          <Icon name="add" size={20} />{S.tiers.create}
        </button>
      </div>
    )
  }
  const edit = (i: number, f: TierField) => (v: number) => onChange(applyEdit(table, i, f, v))
  return (
    <div class="adm-tiers">
      {table.length === 0 ? <p class="notice">{S.tiers.empty}</p> : (
        <ol class="board-list adm-tier-list">
          {table.map((t, i) => {
            const id = `${idPrefix}-${i}`
            const kind = tierKind(t)
            return (
              <li key={i} class="adm-tier" aria-label={S.tiers.row(i + 1)}>
                <span class="adm-tier-n" aria-hidden="true">{i + 1}</span>
                <NumField id={`${id}-min`} label={S.tiers.min} value={t.min} onCommit={edit(i, 'min')} />
                <NumField id={`${id}-max`} label={S.tiers.max} value={t.max} onCommit={edit(i, 'max')} />
                <NumField id={`${id}-fee`} label={S.tiers.fee} value={tierValue(t)} kind={kind} onCommit={edit(i, 'fee')} />
                <div class="adm-tier-end">
                  <label class="adm-num adm-unit" for={`${id}-unit`}>
                    <span class="adm-num-label">{S.tiers.unit}</span>
                    <select id={`${id}-unit`} class="adm-select" value={kind}
                      onChange={(e) => onChange(setKind(table, i, e.currentTarget.value as FeeKind))}>
                      <option value="fee">Ar</option>
                      <option value="pct">%</option>
                    </select>
                  </label>
                  <button type="button" class="adm-tier-del" onClick={() => onChange(removeTier(table, i))}
                    aria-label={`${S.tiers.remove} : ${S.tiers.row(i + 1).toLowerCase()}`}>
                    <Icon name="trash" size={18} /><span aria-hidden="true">{S.tiers.remove}</span>
                  </button>
                </div>
              </li>
            )
          })}
        </ol>
      )}
      <div class="adm-row">
        <button type="button" class="btn btn-outline" onClick={() => onChange(addTier(table, minTx))}>
          <Icon name="add" size={20} />{S.tiers.add}
        </button>
        <button type="button" class="btn btn-text adm-danger" onClick={onDrop}>{S.tiers.drop}</button>
      </div>
    </div>
  )
}
