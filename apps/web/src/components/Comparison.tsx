import { useEffect, useMemo, useState, type FormEvent } from 'react'
import type { BudgetReport, CompareResponse, SearchResult } from '../lib/types'
import { cssVars, formatCurrency, formatPercent } from '../lib/format'
import { formatFiscalYearDisplay } from '../lib/fiscal-year'
import { compareToCsv, downloadTextFile } from '../lib/csv-export'
import { SectionHeading } from './SectionHeading'

interface ComparisonProps {
  activeReport: BudgetReport
  compareCity: string
  compareState: string
  compareYear: string
  onCompareCityChange: (v: string) => void
  onCompareStateChange: (v: string) => void
  onCompareYearChange: (v: string) => void
  onSubmit: () => void
  onCancel: () => void
  isPending: boolean
  elapsedSec: number
  data: CompareResponse | undefined
  error: Error | null
  archiveOptions: SearchResult[]
  perCapitaMode: boolean
  onPerCapitaModeChange: (v: boolean) => void
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
  onCancel,
  isPending,
  elapsedSec,
  data,
  error,
  archiveOptions,
  perCapitaMode,
  onPerCapitaModeChange,
}: ComparisonProps) {
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    onSubmit()
  }

  const others = useMemo(
    () =>
      archiveOptions.filter(
        (r) =>
          r.city !== activeReport.city ||
          r.state !== activeReport.state ||
          r.fiscalYearLabel !== activeReport.fiscalYearLabel,
      ),
    [
      archiveOptions,
      activeReport.city,
      activeReport.state,
      activeReport.fiscalYearLabel,
    ],
  )

  const [presetId, setPresetId] = useState('')

  useEffect(() => {
    const m = others.find(
      (o) =>
        o.city === compareCity &&
        o.state === compareState &&
        o.fiscalYearLabel.trim() === (compareYear || '').trim(),
    )
    setPresetId(m?.id ?? '')
  }, [compareCity, compareState, compareYear, others])

  const exportCompare = () => {
    if (!data) return
    const slug = `compare-${data.primary.city}-${data.secondary.city}`
      .replace(/[^\w.-]+/g, '_')
      .slice(0, 80)
    downloadTextFile(`budget-buckets-${slug}.csv`, compareToCsv(data.primary, data.secondary))
  }

  return (
    <section className="section">
      <SectionHeading num="03" eyebrow="City vs City" title="Line them up, side by side" />

      <div className="compare-shell">
        <form className="compare-form" onSubmit={handleSubmit}>
          <div className="field field--full">
            <label htmlFor="cmp-preset">Compare with an archived budget</label>
            <select
              id="cmp-preset"
              className="compare-select"
              value={presetId}
              onChange={(e) => {
                const id = e.target.value
                setPresetId(id)
                const r = others.find((o) => o.id === id)
                if (r) {
                  onCompareCityChange(r.city)
                  onCompareStateChange(r.state)
                  onCompareYearChange(r.fiscalYearLabel)
                }
              }}
            >
              <option value="">— Type a city manually below —</option>
              {others.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.displayName} · {formatFiscalYearDisplay(o.fiscalYearLabel)}
                </option>
              ))}
            </select>
          </div>

          <div className="field-row compare-form__manual">
            <div className="field">
              <label htmlFor="cmp-city">Compare against</label>
              <input
                id="cmp-city"
                value={compareCity}
                onChange={(e) => {
                  setPresetId('')
                  onCompareCityChange(e.target.value)
                }}
                placeholder="City name"
              />
            </div>
            <div className="field">
              <label htmlFor="cmp-state">State</label>
              <input
                id="cmp-state"
                value={compareState}
                onChange={(e) => {
                  setPresetId('')
                  onCompareStateChange(e.target.value)
                }}
                placeholder="CA"
              />
            </div>
            <div className="field">
              <label htmlFor="cmp-year">FY</label>
              <input
                id="cmp-year"
                value={compareYear}
                onChange={(e) => {
                  setPresetId('')
                  onCompareYearChange(e.target.value)
                }}
                placeholder="optional — latest if empty"
              />
            </div>
          </div>

          <div className="compare-toolbar">
            <label className="compare-check">
              <input
                type="checkbox"
                checked={perCapitaMode}
                onChange={(e) => onPerCapitaModeChange(e.target.checked)}
              />
              <span>Show dollars per resident (bars use per-capita scale)</span>
            </label>
          </div>

          <div className="compare-actions">
            <button className="btn" type="submit" disabled={isPending || !compareCity.trim()}>
              {isPending && <span className="spinner" aria-hidden />}
              {isPending ? 'Comparing…' : 'Run comparison'}
            </button>
            {isPending ? (
              <>
                <span className="compare-elapsed" aria-live="polite">
                  {elapsedSec}s
                  <span className="compare-elapsed__hint"> (times out at 120s)</span>
                </span>
                <button type="button" className="btn btn--ghost" onClick={onCancel}>
                  Cancel
                </button>
              </>
            ) : null}
            {data ? (
              <button type="button" className="btn btn--ghost" onClick={exportCompare}>
                Export comparison CSV
              </button>
            ) : null}
          </div>
        </form>

        {error ? (
          <div className="alert">
            <strong>Couldn't fetch that comparison.</strong>
            <p>{error.message}</p>
          </div>
        ) : null}

        {data ? (
          <ComparisonTable data={data} perCapitaMode={perCapitaMode} />
        ) : (
          <p className="chat-placeholder">
            Pick another city to see every bucket stacked against{' '}
            <strong>{activeReport.displayName}</strong> ({formatFiscalYearDisplay(activeReport.fiscalYearLabel)}).
            Use the archive menu to avoid long live scrapes.
          </p>
        )}
      </div>
    </section>
  )
}

