import { useMemo, useState } from 'react'
import type { BucketAllocation } from '../lib/types'
import { formatCurrency, formatPercent } from '../lib/format'

export type DonutDenominator = 'adopted' | 'mapped'

interface BucketDonutProps {
  buckets: BucketAllocation[]
  totalBudget: number | null
  denominator: DonutDenominator
}

const VIEW_W = 760
const VIEW_H = 520
const CX = VIEW_W / 2
const CY = VIEW_H / 2
const OUTER = 180
const INNER = 112
const LEADER_OUTER = OUTER + 6
const LEADER_ELBOW = OUTER + 26
const LABEL_X_RIGHT = CX + 228
const LABEL_X_LEFT = CX - 228

const UNALLOCATED_KEY = '__unallocated__'
const UNALLOCATED_COLOR = '#6b7280'

function polar(cx: number, cy: number, r: number, angle: number) {
  return {
    x: cx + r * Math.cos(angle),
    y: cy + r * Math.sin(angle),
  }
}

function donutArcPath(
  start: number,
  end: number,
  outerR: number,
  innerR: number,
): string {
  const large = end - start > Math.PI ? 1 : 0
  const a = polar(CX, CY, outerR, start)
  const b = polar(CX, CY, outerR, end)
  const c = polar(CX, CY, innerR, end)
  const d = polar(CX, CY, innerR, start)
  return `M ${a.x} ${a.y} A ${outerR} ${outerR} 0 ${large} 1 ${b.x} ${b.y} L ${c.x} ${c.y} A ${innerR} ${innerR} 0 ${large} 0 ${d.x} ${d.y} Z`
}

interface DonutSlice {
  sliceKey: string
  label: string
  color: string
  amount: number
  /** Arc span as fraction of the full ring (sums to 1). */
  arcFraction: number
  /** Label percentage (same as arc in mapped mode; adopted-total-based in adopted mode). */
  labelFraction: number
}

