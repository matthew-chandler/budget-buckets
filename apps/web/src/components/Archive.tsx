import { useMemo } from 'react'
import type { SearchResult } from '../lib/types'
import { formatDate } from '../lib/format'
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
  const groups = useMemo(() => groupResults(results), [results])

  return (
    <section className="section archive fade-in">
      <SectionHeading num="00" eyebrow="The Archive" title="Cities already on file" />

      <div className="archive__lede">
        Each city appears once; choose a fiscal year underneath to open that budget from the cache
        (no live scrape).
      </div>

      {isLoading ? (
        <div className="archive-empty">Loading the stacks…</div>
      ) : groups.length === 0 ? (
        <div className="archive-empty">
          <p>The archive is empty.</p>
          <span>Search a city above to file the first budget.</span>
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
                    {g.years.length} fiscal year{g.years.length === 1 ? '' : 's'} on file
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
                          Filed {formatDate(r.updatedAt)}
                        </span>
                        <span className="archive-year-row__action">
                          {isLoadingThis ? (
                            <>
                              <span className="spinner" aria-hidden /> Opening
                            </>
                          ) : isActive ? (
                            'Viewing'
                          ) : (
                            'Open →'
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
