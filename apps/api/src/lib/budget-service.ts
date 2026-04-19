import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { tmpdir } from 'node:os'
import { bucketDefinitions, getBucketDefinition, normalizeBucketKey } from './buckets.js'
import {
  deleteReportTranslationsForReport,
  getBudgetReportByCityYear,
  getBudgetReportById,
  getLatestBudgetReport,
  getReportTranslationJson,
  listBudgetReportsForCity,
  searchCities,
  type PersistedBudgetReport,
  upsertBudgetReport,
  upsertReportTranslation,
} from './db.js'
import {
  answerBudgetQuestion,
  scrapeBudgetFromUploadedPdfWithPi,
  scrapeBudgetWithPi,
  translateReportPayloadWithPi,
} from './pi.js'
import {
  applyReportTranslationPayload,
  REPORT_TRANSLATION_PROMPT_REV,
  type ReportTranslationPayload,
} from './report-translation.js'
import type {
  BudgetReport,
  BucketAllocation,
  ChatResponse,
  Citation,
  CompareResponse,
  HistoryResponse,
  RawCategory,
  ResolveResponse,
  SearchResult,
  ScrapedBudgetPayload,
} from './types.js'
import {
  formatDisplayName,
  normalizeCity,
  normalizeState,
  parseFiscalYearSort,
  parseOptionalNumber,
  slugify,
} from './utils.js'

function aggregateRawCategories(rawCategories: RawCategory[]): Map<string, number> {
  const totals = new Map<string, number>()

  for (const category of rawCategories) {
    if (!category.bucketKey || category.amount === null) {
      continue
    }

    totals.set(category.bucketKey, (totals.get(category.bucketKey) ?? 0) + category.amount)
  }

  return totals
}

function normalizeRawCategories(rawCategories: ScrapedBudgetPayload['rawCategories']): RawCategory[] {
  return rawCategories.map((category) => ({
    name: category.name.trim(),
    amount: parseOptionalNumber(category.amount),
    bucketKey: normalizeBucketKey(category.bucketKey),
    note: category.note ?? null,
  }))
}

function normalizeCitations(
  citations: ScrapedBudgetPayload['citations'],
  source: ScrapedBudgetPayload['source'],
): Citation[] {
  const normalized = citations
    .filter((citation) => citation.title?.trim() && citation.url?.trim())
    .map((citation) => ({
      title: citation.title.trim(),
      url: citation.url.trim(),
      note: citation.note ?? null,
      appliesToBucketKey: normalizeBucketKey(citation.appliesToBucketKey),
    }))

  if (source?.title && source.url) {
    const exists = normalized.some((citation) => citation.url === source.url)
    if (!exists) {
      normalized.unshift({
        title: source.title,
        url: source.url,
        note: source.notes ?? null,
        appliesToBucketKey: null,
      })
    }
  }

  return normalized
}

