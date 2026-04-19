import type { BudgetReport } from './types'
import { formatPercent } from './format'
import { formatFiscalYearDisplay } from './fiscal-year'

function escapeCsvCell(v: string): string {
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`
  return v
}

export function reportToCsvRows(report: BudgetReport): string {
  const lines: string[] = []
  lines.push(['Key', 'Value'].map(escapeCsvCell).join(','))
  for (const [k, v] of [
    ['City', report.city],
    ['State', report.state],
    ['Fiscal year (raw)', report.fiscalYearLabel],
    ['Fiscal year (display)', formatFiscalYearDisplay(report.fiscalYearLabel)],
    ['Total budget USD', report.totalBudget?.toString() ?? ''],
    ['Population', report.population?.toString() ?? ''],
    ['Report ID', report.id],
  ] as const) {
    lines.push([k, v].map(escapeCsvCell).join(','))
  }
  lines.push('')
  lines.push(['Bucket', 'Amount USD', 'Share of total', 'Source page'].map(escapeCsvCell).join(','))
  for (const b of report.buckets) {
    lines.push(
      [
        b.label,
        b.amount?.toString() ?? '',
        b.share != null ? (b.share * 100).toFixed(2) + '%' : '',
        b.citationPage != null ? String(b.citationPage) : '',
      ]
        .map(escapeCsvCell)
        .join(','),
    )
  }
  return lines.join('\n')
}

export function compareToCsv(primary: BudgetReport, secondary: BudgetReport): string {
  const lines: string[] = []
  lines.push(
    [
      'Bucket',
      `${primary.displayName} (${formatFiscalYearDisplay(primary.fiscalYearLabel)})`,
      'Share',
      `${secondary.displayName} (${formatFiscalYearDisplay(secondary.fiscalYearLabel)})`,
      'Share',
    ]
      .map(escapeCsvCell)
      .join(','),
  )
  for (const b of primary.buckets) {
    const o = secondary.buckets.find((x) => x.key === b.key)
    lines.push(
      [
        b.label,
        b.amount?.toString() ?? '',
        b.share != null ? formatPercent(b.share) : '',
        o?.amount?.toString() ?? '',
        o?.share != null ? formatPercent(o.share) : '',
      ]
        .map(escapeCsvCell)
        .join(','),
    )
  }
  return lines.join('\n')
}

export function downloadTextFile(filename: string, content: string, mime = 'text/csv;charset=utf-8') {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
