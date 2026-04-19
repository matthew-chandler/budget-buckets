import type { BudgetReport } from '../lib/types'
import { isHttpUrl } from '../lib/api'
import { formatDate } from '../lib/format'

interface SourcesBlockProps {
  report: BudgetReport
  fromCache: boolean
}

export function SourcesBlock({ report, fromCache }: SourcesBlockProps) {
  const fromPdf =
    !fromCache &&
    !report.sourceUrl &&
    Boolean(report.sourceNotes?.toLowerCase().includes('upload'))

  const provenance = fromCache
    ? 'Loaded from our cached ledger — last updated ' + formatDate(report.updatedAt)
    : fromPdf
    ? 'Extracted from the PDF you uploaded'
    : 'Freshly scraped by a Pi agent'

  return (
    <div className="sources">
      <div>
        <p className="sources__lede">
          {report.summary ??
            'No editorial summary was extracted for this report. The citations and category mapping below are still authoritative.'}
        </p>
      </div>

      <dl className="sources__meta">
        <div className="pair">
          <dt>Provenance</dt>
          <dd>{provenance}</dd>
        </div>
        <div className="pair">
          <dt>Source</dt>
          <dd>
            {report.sourceUrl && isHttpUrl(report.sourceUrl) ? (
              <a href={report.sourceUrl} target="_blank" rel="noreferrer">
                {report.sourceTitle ?? report.sourceUrl}
              </a>
            ) : report.sourceTitle ? (
              report.sourceTitle
            ) : (
              'No official source URL captured.'
            )}
            {report.sourceNotes ? (
              <div
                style={{
                  marginTop: 4,
                  fontSize: '0.82rem',
                  color: 'var(--ink-60)',
                }}
              >
                {report.sourceNotes}
              </div>
            ) : null}
          </dd>
        </div>
        <div className="pair">
          <dt>Citations</dt>
          <dd>
            {report.citations.length ? (
              <ol className="citations-list">
                {report.citations.map((citation) => (
                  <li key={`${citation.url}-${citation.title}`}>
                    {isHttpUrl(citation.url) ? (
                      <a href={citation.url} target="_blank" rel="noreferrer">
                        {citation.title}
                      </a>
                    ) : (
                      <span>{citation.title}</span>
                    )}
                    {citation.note ? <span>{citation.note}</span> : null}
                  </li>
                ))}
              </ol>
            ) : (
              <span style={{ color: 'var(--ink-60)' }}>
                No individual citations were extracted.
              </span>
            )}
          </dd>
        </div>
      </dl>
    </div>
  )
}
