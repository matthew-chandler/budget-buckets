import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import Database from 'better-sqlite3'
import type { BudgetReport, Citation, RawCategory } from './types.js'
import { createId } from './utils.js'

interface ReportRow {
  id: string
  city: string
  state: string
  display_name: string
  city_slug: string
  state_slug: string
  population: number | null
  fiscal_year_label: string
  fiscal_year_sort: number | null
  currency: string
  total_budget: number | null
  source_title: string | null
  source_url: string | null
  source_notes: string | null
  summary: string | null
  buckets_json: string
  raw_categories_json: string
  citations_json: string
  retrieved_at: string
  created_at: string
  updated_at: string
}

interface CitySearchRow {
  city: string
  state: string
  displayName: string
  latestFiscalYearLabel: string
  updatedAt: string
}

export interface PersistedBudgetReport extends BudgetReport {
  citySlug: string
  stateSlug: string
}

const dbPath = join(process.cwd(), 'data', 'budget-buckets.sqlite')
mkdirSync(dirname(dbPath), { recursive: true })

export const db = new Database(dbPath)

db.pragma('journal_mode = WAL')
db.pragma('synchronous = NORMAL')

db.exec(`
  CREATE TABLE IF NOT EXISTS budget_reports (
    id TEXT PRIMARY KEY,
    city TEXT NOT NULL,
    state TEXT NOT NULL,
    display_name TEXT NOT NULL,
    city_slug TEXT NOT NULL,
    state_slug TEXT NOT NULL,
    population INTEGER,
    fiscal_year_label TEXT NOT NULL,
    fiscal_year_sort INTEGER,
    currency TEXT NOT NULL,
    total_budget REAL,
    source_title TEXT,
    source_url TEXT,
    source_notes TEXT,
    summary TEXT,
    buckets_json TEXT NOT NULL,
    raw_categories_json TEXT NOT NULL,
    citations_json TEXT NOT NULL,
    retrieved_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(city_slug, state_slug, fiscal_year_label)
  );

  CREATE INDEX IF NOT EXISTS idx_budget_reports_city_state
    ON budget_reports(city_slug, state_slug, fiscal_year_sort DESC, updated_at DESC);

  CREATE INDEX IF NOT EXISTS idx_budget_reports_display_name
    ON budget_reports(display_name);
`)

function rowToReport(row: ReportRow): PersistedBudgetReport {
  return {
    id: row.id,
    city: row.city,
    state: row.state,
    displayName: row.display_name,
    citySlug: row.city_slug,
    stateSlug: row.state_slug,
    population: row.population,
    fiscalYearLabel: row.fiscal_year_label,
    fiscalYearSort: row.fiscal_year_sort,
    currency: row.currency,
    totalBudget: row.total_budget,
    sourceTitle: row.source_title,
    sourceUrl: row.source_url,
    sourceNotes: row.source_notes,
    summary: row.summary,
    buckets: JSON.parse(row.buckets_json),
    rawCategories: JSON.parse(row.raw_categories_json),
    citations: JSON.parse(row.citations_json),
    retrievedAt: row.retrieved_at,
    updatedAt: row.updated_at,
  }
}

