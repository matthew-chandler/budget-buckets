import { type FormEvent } from 'react'
import type { BudgetReport, ChatResponse } from '../lib/types'
import { isHttpUrl } from '../lib/api'
import { SectionHeading } from './SectionHeading'

const SUGGESTIONS = [
  'What stands out most about this budget?',
  'Which bucket would a resident feel the biggest change in?',
  'What tradeoffs does this year\u2019s budget imply?',
  'Where is discretionary spending concentrated?',
]

interface ChatPanelProps {
  activeReport: BudgetReport
  question: string
  onQuestionChange: (v: string) => void
  onSubmit: () => void
  isPending: boolean
  data: ChatResponse | undefined
  error: Error | null
}

export function ChatPanel({
  activeReport,
  question,
  onQuestionChange,
  onSubmit,
  isPending,
  data,
  error,
}: ChatPanelProps) {
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    onSubmit()
  }

  return (
    <section className="section">
      <SectionHeading num="05" eyebrow="Q & A with the Agent" title="Ask the ledger" />

      <div className="chat-shell">
        <form className="chat-form" onSubmit={handleSubmit}>
          <div className="chat-suggestions">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                className="chat-chip"
                onClick={() => onQuestionChange(s)}
              >
                {s}
              </button>
            ))}
          </div>

          <textarea
            className="field-textarea"
            rows={3}
            value={question}
            onChange={(e) => onQuestionChange(e.target.value)}
            placeholder={`Ask anything about ${activeReport.displayName}\u2019s ${activeReport.fiscalYearLabel} budget…`}
          />

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              className="btn"
              type="submit"
              disabled={isPending || !question.trim()}
            >
              {isPending && <span className="spinner" aria-hidden />}
              {isPending ? 'Thinking…' : 'Ask the agent'}
            </button>
          </div>
        </form>

        {error ? (
          <div className="alert">
            <strong>The agent couldn't answer that one.</strong>
            <p>{error.message}</p>
          </div>
        ) : null}

        {data ? (
          <div className="chat-answer">
            <div className="chat-answer__mark" aria-hidden>
              “
            </div>
            <div className="chat-answer__body">
              <p className="chat-answer__text">{data.answer}</p>
              {data.citations.length ? (
                <div className="chat-answer__attribution">
                  Cited sources:{' '}
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
          <p className="chat-placeholder">
            The agent will answer in plain English, citing the sections of the
            budget it pulled from. It's candid — and it'll tell you if the
            document doesn't say.
          </p>
        )}
      </div>
    </section>
  )
}
