/**
 * Display fiscal years in a consistent style (e.g. FY 2025–26).
 */
export function formatFiscalYearDisplay(label: string): string {
  const raw = label.trim()
  if (!raw) return '—'

  const t = raw.replace(/^FY\s+/i, '').trim()
  const m = t.match(/^(\d{4})\s*[-–/]\s*(\d{2,4})$/)
  if (!m) {
    return /^FY\s+/i.test(label.trim()) ? label.trim() : `FY ${t}`
  }

  const y1 = m[1]
  let y2 = m[2]
  if (y2.length === 4) y2 = y2.slice(2)
  return `FY ${y1}–${y2.padStart(2, '0')}`
}