export async function upsertBudgetReport(
  input: Omit<PersistedBudgetReport, 'id' | 'updatedAt' | 'retrievedAt'> & {
    id?: string
    retrievedAt?: string
  },
): Promise<PersistedBudgetReport> {
  const now = new Date().toISOString()
  const id = input.id ?? createId('report')
  const retrievedAt = input.retrievedAt ?? now

  db.prepare(`
    INSERT INTO budget_reports (
      id,
      city,
      state,
      display_name,
      city_slug,
      state_slug,
      population,
      fiscal_year_label,
      fiscal_year_sort,
      currency,
      total_budget,
      source_title,
      source_url,
      source_notes,
      summary,
      buckets_json,
      raw_categories_json,
      citations_json,
      retrieved_at,
      created_at,
      updated_at
    ) VALUES (
      @id,
      @city,
      @state,
      @displayName,
      @citySlug,
      @stateSlug,
      @population,
      @fiscalYearLabel,
      @fiscalYearSort,
      @currency,
      @totalBudget,
      @sourceTitle,
      @sourceUrl,
      @sourceNotes,
      @summary,
      @bucketsJson,
      @rawCategoriesJson,
      @citationsJson,
      @retrievedAt,
      @createdAt,
      @updatedAt
    )
    ON CONFLICT(city_slug, state_slug, fiscal_year_label) DO UPDATE SET
      display_name = excluded.display_name,
      population = excluded.population,
      fiscal_year_sort = excluded.fiscal_year_sort,
      currency = excluded.currency,
      total_budget = excluded.total_budget,
      source_title = excluded.source_title,
      source_url = excluded.source_url,
      source_notes = excluded.source_notes,
      summary = excluded.summary,
      buckets_json = excluded.buckets_json,
      raw_categories_json = excluded.raw_categories_json,
      citations_json = excluded.citations_json,
      retrieved_at = excluded.retrieved_at,
      updated_at = excluded.updated_at
  `).run({
    id,
    city: input.city,
    state: input.state,
    displayName: input.displayName,
    citySlug: input.citySlug,
    stateSlug: input.stateSlug,
    population: input.population,
    fiscalYearLabel: input.fiscalYearLabel,
    fiscalYearSort: input.fiscalYearSort,
    currency: input.currency,
    totalBudget: input.totalBudget,
    sourceTitle: input.sourceTitle,
    sourceUrl: input.sourceUrl,
    sourceNotes: input.sourceNotes,
    summary: input.summary,
    bucketsJson: JSON.stringify(input.buckets),
    rawCategoriesJson: JSON.stringify(input.rawCategories),
    citationsJson: JSON.stringify(input.citations),
    retrievedAt,
    createdAt: now,
    updatedAt: now,
  })

  return (await getBudgetReportByCityYear(input.citySlug, input.stateSlug, input.fiscalYearLabel))!
}

export async function getLatestBudgetReport(
  citySlug: string,
  stateSlug: string,
): Promise<PersistedBudgetReport | null> {
  const row = db.prepare(`
    SELECT *
    FROM budget_reports
    WHERE city_slug = ? AND state_slug = ?
    ORDER BY fiscal_year_sort DESC, updated_at DESC
    LIMIT 1
  `).get(citySlug, stateSlug) as ReportRow | undefined

  return row ? rowToReport(row) : null
}

export async function getBudgetReportByCityYear(
  citySlug: string,
  stateSlug: string,
  fiscalYearLabel: string,
): Promise<PersistedBudgetReport | null> {
  const row = db.prepare(`
    SELECT *
    FROM budget_reports
    WHERE city_slug = ? AND state_slug = ? AND fiscal_year_label = ?
    LIMIT 1
  `).get(citySlug, stateSlug, fiscalYearLabel) as ReportRow | undefined

  return row ? rowToReport(row) : null
}

export async function listBudgetReportsForCity(
  citySlug: string,
  stateSlug: string,
): Promise<PersistedBudgetReport[]> {
  const rows = db.prepare(`
    SELECT *
    FROM budget_reports
    WHERE city_slug = ? AND state_slug = ?
    ORDER BY fiscal_year_sort ASC, updated_at ASC
  `).all(citySlug, stateSlug) as unknown as ReportRow[]

  return rows.map(rowToReport)
}

export async function searchCities(query: string): Promise<CitySearchRow[]> {
  const normalized = `%${query.trim()}%`
  const rows = db.prepare(`
    SELECT *
    FROM budget_reports
    WHERE display_name LIKE ? COLLATE NOCASE
    ORDER BY updated_at DESC
    LIMIT 25
  `).all(normalized) as unknown as ReportRow[]

  const deduped = new Map<string, CitySearchRow>()

  for (const row of rows) {
    const key = `${row.city_slug}:${row.state_slug}`
    if (!deduped.has(key)) {
      deduped.set(key, {
        city: row.city,
        state: row.state,
        displayName: row.display_name,
        latestFiscalYearLabel: row.fiscal_year_label,
        updatedAt: row.updated_at,
      })
    }
  }

  return [...deduped.values()].slice(0, 10)
}

export function citationsForReport(report: BudgetReport): Citation[] {
  return report.citations
}

export function rawCategoriesForReport(report: BudgetReport): RawCategory[] {
  return report.rawCategories
}
