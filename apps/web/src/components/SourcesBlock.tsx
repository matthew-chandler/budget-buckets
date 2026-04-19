import { useI18n } from '../i18n/I18nProvider'
import type { BudgetReport } from '../lib/types'
import { isHttpUrl } from '../lib/api'

interface SourcesBlockProps {
  report: BudgetReport
  fromCache: boolean
}

export function SourcesBlock({ report, fromCache }: SourcesBlockProps) {
  const { t, formatDate, formatMessage } = useI18n()

  const fromPdf =
    !fromCache &&
    !report.sourceUrl &&
    Boolean(report.sourceNotes?.toLowerCase().includes('upload'))

  const provenance = fromCache
    ? formatMessage('provenanceCache', { date: formatDate(report.updatedAt) })
    : fromPdf
      ? t('provenancePdf')
      : t('provenanceFresh')

  return (
    <div className="sources">
      <div>
        <p className="sources__lede">{report.summary ?? t('sourcesNoSummary')}</p>
      </div>

      <dl className="sources__meta">
        <div className="pair">
          <dt>{t('sourcesProvenance')}</dt>
          <dd>{provenance}</dd>
        </div>
        <div className="pair">
          <dt>{t('sourcesSource')}</dt>
          <dd>
            {report.sourceUrl && isHttpUrl(report.sourceUrl) ? (
              <a href={report.sourceUrl} target="_blank" rel="noreferrer">
                {report.sourceTitle ?? report.sourceUrl}
              </a>
            ) : report.sourceTitle ? (
              report.sourceTitle
            ) : (
              t('sourcesNoUrl')
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
          <dt>{t('sourcesCitations')}</dt>
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
                    {citation.page != null ? (
                      <span className="citations-list__page">
                        {' '}
                        ({formatMessage('citationPageSuffix', { page: citation.page })})
                      </span>
                    ) : null}
                    {citation.note ? <span>{citation.note}</span> : null}
                  </li>
                ))}
              </ol>
            ) : (
              <span style={{ color: 'var(--ink-60)' }}>{t('sourcesNoCitations')}</span>
            )}
          </dd>
        </div>
      </dl>
    </div>
  )
}
