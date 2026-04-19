import { useRef, useState, type FormEvent } from 'react'
import { useI18n } from '../i18n/I18nProvider'
import { formatStr } from '../i18n/strings'
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
  const { t } = useI18n()
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
      setPdfEntryError(t('pdfCityStateRequired'))
      return
    }

    const keys = pdfEntries.map(entryKey)
    const dup = keys.find((k, i) => keys.indexOf(k) !== i)
    if (dup) {
      setPdfEntryError(t('pdfDuplicateFy'))
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

  const uploadReadyNote =
    pdfEntries.length === 0
      ? t('uploadIdleHint')
      : pdfEntries.length === 1
        ? t('uploadReadyOne')
        : formatStr(t('uploadReadyMany'), { n: pdfEntries.length })

  return (
    <section className="frontpage">
      <div className="frontpage__kicker">
        <span className="dot" aria-hidden />
        <p className="eyebrow">{t('searchEyebrow')}</p>
      </div>

      <div className="frontpage__grid">
        <div className="fade-in">
          <h1 className="frontpage__headline">
            {t('searchHeadlineBefore')}
            <em>{t('searchHeadlineEm')}</em>
            {t('searchHeadlineAfter')}
          </h1>

          <p className="frontpage__lede frontpage__lede--dropcap">{t('searchLede')}</p>

          <div className="frontpage__byline">
            <span>{t('searchBylineAgent')}</span>
            <span>·</span>
            <span>{t('searchBylineCited')}</span>
            <span>·</span>
            <span>{t('searchBylineFree')}</span>
          </div>
        </div>

        <div className="fade-in fade-in--d2">
          <fieldset className="search-fieldset">
            <legend className="search-fieldset__legend">{t('searchLegend')}</legend>
            <p className="search-fieldset__hint">{t('searchHint')}</p>
            <form className="search-card search-card--primary" onSubmit={handleSearch}>
              <div className="field field--full">
                <label htmlFor="city-input">{t('labelCity')}</label>
                <input
                  id="city-input"
                  value={city}
                  onChange={(e) => onCityChange(e.target.value)}
                  placeholder={t('phCity')}
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>

              <div className="field-row" style={{ marginTop: 16 }}>
                <div className="field">
                  <label htmlFor="state-input">{t('labelState')}</label>
                  <input
                    id="state-input"
                    value={state}
                    onChange={(e) => onStateChange(e.target.value)}
                    placeholder={t('phState')}
                    autoComplete="off"
                    spellCheck={false}
                  />
                </div>
                <div className="field">
                  <label htmlFor="fy-input">{t('labelFiscalYear')}</label>
                  <input
                    id="fy-input"
                    value={fiscalYear}
                    onChange={(e) => onFiscalYearChange(e.target.value)}
                    placeholder={t('phFY')}
                    autoComplete="off"
                    spellCheck={false}
                  />
                </div>
              </div>

              <div className="form-footer">
                <p className="form-footer__note">{t('searchNote')}</p>
                <button
                  type="submit"
                  className="btn"
                  disabled={isLoading || !city.trim() || !state.trim()}
                >
                  {isLoading && <span className="spinner" aria-hidden />}
                  {isLoading ? t('btnReading') : hasReport ? t('btnLoadAnother') : t('btnOpenLedger')}
                </button>
              </div>
            </form>
          </fieldset>

          <fieldset className="search-fieldset search-fieldset--upload">
            <legend className="search-fieldset__legend">{t('uploadLegend')}</legend>
            <form className="search-card search-card--upload" onSubmit={handleUpload}>
              <p className="search-card__hint" style={{ marginTop: 0 }}>
                {t('uploadHint')}
              </p>

              <div className="field field--full" style={{ marginTop: 16 }}>
                <label htmlFor="pdf-input">{t('labelBudgetPdfs')}</label>
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
                          <label htmlFor={`pdf-city-${index}`}>{t('labelCity')}</label>
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
                          <label htmlFor={`pdf-state-${index}`}>{t('labelState')}</label>
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
                          <label htmlFor={`pdf-fy-${index}`}>{t('labelFiscalYear')}</label>
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
                            placeholder={t('phFY')}
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
                <p className="form-footer__note">{uploadReadyNote}</p>
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
                      {t('btnClearPdfs')}
                    </button>
                  ) : null}
                  <button
                    type="submit"
                    className="btn btn--accent"
                    disabled={isUploading || !pdfEntries.length}
                  >
                    {isUploading && <span className="spinner" aria-hidden />}
                    {isUploading
                      ? t('btnReadingPdfs')
                      : pdfEntries.length > 1
                        ? formatStr(t('btnAnalyzeMany'), { n: pdfEntries.length })
                        : t('btnAnalyzeOne')}
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
