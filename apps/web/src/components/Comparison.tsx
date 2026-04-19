import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { bucketLabel } from '../i18n/buckets'
import { useI18n } from '../i18n/I18nProvider'
import { formatStr } from '../i18n/strings'
import type { AppLocale } from '../i18n/types'
import type { BudgetReport, CompareResponse, SearchResult } from '../lib/types'
import { useTranslatedReport } from '../lib/useTranslatedReport'
import { cssVars } from '../lib/format'
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
  const { locale, t } = useI18n()

  const trPrimary = useTranslatedReport(data?.primary ?? null)
  const trSecondary = useTranslatedReport(data?.secondary ?? null)
  const localizedCompareData = useMemo((): CompareResponse | null => {
    if (!data) return null
    return {
      ...data,
      primary: trPrimary.displayReport!,
      secondary: trSecondary.displayReport!,
    }
  }, [data, trPrimary.displayReport, trSecondary.displayReport])

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
    if (!localizedCompareData) return
    const slug = `compare-${localizedCompareData.primary.city}-${localizedCompareData.secondary.city}`
      .replace(/[^\w.-]+/g, '_')
      .slice(0, 80)
    downloadTextFile(
      `budget-buckets-${slug}.csv`,
      compareToCsv(localizedCompareData.primary, localizedCompareData.secondary),
    )
  }

  return (
    <section className="section">
      <SectionHeading num="03" eyebrow={t('compareEyebrow')} title={t('compareTitle')} />

      <div className="compare-shell">
        <form className="compare-form" onSubmit={handleSubmit}>
          <div className="field field--full">
            <label htmlFor="cmp-preset">{t('comparePresetLabel')}</label>
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
              <option value="">{t('archivePresetManual')}</option>
              {others.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.displayName} · {formatFiscalYearDisplay(o.fiscalYearLabel)}
                </option>
              ))}
            </select>
          </div>

          <div className="field-row compare-form__manual">
            <div className="field">
              <label htmlFor="cmp-city">{t('compareAgainst')}</label>
              <input
                id="cmp-city"
                value={compareCity}
                onChange={(e) => {
                  setPresetId('')
                  onCompareCityChange(e.target.value)
                }}
                placeholder={t('phCompareCity')}
              />
            </div>
            <div className="field">
              <label htmlFor="cmp-state">{t('labelState')}</label>
              <input
                id="cmp-state"
                value={compareState}
                onChange={(e) => {
                  setPresetId('')
                  onCompareStateChange(e.target.value)
                }}
                placeholder={t('phState')}
              />
            </div>
            <div className="field">
              <label htmlFor="cmp-year">{t('compareFY')}</label>
              <input
                id="cmp-year"
                value={compareYear}
                onChange={(e) => {
                  setPresetId('')
                  onCompareYearChange(e.target.value)
                }}
                placeholder={t('phCompareFY')}
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
              <span>{t('comparePerCapita')}</span>
            </label>
          </div>

          <div className="compare-actions">
            <button className="btn" type="submit" disabled={isPending || !compareCity.trim()}>
              {isPending && <span className="spinner" aria-hidden />}
              {isPending ? t('btnComparing') : t('btnRunComparison')}
            </button>
            {isPending ? (
              <>
                <span className="compare-elapsed" aria-live="polite">
                  {elapsedSec}s
                  <span className="compare-elapsed__hint">{t('compareTimeoutHint')}</span>
                </span>
                <button type="button" className="btn btn--ghost" onClick={onCancel}>
                  {t('btnCancel')}
                </button>
              </>
            ) : null}
            {localizedCompareData ? (
              <button type="button" className="btn btn--ghost" onClick={exportCompare}>
                {t('btnExportCompare')}
              </button>
            ) : null}
          </div>
        </form>

        {error ? (
          <div className="alert">
            <strong>{t('errCompare')}</strong>
            <p>{error.message}</p>
          </div>
        ) : null}

        {localizedCompareData && (trPrimary.isTranslating || trSecondary.isTranslating) ? (
          <p className="form-footer__note" style={{ marginTop: 12 }}>
            {t('hintTranslatingContent')}
          </p>
        ) : null}

        {localizedCompareData ? (
          <ComparisonTable
            data={localizedCompareData}
            perCapitaMode={perCapitaMode}
            locale={locale}
          />
        ) : (
          <p className="chat-placeholder">
            {formatStr(t('comparePlaceholder'), {
              name: activeReport.displayName,
              fy: formatFiscalYearDisplay(activeReport.fiscalYearLabel),
            })}
          </p>
        )}
      </div>
    </section>
  )
}

function ComparisonTable({
  data,
  perCapitaMode,
  locale,
}: {
  data: CompareResponse
  perCapitaMode: boolean
  locale: AppLocale
}) {
  const { t, formatCurrency, formatPercent } = useI18n()
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
          <span className="compare-head__label">{t('compareHeadPrimary')}</span>
          <span className="compare-head__city">{primary.displayName}</span>
          <span className="compare-head__sub">
            {formatFiscalYearDisplay(primary.fiscalYearLabel)} · {t('compareTotalWord')}{' '}
            {formatCurrency(primary.totalBudget, true)}
            {perCapitaMode && primary.population
              ? ` · ${formatCurrency((primary.totalBudget ?? 0) / primary.population, false)}${t('comparePerPerson')}`
              : ''}
          </span>
        </div>
        <div className="compare-head">
          <span className="compare-head__label">{t('compareHeadAgainst')}</span>
          <span className="compare-head__city">{secondary.displayName}</span>
          <span className="compare-head__sub">
            {formatFiscalYearDisplay(secondary.fiscalYearLabel)} · {t('compareTotalWord')}{' '}
            {formatCurrency(secondary.totalBudget, true)}
            {perCapitaMode && secondary.population
              ? ` · ${formatCurrency((secondary.totalBudget ?? 0) / secondary.population, false)}${t('comparePerPerson')}`
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
                  {bucketLabel(bucket.key, locale)}
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
                      ? `${formatCurrency(aAmt / primary.population, false)}${t('comparePerPerson')}`
                      : t('dash')
                    : formatCurrency(aAmt, true)}
                  <br />
                  <span style={{ color: 'var(--ink-60)', fontWeight: 400 }}>
                    {formatPercent(aPct)} {t('compareOfBudget')}
                  </span>
                </span>
              </div>

              <div className={`compare-diff ${diffClass}`}>
                <div className="compare-diff__arrow">{arrow}</div>
                <div>
                  {Math.abs(diff) < 0.005 ? t('dash') : formatPercent(Math.abs(diff))}
                </div>
                <div className="compare-diff__sub">{t('compareShareDelta')}</div>
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
                      ? `${formatCurrency(bAmt / secondary.population, false)}${t('comparePerPerson')}`
                      : t('dash')
                    : formatCurrency(bAmt, true)}
                  <br />
                  <span style={{ color: 'var(--ink-60)', fontWeight: 400 }}>
                    {formatPercent(bPct)} {t('compareOfBudget')}
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
