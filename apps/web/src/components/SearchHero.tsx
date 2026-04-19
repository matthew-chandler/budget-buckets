import { useState, type FormEvent } from 'react'

interface SearchHeroProps {
  city: string
  state: string
  fiscalYear: string
  onCityChange: (v: string) => void
  onStateChange: (v: string) => void
  onFiscalYearChange: (v: string) => void
  onSubmit: () => void
  onSubmitPdf: (file: File) => void
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
  onSubmitPdf,
  isLoading,
  isUploading,
  hasReport,
}: SearchHeroProps) {
  const [pdfFile, setPdfFile] = useState<File | null>(null)

  const handleSearch = (e: FormEvent) => {
    e.preventDefault()
    onSubmit()
  }

  const handleUpload = (e: FormEvent) => {
    e.preventDefault()
    if (pdfFile) onSubmitPdf(pdfFile)
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

          <p className="frontpage__lede">
            <span className="dropcap">M</span>
            unicipal budgets are public documents &mdash; but they read like fine
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

          <form className="search-card search-card--upload" onSubmit={handleUpload}>
            <p className="search-card__hint" style={{ marginTop: 0 }}>
              Got the PDF already? Upload it directly and skip the scrape. We'll
              use the city, state, and year from above (max 25&thinsp;MB).
            </p>

            <div className="field field--full" style={{ marginTop: 16 }}>
              <label htmlFor="pdf-input">Budget PDF</label>
              <input
                id="pdf-input"
                type="file"
                accept="application/pdf,.pdf"
                onChange={(e) => setPdfFile(e.target.files?.[0] ?? null)}
              />
            </div>

            <div className="form-footer">
              <p className="form-footer__note">
                {pdfFile
                  ? `Selected: ${pdfFile.name}`
                  : 'The agent will extract figures and map them to buckets.'}
              </p>
              <button
                type="submit"
                className="btn btn--accent"
                disabled={isUploading || !pdfFile}
              >
                {isUploading && <span className="spinner" aria-hidden />}
                {isUploading ? 'Reading PDF…' : 'Analyze this PDF'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </section>
  )
}
