import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import './App.css'

type BucketKey =
  | 'public-safety-justice'
  | 'public-works-infrastructure'
  | 'community-recreation'
  | 'health-human-services'
  | 'transportation'
  | 'government-operations-administration'
  | 'pensions-debt'
  | 'economic-development'
  | 'miscellaneous'

interface BucketDefinition {
  key: BucketKey
  label: string
  color: string
  description: string
  examples: string[]
}

interface Citation {
  title: string
  url: string
  note?: string | null
  appliesToBucketKey?: BucketKey | null
}

interface BucketAllocation {
  key: BucketKey
  label: string
  color: string
  amount: number | null
  share: number | null
  summary: string | null
  rawCategories: string[]
  citationUrl?: string | null
  citationTitle?: string | null
}

interface RawCategory {
  name: string
  amount: number | null
  bucketKey: BucketKey | null
  note?: string | null
}

interface BudgetReport {
  id: string
  city: string
  state: string
  displayName: string
  population: number | null
  fiscalYearLabel: string
  fiscalYearSort: number | null
  currency: string
  totalBudget: number | null
  sourceTitle: string | null
  sourceUrl: string | null
  sourceNotes: string | null
  summary: string | null
  buckets: BucketAllocation[]
  rawCategories: RawCategory[]
  citations: Citation[]
  retrievedAt: string
  updatedAt: string
}

interface ResolveResponse {
  report: BudgetReport
  bucketDefinitions: BucketDefinition[]
  fromCache: boolean
}

interface CompareResponse {
  primary: BudgetReport
  secondary: BudgetReport
  bucketDefinitions: BucketDefinition[]
}

interface HistoryResponse {
  reports: BudgetReport[]
  bucketDefinitions: BucketDefinition[]
}

interface ChatResponse {
  answer: string
  citations: Citation[]
}

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })

  const data = (await response.json()) as T & { error?: string }

  if (!response.ok) {
    throw new Error(data.error ?? 'Request failed.')
  }

  return data
}

function formatCurrency(amount: number | null, compact = false): string {
  if (amount === null) {
    return 'Unknown'
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: compact ? 'compact' : 'standard',
    maximumFractionDigits: compact ? 1 : 0,
  }).format(amount)
}

function formatPercent(value: number | null): string {
  if (value === null) {
    return 'Unknown'
  }

  return new Intl.NumberFormat('en-US', {
    style: 'percent',
    maximumFractionDigits: 1,
  }).format(value)
}

function polarToCartesian(cx: number, cy: number, radius: number, angle: number) {
  return {
    x: cx + radius * Math.cos(angle),
    y: cy + radius * Math.sin(angle),
  }
}

