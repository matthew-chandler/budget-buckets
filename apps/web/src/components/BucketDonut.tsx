import { useMemo, useState } from 'react'
import { bucketShortLabel, donutUnmappedShort } from '../i18n/buckets'
import { useI18n } from '../i18n/I18nProvider'
import { formatStr } from '../i18n/strings'
import type { BucketAllocation } from '../lib/types'

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
/** Left labels in the upper-left quadrant use a slightly inset X so leaders stay shorter. */
const LABEL_X_LEFT_UPPER = CX - 210
const VIEW_MARGIN = 22

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
  shortLabel: string
  color: string
  amount: number
  /** Arc span as fraction of the full ring (sums to 1). */
  arcFraction: number
  /** Label percentage (same as arc in mapped mode; adopted-total-based in adopted mode). */
  labelFraction: number
}

export function BucketDonut({ buckets, totalBudget, denominator }: BucketDonutProps) {
  const { locale, t, formatCurrency, formatPercent } = useI18n()
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
          shortLabel: bucketShortLabel(bucket.key, locale),
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
          shortLabel: donutUnmappedShort(locale),
          color: UNALLOCATED_COLOR,
          amount: gap,
          arcFraction: gap / total,
          labelFraction: gap / total,
        })
      }
      return out
    }

    return visible.map((bucket) => {
      const amt = bucket.amount ?? 0
      const f = amt / sumMapped
      return {
        sliceKey: bucket.key,
        shortLabel: bucketShortLabel(bucket.key, locale),
        color: bucket.color,
        amount: amt,
        arcFraction: f,
        labelFraction: f,
      }
    })
  }, [visible, totalBudget, denominator, locale])

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
        <p>{t('donutEmptyTitle')}</p>
        <span>{t('donutEmptyHint')}</span>
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
  leftLabels.sort((a, b) => Math.sin(b.mid) - Math.sin(a.mid))

  const MIN_GAP = 30

  /**
   * Spread label Y positions to satisfy MIN_GAP without only shoving downward (which bunches
   * everything into a bottom corner). Forward + backward pass, then rigid shift to stay on-canvas.
   */
  function resolveYsBidirectional(side: typeof rightLabels): { slice: (typeof side)[0]; y: number }[] {
    if (side.length === 0) return []

    const ideal = side.map((s) => polar(CX, CY, LEADER_ELBOW, s.mid).y)
    const order = side.map((_, i) => i).sort((a, b) => ideal[a] - ideal[b])
    const ys = order.map((i) => ideal[i])
    const n = ys.length

    for (let i = 1; i < n; i++) {
      if (ys[i] - ys[i - 1] < MIN_GAP) ys[i] = ys[i - 1] + MIN_GAP
    }
    for (let i = n - 2; i >= 0; i--) {
      if (ys[i + 1] - ys[i] < MIN_GAP) ys[i] = ys[i + 1] - MIN_GAP
    }

    const labelPad = 22
    let shift = 0
    let minY = Math.min(...ys) - labelPad
    let maxY = Math.max(...ys) + labelPad
    if (minY < VIEW_MARGIN) shift = VIEW_MARGIN - minY
    if (maxY + shift > VIEW_H - VIEW_MARGIN) {
      shift = VIEW_H - VIEW_MARGIN - maxY
    }
    const shifted = ys.map((y) => y + shift)

    const yByIndex = new Array<number>(side.length)
    order.forEach((origIdx, k) => {
      yByIndex[origIdx] = shifted[k]
    })
    return side.map((s, i) => ({ slice: s, y: yByIndex[i] }))
  }

  /** Upper half of the left semicircle (smaller screen Y): labels can sit above their arcs without one column stacking from the bottom. */
  const leftUpper = leftLabels.filter((s) => Math.sin(s.mid) < 0)
  const leftLower = leftLabels.filter((s) => Math.sin(s.mid) >= 0)

  const rightYs = resolveYsBidirectional(rightLabels)
  const leftUpperYs = resolveYsBidirectional(leftUpper)
  const leftLowerYs = resolveYsBidirectional(leftLower)

  if (leftUpperYs.length && leftLowerYs.length) {
    const bottomUpper = Math.max(...leftUpperYs.map((r) => r.y))
    const topLower = Math.min(...leftLowerYs.map((r) => r.y))
    if (topLower - bottomUpper < MIN_GAP) {
      const bump = bottomUpper + MIN_GAP - topLower
      for (const row of leftLowerYs) row.y += bump
    }
  }

  const allLeftLeaderYs = [...leftUpperYs, ...leftLowerYs]
  if (allLeftLeaderYs.length) {
    const labelPad = 22
    let bottom = Math.max(...allLeftLeaderYs.map((r) => r.y)) + labelPad
    if (bottom > VIEW_H - VIEW_MARGIN) {
      const adj = VIEW_H - VIEW_MARGIN - bottom
      for (const row of allLeftLeaderYs) row.y += adj
    }
    let top = Math.min(...allLeftLeaderYs.map((r) => r.y)) - labelPad
    if (top < VIEW_MARGIN) {
      const adj = VIEW_MARGIN - top
      for (const row of allLeftLeaderYs) row.y += adj
    }
  }

  const donutAria = denominator === 'adopted' ? t('donutAriaAdopted') : t('donutAriaMapped')

  return (
    <div className="donut-wrap">
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        className="donut-svg"
        role="img"
        aria-label={donutAria}
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
                aria-label={`${s.slice.shortLabel}: ${formatCurrency(s.slice.amount, true)}, ${formatPercent(s.slice.labelFraction)}`}
              />
            )
          })}
        </g>

        {rightYs.map(({ slice: s, y }) => {
          const start = polar(CX, CY, LEADER_OUTER, s.mid)
          const elbow = polar(CX, CY, LEADER_ELBOW, s.mid)
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
                {s.slice.shortLabel}
              </text>
              <text
                x={LABEL_X_RIGHT - 4}
                y={y + 13}
                className="donut-leader-pct"
                textAnchor="start"
              >
                {formatPercent(s.slice.labelFraction)} · {formatCurrency(s.slice.amount, true)}
              </text>
            </g>
          )
        })}

        {leftUpperYs.map(({ slice: s, y }) => {
          const start = polar(CX, CY, LEADER_OUTER, s.mid)
          const elbow = polar(CX, CY, LEADER_ELBOW, s.mid)
          const endX = LABEL_X_LEFT_UPPER + 10
          const path = `M ${start.x} ${start.y} L ${elbow.x} ${elbow.y} L ${endX} ${y}`
          const isDim = active !== null && active !== s.slice.sliceKey
          return (
            <g key={`lu-${s.slice.sliceKey}`} opacity={isDim ? 0.35 : 1}>
              <path d={path} className="donut-leader" />
              <circle cx={endX} cy={y} r={2} className="donut-leader-dot" />
              <text
                x={LABEL_X_LEFT_UPPER + 4}
                y={y - 4}
                className="donut-leader-label"
                textAnchor="end"
              >
                {s.slice.shortLabel}
              </text>
              <text
                x={LABEL_X_LEFT_UPPER + 4}
                y={y + 13}
                className="donut-leader-pct"
                textAnchor="end"
              >
                {formatPercent(s.slice.labelFraction)} · {formatCurrency(s.slice.amount, true)}
              </text>
            </g>
          )
        })}

        {leftLowerYs.map(({ slice: s, y }) => {
          const start = polar(CX, CY, LEADER_OUTER, s.mid)
          const elbow = polar(CX, CY, LEADER_ELBOW, s.mid)
          const endX = LABEL_X_LEFT + 10
          const path = `M ${start.x} ${start.y} L ${elbow.x} ${elbow.y} L ${endX} ${y}`
          const isDim = active !== null && active !== s.slice.sliceKey
          return (
            <g key={`ll-${s.slice.sliceKey}`} opacity={isDim ? 0.35 : 1}>
              <path d={path} className="donut-leader" />
              <circle cx={endX} cy={y} r={2} className="donut-leader-dot" />
              <text
                x={LABEL_X_LEFT + 4}
                y={y - 4}
                className="donut-leader-label"
                textAnchor="end"
              >
                {s.slice.shortLabel}
              </text>
              <text
                x={LABEL_X_LEFT + 4}
                y={y + 13}
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
            {activeSlice ? activeSlice.shortLabel : t('donutCenterAdopted')}
          </text>
          <text x={CX} y={CY + 10} className="donut-center__value">
            {formatCurrency(activeSlice?.amount ?? totalArcAmount, true)}
          </text>
          <text x={CX} y={CY + 32} className="donut-center__sub">
            {activeSlice
              ? formatStr(t('donutCenterOfRing'), {
                  pct: String(Math.round(activeSlice.labelFraction * 100)),
                })
              : slices.length === 1
                ? formatStr(t('donutCenterSegments'), { n: slices.length })
                : formatStr(t('donutCenterSegmentsPlural'), { n: slices.length })}
          </text>
        </g>
      </svg>
    </div>
  )
}
