export type BucketKey =
  | 'public-safety-justice'
  | 'public-works-infrastructure'
  | 'community-recreation'
  | 'health-human-services'
  | 'transportation'
  | 'government-operations-administration'
  | 'pensions-debt'
  | 'economic-development'
  | 'miscellaneous'

export interface BucketDefinition {
  key: BucketKey
  label: string
  color: string
  description: string
  examples: string[]
}

export interface Citation {
  title: string
  url: string
  note?: string | null
  appliesToBucketKey?: BucketKey | null
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

export interface RawCategory {
  name: string
  amount: number | null
  bucketKey: BucketKey | null
  note?: string | null
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

export interface ResolveResponse {
  report: BudgetReport
  bucketDefinitions: BucketDefinition[]
  fromCache: boolean
}

export interface CompareResponse {
  primary: BudgetReport
  secondary: BudgetReport
  bucketDefinitions: BucketDefinition[]
}

export interface HistoryResponse {
  reports: BudgetReport[]
  bucketDefinitions: BucketDefinition[]
}

export interface ChatResponse {
  answer: string
  citations: Citation[]
}

export interface SearchResult {
  id: string
  city: string
  state: string
  displayName: string
  fiscalYearLabel: string
  updatedAt: string
}

export interface SearchResponse {
  results: SearchResult[]
}

/** One uploaded PDF and the city / state / year used as that report's identity. */
export interface PdfUploadEntry {
  file: File
  city: string
  state: string
  fiscalYear: string
}
