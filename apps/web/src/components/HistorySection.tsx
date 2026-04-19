import { type FormEvent } from 'react'
import { useI18n } from '../i18n/I18nProvider'
import type { BudgetReport, HistoryResponse } from '../lib/types'
import { formatFiscalYearDisplay } from '../lib/fiscal-year'
import { SectionHeading } from './SectionHeading'

interface HistorySectionProps {
  activeReport: BudgetReport
  historyYear: string
  onHistoryYearChange: (v: string) => void
  onSubmit: () => void
  isPending: boolean
  data: HistoryResponse | undefined
}

export function HistorySection({
  activeReport,
  historyYear,
  onHistoryYearChange,
  onSubmit,
  isPending,
  data,
}: HistorySectionProps) {
  const { t, intlLocale, formatCurrency, formatPercent } = useI18n()
  const reports = data?.reports ?? []
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    onSubmit()
  }

  return (
    <section className="section">
      <SectionHeading
        num="04"
        eyebrow={t('historyEyebrow')}
        title={t('historyTitle')}
      />

      <div className="history-shell">
        <HistoryLineChart reports={reports} intlLocale={intlLocale} />

        <div className="history-side">
          <h3>{activeReport.displayName}</h3>

          {reports.length ? (
            <div className="history-list">
              {reports.map((r, i) => {
                const prev = reports[i - 1]
                const delta =
                  prev?.totalBudget && r.totalBudget
                    ? (r.totalBudget - prev.totalBudget) / prev.totalBudget
                    : null
                const deltaClass =
                  delta === null
                    ? ''
                    : delta > 0
                      ? 'is-up'
                      : delta < 0
                        ? 'is-down'
                        : ''
                return (
                  <div key={r.id} className="history-item">
                    <span className="history-item__year" title={r.fiscalYearLabel}>
                      {formatFiscalYearDisplay(r.fiscalYearLabel)}
                    </span>
                    <span className="history-item__total">
                      {formatCurrency(r.totalBudget, true)}
                    </span>
                    <span className={`history-item__delta ${deltaClass}`}>
                      {delta === null
                        ? t('dash')
                        : (delta > 0 ? '+' : '') + formatPercent(delta)}
                    </span>
                  </div>
                )
              })}
            </div>
          ) : (
            <p style={{ color: 'var(--ink-60)', fontStyle: 'italic' }}>
              {t('historyOnlyOneYear')}
            </p>
          )}

          <form className="history-form" onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="hist-year">{t('historyLoadYear')}</label>
              <input
                id="hist-year"
                value={historyYear}
                onChange={(e) => onHistoryYearChange(e.target.value)}
                placeholder={t('phFY')}
              />
            </div>
            <button
              className="btn btn--sm"
              type="submit"
              disabled={isPending || !historyYear.trim()}
            >
              {isPending ? t('btnLoading') : t('btnPullYear')}
            </button>
          </form>
        </div>
      </div>
    </section>
  )
}

function HistoryLineChart({
  reports,
  intlLocale,
}: {
  reports: BudgetReport[]
  intlLocale: string
}) {
  const { t } = useI18n()
  const plotted = reports.filter((r) => r.totalBudget !== null)

  if (plotted.length < 2) {
    return (
      <div className="history-chart" style={{ aspectRatio: '3 / 1.8' }}>
        <div className="history-chart__fignote">{t('historyFig')}</div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: 'var(--ink-60)',
            fontStyle: 'italic',
            fontFamily: 'var(--display)',
            fontSize: '1.1rem',
            textAlign: 'center',
          }}
        >
          {t('historyNeedTwoYears')}
        </div>
      </div>
    )
  }

  const sorted = [...plotted].sort(
    (a, b) => (a.fiscalYearSort ?? 0) - (b.fiscalYearSort ?? 0),
  )

  const W = 640
  const H = 360
  const PAD_L = 44
  const PAD_R = 20
  const PAD_T = 24
  const PAD_B = 34

  const values = sorted.map((r) => r.totalBudget ?? 0)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const pad = (max - min) * 0.1 || 1
  const yMin = Math.max(0, min - pad)
  const yMax = max + pad

  const xFor = (i: number) =>
    PAD_L + (i * (W - PAD_L - PAD_R)) / Math.max(sorted.length - 1, 1)
  const yFor = (v: number) =>
    H - PAD_B - ((v - yMin) / (yMax - yMin)) * (H - PAD_T - PAD_B)

  const points = sorted.map((r, i) => ({
    x: xFor(i),
    y: yFor(r.totalBudget ?? 0),
    r,
  }))

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${H - PAD_B} L ${points[0].x} ${H - PAD_B} Z`

  const gridCount = 4
  const gridlines = Array.from({ length: gridCount + 1 }, (_, i) => {
    const val = yMin + ((yMax - yMin) * i) / gridCount
    const y = yFor(val)
    return { val, y }
  })

  return (
    <div className="history-chart">
      <div className="history-chart__fignote">{t('historyFigCaption')}</div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        {gridlines.map((g, i) => (
          <g key={i}>
            <line
              x1={PAD_L}
              y1={g.y}
              x2={W - PAD_R}
              y2={g.y}
              className="history-grid"
            />
            <text
              x={PAD_L - 8}
              y={g.y + 3}
              textAnchor="end"
              className="history-tick-label"
            >
              $
              {Intl.NumberFormat(intlLocale, {
                notation: 'compact',
                maximumFractionDigits: 1,
              }).format(g.val)}
            </text>
          </g>
        ))}

        <line
          x1={PAD_L}
          y1={H - PAD_B}
          x2={W - PAD_R}
          y2={H - PAD_B}
          className="history-axis"
        />

        <path d={areaPath} className="history-area" />
        <path d={linePath} className="history-line" />

        {points.map((p, i) => (
          <g key={i}>
            <circle
              cx={p.x}
              cy={p.y}
              r={5}
              className={`history-dot ${i === points.length - 1 ? 'history-dot--latest' : ''}`}
            />
            <text
              x={p.x}
              y={H - PAD_B + 18}
              textAnchor="middle"
              className="history-tick-label"
            >
              {formatFiscalYearDisplay(p.r.fiscalYearLabel)}
            </text>
            <text
              x={p.x}
              y={p.y - 12}
              textAnchor="middle"
              className="history-label"
            >
              {Intl.NumberFormat(intlLocale, {
                style: 'currency',
                currency: 'USD',
                notation: 'compact',
                maximumFractionDigits: 2,
              }).format(p.r.totalBudget ?? 0)}
            </text>
          </g>
        ))}
      </svg>
    </div>
  )
}
