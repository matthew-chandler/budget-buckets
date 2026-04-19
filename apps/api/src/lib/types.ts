import type { BucketDefinition, BucketKey } from './buckets.js'

export interface Citation {
  title: string
  url: string
  note?: string | null
  appliesToBucketKey?: BucketKey | null
}

export interface RawCategory {
  name: string
  amount: number | null
  bucketKey: BucketKey | null
  note?: string | null
}

export interface BucketAllocation {
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

export interface BudgetReport {
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

export interface CompareResponse {
  primary: BudgetReport
  secondary: BudgetReport
  bucketDefinitions: BucketDefinition[]
}

export interface ResolveResponse {
  report: BudgetReport
  bucketDefinitions: BucketDefinition[]
  fromCache: boolean
}

export interface SearchResult {
  city: string
  state: string
  displayName: string
  latestFiscalYearLabel: string
  updatedAt: string
}

export interface HistoryResponse {
  reports: BudgetReport[]
  bucketDefinitions: BucketDefinition[]
}

export interface ChatResponse {
  answer: string
  citations: Citation[]
}

export interface ScrapedBudgetPayload {
  city: string | null
  state: string | null
  population: number | null
  fiscalYear: string | null
  currency: string | null
  totalBudget: number | null
  summary: string | null
  source: {
    title: string | null
    url: string | null
    notes: string | null
  } | null
  buckets: Array<{
    bucketKey: string | null
    label: string | null
    amount: number | null
    summary: string | null
    rawCategories: string[]
    citationUrl?: string | null
    citationTitle?: string | null
  }>
  rawCategories: Array<{
    name: string
    amount: number | null
    bucketKey: string | null
    note?: string | null
  }>
  citations: Array<{
    title: string
    url: string
    note?: string | null
    appliesToBucketKey?: string | null
  }>
}