function normalizeBuckets(
  scraped: ScrapedBudgetPayload,
  rawCategories: RawCategory[],
  citations: Citation[],
  totalBudget: number | null,
): BucketAllocation[] {
  const rawCategoryTotals = aggregateRawCategories(rawCategories)
  const scrapedByKey = new Map(
    scraped.buckets
      .map((bucket) => {
        const key = normalizeBucketKey(bucket.bucketKey ?? bucket.label)
        if (!key) {
          return null
        }

        return [
          key,
          {
            amount: parseOptionalNumber(bucket.amount),
            summary: bucket.summary?.trim() ?? null,
            rawCategories: bucket.rawCategories ?? [],
            citationUrl: bucket.citationUrl ?? null,
            citationTitle: bucket.citationTitle ?? null,
          },
        ] as const
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null),
  )

  return bucketDefinitions.map((definition) => {
    const scrapedBucket = scrapedByKey.get(definition.key)
    const amount =
      scrapedBucket?.amount ??
      rawCategoryTotals.get(definition.key) ??
      null

    const share =
      totalBudget && amount !== null && totalBudget > 0 ? amount / totalBudget : null

    const bucketCitation =
      citations.find((citation) => citation.appliesToBucketKey === definition.key) ?? null

    return {
      key: definition.key,
      label: definition.label,
      color: definition.color,
      amount,
      share,
      summary: scrapedBucket?.summary ?? null,
      rawCategories:
        scrapedBucket?.rawCategories.length
          ? scrapedBucket.rawCategories
          : rawCategories
              .filter((category) => category.bucketKey === definition.key)
              .map((category) => category.name),
      citationUrl: scrapedBucket?.citationUrl ?? bucketCitation?.url ?? null,
      citationTitle: scrapedBucket?.citationTitle ?? bucketCitation?.title ?? null,
    }
  })
}

function normalizeScrapedReport(input: {
  requestedCity: string
  requestedState: string
  requestedFiscalYear?: string | null
  scraped: ScrapedBudgetPayload
}): Omit<BudgetReport, 'id' | 'updatedAt' | 'retrievedAt'> & {
  citySlug: string
  stateSlug: string
} {
  const city = normalizeCity(input.scraped.city ?? input.requestedCity)
  const state = normalizeState(input.scraped.state ?? input.requestedState)
  const population = parseOptionalNumber(input.scraped.population)
  const rawCategories = normalizeRawCategories(input.scraped.rawCategories ?? [])
  const citations = normalizeCitations(input.scraped.citations ?? [], input.scraped.source)
  const explicitTotalBudget = parseOptionalNumber(input.scraped.totalBudget)
  const fiscalYearLabel =
    input.scraped.fiscalYear?.trim() ??
    input.requestedFiscalYear?.trim() ??
    'Unknown fiscal year'
  const fiscalYearSort = parseFiscalYearSort(fiscalYearLabel)
  const tentativeBuckets = normalizeBuckets(
    input.scraped,
    rawCategories,
    citations,
    explicitTotalBudget,
  )

  const summedTotalBudget =
    tentativeBuckets.reduce((total, bucket) => total + (bucket.amount ?? 0), 0) || null
  const totalBudget = explicitTotalBudget ?? summedTotalBudget
  const buckets = normalizeBuckets(input.scraped, rawCategories, citations, totalBudget)

  return {
    city,
    state,
    displayName: formatDisplayName(city, state),
    citySlug: slugify(city),
    stateSlug: slugify(state),
    population,
    fiscalYearLabel,
    fiscalYearSort,
    currency: input.scraped.currency?.trim() ?? 'USD',
    totalBudget,
    sourceTitle: input.scraped.source?.title ?? null,
    sourceUrl: input.scraped.source?.url ?? null,
    sourceNotes: input.scraped.source?.notes ?? null,
    summary: input.scraped.summary ?? null,
    buckets,
    rawCategories,
    citations,
  }
}

export async function resolveBudgetReport(input: {
  city: string
  state: string
  fiscalYear?: string | null
}): Promise<ResolveResponse> {
  const city = normalizeCity(input.city)
  const state = normalizeState(input.state)
  const citySlug = slugify(city)
  const stateSlug = slugify(state)
  const fiscalYear = input.fiscalYear?.trim() || null

  const existing = fiscalYear
    ? await getBudgetReportByCityYear(citySlug, stateSlug, fiscalYear)
    : await getLatestBudgetReport(citySlug, stateSlug)

  if (existing) {
    return {
      report: existing,
      bucketDefinitions,
      fromCache: true,
    }
  }

  const scraped = await scrapeBudgetWithPi({
    city,
    state,
    fiscalYearLabel: fiscalYear,
  })

  const normalized = normalizeScrapedReport({
    requestedCity: city,
    requestedState: state,
    requestedFiscalYear: fiscalYear,
    scraped,
  })

  const report = await upsertBudgetReport(normalized)
  deleteReportTranslationsForReport(report.id)
  queueReportTranslations(report.id)

  return {
    report,
    bucketDefinitions,
    fromCache: false,
  }
}

export async function resolveBudgetReportFromUploadedPdf(input: {
  city: string
  state: string
  fiscalYear?: string | null
  pdfBuffer: Buffer
  fileName: string
}): Promise<ResolveResponse> {
  const city = normalizeCity(input.city)
  const state = normalizeState(input.state)
  const fiscalYear = input.fiscalYear?.trim() || null
  const safeName = basename(input.fileName || 'budget.pdf').replace(/[^\w.\-]+/g, '_') || 'budget.pdf'
  const dir = await mkdtemp(join(tmpdir(), 'budget-buckets-upload-'))
  const pdfFileName = /\.pdf$/i.test(safeName) ? safeName : `${safeName}.pdf`
  const pdfPath = join(dir, pdfFileName)

  try {
    await writeFile(pdfPath, input.pdfBuffer)

    const scraped = await scrapeBudgetFromUploadedPdfWithPi({
      city,
      state,
      fiscalYearLabel: fiscalYear,
      pdfPath,
      fileName: pdfFileName,
    })

    const normalized = normalizeScrapedReport({
      requestedCity: city,
      requestedState: state,
      requestedFiscalYear: fiscalYear,
      scraped,
    })

    const report = await upsertBudgetReport(normalized)
    deleteReportTranslationsForReport(report.id)
    queueReportTranslations(report.id)

    return {
      report,
      bucketDefinitions,
      fromCache: false,
    }
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

export async function compareBudgetReports(input: {
  primary: { city: string; state: string; fiscalYear?: string | null }
  secondary: { city: string; state: string; fiscalYear?: string | null }
}): Promise<CompareResponse> {
  const [primaryResolved, secondaryResolved] = await Promise.all([
    resolveBudgetReport(input.primary),
    resolveBudgetReport(input.secondary),
  ])

  return {
    primary: primaryResolved.report,
    secondary: secondaryResolved.report,
    bucketDefinitions,
  }
}

export async function getBudgetHistory(input: {
  city: string
  state: string
}): Promise<HistoryResponse> {
  const citySlug = slugify(normalizeCity(input.city))
  const stateSlug = slugify(normalizeState(input.state))

  return {
    reports: await listBudgetReportsForCity(citySlug, stateSlug),
    bucketDefinitions,
  }
}

export async function searchKnownCities(query: string): Promise<SearchResult[]> {
  return searchCities(query)
}

function toClientReport(p: PersistedBudgetReport): BudgetReport {
  const { citySlug: _cs, stateSlug: _ss, ...rest } = p
  return rest
}

export async function getLocalizedBudgetReport(
  reportId: string,
  locale: 'en' | 'es' | 'zh',
): Promise<BudgetReport> {
  const base = await getBudgetReportById(reportId)
  if (!base) {
    throw new Error('Report not found.')
  }
  const canonical = toClientReport(base)
  if (locale === 'en') {
    return canonical
  }

  const cached = getReportTranslationJson(reportId, locale, REPORT_TRANSLATION_PROMPT_REV)
  let payload: ReportTranslationPayload
  if (cached) {
    payload = JSON.parse(cached) as ReportTranslationPayload
  } else {
    payload = await translateReportPayloadWithPi(canonical, locale)
    upsertReportTranslation(reportId, locale, JSON.stringify(payload), REPORT_TRANSLATION_PROMPT_REV)
  }
  return applyReportTranslationPayload(canonical, payload)
}

export function queueReportTranslations(reportId: string): void {
  void (async () => {
    try {
      const base = await getBudgetReportById(reportId)
      if (!base) return
      const canonical = toClientReport(base)
      for (const loc of ['es', 'zh'] as const) {
        if (getReportTranslationJson(reportId, loc, REPORT_TRANSLATION_PROMPT_REV)) continue
        const payload = await translateReportPayloadWithPi(canonical, loc)
        upsertReportTranslation(reportId, loc, JSON.stringify(payload), REPORT_TRANSLATION_PROMPT_REV)
      }
    } catch (err) {
      console.error('[queueReportTranslations]', reportId, err)
    }
  })()
}

function assertReportSnapshotMatches(
  report: BudgetReport,
  city: string,
  state: string,
  fiscalYear: string | null | undefined,
) {
  if (
    normalizeCity(report.city) !== normalizeCity(city) ||
    normalizeState(report.state) !== normalizeState(state)
  ) {
    throw new Error('Report snapshot does not match the requested city and state.')
  }
  const fy = fiscalYear?.trim() ?? ''
  if (fy && report.fiscalYearLabel.trim() !== fy) {
    throw new Error('Report snapshot does not match the requested fiscal year.')
  }
}

export async function chatAboutBudget(input: {
  city: string
  state: string
  fiscalYear?: string | null
  question: string
  language?: 'en' | 'es' | 'zh'
  reportSnapshot?: BudgetReport | null
}): Promise<ChatResponse> {
  let report: BudgetReport
  if (input.reportSnapshot) {
    assertReportSnapshotMatches(input.reportSnapshot, input.city, input.state, input.fiscalYear)
    report = input.reportSnapshot
  } else {
    report = (await resolveBudgetReport(input)).report
  }
  return answerBudgetQuestion(report, input.question, input.language ?? 'en')
}

export { bucketDefinitions, getBucketDefinition }
