function titleCaseWords(s: string): string {
  if (!s) return ''
  return s
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

/**
 * Best-effort city / state / fiscal year hints from common municipal PDF filenames.
 */
export function hintsFromPdfFilename(name: string): {
  city: string
  state: string
  fiscalYear: string
} {
  const base = name.replace(/\.pdf$/i, '').replace(/_/g, ' ')
  let city = ''
  let state = ''
  let fiscalYear = ''

  const fy =
    base.match(
      /(?:FY|FISCAL\s+YEAR)\s*(\d{4})\s*[-–/]\s*(\d{2,4})/i,
    ) || base.match(/\b(20\d{2})\s*[-–/]\s*(20\d{2}|\d{2})\b/i)

  if (fy) {
    const a = fy[1]
    let b = fy[2]
    if (b.length === 2) b = `${a.slice(0, 2)}${b}`
    fiscalYear = `${a}-${b.slice(2)}`
  }

  const cityOf = base.match(
    /CITY\s+OF\s+([A-Za-z][A-Za-z\s]+?)(?=\s+(?:FISCAL|FY|ADOPTED|BUDGET|\d{4})|$)/i,
  )
  if (cityOf) {
    city = titleCaseWords(cityOf[1].trim().replace(/\s+/g, ' '))
  }

  const townOf = base.match(
    /TOWN\s+OF\s+([A-Za-z][A-Za-z\s]+?)(?=\s+(?:FISCAL|FY|ADOPTED|BUDGET|\d{4})|$)/i,
  )
  if (townOf && !city) {
    city = titleCaseWords(townOf[1].trim().replace(/\s+/g, ' '))
  }

  const ca = /\bCA\b|CALIFORNIA/i.test(base)
  if (ca) state = 'CA'

  return { city, state, fiscalYear }
}
