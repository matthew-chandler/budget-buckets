import type { BucketKey } from './buckets.js'
import type { BudgetReport } from './types.js'

/**
 * Increment when server-side translation instructions change materially so cached
 * `report_translations` rows are treated as stale and regenerated.
 */
export const REPORT_TRANSLATION_PROMPT_REV = 2

/** String fields produced by the translation model; merged onto the canonical English report. */
export interface ReportTranslationPayload {
  summary: string | null
  sourceTitle: string | null
  sourceNotes: string | null
  buckets: Array<{
    key: BucketKey
    summary: string | null
    rawCategories: string[]
    citationTitle: string | null
  }>
  rawCategories: Array<{ name: string; note: string | null }>
  citations: Array<{ title: string; note: string | null }>
}

export function buildReportTranslationPayload(report: BudgetReport): ReportTranslationPayload {
  return {
    summary: report.summary,
    sourceTitle: report.sourceTitle,
    sourceNotes: report.sourceNotes,
    buckets: report.buckets.map((b) => ({
      key: b.key,
      summary: b.summary,
      rawCategories: [...b.rawCategories],
      citationTitle: b.citationTitle ?? null,
    })),
    rawCategories: report.rawCategories.map((r) => ({
      name: r.name,
      note: r.note ?? null,
    })),
    citations: report.citations.map((c) => ({
      title: c.title,
      note: c.note ?? null,
    })),
  }
}

export function applyReportTranslationPayload(
  report: BudgetReport,
  trans: ReportTranslationPayload,
): BudgetReport {
  const bucketTrans = new Map<string, ReportTranslationPayload['buckets'][number]>()
  for (const b of trans.buckets) {
    bucketTrans.set(String(b.key).trim(), b)
  }

  return {
    ...report,
    summary: trans.summary ?? report.summary,
    sourceTitle: trans.sourceTitle ?? report.sourceTitle,
    sourceNotes: trans.sourceNotes ?? report.sourceNotes,
    buckets: report.buckets.map((b) => {
      const t = bucketTrans.get(b.key) ?? bucketTrans.get(String(b.key).trim())
      if (!t) return b
      return {
        ...b,
        summary: t.summary ?? b.summary,
        rawCategories:
          Array.isArray(t.rawCategories) && t.rawCategories.length === b.rawCategories.length
            ? t.rawCategories
            : b.rawCategories,
        citationTitle: t.citationTitle ?? b.citationTitle,
      }
    }),
    rawCategories: report.rawCategories.map((r, i) => {
      const t = trans.rawCategories[i]
      if (!t) return r
      return {
        ...r,
        name: t.name ?? r.name,
        note: t.note !== undefined ? t.note : r.note,
      }
    }),
    citations: report.citations.map((c, i) => {
      const t = trans.citations[i]
      if (!t) return c
      return {
        ...c,
        title: t.title ?? c.title,
        note: t.note !== undefined ? t.note : c.note,
      }
    }),
  }
}

export function assertTranslationPayloadShape(
  report: BudgetReport,
  translated: ReportTranslationPayload,
) {
  if (
    !Array.isArray(translated.buckets) ||
    translated.buckets.length !== report.buckets.length ||
    !Array.isArray(translated.rawCategories) ||
    translated.rawCategories.length !== report.rawCategories.length ||
    !Array.isArray(translated.citations) ||
    translated.citations.length !== report.citations.length
  ) {
    throw new Error('Translation JSON did not match the source report shape.')
  }

  const transKeys = new Set(translated.buckets.map((b) => String(b.key).trim()))
  for (const b of report.buckets) {
    if (!transKeys.has(String(b.key).trim())) {
      throw new Error(`Translation missing bucket key ${b.key}`)
    }
  }
  if (transKeys.size !== report.buckets.length) {
    throw new Error('Translation bucket keys are not a 1:1 match with the source report.')
  }
}
