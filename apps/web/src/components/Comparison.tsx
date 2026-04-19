import { type FormEvent } from 'react'
import type { BudgetReport, CompareResponse } from '../lib/types'
import { formatCurrency, formatPercent } from '../lib/format'

interface ComparisonProps {
  activeReport: BudgetReport
  compareCity: string
  compareState: string
  compareYear: string
  onCompareCityChange: (v: string) => void
  onCompareStateChange: (v: string) => void
  onCompareYearChange: (v: string) => void
  onSubmit: () => void
  isPending: boolean
  data: CompareResponse | undefined
  error: Error | null
}

export function Comparison({
  activeReport,
  compareCity,
  compareState,
  compareYear,
  onCompareCityChange,
  onCompareStateChange,
  onCompareYearChange,
  onSubmit,
  isPending,
  data,
  error,
}: ComparisonProps) {
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    onSubmit()
  }

  return (
    <section className="section">
      <div className="section-heading">
        <div className="section-heading__num">03</div>
        <div className="section-heading__title">
          <p className="eyebrow">City vs City</p>
          <h2>Line them up, side by side</h2>
        </div>
      </div>

      <div className="compare-shell">
        <form className="compare-form" onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="cmp-city">Compare against</label>
            <input
              id="cmp-city"
              value={compareCity}
              onChange={(e) => onCompareCityChange(e.target.value)}
              placeholder="San Diego"
            />
          </div>
          <div className="field">
            <label htmlFor="cmp-state">State</label>
            <input
              id="cmp-state"
              value={compareState}
              onChange={(e) => onCompareStateChange(e.target.value)}
              placeholder="CA"
            />
          </div>
          <div className="field">
            <label htmlFor="cmp-year">FY</label>
            <input
              id="cmp-year"
              value={compareYear}
              onChange={(e) => onCompareYearChange(e.target.value)}
              placeholder="optional"
            />
          </div>
          <button className="btn" type="submit" disabled={isPending || !compareCity.trim()}>
            {isPending && <span className="spinner" aria-hidden />}
            {isPending ? 'Comparing…' : 'Run comparison'}
          </button>
        </form>

        {error ? (
          <div className="alert">
            <strong>Couldn't fetch that comparison.</strong>
            <p>{error.message}</p>
          </div>
        ) : null}

        {data ? (
          <ComparisonTable data={data} />
        ) : (
          <p className="chat-placeholder">
            Pick another city to see every bucket stacked against{' '}
            <strong>{activeReport.displayName}</strong>. Useful for
            understanding how civic priorities differ across places of similar
            size.
          </p>
        )}
      </div>
    </section>
  )
}

function ComparisonTable({ data }: { data: CompareResponse }) {
  const { primary, secondary } = data

  const maxAmount = Math.max(
    ...primary.buckets.map((b) => b.amount ?? 0),
    ...secondary.buckets.map((b) => b.amount ?? 0),
    1,
  )

  return (
    <div>
      <div className="compare-heads">
        <div className="compare-head">
          <span className="compare-head__label">Primary</span>
          <span className="compare-head__city">{primary.displayName}</span>
          <span className="compare-head__sub">
            {primary.fiscalYearLabel} · Total {formatCurrency(primary.totalBudget, true)}
          </span>
        </div>
        <div className="compare-head">
          <span className="compare-head__label">Against</span>
          <span className="compare-head__city">{secondary.displayName}</span>
          <span className="compare-head__sub">
            {secondary.fiscalYearLabel} · Total {formatCurrency(secondary.totalBudget, true)}
          </span>
        </div>
      </div>

      <div className="compare-table">
        {primary.buckets.map((bucket) => {
          const other = secondary.buckets.find((b) => b.key === bucket.key)
          const aAmt = bucket.amount ?? 0
          const bAmt = other?.amount ?? 0
          const aPct = bucket.share ?? 0
          const bPct = other?.share ?? 0
          const diff = aPct - bPct
          const diffClass =
            Math.abs(diff) < 0.005 ? '' : diff > 0 ? 'is-up' : 'is-down'
          const arrow = diff > 0.005 ? '▲' : diff < -0.005 ? '▼' : '•'
          return (
            <div
              key={bucket.key}
              className="compare-row"
              style={{ ['--bucket-color' as string]: bucket.color }}
            >
              <div className="compare-row__label">
                <span className="compare-row__name">
                  <span className="compare-row__swatch" aria-hidden />
                  {bucket.label}
                </span>
              </div>

              <div className="compare-bar compare-bar--left">
                <div className="compare-bar__track">
                  <div
                    className="compare-bar__fill"
                    style={{
                      width: `${(aAmt / maxAmount) * 100}%`,
                    }}
                  />
                </div>
                <span className="compare-bar__value">
                  {formatCurrency(aAmt, true)}
                  <br />
                  <span style={{ color: 'var(--ink-60)', fontWeight: 400 }}>
                    {formatPercent(aPct)}
                  </span>
                </span>
              </div>

              <div className={`compare-diff ${diffClass}`}>
                <div className="compare-diff__arrow">{arrow}</div>
                <div>
                  {Math.abs(diff) < 0.005
                    ? '—'
                    : formatPercent(Math.abs(diff))}
                </div>
              </div>

              <div className="compare-bar compare-bar--right">
                <div className="compare-bar__track">
                  <div
                    className="compare-bar__fill"
                    style={{
                      width: `${(bAmt / maxAmount) * 100}%`,
                    }}
                  />
                </div>
                <span className="compare-bar__value">
                  {formatCurrency(bAmt, true)}
                  <br />
                  <span style={{ color: 'var(--ink-60)', fontWeight: 400 }}>
                    {formatPercent(bPct)}
                  </span>
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
