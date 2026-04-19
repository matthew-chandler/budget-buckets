import { useMemo, type FormEvent } from 'react'
import { useI18n } from '../i18n/I18nProvider'
import { formatStr } from '../i18n/strings'
import type { BudgetReport, ChatResponse } from '../lib/types'
import { isHttpUrl } from '../lib/api'
import { formatFiscalYearDisplay } from '../lib/fiscal-year'
import { formatChatAnswerToNodes } from '../lib/format-chat-answer'
import { SectionHeading } from './SectionHeading'

interface ChatPanelProps {
  activeReport: BudgetReport
  question: string
  onQuestionChange: (v: string) => void
  onSubmit: () => void
  onCancel: () => void
  isPending: boolean
  data: ChatResponse | undefined
  error: Error | null
  /** When true, parsed report text is still being translated for non-English locales. */
  chatContentPending?: boolean
}

export function ChatPanel({
  activeReport,
  question,
  onQuestionChange,
  onSubmit,
  onCancel,
  isPending,
  data,
  error,
  chatContentPending = false,
}: ChatPanelProps) {
  const { t } = useI18n()
  const fy = formatFiscalYearDisplay(activeReport.fiscalYearLabel)

  const suggestions = useMemo(
    () =>
      [
        t('chatSuggestion0'),
        t('chatSuggestion1'),
        t('chatSuggestion2'),
        t('chatSuggestion3'),
      ] as const,
    [t],
  )

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    onSubmit()
  }

  const placeholder = formatStr(t('chatPlaceholder'), {
    name: activeReport.displayName,
    fy,
  })

  return (
    <section className="section">
      <SectionHeading num="05" eyebrow={t('chatEyebrow')} title={t('chatTitle')} />

      <div className="chat-shell">
        <form className="chat-form" onSubmit={handleSubmit}>
          <div className="chat-suggestions">
            {suggestions.map((s) => (
              <button key={s} type="button" className="chat-chip" onClick={() => onQuestionChange(s)}>
                {s}
              </button>
            ))}
          </div>

          <textarea
            className="field-textarea"
            rows={3}
            value={question}
            onChange={(e) => onQuestionChange(e.target.value)}
            placeholder={placeholder}
          />

          <div className="chat-actions">
            <button
              className="btn"
              type="submit"
              disabled={isPending || !question.trim() || chatContentPending}
            >
              {isPending && <span className="spinner" aria-hidden />}
              {isPending ? t('btnThinking') : t('btnAskAgent')}
            </button>
            {isPending ? (
              <button type="button" className="btn btn--ghost" onClick={onCancel}>
                {t('btnCancel')}
              </button>
            ) : null}
          </div>
        </form>

        {error ? (
          <div className="alert">
            <strong>{t('errChat')}</strong>
            <p>{error.message}</p>
          </div>
        ) : null}

        {data ? (
          <div className="chat-answer">
            <div className="chat-answer__mark" aria-hidden>
              “
            </div>
            <div className="chat-answer__body">
              <p className="chat-answer__text">{formatChatAnswerToNodes(data.answer)}</p>
              {data.citations.length ? (
                <div className="chat-answer__attribution">
                  {t('chatCitedSources')}{' '}
                  {data.citations.slice(0, 4).map((c, i) => (
                    <span key={`${c.url}-${c.title}`}>
                      {i > 0 ? ' · ' : ''}
                      {isHttpUrl(c.url) ? (
                        <a href={c.url} target="_blank" rel="noreferrer">
                          {c.title}
                        </a>
                      ) : (
                        c.title
                      )}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        ) : (
          <p className="chat-placeholder">{t('chatPlaceholderBody')}</p>
        )}
      </div>
    </section>
  )
}