function describeArc(
  cx: number,
  cy: number,
  radius: number,
  startAngle: number,
  endAngle: number,
) {
  const start = polarToCartesian(cx, cy, radius, endAngle)
  const end = polarToCartesian(cx, cy, radius, startAngle)
  const largeArcFlag = endAngle - startAngle > Math.PI ? 1 : 0

  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 0 ${end.x} ${end.y} Z`
}

function PieChart({
  buckets,
}: {
  buckets: BucketAllocation[]
}) {
  const [activeKey, setActiveKey] = useState<BucketKey | null>(null)
  const visibleBuckets = buckets.filter((bucket) => (bucket.amount ?? 0) > 0)
  const total = visibleBuckets.reduce((sum, bucket) => sum + (bucket.amount ?? 0), 0)

  if (!visibleBuckets.length || !total) {
    return (
      <div className="empty-chart">
        <p>No bucket totals were extracted yet.</p>
        <span>The report can still be useful for citations and follow-up questions.</span>
      </div>
    )
  }

  let angle = -Math.PI / 2

  return (
    <div className="pie-layout">
      <svg viewBox="0 0 240 240" className="pie-chart" role="img" aria-label="Budget buckets pie chart">
        {visibleBuckets.map((bucket) => {
          const slice = ((bucket.amount ?? 0) / total) * Math.PI * 2
          const nextAngle = angle + slice
          const path = describeArc(120, 120, activeKey === bucket.key ? 108 : 100, angle, nextAngle)
          angle = nextAngle

          return (
            <path
              key={bucket.key}
              d={path}
              fill={bucket.color}
              opacity={activeKey && activeKey !== bucket.key ? 0.55 : 1}
              onMouseEnter={() => setActiveKey(bucket.key)}
              onMouseLeave={() => setActiveKey(null)}
              onFocus={() => setActiveKey(bucket.key)}
              onBlur={() => setActiveKey(null)}
              tabIndex={0}
            />
          )
        })}
        <circle cx="120" cy="120" r="54" fill="#fffaf0" />
        <text x="120" y="112" textAnchor="middle" className="pie-total-label">
          Total
        </text>
        <text x="120" y="132" textAnchor="middle" className="pie-total-value">
          {formatCurrency(total, true)}
        </text>
      </svg>

      <div className="legend">
        {visibleBuckets.map((bucket) => (
          <button
            key={bucket.key}
            className={`legend-item${activeKey === bucket.key ? ' is-active' : ''}`}
            onMouseEnter={() => setActiveKey(bucket.key)}
            onMouseLeave={() => setActiveKey(null)}
            onFocus={() => setActiveKey(bucket.key)}
            onBlur={() => setActiveKey(null)}
            type="button"
          >
            <span className="legend-swatch" style={{ backgroundColor: bucket.color }} />
            <span>
              <strong>{bucket.label}</strong>
              <small>
                {formatCurrency(bucket.amount)} · {formatPercent(bucket.share)}
              </small>
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

function HistoryChart({ reports }: { reports: BudgetReport[] }) {
  const plotted = reports.filter((report) => report.totalBudget !== null)

  if (plotted.length < 2) {
    return (
      <div className="empty-chart">
        <p>Need at least two fiscal years for a trend line.</p>
        <span>Use “Load another fiscal year” below to add one more official budget record.</span>
      </div>
    )
  }

  const values = plotted.map((report) => report.totalBudget ?? 0)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const width = 520
  const height = 220
  const padding = 28
  const range = Math.max(max - min, 1)

  const points = plotted.map((report, index) => {
    const x = padding + (index * (width - padding * 2)) / Math.max(plotted.length - 1, 1)
    const y =
      height - padding - (((report.totalBudget ?? 0) - min) / range) * (height - padding * 2)

    return `${x},${y}`
  })

  return (
    <div className="history-chart">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Budget history line chart">
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} />
        <line x1={padding} y1={padding} x2={padding} y2={height - padding} />
        <polyline fill="none" stroke="#2f6c74" strokeWidth="4" points={points.join(' ')} />
        {plotted.map((report, index) => {
          const x = padding + (index * (width - padding * 2)) / Math.max(plotted.length - 1, 1)
          const y =
            height - padding - (((report.totalBudget ?? 0) - min) / range) * (height - padding * 2)

          return (
            <g key={report.id}>
              <circle cx={x} cy={y} r="5" fill="#c65d3b" />
              <text x={x} y={height - 10} textAnchor="middle" className="history-label">
                {report.fiscalYearLabel}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

function ComparisonTable({
  primary,
  secondary,
}: {
  primary: BudgetReport
  secondary: BudgetReport
}) {
  return (
    <div className="compare-grid">
      {primary.buckets.map((bucket) => {
        const secondaryBucket = secondary.buckets.find((item) => item.key === bucket.key)
        return (
          <div key={bucket.key} className="compare-row">
            <div>
              <strong>{bucket.label}</strong>
              <small>{bucket.summary || secondaryBucket?.summary || 'No bucket notes extracted.'}</small>
            </div>
            <div className="compare-values">
              <span>{formatCurrency(bucket.amount, true)}</span>
              <span>{formatCurrency(secondaryBucket?.amount ?? null, true)}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function ReportSummary({ report, fromCache }: { report: BudgetReport; fromCache?: boolean }) {
  return (
    <section className="panel report-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">{fromCache ? 'Loaded from database' : 'Freshly scraped'}</p>
          <h2>{report.displayName}</h2>
          <p className="subhead">{report.fiscalYearLabel}</p>
        </div>
        <div className="stat-grid">
          <div className="stat-card">
            <span>Total budget</span>
            <strong>{formatCurrency(report.totalBudget, true)}</strong>
          </div>
          <div className="stat-card">
            <span>Population</span>
            <strong>
              {report.population
                ? new Intl.NumberFormat('en-US').format(report.population)
                : 'Unknown'}
            </strong>
          </div>
          <div className="stat-card">
            <span>Updated</span>
            <strong>{new Date(report.updatedAt).toLocaleDateString()}</strong>
          </div>
        </div>
      </div>

      <div className="report-grid">
        <PieChart buckets={report.buckets} />
        <div className="report-notes">
          <h3>What this budget covers</h3>
          <p>{report.summary ?? 'No city-level summary was extracted yet.'}</p>

          <h3>Source</h3>
          {report.sourceUrl ? (
            <a href={report.sourceUrl} target="_blank" rel="noreferrer">
              {report.sourceTitle ?? report.sourceUrl}
            </a>
          ) : (
            <p>No official source URL was captured.</p>
          )}
          {report.sourceNotes ? <p>{report.sourceNotes}</p> : null}

          <h3>Citations</h3>
          <ul className="citation-list">
            {report.citations.length ? (
              report.citations.map((citation) => (
                <li key={`${citation.url}-${citation.title}`}>
                  <a href={citation.url} target="_blank" rel="noreferrer">
                    {citation.title}
                  </a>
                  {citation.note ? <span>{citation.note}</span> : null}
                </li>
              ))
            ) : (
              <li>No citations were extracted.</li>
            )}
          </ul>
        </div>
      </div>
    </section>
  )
}

function App() {
  const [city, setCity] = useState('Los Angeles')
  const [state, setState] = useState('CA')
  const [fiscalYear, setFiscalYear] = useState('')
  const [activeReport, setActiveReport] = useState<BudgetReport | null>(null)
  const [activeFromCache, setActiveFromCache] = useState(false)
  const [compareCity, setCompareCity] = useState('San Diego')
  const [compareState, setCompareState] = useState('CA')
  const [compareYear, setCompareYear] = useState('')
  const [historyYear, setHistoryYear] = useState('')
  const [chatQuestion, setChatQuestion] = useState(
    'What stands out most about this budget and what would a resident probably notice?',
  )

  const metaQuery = useQuery({
    queryKey: ['meta'],
    queryFn: () => apiFetch<{ buckets: BucketDefinition[] }>('/api/meta'),
  })

  const historyQuery = useQuery({
    queryKey: ['history', activeReport?.city, activeReport?.state, activeReport?.updatedAt],
    queryFn: () =>
      apiFetch<HistoryResponse>(
        `/api/reports/history?city=${encodeURIComponent(activeReport!.city)}&state=${encodeURIComponent(activeReport!.state)}`,
      ),
    enabled: Boolean(activeReport),
  })

  const resolveMutation = useMutation({
    mutationFn: (payload: { city: string; state: string; fiscalYear?: string | null }) =>
      apiFetch<ResolveResponse>('/api/reports/resolve', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: (data) => {
      setActiveReport(data.report)
      setActiveFromCache(data.fromCache)
    },
  })

  const compareMutation = useMutation({
    mutationFn: () =>
      apiFetch<CompareResponse>('/api/compare/cities', {
        method: 'POST',
        body: JSON.stringify({
          primary: {
            city: activeReport!.city,
            state: activeReport!.state,
          },
          secondary: {
            city: compareCity,
            state: compareState,
            fiscalYear: compareYear || null,
          },
        }),
      }),
  })

  const loadHistoryYearMutation = useMutation({
    mutationFn: () =>
      apiFetch<ResolveResponse>('/api/reports/resolve', {
        method: 'POST',
        body: JSON.stringify({
          city: activeReport!.city,
          state: activeReport!.state,
          fiscalYear: historyYear,
        }),
      }),
    onSuccess: () => {
      historyQuery.refetch()
      setHistoryYear('')
    },
  })

  const chatMutation = useMutation({
    mutationFn: () =>
      apiFetch<ChatResponse>('/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          city: activeReport!.city,
          state: activeReport!.state,
          fiscalYear: activeReport!.fiscalYearLabel,
          question: chatQuestion,
        }),
      }),
  })

  const activeBuckets = activeReport?.buckets.filter((bucket) => bucket.amount !== null) ?? []

  return (
    <main className="page-shell">
      <section className="hero-panel">
        <div className="hero-copy">
          <p className="eyebrow">Budget Buckets</p>
          <h1>Local budgets, broken into buckets people can actually read.</h1>
          <p className="hero-text">
            Search a U.S. city and Budget Buckets will reuse cached budget data when it exists.
            Otherwise it runs a live Pi + agent-browser scrape, stores the result, and shows the
            spending in standardized civic buckets.
          </p>
        </div>

        <form
          className="hero-form panel"
          onSubmit={(event) => {
            event.preventDefault()
            resolveMutation.mutate({
              city,
              state,
              fiscalYear: fiscalYear || null,
            })
          }}
        >
          <label>
            City
            <input value={city} onChange={(event) => setCity(event.target.value)} />
          </label>
          <label>
            State
            <input value={state} onChange={(event) => setState(event.target.value)} />
          </label>
          <label>
            Fiscal year (optional)
            <input
              value={fiscalYear}
              onChange={(event) => setFiscalYear(event.target.value)}
              placeholder="FY 2024-2025"
            />
          </label>
          <button type="submit" disabled={resolveMutation.isPending}>
            {resolveMutation.isPending ? 'Loading live budget…' : 'Load city budget'}
          </button>
          <p className="form-note">
            Tip: start with a city and state. Add a fiscal year only when you want a specific
            adopted budget.
          </p>
        </form>
      </section>

      {resolveMutation.error ? (
        <section className="panel error-panel">
          <strong>Could not load that budget.</strong>
          <p>{resolveMutation.error.message}</p>
        </section>
      ) : null}

      {activeReport ? <ReportSummary report={activeReport} fromCache={activeFromCache} /> : null}

      {activeReport ? (
        <section className="panel insights-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Bucket coverage</p>
              <h2>What we captured</h2>
            </div>
            <span className="pill">
              {activeBuckets.length} / {metaQuery.data?.buckets.length ?? activeReport.buckets.length} buckets
            </span>
          </div>

          <div className="bucket-cards">
            {activeReport.buckets.map((bucket) => (
              <article key={bucket.key} className="bucket-card">
                <span className="legend-swatch" style={{ backgroundColor: bucket.color }} />
                <h3>{bucket.label}</h3>
                <strong>{formatCurrency(bucket.amount, true)}</strong>
                <p>{bucket.summary ?? 'No summary extracted for this bucket yet.'}</p>
                {bucket.rawCategories.length ? (
                  <small>{bucket.rawCategories.slice(0, 4).join(' · ')}</small>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {activeReport ? (
        <section className="dual-panels">
          <section className="panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">City vs city</p>
                <h2>Compare side by side</h2>
              </div>
            </div>

            <form
              className="inline-form"
              onSubmit={(event) => {
                event.preventDefault()
                compareMutation.mutate()
              }}
            >
              <input value={compareCity} onChange={(event) => setCompareCity(event.target.value)} />
              <input value={compareState} onChange={(event) => setCompareState(event.target.value)} />
              <input
                value={compareYear}
                onChange={(event) => setCompareYear(event.target.value)}
                placeholder="Optional FY"
              />
              <button type="submit" disabled={compareMutation.isPending}>
                {compareMutation.isPending ? 'Comparing…' : 'Compare cities'}
              </button>
            </form>

            {compareMutation.data ? (
              <>
                <div className="compare-headline">
                  <div>
                    <strong>{compareMutation.data.primary.displayName}</strong>
                    <span>{compareMutation.data.primary.fiscalYearLabel}</span>
                  </div>
                  <div>
                    <strong>{compareMutation.data.secondary.displayName}</strong>
                    <span>{compareMutation.data.secondary.fiscalYearLabel}</span>
                  </div>
                </div>
                <ComparisonTable
                  primary={compareMutation.data.primary}
                  secondary={compareMutation.data.secondary}
                />
              </>
            ) : (
              <p className="placeholder-copy">
                Load another city to see the bucket totals lined up against {activeReport.displayName}.
              </p>
            )}
          </section>

          <section className="panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Across time</p>
                <h2>Track fiscal-year history</h2>
              </div>
            </div>

            <HistoryChart reports={historyQuery.data?.reports ?? []} />

            <form
              className="inline-form"
              onSubmit={(event) => {
                event.preventDefault()
                loadHistoryYearMutation.mutate()
              }}
            >
              <input
                value={historyYear}
                onChange={(event) => setHistoryYear(event.target.value)}
                placeholder="FY 2023-2024"
              />
              <button type="submit" disabled={loadHistoryYearMutation.isPending || !historyYear}>
                {loadHistoryYearMutation.isPending ? 'Loading…' : 'Load another fiscal year'}
              </button>
            </form>

            {historyQuery.data?.reports.length ? (
              <div className="history-list">
                {historyQuery.data.reports.map((report) => (
                  <div key={report.id} className="history-item">
                    <strong>{report.fiscalYearLabel}</strong>
                    <span>{formatCurrency(report.totalBudget, true)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="placeholder-copy">
                This city only has one stored fiscal year so far.
              </p>
            )}
          </section>
        </section>
      ) : null}

      {activeReport ? (
        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Budget Q&A</p>
              <h2>Ask a follow-up question</h2>
            </div>
          </div>

          <form
            className="chat-form"
            onSubmit={(event) => {
              event.preventDefault()
              chatMutation.mutate()
            }}
          >
            <textarea
              rows={4}
              value={chatQuestion}
              onChange={(event) => setChatQuestion(event.target.value)}
            />
            <button type="submit" disabled={chatMutation.isPending}>
              {chatMutation.isPending ? 'Thinking…' : 'Ask the budget agent'}
            </button>
          </form>

          {chatMutation.data ? (
            <div className="answer-card">
              <p>{chatMutation.data.answer}</p>
              <ul className="citation-list">
                {chatMutation.data.citations.slice(0, 4).map((citation) => (
                  <li key={`${citation.url}-${citation.title}`}>
                    <a href={citation.url} target="_blank" rel="noreferrer">
                      {citation.title}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="placeholder-copy">
              Ask about priorities, tradeoffs, or which buckets residents may feel most directly.
            </p>
          )}
        </section>
      ) : null}
    </main>
  )
}

export default App
