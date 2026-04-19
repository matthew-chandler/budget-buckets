import { useMemo } from 'react'
import { useI18n } from '../i18n/I18nProvider'
import { formatStr } from '../i18n/strings'
import type { SearchResult } from '../lib/types'
import { formatFiscalYearDisplay } from '../lib/fiscal-year'
import { SectionHeading } from './SectionHeading'

interface ArchiveProps {
  results: SearchResult[]
  isLoading: boolean
  isSelecting: boolean
  selectingKey: string | null
  activeKey: string | null
  onSelect: (result: SearchResult) => void
}

interface ArchiveGroup {
  placeKey: string
  city: string
  state: string
  displayName: string
  years: SearchResult[]
}

function groupResults(results: SearchResult[]): ArchiveGroup[] {
  const map = new Map<string, SearchResult[]>()

  for (const r of results) {
    const k = `${r.city}|${r.state}`
    if (!map.has(k)) map.set(k, [])
    map.get(k)!.push(r)
  }

  const groups: ArchiveGroup[] = []

  for (const [placeKey, years] of map.entries()) {
    years.sort((a, b) => {
      const byFy = b.fiscalYearLabel.localeCompare(a.fiscalYearLabel, undefined, {
        numeric: true,
      })
      if (byFy !== 0) return byFy
      return b.updatedAt.localeCompare(a.updatedAt)
    })
    const first = years[0]!
    groups.push({
      placeKey,
      city: first.city,
      state: first.state,
      displayName: first.displayName,
      years,
    })
  }

  groups.sort((a, b) =>
    a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' }),
  )

  return groups
}

export function Archive({
  results,
  isLoading,
  isSelecting,
  selectingKey,
  activeKey,
  onSelect,
}: ArchiveProps) {
  const { t, formatDate } = useI18n()
  const groups = useMemo(() => groupResults(results), [results])

  return (
    <section className="section archive fade-in">
      <SectionHeading num="00" eyebrow={t('archiveEyebrow')} title={t('archiveTitle')} />

      <div className="archive__lede">{t('archiveLede')}</div>

      {isLoading ? (
        <div className="archive-empty">{t('archiveLoading')}</div>
      ) : groups.length === 0 ? (
        <div className="archive-empty">
          <p>{t('archiveEmptyTitle')}</p>
          <span>{t('archiveEmptyHint')}</span>
        </div>
      ) : (
        <ul className="archive-list">
          {groups.map((g, i) => (
            <li key={g.placeKey} className="archive-group">
              <div className="archive-group__header">
                <span className="archive-row__num archive-group__num">
                  {(i + 1).toString().padStart(2, '0')}
                </span>
                <div className="archive-group__title">
                  <div className="archive-row__city">
                    <span className="archive-row__name">{g.city}</span>
                    <span className="archive-row__state">, {g.state}</span>
                  </div>
                  <span className="archive-group__meta">
                    {g.years.length === 1
                      ? t('archiveFyOne')
                      : formatStr(t('archiveFyMany'), { n: g.years.length })}
                  </span>
                </div>
              </div>
              <ul className="archive-group__years">
                {g.years.map((r) => {
                  const kid = r.id
                  const isLoadingThis = isSelecting && selectingKey === kid
                  const isActive = activeKey === kid
                  return (
                    <li key={kid}>
                      <button
                        type="button"
                        className={`archive-year-row ${isActive ? 'is-active' : ''}`}
                        onClick={() => onSelect(r)}
                        disabled={isSelecting}
                      >
                        <span className="archive-year-row__fy" title={r.fiscalYearLabel}>
                          {formatFiscalYearDisplay(r.fiscalYearLabel)}
                        </span>
                        <span className="archive-year-row__date">
                          {t('archiveFiled')} {formatDate(r.updatedAt)}
                        </span>
                        <span className="archive-year-row__action">
                          {isLoadingThis ? (
                            <>
                              <span className="spinner" aria-hidden /> {t('archiveOpening')}
                            </>
                          ) : isActive ? (
                            t('archiveViewing')
                          ) : (
                            t('archiveOpen')
                          )}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
