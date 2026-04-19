import type { SearchResult } from '../lib/types'
import { formatDate } from '../lib/format'
import { SectionHeading } from './SectionHeading'

interface ArchiveProps {
  results: SearchResult[]
  isLoading: boolean
  isSelecting: boolean
  selectingKey: string | null
  activeKey: string | null
  onSelect: (result: SearchResult) => void
}

function keyFor(r: Pick<SearchResult, 'city' | 'state'>): string {
  return `${r.city}|${r.state}`
}

export function Archive({
  results,
  isLoading,
  isSelecting,
  selectingKey,
  activeKey,
  onSelect,
}: ArchiveProps) {
  return (
    <section className="section archive fade-in">
      <SectionHeading num="00" eyebrow="The Archive" title="Cities already on file" />

      <div className="archive__lede">
        Pick up any city we've already indexed &mdash; no wait, no live scrape.
        The ledger is cached until a new fiscal year comes in.
      </div>

      {isLoading ? (
        <div className="archive-empty">Loading the stacks…</div>
      ) : results.length === 0 ? (
        <div className="archive-empty">
          <p>The archive is empty.</p>
          <span>Search a city above to file the first budget.</span>
        </div>
      ) : (
        <ul className="archive-list">
          {results.map((r, i) => {
            const k = keyFor(r)
            const isLoadingThis = isSelecting && selectingKey === k
            const isActive = activeKey === k
            return (
              <li key={k}>
                <button
                  type="button"
                  className={`archive-row ${isActive ? 'is-active' : ''}`}
                  onClick={() => onSelect(r)}
                  disabled={isSelecting}
                >
                  <span className="archive-row__num">
                    {(i + 1).toString().padStart(2, '0')}
                  </span>
                  <span className="archive-row__city">
                    <span className="archive-row__name">{r.city}</span>
                    <span className="archive-row__state">, {r.state}</span>
                  </span>
                  <span className="archive-row__fy">{r.latestFiscalYearLabel}</span>
                  <span className="archive-row__date">
                    Filed {formatDate(r.updatedAt)}
                  </span>
                  <span className="archive-row__action">
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
      )}
    </section>
  )
}
