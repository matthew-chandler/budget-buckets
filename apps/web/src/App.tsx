import { useEffect, useMemo, useRef, useState } from 'react'
import type { PdfUploadEntry } from './lib/types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useI18n } from './i18n/I18nProvider'
import { apiFetch } from './lib/api'
import { useTranslatedReport } from './lib/useTranslatedReport'
import type {
  BudgetReport,
  ChatResponse,
  CompareResponse,
  HistoryResponse,
  ResolveResponse,
  SearchResponse,
  SearchResult,
} from './lib/types'
import type { DonutDenominator } from './components/BucketDonut'

import { Masthead } from './components/Masthead'
import { SearchHero } from './components/SearchHero'
import { Archive } from './components/Archive'
import { Dossier } from './components/Dossier'
import { Comparison } from './components/Comparison'
import { HistorySection } from './components/HistorySection'
import { ChatPanel } from './components/ChatPanel'
import { Footer } from './components/Footer'

const REQ_TIMEOUT_MS = 120_000
const CHAT_TIMEOUT_MS = 90_000

function withTimeout(signal: AbortSignal | undefined, ms: number): AbortSignal {
  const ctrl = new AbortController()
  const t = window.setTimeout(() => ctrl.abort(), ms)
  const chain = () => {
    clearTimeout(t)
    ctrl.abort()
  }
  if (signal) {
    if (signal.aborted) chain()
    else signal.addEventListener('abort', chain, { once: true })
  }
  return ctrl.signal
}

