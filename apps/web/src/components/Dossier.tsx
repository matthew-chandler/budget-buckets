import type { BudgetReport } from '../lib/types'
import type { DonutDenominator } from './BucketDonut'
import { formatCurrency, formatNumber, formatPercent, perCapita } from '../lib/format'
import { formatFiscalYearDisplay } from '../lib/fiscal-year'
import { downloadTextFile, reportToCsvRows } from '../lib/csv-export'
import { BucketDonut } from './BucketDonut'
import { BucketGrid } from './BucketGrid'
import { SourcesBlock } from './SourcesBlock'
import { SectionHeading } from './SectionHeading'

interface DossierProps {
  report: BudgetReport
  fromCache: boolean
  donutDenominator: DonutDenominator
  onDonutDenominatorChange: (v: DonutDenominator) => void
}

export function Dossier({
  report,
  fromCache,
  donutDenominator,
  onDonutDenominatorChange,
}: DossierProps) {
  const status = fromCache ? 'From the archive' : 'Freshly filed'
  const perResident = perCapita(report.totalBudget, report.population)
  const topBucket = [...report.buckets]
    .filter((b) => (b.amount ?? 0) > 0)
    .sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0))[0]

  const sumMapped = report.buckets.reduce((s, b) => s + (b.amount ?? 0), 0)
  const total = report.totalBudget
  const coverageRatio =
    total && total > 0 && sumMapped >= 0 ? Math.min(1, sumMapped / total) : null
  const gap =
    total && total > 0 ? Math.max(0, total - sumMapped) : null

  const fyDisplay = formatFiscalYearDisplay(report.fiscalYearLabel)

  const exportCsv = () => {
    const slug = `${report.city}-${report.state}-${report.fiscalYearLabel}`
      .replace(/[^\w.-]+/g, '_')
      .slice(0, 80)
    downloadTextFile(`budget-buckets-${slug}.csv`, reportToCsvRows(report))
  }

  return (
    <section className="dossier fade-in">
      <span className={`dossier__status ${fromCache ? '' : 'is-live'}`}>
        <span className="pulse" aria-hidden />
        {status}
      </span>

      <div className="dossier__top">
        <h1 className="dossier__city">
          {report.city}
          <span className="dossier__city-state">, {report.state}</span>
        </h1>
        <div className="dossier__dateline">
          <div>
            <strong title={report.fiscalYearLabel}>{fyDisplay}</strong>
          </div>
          <div>Report ID · {report.id.slice(0, 8).toUpperCase()}</div>
          <div>Retrieved · {new Date(report.retrievedAt).toLocaleDateString()}</div>
        </div>
      </div>

      <div className="stats-strip">
        <div className="stats-strip__cell">
          <span className="stats-strip__label">Total Adopted Budget</span>
          <span className="stats-strip__value stats-strip__value--num">
            {formatCurrency(report.totalBudget, true)}
          </span>
          <span className="stats-strip__hint">
            {report.totalBudget
              ? formatCurrency(report.totalBudget, false)
              : 'Value not extracted'}
          </span>
        </div>
        <div className="stats-strip__cell">
          <span className="stats-strip__label">Population</span>
          <span className="stats-strip__value stats-strip__value--num">
            {formatNumber(report.population)}
          </span>
          <span className="stats-strip__hint">residents</span>
        </div>
        <div className="stats-strip__cell">
          <span className="stats-strip__label">Per Resident</span>
          <span className="stats-strip__value stats-strip__value--num">
            {formatCurrency(perResident, false)}
          </span>
          <span className="stats-strip__hint">budgeted per person</span>
        </div>
        <div className="stats-strip__cell">
          <span className="stats-strip__label">Largest Bucket</span>
          <span className="stats-strip__value">
            {topBucket ? topBucket.label.split(' & ')[0] : '—'}
          </span>
          <span className="stats-strip__hint">
            {topBucket
              ? `${formatCurrency(topBucket.amount, true)} allocated`
              : 'No totals yet'}
          </span>
        </div>
      </div>

      {total && total > 0 ? (
        <div className="coverage-banner">
          <div>
            <strong>Coverage</strong>{' '}
            <span className="coverage-banner__nums">
              {formatCurrency(sumMapped, true)} mapped of {formatCurrency(total, true)} adopted
              {coverageRatio !== null ? ` (${formatPercent(coverageRatio)} of total)` : ''}
            </span>
          </div>
          {gap !== null && gap > 0 ? (
            <span className="coverage-banner__gap">
              Unmapped: {formatCurrency(gap, true)} — shown as its own slice when using “adopted
              total” mode.
            </span>
          ) : (
            <span className="coverage-banner__gap">Bucket sums match the adopted total.</span>
          )}
        </div>
      ) : null}

      <div className="chart-toolbar">
        <div className="chart-toolbar__group" role="group" aria-label="Donut percentage basis">
          <span className="chart-toolbar__label">Ring shows</span>
          <button
            type="button"
            className={`btn btn--sm ${donutDenominator === 'adopted' ? '' : 'btn--ghost'}`}
            onClick={() => onDonutDenominatorChange('adopted')}
          >
            % of adopted total
          </button>
          <button
            type="button"
            className={`btn btn--sm ${donutDenominator === 'mapped' ? '' : 'btn--ghost'}`}
            onClick={() => onDonutDenominatorChange('mapped')}
          >
            % of extracted buckets
          </button>
        </div>
        <button type="button" className="btn btn--sm btn--ghost" onClick={exportCsv}>
          Export CSV
        </button>
        <button
          type="button"
          className="btn btn--sm btn--ghost"
          onClick={() => window.print()}
        >
          Print / save as PDF
        </button>
      </div>

      <div className="chart-lede">
        <BucketDonut
          buckets={report.buckets}
          totalBudget={report.totalBudget}
          denominator={donutDenominator}
        />

        <aside className="chart-sidenote">
          <div className="chart-sidenote__fig">Fig. 1 — Allocation by bucket</div>
          <p className="chart-sidenote__text">
            Every dollar the city adopted was sorted into one of nine civic
            buckets.{' '}
            {topBucket && (
              <>
                <strong>{topBucket.label}</strong> leads the ledger at{' '}
                <strong>{formatCurrency(topBucket.amount, true)}</strong>,
                roughly <strong>{Math.round((topBucket.share ?? 0) * 100)}%</strong>{' '}
                of the adopted total.
              </>
            )}
          </p>
          <div className="chart-sidenote__citation">
            Hover any slice for details · Switch “ring shows” if bucket totals do not sum to the
            adopted figure
          </div>
        </aside>
      </div>

      <SourcesBlock report={report} fromCache={fromCache} />

      <div style={{ marginTop: 32 }}>
        <SectionHeading num="02" eyebrow="Bucket Detail" title="What every bucket holds" />
      </div>

      <BucketGrid buckets={report.buckets} />
    </section>
  )
}