export function BucketDonut({ buckets, totalBudget, denominator }: BucketDonutProps) {
  const [active, setActive] = useState<string | null>(null)

  const visible = useMemo(
    () => buckets.filter((b) => (b.amount ?? 0) > 0),
    [buckets],
  )

  const slices = useMemo((): DonutSlice[] => {
    if (!visible.length) return []

    const sumMapped = visible.reduce((sum, b) => sum + (b.amount ?? 0), 0)
    if (sumMapped <= 0) return []

    const useAdopted =
      denominator === 'adopted' &&
      totalBudget !== null &&
      totalBudget !== undefined &&
      totalBudget > 0

    if (useAdopted) {
      const total = totalBudget
      const out: DonutSlice[] = visible.map((bucket) => {
        const amt = bucket.amount ?? 0
        return {
          sliceKey: bucket.key,
          label: bucket.label,
          color: bucket.color,
          amount: amt,
          arcFraction: amt / total,
          labelFraction: amt / total,
        }
      })
      const gap = Math.max(0, total - sumMapped)
      if (gap > 0 && gap / total >= 0.002) {
        out.push({
          sliceKey: UNALLOCATED_KEY,
          label: 'Unmapped / other funds',
          color: UNALLOCATED_COLOR,
          amount: gap,
          arcFraction: gap / total,
          labelFraction: gap / total,
        })
      }
      return out
    }

    // mapped: wedge sizes match % of extracted bucket totals
    return visible.map((bucket) => {
      const amt = bucket.amount ?? 0
      const f = amt / sumMapped
      return {
        sliceKey: bucket.key,
        label: bucket.label,
        color: bucket.color,
        amount: amt,
        arcFraction: f,
        labelFraction: f,
      }
    })
  }, [visible, totalBudget, denominator])

  const arcSlices = useMemo(() => {
    let cursor = -Math.PI / 2
    return slices.map((s) => {
      const start = cursor
      const span = s.arcFraction * Math.PI * 2
      const end = cursor + span
      const mid = (start + end) / 2
      cursor = end
      return { slice: s, start, end, mid, arcFraction: s.arcFraction }
    })
  }, [slices])

  const totalArcAmount = useMemo(
    () => slices.reduce((s, x) => s + x.amount, 0),
    [slices],
  )

  if (!visible.length || !slices.length) {
    return (
      <div className="empty-chart">
        <p>No bucket totals extracted yet.</p>
        <span>The agent can still surface citations and answer questions below.</span>
      </div>
    )
  }

  const activeSlice = active ? slices.find((s) => s.sliceKey === active) ?? null : null

  const ticks = Array.from({ length: 20 }, (_, i) => i * ((Math.PI * 2) / 20))

  const labeled = arcSlices.filter((s) => s.arcFraction >= 0.025)
  const leftLabels: typeof labeled = []
  const rightLabels: typeof labeled = []
  for (const s of labeled) {
    if (Math.cos(s.mid) >= 0) rightLabels.push(s)
    else leftLabels.push(s)
  }
  rightLabels.sort((a, b) => Math.sin(a.mid) - Math.sin(b.mid))
  leftLabels.sort((a, b) => Math.sin(a.mid) - Math.sin(b.mid))

  const MIN_GAP = 28

  function resolveY(side: typeof rightLabels) {
    const out = side.map((s) => ({
      slice: s,
      y: polar(CX, CY, LEADER_ELBOW, s.mid).y,
    }))
    for (let i = 1; i < out.length; i++) {
      const prev = out[i - 1]
      if (out[i].y - prev.y < MIN_GAP) {
        out[i].y = prev.y + MIN_GAP
      }
    }
    return out
  }

  const rightYs = resolveY(rightLabels)
  const leftYs = resolveY(leftLabels)

  return (
    <div className="donut-wrap">
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        className="donut-svg"
        role="img"
        aria-label={
          denominator === 'adopted'
            ? 'Budget breakdown donut chart, shares of adopted total'
            : 'Budget breakdown donut chart, shares of extracted bucket totals'
        }
      >
        {ticks.map((angle, i) => {
          const outer = polar(CX, CY, OUTER + 3, angle)
          const inner = polar(CX, CY, OUTER + (i % 2 === 0 ? 12 : 8), angle)
          return (
            <line
              key={`t-${i}`}
              className="donut-tick"
              x1={outer.x}
              y1={outer.y}
              x2={inner.x}
              y2={inner.y}
            />
          )
        })}

        <g>
          {arcSlices.map((s, i) => {
            const isActive = active === s.slice.sliceKey
            const isDim = active !== null && !isActive
            return (
              <path
                key={s.slice.sliceKey}
                d={donutArcPath(s.start, s.end, OUTER, INNER)}
                fill={s.slice.color}
                className={`donut-slice ${isActive ? 'is-active' : ''} ${isDim ? 'is-dim' : ''}`}
                style={{ animationDelay: `${i * 60}ms` }}
                onMouseEnter={() => setActive(s.slice.sliceKey)}
                onMouseLeave={() => setActive(null)}
                onFocus={() => setActive(s.slice.sliceKey)}
                onBlur={() => setActive(null)}
                tabIndex={0}
                role="button"
                aria-label={`${shortLabel(s.slice.label)}: ${formatCurrency(s.slice.amount, true)}, ${formatPercent(s.slice.labelFraction)}`}
              />
            )
          })}
        </g>

        {rightLabels.map((s, i) => {
          const start = polar(CX, CY, LEADER_OUTER, s.mid)
          const elbow = polar(CX, CY, LEADER_ELBOW, s.mid)
          const y = rightYs[i].y
          const endX = LABEL_X_RIGHT - 10
          const path = `M ${start.x} ${start.y} L ${elbow.x} ${elbow.y} L ${endX} ${y}`
          const isDim = active !== null && active !== s.slice.sliceKey
          return (
            <g key={`r-${s.slice.sliceKey}`} opacity={isDim ? 0.35 : 1}>
              <path d={path} className="donut-leader" />
              <circle cx={endX} cy={y} r={2} className="donut-leader-dot" />
              <text
                x={LABEL_X_RIGHT - 4}
                y={y - 4}
                className="donut-leader-label"
                textAnchor="start"
              >
                {shortLabel(s.slice.label)}
              </text>
              <text
                x={LABEL_X_RIGHT - 4}
                y={y + 10}
                className="donut-leader-pct"
                textAnchor="start"
              >
                {formatPercent(s.slice.labelFraction)} · {formatCurrency(s.slice.amount, true)}
              </text>
            </g>
          )
        })}

        {leftLabels.map((s, i) => {
          const start = polar(CX, CY, LEADER_OUTER, s.mid)
          const elbow = polar(CX, CY, LEADER_ELBOW, s.mid)
          const y = leftYs[i].y
          const endX = LABEL_X_LEFT + 10
          const path = `M ${start.x} ${start.y} L ${elbow.x} ${elbow.y} L ${endX} ${y}`
          const isDim = active !== null && active !== s.slice.sliceKey
          return (
            <g key={`l-${s.slice.sliceKey}`} opacity={isDim ? 0.35 : 1}>
              <path d={path} className="donut-leader" />
              <circle cx={endX} cy={y} r={2} className="donut-leader-dot" />
              <text
                x={LABEL_X_LEFT + 4}
                y={y - 4}
                className="donut-leader-label"
                textAnchor="end"
              >
                {shortLabel(s.slice.label)}
              </text>
              <text
                x={LABEL_X_LEFT + 4}
                y={y + 10}
                className="donut-leader-pct"
                textAnchor="end"
              >
                {formatPercent(s.slice.labelFraction)} · {formatCurrency(s.slice.amount, true)}
              </text>
            </g>
          )
        })}

        <g className="donut-center">
          <text x={CX} y={CY - 28} className="donut-center__kicker">
            {activeSlice ? shortLabel(activeSlice.label) : 'Adopted Budget'}
          </text>
          <text x={CX} y={CY + 10} className="donut-center__value">
            {formatCurrency(activeSlice?.amount ?? totalArcAmount, true)}
          </text>
          <text x={CX} y={CY + 32} className="donut-center__sub">
            {activeSlice
              ? `${formatPercent(activeSlice.labelFraction)} of ring basis`
              : `${slices.length} segment${slices.length === 1 ? '' : 's'}`}
          </text>
        </g>
      </svg>
    </div>
  )
}

function shortLabel(label: string): string {
  return label
    .replace('Government Operations & Administration', 'Gov. Operations')
    .replace('Public Works & Infrastructure', 'Public Works')
    .replace('Public Safety & Justice', 'Public Safety')
    .replace('Health & Human Services', 'Health & Human Svc.')
    .replace('Community & Recreation', 'Community & Rec.')
    .replace('Economic Development', 'Economic Dev.')
    .replace('Unmapped / other funds', 'Unmapped')
}