export default function App() {
  const { locale, t } = useI18n()
  const queryClient = useQueryClient()
  const prevLocaleRef = useRef(locale)

  const [city, setCity] = useState('Los Angeles')
  const [state, setState] = useState('CA')
  const [fiscalYear, setFiscalYear] = useState('')

  const [activeReport, setActiveReport] = useState<BudgetReport | null>(null)
  const [activeFromCache, setActiveFromCache] = useState(false)

  const [compareCity, setCompareCity] = useState('')
  const [compareState, setCompareState] = useState('CA')
  const [compareYear, setCompareYear] = useState('')

  const [historyYear, setHistoryYear] = useState('')
  const [chatQuestion, setChatQuestion] = useState(() => t('defaultChatQuestion'))

  useEffect(() => {
    setChatQuestion(t('defaultChatQuestion'))
  }, [locale, t])

  const [donutDenominator, setDonutDenominator] = useState<DonutDenominator>('adopted')
  const [comparePerCapita, setComparePerCapita] = useState(false)

  const [compareElapsed, setCompareElapsed] = useState(0)

  const resolveAbortRef = useRef<AbortController | null>(null)
  const compareAbortRef = useRef<AbortController | null>(null)
  const chatAbortRef = useRef<AbortController | null>(null)
  const uploadAbortRef = useRef<AbortController | null>(null)

  const urlBootstrapped = useRef(false)

  useEffect(() => {
    if (activeReport) {
      const el = document.getElementById('dossier-anchor')
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [activeReport?.id])

  const archiveQuery = useQuery({
    queryKey: ['archive'],
    queryFn: () => apiFetch<SearchResponse>('/api/search?q='),
  })

  const archiveResults = useMemo(
    () => archiveQuery.data?.results ?? [],
    [archiveQuery.data?.results],
  )

  useEffect(() => {
    if (activeReport?.id) setDonutDenominator('adopted')
  }, [activeReport?.id])

  useEffect(() => {
    if (prevLocaleRef.current === locale) return
    prevLocaleRef.current = locale
    queryClient.resetQueries({ queryKey: ['report-translation'] })
  }, [locale, queryClient])

  const {
    displayReport: dossierReport,
    isTranslating: isTranslatingReport,
    translationError,
  } = useTranslatedReport(activeReport)

  const historyQuery = useQuery({
    queryKey: [
      'history',
      activeReport?.city,
      activeReport?.state,
      activeReport?.updatedAt,
    ],
    queryFn: () =>
      apiFetch<HistoryResponse>(
        `/api/reports/history?city=${encodeURIComponent(activeReport!.city)}&state=${encodeURIComponent(activeReport!.state)}`,
      ),
    enabled: Boolean(activeReport),
  })

  const resolveMutation = useMutation({
    mutationFn: (payload: {
      city: string
      state: string
      fiscalYear?: string | null
    }) => {
      resolveAbortRef.current?.abort()
      const ac = new AbortController()
      resolveAbortRef.current = ac
      return apiFetch<ResolveResponse>('/api/reports/resolve', {
        method: 'POST',
        body: JSON.stringify(payload),
        signal: withTimeout(ac.signal, REQ_TIMEOUT_MS),
      })
    },
    onSuccess: (data) => {
      setActiveReport(data.report)
      setActiveFromCache(data.fromCache)
      archiveQuery.refetch()
    },
  })

  useEffect(() => {
    if (urlBootstrapped.current) return
    urlBootstrapped.current = true
    const p = new URLSearchParams(window.location.search)
    const c = p.get('city')?.trim()
    const s = p.get('state')?.trim()
    const fy = p.get('fy')?.trim() ?? p.get('fiscalYear')?.trim() ?? ''
    if (c && s) {
      setCity(c)
      setState(s)
      setFiscalYear(fy)
      resolveMutation.mutate({ city: c, state: s, fiscalYear: fy || null })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot bootstrap from URL
  }, [])

  useEffect(() => {
    if (!activeReport) return
    const url = new URL(window.location.href)
    url.searchParams.set('city', activeReport.city)
    url.searchParams.set('state', activeReport.state)
    url.searchParams.set('fy', activeReport.fiscalYearLabel)
    window.history.replaceState({}, '', `${url.pathname}?${url.searchParams.toString()}`)
  }, [activeReport?.id, activeReport?.fiscalYearLabel])

  const [archiveSelecting, setArchiveSelecting] = useState<string | null>(null)

  const handleArchiveSelect = (r: SearchResult) => {
    const key = r.id
    setArchiveSelecting(key)
    setCity(r.city)
    setState(r.state)
    setFiscalYear(r.fiscalYearLabel)
    resolveMutation.mutate(
      { city: r.city, state: r.state, fiscalYear: r.fiscalYearLabel },
      {
        onSettled: () => setArchiveSelecting(null),
      },
    )
  }

  const compareSeeded = useRef(false)

  useEffect(() => {
    compareSeeded.current = false
  }, [activeReport?.id])

  useEffect(() => {
    if (!activeReport || !archiveResults.length || compareSeeded.current) return
    const others = archiveResults.filter(
      (x) =>
        x.city !== activeReport.city ||
        x.state !== activeReport.state ||
        x.fiscalYearLabel !== activeReport.fiscalYearLabel,
    )
    const first = others[0]
    if (first) {
      setCompareCity(first.city)
      setCompareState(first.state)
      setCompareYear(
        first.fiscalYearLabel === activeReport.fiscalYearLabel ? '' : first.fiscalYearLabel,
      )
      compareSeeded.current = true
    }
  }, [activeReport, archiveResults])

  const [uploadPdfFailures, setUploadPdfFailures] = useState<
    { name: string; message: string }[]
  >([])

  const uploadPdfMutation = useMutation({
    mutationFn: async (entries: PdfUploadEntry[]) => {
      uploadAbortRef.current?.abort()
      const ac = new AbortController()
      uploadAbortRef.current = ac
      const signal = withTimeout(ac.signal, REQ_TIMEOUT_MS)

      const reports: BudgetReport[] = []
      const failures: { name: string; message: string }[] = []

      for (const entry of entries) {
        const c = entry.city.trim()
        const s = entry.state.trim()
        if (!c || !s) {
          failures.push({
            name: entry.file.name,
            message: t('pdfCityStateRequired'),
          })
          continue
        }

        const formData = new FormData()
        formData.append('city', c)
        formData.append('state', s)
        if (entry.fiscalYear.trim()) {
          formData.append('fiscalYear', entry.fiscalYear.trim())
        }
        formData.append('file', entry.file)

        try {
          const data = await apiFetch<ResolveResponse>('/api/reports/upload-pdf', {
            method: 'POST',
            body: formData,
            signal,
          })
          reports.push(data.report)
        } catch (err) {
          failures.push({
            name: entry.file.name,
            message: err instanceof Error ? err.message : t('requestFailed'),
          })
        }
      }

      return { reports, failures }
    },
    onMutate: () => {
      setUploadPdfFailures([])
    },
    onSuccess: (data) => {
      setUploadPdfFailures(data.failures)
      if (data.reports.length) {
        setActiveReport(data.reports[data.reports.length - 1]!)
        setActiveFromCache(false)
      }
      archiveQuery.refetch()
    },
  })

  const compareMutation = useMutation({
    mutationFn: () => {
      compareAbortRef.current?.abort()
      const ac = new AbortController()
      compareAbortRef.current = ac
      return apiFetch<CompareResponse>('/api/compare/cities', {
        method: 'POST',
        body: JSON.stringify({
          primary: {
            city: activeReport!.city,
            state: activeReport!.state,
            fiscalYear: activeReport!.fiscalYearLabel,
          },
          secondary: {
            city: compareCity,
            state: compareState,
            fiscalYear: compareYear || null,
          },
        }),
        signal: withTimeout(ac.signal, REQ_TIMEOUT_MS),
      })
    },
  })

  useEffect(() => {
    if (!compareMutation.isPending) {
      setCompareElapsed(0)
      return
    }
    const t0 = Date.now()
    const id = window.setInterval(
      () => setCompareElapsed(Math.floor((Date.now() - t0) / 1000)),
      1000,
    )
    return () => clearInterval(id)
  }, [compareMutation.isPending])

  const cancelCompare = () => {
    compareAbortRef.current?.abort()
    compareMutation.reset()
  }

  const loadHistoryYearMutation = useMutation({
    mutationFn: () =>
      apiFetch<ResolveResponse>('/api/reports/resolve', {
        method: 'POST',
        body: JSON.stringify({
          city: activeReport!.city,
          state: activeReport!.state,
          fiscalYear: historyYear,
        }),
        signal: withTimeout(undefined, REQ_TIMEOUT_MS),
      }),
    onSuccess: (data) => {
      setActiveReport(data.report)
      setActiveFromCache(data.fromCache)
      historyQuery.refetch()
      setHistoryYear('')
      archiveQuery.refetch()
    },
  })

  const chatMutation = useMutation({
    mutationFn: () => {
      chatAbortRef.current?.abort()
      const ac = new AbortController()
      chatAbortRef.current = ac
      return apiFetch<ChatResponse>('/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          city: activeReport!.city,
          state: activeReport!.state,
          fiscalYear: activeReport!.fiscalYearLabel,
          question: chatQuestion,
          language: locale,
          ...(locale !== 'en' ? { reportSnapshot: dossierReport } : {}),
        }),
        signal: withTimeout(ac.signal, CHAT_TIMEOUT_MS),
      })
    },
  })

  const cancelChat = () => {
    chatAbortRef.current?.abort()
    chatMutation.reset()
  }

  return (
    <>
      <Masthead />
      <main className="page">
        <SearchHero
          city={city}
          state={state}
          fiscalYear={fiscalYear}
          onCityChange={setCity}
          onStateChange={setState}
          onFiscalYearChange={setFiscalYear}
          onSubmit={() =>
            resolveMutation.mutate({
              city,
              state,
              fiscalYear: fiscalYear || null,
            })
          }
          onSubmitPdfs={(entries) => uploadPdfMutation.mutate(entries)}
          isLoading={resolveMutation.isPending}
          isUploading={uploadPdfMutation.isPending}
          hasReport={!!activeReport}
        />

        {resolveMutation.error ? (
          <div className="alert">
            <strong>{t('errLoadBudget')}</strong>
            <p>{resolveMutation.error.message}</p>
          </div>
        ) : null}

        {uploadPdfFailures.length > 0 ? (
          <div className="alert">
            <strong>{t('errPdfPartial')}</strong>
            <ul style={{ margin: '8px 0 0', paddingLeft: 20 }}>
              {uploadPdfFailures.map((f, i) => (
                <li key={`${i}-${f.name}`}>
                  <strong>{f.name}:</strong> {f.message}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <Archive
          results={archiveResults}
          isLoading={archiveQuery.isLoading}
          isSelecting={resolveMutation.isPending && archiveSelecting !== null}
          selectingKey={archiveSelecting}
          activeKey={activeReport?.id ?? null}
          onSelect={handleArchiveSelect}
        />

        <div id="dossier-anchor" />

        {activeReport ? (
          <>
            {locale !== 'en' && (isTranslatingReport || translationError) ? (
              <div className="translate-banner" role="status">
                {isTranslatingReport ? <p>{t('hintTranslatingContent')}</p> : null}
                {translationError ? (
                  <p className="translate-banner__err">{t('errTranslation')}</p>
                ) : null}
              </div>
            ) : null}

            <Dossier
              report={dossierReport!}
              fromCache={activeFromCache}
              donutDenominator={donutDenominator}
              onDonutDenominatorChange={setDonutDenominator}
            />

            <Comparison
              activeReport={activeReport}
              compareCity={compareCity}
              compareState={compareState}
              compareYear={compareYear}
              onCompareCityChange={setCompareCity}
              onCompareStateChange={setCompareState}
              onCompareYearChange={setCompareYear}
              onSubmit={() => compareMutation.mutate()}
              onCancel={cancelCompare}
              isPending={compareMutation.isPending}
              elapsedSec={compareElapsed}
              data={compareMutation.data}
              error={compareMutation.error}
              archiveOptions={archiveResults}
              perCapitaMode={comparePerCapita}
              onPerCapitaModeChange={setComparePerCapita}
            />

            <HistorySection
              activeReport={activeReport}
              historyYear={historyYear}
              onHistoryYearChange={setHistoryYear}
              onSubmit={() => loadHistoryYearMutation.mutate()}
              isPending={loadHistoryYearMutation.isPending}
              data={historyQuery.data}
            />

            <ChatPanel
              activeReport={dossierReport!}
              question={chatQuestion}
              onQuestionChange={setChatQuestion}
              onSubmit={() => chatMutation.mutate()}
              onCancel={cancelChat}
              isPending={chatMutation.isPending}
              data={chatMutation.data}
              error={chatMutation.error}
              chatContentPending={locale !== 'en' && isTranslatingReport}
            />
          </>
        ) : null}

        <Footer />
      </main>
    </>
  )
}
