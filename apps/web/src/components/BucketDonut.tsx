import { useMemo, useState } from 'react'
import type { BucketAllocation } from '../lib/types'
import { formatCurrency, formatPercent } from '../lib/format'

interface BucketDonutProps {
  buckets: BucketAllocation[]
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

export function BucketDonut({ buckets }: BucketDonutProps) {
  const [active, setActive] = useState<string | null>(null)

  const visible = useMemo(
    () => buckets.filter((b) => (b.amount ?? 0) > 0),
    [buckets],
  )

  const total = useMemo(
    () => visible.reduce((sum, b) => sum + (b.amount ?? 0), 0),
    [visible],
  )

  const slices = useMemo(() => {
    let cursor = -Math.PI / 2
    return visible.map((bucket) => {
      const fraction = total ? (bucket.amount ?? 0) / total : 0
      const start = cursor
      const end = cursor + fraction * Math.PI * 2
      const mid = (start + end) / 2
      cursor = end
      return { bucket, start, end, mid, fraction }
    })
  }, [visible, total])

  if (!visible.length || !total) {
    return (
      <div className="empty-chart">
        <p>No bucket totals extracted yet.</p>
        <span>The agent can still surface citations and answer questions below.</span>
      </div>
    )
  }

  const activeBucket = active
    ? visible.find((b) => b.key === active) ?? null
    : null

  // Tick marks at 10% intervals
  const ticks = Array.from({ length: 20 }, (_, i) => i * ((Math.PI * 2) / 20))

  // Build label placements with vertical anti-collision per side
  const labeled = slices.filter((s) => s.fraction >= 0.025)
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
        aria-label="Budget breakdown donut chart"
      >
        {/* Ticks around outer edge */}
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

        {/* Slices */}
        <g>
          {slices.map((s, i) => {
            const isActive = active === s.bucket.key
            const isDim = active !== null && !isActive
            return (
              <path
                key={s.bucket.key}
                d={donutArcPath(s.start, s.end, OUTER, INNER)}
                fill={s.bucket.color}
                className={`donut-slice ${isActive ? 'is-active' : ''} ${isDim ? 'is-dim' : ''}`}
                style={{ animationDelay: `${i * 60}ms` }}
                onMouseEnter={() => setActive(s.bucket.key)}
                onMouseLeave={() => setActive(null)}
                onFocus={() => setActive(s.bucket.key)}
                onBlur={() => setActive(null)}
                tabIndex={0}
                role="button"
                aria-label={`${s.bucket.label}: ${formatCurrency(s.bucket.amount, true)}, ${formatPercent(s.fraction)}`}
              />
            )
          })}
        </g>

        {/* Leader lines + labels — right side */}
        {rightLabels.map((s, i) => {
          const start = polar(CX, CY, LEADER_OUTER, s.mid)
          const elbow = polar(CX, CY, LEADER_ELBOW, s.mid)
          const y = rightYs[i].y
          const endX = LABEL_X_RIGHT - 10
          const path = `M ${start.x} ${start.y} L ${elbow.x} ${elbow.y} L ${endX} ${y}`
          const isDim = active !== null && active !== s.bucket.key
          return (
            <g key={`r-${s.bucket.key}`} opacity={isDim ? 0.35 : 1}>
              <path d={path} className="donut-leader" />
              <circle cx={endX} cy={y} r={2} className="donut-leader-dot" />
              <text
                x={LABEL_X_RIGHT - 4}
                y={y - 4}
                className="donut-leader-label"
                textAnchor="start"
              >
                {shortLabel(s.bucket.label)}
              </text>
              <text
                x={LABEL_X_RIGHT - 4}
                y={y + 10}
                className="donut-leader-pct"
                textAnchor="start"
              >
                {formatPercent(s.fraction)} · {formatCurrency(s.bucket.amount, true)}
              </text>
            </g>
          )
        })}

        {/* Leader lines + labels — left side */}
        {leftLabels.map((s, i) => {
          const start = polar(CX, CY, LEADER_OUTER, s.mid)
          const elbow = polar(CX, CY, LEADER_ELBOW, s.mid)
          const y = leftYs[i].y
          const endX = LABEL_X_LEFT + 10
          const path = `M ${start.x} ${start.y} L ${elbow.x} ${elbow.y} L ${endX} ${y}`
          const isDim = active !== null && active !== s.bucket.key
          return (
            <g key={`l-${s.bucket.key}`} opacity={isDim ? 0.35 : 1}>
              <path d={path} className="donut-leader" />
              <circle cx={endX} cy={y} r={2} className="donut-leader-dot" />
              <text
                x={LABEL_X_LEFT + 4}
                y={y - 4}
                className="donut-leader-label"
                textAnchor="end"
              >
                {shortLabel(s.bucket.label)}
              </text>
              <text
                x={LABEL_X_LEFT + 4}
                y={y + 10}
                className="donut-leader-pct"
                textAnchor="end"
              >
                {formatPercent(s.fraction)} · {formatCurrency(s.bucket.amount, true)}
              </text>
            </g>
          )
        })}

        {/* Center readout */}
        <g className="donut-center">
          <text x={CX} y={CY - 28} className="donut-center__kicker">
            {activeBucket ? shortLabel(activeBucket.label) : 'Adopted Budget'}
          </text>
          <text x={CX} y={CY + 10} className="donut-center__value">
            {formatCurrency(activeBucket?.amount ?? total, true)}
          </text>
          <text x={CX} y={CY + 32} className="donut-center__sub">
            {activeBucket
              ? `${formatPercent(activeBucket.share ?? 0)} of total`
              : `${visible.length} bucket${visible.length === 1 ? '' : 's'}`}
          </text>
        </g>
      </svg>
    </div>
  )
}

function shortLabel(label: string): string {
  // Compact long bucket labels for ring annotations
  return label
    .replace('Government Operations & Administration', 'Gov. Operations')
    .replace('Public Works & Infrastructure', 'Public Works')
    .replace('Public Safety & Justice', 'Public Safety')
    .replace('Health & Human Services', 'Health & Human Svc.')
    .replace('Community & Recreation', 'Community & Rec.')
    .replace('Economic Development', 'Economic Dev.')
}
