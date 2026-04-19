import type { BudgetReport } from '../lib/types'
import { bucketLabel } from '../i18n/buckets'
import { useI18n } from '../i18n/I18nProvider'
import type { DonutDenominator } from './BucketDonut'
import { perCapita } from '../lib/format'
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
  const { locale, t, formatMessage, formatCurrency, formatPercent, formatNumber, formatDate } =
    useI18n()

  const status = fromCache ? t('dossierStatusArchive') : t('dossierStatusLive')
  const perResident = perCapita(report.totalBudget, report.population)
  const topBucket = [...report.buckets]
    .filter((b) => (b.amount ?? 0) > 0)
    .sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0))[0]

  const sumMapped = report.buckets.reduce((s, b) => s + (b.amount ?? 0), 0)
  const total = report.totalBudget
  const coverageRatio =
    total && total > 0 && sumMapped >= 0 ? Math.min(1, sumMapped / total) : null
  const gap = total && total > 0 ? Math.max(0, total - sumMapped) : null

  const fyDisplay = formatFiscalYearDisplay(report.fiscalYearLabel)

  const exportCsv = () => {
    const slug = `${report.city}-${report.state}-${report.fiscalYearLabel}`
      .replace(/[^\w.-]+/g, '_')
      .slice(0, 80)
    downloadTextFile(`budget-buckets-${slug}.csv`, reportToCsvRows(report))
  }

  const topLabel = topBucket ? bucketLabel(topBucket.key, locale) : t('dash')

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
          <div>
            {t('dossierReportId')} · {report.id.slice(0, 8).toUpperCase()}
          </div>
          <div>
            {t('dossierRetrieved')} · {formatDate(report.retrievedAt)}
          </div>
        </div>
      </div>

      <div className="stats-strip">
        <div className="stats-strip__cell">
          <span className="stats-strip__label">{t('labelTotalAdoptedBudget')}</span>
          <span className="stats-strip__value stats-strip__value--num">
            {formatCurrency(report.totalBudget, true)}
          </span>
          <span className="stats-strip__hint">
            {report.totalBudget
              ? formatCurrency(report.totalBudget, false)
              : t('valueNotExtracted')}
          </span>
        </div>
        <div className="stats-strip__cell">
          <span className="stats-strip__label">{t('labelPopulation')}</span>
          <span className="stats-strip__value stats-strip__value--num">
            {formatNumber(report.population)}
          </span>
          <span className="stats-strip__hint">{t('hintResidents')}</span>
        </div>
        <div className="stats-strip__cell">
          <span className="stats-strip__label">{t('labelPerResident')}</span>
          <span className="stats-strip__value stats-strip__value--num">
            {formatCurrency(perResident, false)}
          </span>
          <span className="stats-strip__hint">{t('hintBudgetedPerPerson')}</span>
        </div>
        <div className="stats-strip__cell">
          <span className="stats-strip__label">{t('labelLargestBucket')}</span>
          <span className="stats-strip__value">{topLabel}</span>
          <span className="stats-strip__hint">
            {topBucket
              ? formatMessage('hintAllocated', {
                  amount: formatCurrency(topBucket.amount, true),
                })
              : t('hintNoTotalsYet')}
          </span>
        </div>
      </div>

      {total && total > 0 ? (
        <div className="coverage-banner">
          <div>
            <strong>{t('coverage')}</strong>{' '}
            <span className="coverage-banner__nums">
              {formatMessage('coverageMappedOf', {
                mapped: formatCurrency(sumMapped, true),
                total: formatCurrency(total, true),
              })}
              {coverageRatio !== null
                ? formatMessage('coverageOfTotal', { pct: formatPercent(coverageRatio) })
                : ''}
            </span>
          </div>
          {gap !== null && gap > 0 ? (
            <span className="coverage-banner__gap">
              {formatMessage('coverageUnmapped', { gap: formatCurrency(gap, true) })}
            </span>
          ) : (
            <span className="coverage-banner__gap">{t('coverageMatch')}</span>
          )}
        </div>
      ) : null}

      <div className="chart-toolbar">
        <div className="chart-toolbar__group" role="group" aria-label={t('chartRingShows')}>
          <span className="chart-toolbar__label">{t('chartRingShows')}</span>
          <button
            type="button"
            className={`btn btn--sm ${donutDenominator === 'adopted' ? '' : 'btn--ghost'}`}
            onClick={() => onDonutDenominatorChange('adopted')}
          >
            {t('chartPctAdopted')}
          </button>
          <button
            type="button"
            className={`btn btn--sm ${donutDenominator === 'mapped' ? '' : 'btn--ghost'}`}
            onClick={() => onDonutDenominatorChange('mapped')}
          >
            {t('chartPctMapped')}
          </button>
        </div>
        <button type="button" className="btn btn--sm btn--ghost" onClick={exportCsv}>
          {t('btnExportCsv')}
        </button>
        <button
          type="button"
          className="btn btn--sm btn--ghost"
          onClick={() => window.print()}
        >
          {t('btnPrint')}
        </button>
      </div>

      <div className="chart-lede">
        <BucketDonut
          buckets={report.buckets}
          totalBudget={report.totalBudget}
          denominator={donutDenominator}
        />

        <aside className="chart-sidenote">
          <div className="chart-sidenote__fig">{t('chartFig')}</div>
          <p className="chart-sidenote__text">
            {t('dossierChartIntro')}
            {topBucket && (
              <>
                <strong>{bucketLabel(topBucket.key, locale)}</strong>
                {formatMessage('dossierChartAfterLabel', {
                  amount: formatCurrency(topBucket.amount, true),
                  pct: String(Math.round((topBucket.share ?? 0) * 100)),
                })}
              </>
            )}
          </p>
          <div className="chart-sidenote__citation">{t('chartSidenoteCitation')}</div>
        </aside>
      </div>

      <SourcesBlock report={report} fromCache={fromCache} />

      <div style={{ marginTop: 32 }}>
        <SectionHeading num="02" eyebrow={t('section02Eyebrow')} title={t('section02Title')} />
      </div>

      <BucketGrid buckets={report.buckets} />
    </section>
  )
}
