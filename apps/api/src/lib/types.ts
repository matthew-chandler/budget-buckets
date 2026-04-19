import type { BucketDefinition, BucketKey } from './buckets.js'

export interface Citation {
  title: string
  url: string
  note?: string | null
  appliesToBucketKey?: BucketKey | null
  /** 1-based page in the source PDF or document, when known. */
  page?: number | null
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
  /** 1-based page in the source document where this bucket’s figures appear, when known. */
  citationPage?: number | null
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
  /** True when the API has a copy of the uploaded PDF for this report id. */
  hasSourcePdf?: boolean
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
  id: string
  city: string
  state: string
  displayName: string
  fiscalYearLabel: string
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
    citationPage?: number | null
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
    page?: number | null
  }>
}
