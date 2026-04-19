import type { BudgetReport } from '../lib/types'
import { formatCurrency, formatNumber, perCapita } from '../lib/format'
import { BucketDonut } from './BucketDonut'
import { BucketGrid } from './BucketGrid'
import { SourcesBlock } from './SourcesBlock'

interface DossierProps {
  report: BudgetReport
  fromCache: boolean
}

export function Dossier({ report, fromCache }: DossierProps) {
  const status = fromCache ? 'From the archive' : 'Freshly filed'
  const perResident = perCapita(report.totalBudget, report.population)
  const topBucket = [...report.buckets]
    .filter((b) => (b.amount ?? 0) > 0)
    .sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0))[0]

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
            <strong>{report.fiscalYearLabel}</strong>
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

      <div className="chart-lede">
        <BucketDonut buckets={report.buckets} />

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
                of the total.
              </>
            )}
          </p>
          <div className="chart-sidenote__citation">
            Hover any slice for its exact share · Full breakdown below
          </div>
        </aside>
      </div>

      <SourcesBlock report={report} fromCache={fromCache} />

      <div className="section-heading" style={{ marginTop: 32 }}>
        <div className="section-heading__num">02</div>
        <div className="section-heading__title">
          <p className="eyebrow">Bucket Detail</p>
          <h2>What every bucket holds</h2>
        </div>
      </div>

      <BucketGrid buckets={report.buckets} />
    </section>
  )
}
