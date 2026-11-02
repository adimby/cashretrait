import { useState } from 'preact/hooks'
import type { FeeTable, Tier } from '../../tariffs/schema'
import { feeFor } from '../../engine/fees'
import { t } from '../i18n'
import { formatAr, formatNumber } from '../format'

const W = 328
const H = 184
const M = { l: 46, r: 14, t: 26, b: 26 }
const PW = W - M.l - M.r
const PH = H - M.t - M.b

/** 1/2/5 × 10^k at or above x. */
function niceCeil(x: number): number {
  if (x <= 0) return 1
  const p = 10 ** Math.floor(Math.log10(x))
  for (const m of [1, 2, 4, 5, 10]) if (m * p >= x) return m * p
  return 10 * p
}

const feeAt = (tier: Tier, a: number) => ('fee' in tier ? tier.fee : Math.ceil((a * tier.feePercent) / 100))

/** Shown range: up to the first tier ceiling ≥ 1.25 × the largest marked amount, at least three tiers. */
export function chartDomain(table: FeeTable, marks: number[]): number {
  const ceilings = table.map((x) => x.max).sort((a, b) => a - b)
  if (!ceilings.length) return 1
  const target = Math.max(1.25 * Math.max(0, ...marks), ceilings[Math.min(2, ceilings.length - 1)])
  return ceilings.find((c) => c >= target) ?? ceilings[ceilings.length - 1]
}

const tierText = (tier: Tier) => 'fee' in tier
  ? t('chart.tier', { min: formatAr(tier.min), max: formatAr(tier.max), fee: formatAr(tier.fee) })
  : t('chart.tierPct', { min: formatAr(tier.min), max: formatAr(tier.max), pct: String(tier.feePercent).replace('.', ',') })

/** Inline SVG staircase of the fee table actually used, with the typed amount marked
 *  (its fee in one go) and the split transactions sitting at the tier ceilings. */
export function FeeStairChart({ table, amount, splits, subtitle }: {
  table: FeeTable; amount: number; splits: number[]; subtitle: string
}) {
  const xmax = chartDomain(table, [amount, ...splits])
  const tiers = table.filter((x) => x.min <= xmax).sort((a, b) => a.min - b.min)
  const fmax = Math.max(1, ...tiers.map((x) => feeAt(x, Math.min(x.max, xmax))))
  const ymax = niceCeil(fmax * 1.12)
  const X = (a: number) => M.l + (Math.min(a, xmax) / xmax) * PW
  const Y = (f: number) => M.t + PH - (f / ymax) * PH

  let d = ''
  tiers.forEach((x, i) => {
    const a0 = x.min, a1 = Math.min(x.max, xmax)
    d += `${i ? 'L' : 'M'}${X(a0).toFixed(1)} ${Y(feeAt(x, a0)).toFixed(1)}L${X(a1).toFixed(1)} ${Y(feeAt(x, a1)).toFixed(1)}`
  })
  const first = tiers[0], last = tiers[tiers.length - 1]
  const area = first ? `${d}L${X(Math.min(last.max, xmax)).toFixed(1)} ${Y(0)}L${X(first.min).toFixed(1)} ${Y(0)}Z` : ''

  const single = amount <= xmax ? feeFor(table, amount) : null
  const dots = [...new Set(splits)].filter((a) => a <= xmax && a !== amount).map((a) => ({ a, f: feeFor(table, a) })).filter((p) => p.f !== null) as { a: number; f: number }[]
  const showSplits = dots.length > 0

  const tierOf = (a: number) => tiers.find((x) => a >= x.min && a <= x.max) ?? null
  const [active, setActive] = useState<Tier | null>(null)
  const shown = active ?? tierOf(amount) ?? first ?? null
  const onMove = (e: PointerEvent) => {
    const svg = e.currentTarget as SVGSVGElement
    const box = svg.getBoundingClientRect()
    const ux = ((e.clientX - box.left) / box.width) * W
    const a = ((ux - M.l) / PW) * xmax
    const tier = tierOf(Math.round(a)) ?? (a <= 0 ? first : null)
    if (tier) setActive(tier)
  }

  const yTicks = [0, ymax / 2, ymax]
  const xTicks = [0, xmax / 2, xmax]
  const labelX = single !== null ? Math.max(M.l + 24, Math.min(W - M.r - 24, X(amount))) : 0
  const aria = single !== null
    ? t('chart.aria', { max: formatAr(xmax), amount: formatAr(amount), fee: formatAr(single) })
    : t('chart.ariaNone', { max: formatAr(xmax) })

  return (
    <section class="chart" aria-labelledby="chart-title">
      <h2 id="chart-title" class="section-title">{t('chart.title')}</h2>
      <p class="chart-sub">{subtitle}</p>
      <div class="chart-panel">
        <svg class="chart-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={aria}
          onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setActive(null)}>
          {yTicks.map((v) => (
            <g key={`y${v}`}>
              <line class="chart-grid" x1={M.l} x2={W - M.r} y1={Y(v)} y2={Y(v)} />
              <text class="chart-tick" x={M.l - 6} y={Y(v) + 4} text-anchor="end">{formatNumber(v)}</text>
            </g>
          ))}
          {xTicks.map((v, i) => (
            <text key={`x${v}`} class="chart-tick" x={X(v)} y={H - 6} text-anchor={i === 0 ? 'start' : i === 2 ? 'end' : 'middle'}>{formatNumber(v)}</text>
          ))}
          <path class="chart-area" d={area} />
          {shown && (
            <rect class="chart-band" x={X(shown.min)} y={M.t} width={Math.max(1, X(Math.min(shown.max, xmax)) - X(shown.min))} height={PH} />
          )}
          <path class="chart-line" d={d} />
          {single !== null && (
            <g>
              <line class="chart-marker" x1={X(amount)} x2={X(amount)} y1={Y(single)} y2={Y(0)} />
              <circle class="chart-dot" cx={X(amount)} cy={Y(single)} r={5} />
              <text class="chart-value" x={labelX} y={Math.max(14, Y(single) - 10)} text-anchor="middle">{formatAr(single)}</text>
            </g>
          )}
          {dots.map((p) => <circle key={p.a} class="chart-split" cx={X(p.a)} cy={Y(p.f)} r={5} />)}
        </svg>
        <ul class="chart-legend">
          {single !== null && <li><span class="key key-amount" aria-hidden="true" />{t('chart.legend.amount')}</li>}
          {showSplits && <li><span class="key key-split" aria-hidden="true" />{t('chart.legend.split')}</li>}
        </ul>
        <p class="chart-readout" aria-hidden="true">{shown ? tierText(shown) : ''}</p>
        <p class="chart-help">{t('chart.touch')}</p>
      </div>
      <details class="chart-details">
        <summary>{t('chart.table')}</summary>
        <table class="tier-table">
          <thead><tr><th scope="col">{t('chart.col.from')}</th><th scope="col">{t('chart.col.to')}</th><th scope="col">{t('chart.col.fee')}</th></tr></thead>
          <tbody>
            {tiers.map((x) => (
              <tr key={x.min} class={shown === x ? 'is-active' : undefined}>
                <td>{formatAr(x.min)}</td><td>{formatAr(x.max)}</td>
                <td>{'fee' in x ? formatAr(x.fee) : `${String(x.feePercent).replace('.', ',')} %`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </section>
  )
}
