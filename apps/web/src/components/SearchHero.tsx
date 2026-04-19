import { useRef, useState, type FormEvent } from 'react'
import type { PdfUploadEntry } from '../lib/types'
import { hintsFromPdfFilename } from '../lib/pdf-filename-hint'

interface SearchHeroProps {
  city: string
  state: string
  fiscalYear: string
  onCityChange: (v: string) => void
  onStateChange: (v: string) => void
  onFiscalYearChange: (v: string) => void
  onSubmit: () => void
  onSubmitPdfs: (entries: PdfUploadEntry[]) => void
  isLoading: boolean
  isUploading: boolean
  hasReport: boolean
}

export function SearchHero({
  city,
  state,
  fiscalYear,
  onCityChange,
  onStateChange,
  onFiscalYearChange,
  onSubmit,
  onSubmitPdfs,
  isLoading,
  isUploading,
  hasReport,
}: SearchHeroProps) {
  const pdfInputRef = useRef<HTMLInputElement>(null)
  const [pdfEntries, setPdfEntries] = useState<PdfUploadEntry[]>([])
  const [pdfEntryError, setPdfEntryError] = useState<string | null>(null)

  const entryKey = (e: PdfUploadEntry) => {
    const c = e.city.trim().toLowerCase()
    const s = e.state.trim().toLowerCase()
    const fy = e.fiscalYear.trim().toLowerCase()
    if (fy) {
      return `${c}|${s}|${fy}`
    }
    return `${c}|${s}||${e.file.name.toLowerCase()}|${e.file.size}|${e.file.lastModified}`
  }

  const handleSearch = (e: FormEvent) => {
    e.preventDefault()
    onSubmit()
  }

  const handleUpload = (e: FormEvent) => {
    e.preventDefault()
    if (!pdfEntries.length) return

    if (pdfEntries.some((row) => !row.city.trim() || !row.state.trim())) {
      setPdfEntryError('City and state are required for each PDF.')
      return
    }

    const keys = pdfEntries.map(entryKey)
    const dup = keys.find((k, i) => keys.indexOf(k) !== i)
    if (dup) {
      setPdfEntryError(
        'Two rows match the same city, state, and fiscal year — that would overwrite one saved report. Change the fiscal year or city on one of the rows.',
      )
      return
    }
    setPdfEntryError(null)
    onSubmitPdfs(pdfEntries)
  }

  const clearPdfSelection = () => {
    setPdfEntries([])
    setPdfEntryError(null)
    if (pdfInputRef.current) pdfInputRef.current.value = ''
  }

  return (
    <section className="frontpage">
      <div className="frontpage__kicker">
        <span className="dot" aria-hidden />
        <p className="eyebrow">Dispatch &mdash; Fiscal Reportage</p>
      </div>

      <div className="frontpage__grid">
        <div className="fade-in">
          <h1 className="frontpage__headline">
            Where does <em>your city</em> actually spend the money?
          </h1>

          <p className="frontpage__lede frontpage__lede--dropcap">
            Municipal budgets are public documents &mdash; but they read like fine
            print. Budget Buckets reads them for you. Type a city, and our agent
            fetches the adopted budget, maps every line item into nine civic
            buckets, and shows what the numbers actually mean for the people who
            live there. No spin, just the ledger.
          </p>

          <div className="frontpage__byline">
            <span>By an autonomous Pi agent</span>
            <span>·</span>
            <span>Cited to official sources</span>
            <span>·</span>
            <span>Free &amp; open</span>
          </div>
        </div>

        <div className="fade-in fade-in--d2">
          <fieldset className="search-fieldset">
            <legend className="search-fieldset__legend">Search &amp; open a budget</legend>
            <p className="search-fieldset__hint">
              These fields are only for the live search below — they are{' '}
              <strong>not</strong> used when you upload PDFs.
            </p>
            <form className="search-card search-card--primary" onSubmit={handleSearch}>
              <div className="field field--full">
                <label htmlFor="city-input">City</label>
                <input
                  id="city-input"
                  value={city}
                  onChange={(e) => onCityChange(e.target.value)}
                  placeholder="Los Angeles"
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>

              <div className="field-row" style={{ marginTop: 16 }}>
                <div className="field">
                  <label htmlFor="state-input">State</label>
                  <input
                    id="state-input"
                    value={state}
                    onChange={(e) => onStateChange(e.target.value)}
                    placeholder="CA"
                    autoComplete="off"
                    spellCheck={false}
                  />
                </div>
                <div className="field">
                  <label htmlFor="fy-input">Fiscal Year</label>
                  <input
                    id="fy-input"
                    value={fiscalYear}
                    onChange={(e) => onFiscalYearChange(e.target.value)}
                    placeholder="FY 2024-25"
                    autoComplete="off"
                    spellCheck={false}
                  />
                </div>
              </div>

              <div className="form-footer">
                <p className="form-footer__note">
                  We'll use cached data if available &mdash; otherwise the agent
                  runs a live scrape.
                </p>
                <button
                  type="submit"
                  className="btn"
                  disabled={isLoading || !city.trim() || !state.trim()}
                >
                  {isLoading && <span className="spinner" aria-hidden />}
                  {isLoading ? 'Reading…' : hasReport ? 'Load another' : 'Open the ledger'}
                </button>
              </div>
            </form>
          </fieldset>

          <fieldset className="search-fieldset search-fieldset--upload">
            <legend className="search-fieldset__legend">Upload budget PDFs</legend>
            <form className="search-card search-card--upload" onSubmit={handleUpload}>
              <p className="search-card__hint" style={{ marginTop: 0 }}>
                Each file is a separate report. Use the <strong>City / State / Fiscal year</strong>{' '}
                fields in each row only (not the search form above). Max 25&thinsp;MB per file. We try
                to pre-fill rows from filenames like “City of … FY 2025-26 …”.
              </p>

              <div className="field field--full" style={{ marginTop: 16 }}>
                <label htmlFor="pdf-input">Budget PDFs</label>
                <input
                  id="pdf-input"
                  ref={pdfInputRef}
                  type="file"
                  accept="application/pdf,.pdf"
                  multiple
                  onChange={(e) => {
                    const list = e.target.files
                    if (!list?.length) {
                      setPdfEntries([])
                      return
                    }
                    setPdfEntryError(null)
                    setPdfEntries(
                      Array.from(list).map((file) => {
                        const h = hintsFromPdfFilename(file.name)
                        return {
                          file,
                          city: h.city,
                          state: h.state,
                          fiscalYear: h.fiscalYear,
                        }
                      }),
                    )
                  }}
                />
              </div>

              {pdfEntries.length > 0 ? (
                <div className="pdf-entry-list" style={{ marginTop: 16 }}>
                  {pdfEntries.map((entry, index) => (
                    <div
                      key={`${entry.file.name}-${index}`}
                      className="pdf-entry-list__row"
                      style={{
                        marginBottom: 12,
                        paddingBottom: 12,
                        borderBottom:
                          index < pdfEntries.length - 1
                            ? '1px solid rgba(255,255,255,0.08)'
                            : 'none',
                      }}
                    >
                      <p className="form-footer__note" style={{ marginBottom: 8 }}>
                        <strong>{entry.file.name}</strong>
                      </p>
                      <div className="field-row" style={{ marginTop: 0 }}>
                        <div className="field">
                          <label htmlFor={`pdf-city-${index}`}>City</label>
                          <input
                            id={`pdf-city-${index}`}
                            value={entry.city}
                            onChange={(e) => {
                              const v = e.target.value
                              setPdfEntryError(null)
                              setPdfEntries((rows) =>
                                rows.map((row, i) => (i === index ? { ...row, city: v } : row)),
                              )
                            }}
                            autoComplete="off"
                            spellCheck={false}
                          />
                        </div>
                        <div className="field">
                          <label htmlFor={`pdf-state-${index}`}>State</label>
                          <input
                            id={`pdf-state-${index}`}
                            value={entry.state}
                            onChange={(e) => {
                              const v = e.target.value
                              setPdfEntryError(null)
                              setPdfEntries((rows) =>
                                rows.map((row, i) => (i === index ? { ...row, state: v } : row)),
                              )
                            }}
                            autoComplete="off"
                            spellCheck={false}
                          />
                        </div>
                        <div className="field">
                          <label htmlFor={`pdf-fy-${index}`}>Fiscal Year</label>
                          <input
                            id={`pdf-fy-${index}`}
                            value={entry.fiscalYear}
                            onChange={(e) => {
                              const v = e.target.value
                              setPdfEntryError(null)
                              setPdfEntries((rows) =>
                                rows.map((row, i) => (i === index ? { ...row, fiscalYear: v } : row)),
                              )
                            }}
                            placeholder="FY 2024-25"
                            autoComplete="off"
                            spellCheck={false}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}

              {pdfEntryError ? (
                <p
                  className="form-footer__note"
                  style={{ color: 'var(--warn, #e8b44c)', marginTop: 12 }}
                >
                  {pdfEntryError}
                </p>
              ) : null}

              <div className="form-footer">
                <p className="form-footer__note">
                  {pdfEntries.length
                    ? `${pdfEntries.length} file${pdfEntries.length === 1 ? '' : 's'} ready.`
                    : 'The agent will extract figures and map them to buckets.'}
                </p>
                <div
                  style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}
                >
                  {pdfEntries.length > 0 ? (
                    <button
                      type="button"
                      className="btn btn--ghost"
                      onClick={clearPdfSelection}
                      disabled={isUploading}
                    >
                      Clear PDFs
                    </button>
                  ) : null}
                  <button
                    type="submit"
                    className="btn btn--accent"
                    disabled={isUploading || !pdfEntries.length}
                  >
                    {isUploading && <span className="spinner" aria-hidden />}
                    {isUploading
                      ? 'Reading PDFs…'
                      : pdfEntries.length > 1
                        ? `Analyze ${pdfEntries.length} PDFs`
                        : 'Analyze this PDF'}
                  </button>
                </div>
              </div>
            </form>
          </fieldset>
        </div>
      </div>
    </section>
  )
}
