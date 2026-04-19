import { useEffect, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { apiFetch } from './lib/api'
import type {
  BudgetReport,
  ChatResponse,
  CompareResponse,
  HistoryResponse,
  ResolveResponse,
} from './lib/types'

import { Masthead } from './components/Masthead'
import { SearchHero } from './components/SearchHero'
import { Dossier } from './components/Dossier'
import { Comparison } from './components/Comparison'
import { HistorySection } from './components/HistorySection'
import { ChatPanel } from './components/ChatPanel'
import { Footer } from './components/Footer'

const DEFAULT_QUESTION =
  'What stands out most about this budget, and what would a resident probably notice?'

export default function App() {
  const [city, setCity] = useState('Los Angeles')
  const [state, setState] = useState('CA')
  const [fiscalYear, setFiscalYear] = useState('')

  const [activeReport, setActiveReport] = useState<BudgetReport | null>(null)
  const [activeFromCache, setActiveFromCache] = useState(false)

  const [compareCity, setCompareCity] = useState('San Diego')
  const [compareState, setCompareState] = useState('CA')
  const [compareYear, setCompareYear] = useState('')

  const [historyYear, setHistoryYear] = useState('')
  const [chatQuestion, setChatQuestion] = useState(DEFAULT_QUESTION)

  useEffect(() => {
    if (activeReport) {
      // Soft scroll the dossier into view for nicer UX after loading
      const el = document.getElementById('dossier-anchor')
      if (el)
        el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [activeReport?.id])

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
    }) =>
      apiFetch<ResolveResponse>('/api/reports/resolve', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: (data) => {
      setActiveReport(data.report)
      setActiveFromCache(data.fromCache)
    },
  })

  const uploadPdfMutation = useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData()
      formData.append('city', city)
      formData.append('state', state)
      if (fiscalYear.trim()) {
        formData.append('fiscalYear', fiscalYear.trim())
      }
      formData.append('file', file)

      return apiFetch<ResolveResponse>('/api/reports/upload-pdf', {
        method: 'POST',
        body: formData,
      })
    },
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
          onSubmitPdf={(file) => uploadPdfMutation.mutate(file)}
          isLoading={resolveMutation.isPending}
          isUploading={uploadPdfMutation.isPending}
          hasReport={!!activeReport}
        />

        {resolveMutation.error ? (
          <div className="alert">
            <strong>Couldn't load that budget.</strong>
            <p>{resolveMutation.error.message}</p>
          </div>
        ) : null}

        {uploadPdfMutation.error ? (
          <div className="alert">
            <strong>Couldn't analyze that PDF.</strong>
            <p>{uploadPdfMutation.error.message}</p>
          </div>
        ) : null}

        <div id="dossier-anchor" />

        {activeReport ? (
          <>
            <Dossier report={activeReport} fromCache={activeFromCache} />

            <Comparison
              activeReport={activeReport}
              compareCity={compareCity}
              compareState={compareState}
              compareYear={compareYear}
              onCompareCityChange={setCompareCity}
              onCompareStateChange={setCompareState}
              onCompareYearChange={setCompareYear}
              onSubmit={() => compareMutation.mutate()}
              isPending={compareMutation.isPending}
              data={compareMutation.data}
              error={compareMutation.error}
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
              activeReport={activeReport}
              question={chatQuestion}
              onQuestionChange={setChatQuestion}
              onSubmit={() => chatMutation.mutate()}
              isPending={chatMutation.isPending}
              data={chatMutation.data}
              error={chatMutation.error}
            />
          </>
        ) : null}

        <Footer />
      </main>
    </>
  )
}
