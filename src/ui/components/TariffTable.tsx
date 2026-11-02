import type { FeeTable, Tier } from '../../tariffs/schema'
import { t } from '../i18n'
import { formatNumber } from '../format'
import { Plate } from './Plate'

export const pct = (n: number) => `${String(n).replace('.', ',')} %`

export function TierFee({ tier }: { tier: Tier }) {
  return 'fee' in tier ? <Plate amount={tier.fee} size="s" /> : <Plate size="s">{pct(tier.feePercent)}</Plate>
}

/** One operator's fee grid for one operation, read like the lines of a fare board:
 *  range on the left, fee on a plate on the right. `null` → « non disponible ». */
export function TariffTable({ table, caption, noneText }: { table: FeeTable | null | undefined; caption: string; noneText?: string }) {
  if (!table || !table.length) {
    return (
      <div class="tariff-none" role="note">
        <p class="tariff-none-label"><Plate size="s">{t('unavailable')}</Plate></p>
        {noneText && <p class="tariff-none-text">{noneText}</p>}
      </div>
    )
  }
  const rows = [...table].sort((a, b) => a.min - b.min)
  return (
    <table class="tariff-table">
      <caption class="visually-hidden">{caption}</caption>
      <thead>
        <tr>
          <th scope="col">{t('chart.col.from')}</th>
          <th scope="col">{t('chart.col.to')}</th>
          <th scope="col">{t('chart.col.fee')}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((x) => (
          <tr key={x.min}>
            <td>{formatNumber(x.min)}<span class="visually-hidden"> Ar</span></td>
            <td>{formatNumber(x.max)}<span class="visually-hidden"> Ar</span></td>
            <td><TierFee tier={x} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