function ComparisonTable({
  data,
  perCapitaMode,
}: {
  data: CompareResponse
  perCapitaMode: boolean
}) {
  const { primary, secondary } = data

  const scaleAmt = (amt: number | null, pop: number | null) => {
    if (amt === null) return 0
    if (!perCapitaMode) return amt
    if (!pop) return 0
    return amt / pop
  }

  const maxAmount = Math.max(
    ...primary.buckets.map((b) => scaleAmt(b.amount, primary.population)),
    ...secondary.buckets.map((b) => scaleAmt(b.amount, secondary.population)),
    1,
  )

  return (
    <div>
      <div className="compare-heads">
        <div className="compare-head">
          <span className="compare-head__label">Primary</span>
          <span className="compare-head__city">{primary.displayName}</span>
          <span className="compare-head__sub">
            {formatFiscalYearDisplay(primary.fiscalYearLabel)} · Total{' '}
            {formatCurrency(primary.totalBudget, true)}
            {perCapitaMode && primary.population
              ? ` · ${formatCurrency((primary.totalBudget ?? 0) / primary.population, false)}/person`
              : ''}
          </span>
        </div>
        <div className="compare-head">
          <span className="compare-head__label">Against</span>
          <span className="compare-head__city">{secondary.displayName}</span>
          <span className="compare-head__sub">
            {formatFiscalYearDisplay(secondary.fiscalYearLabel)} · Total{' '}
            {formatCurrency(secondary.totalBudget, true)}
            {perCapitaMode && secondary.population
              ? ` · ${formatCurrency((secondary.totalBudget ?? 0) / secondary.population, false)}/person`
              : ''}
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

          const aShow = scaleAmt(bucket.amount, primary.population)
          const bShow = scaleAmt(other?.amount ?? null, secondary.population)

          return (
            <div
              key={bucket.key}
              className="compare-row"
              style={cssVars({ bucketColor: bucket.color })}
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
                      width: `${(aShow / maxAmount) * 100}%`,
                    }}
                  />
                </div>
                <span className="compare-bar__value">
                  {perCapitaMode
                    ? primary.population
                      ? `${formatCurrency(aAmt / primary.population, false)}/person`
                      : '—'
                    : formatCurrency(aAmt, true)}
                  <br />
                  <span style={{ color: 'var(--ink-60)', fontWeight: 400 }}>
                    {formatPercent(aPct)} of budget
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
                <div className="compare-diff__sub">share Δ</div>
              </div>

              <div className="compare-bar compare-bar--right">
                <div className="compare-bar__track">
                  <div
                    className="compare-bar__fill"
                    style={{
                      width: `${(bShow / maxAmount) * 100}%`,
                    }}
                  />
                </div>
                <span className="compare-bar__value">
                  {perCapitaMode
                    ? secondary.population
                      ? `${formatCurrency(bAmt / secondary.population, false)}/person`
                      : '—'
                    : formatCurrency(bAmt, true)}
                  <br />
                  <span style={{ color: 'var(--ink-60)', fontWeight: 400 }}>
                    {formatPercent(bPct)} of budget
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
