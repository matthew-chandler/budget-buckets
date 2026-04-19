import { randomUUID } from 'node:crypto'

const stateEntries = [
  ['AL', 'Alabama'],
  ['AK', 'Alaska'],
  ['AZ', 'Arizona'],
  ['AR', 'Arkansas'],
  ['CA', 'California'],
  ['CO', 'Colorado'],
  ['CT', 'Connecticut'],
  ['DE', 'Delaware'],
  ['FL', 'Florida'],
  ['GA', 'Georgia'],
  ['HI', 'Hawaii'],
  ['ID', 'Idaho'],
  ['IL', 'Illinois'],
  ['IN', 'Indiana'],
  ['IA', 'Iowa'],
  ['KS', 'Kansas'],
  ['KY', 'Kentucky'],
  ['LA', 'Louisiana'],
  ['ME', 'Maine'],
  ['MD', 'Maryland'],
  ['MA', 'Massachusetts'],
  ['MI', 'Michigan'],
  ['MN', 'Minnesota'],
  ['MS', 'Mississippi'],
  ['MO', 'Missouri'],
  ['MT', 'Montana'],
  ['NE', 'Nebraska'],
  ['NV', 'Nevada'],
  ['NH', 'New Hampshire'],
  ['NJ', 'New Jersey'],
  ['NM', 'New Mexico'],
  ['NY', 'New York'],
  ['NC', 'North Carolina'],
  ['ND', 'North Dakota'],
  ['OH', 'Ohio'],
  ['OK', 'Oklahoma'],
  ['OR', 'Oregon'],
  ['PA', 'Pennsylvania'],
  ['RI', 'Rhode Island'],
  ['SC', 'South Carolina'],
  ['SD', 'South Dakota'],
  ['TN', 'Tennessee'],
  ['TX', 'Texas'],
  ['UT', 'Utah'],
  ['VT', 'Vermont'],
  ['VA', 'Virginia'],
  ['WA', 'Washington'],
  ['WV', 'West Virginia'],
  ['WI', 'Wisconsin'],
  ['WY', 'Wyoming'],
  ['DC', 'District of Columbia'],
] as const

const stateMap = new Map<string, string>()

for (const [code, name] of stateEntries) {
  stateMap.set(code.toLowerCase(), code)
  stateMap.set(name.toLowerCase(), code)
}

export function createId(prefix: string): string {
  return `${prefix}_${randomUUID()}`
}

export function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function normalizeCity(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase())
}

export function normalizeState(value: string): string {
  const trimmed = value.trim().toLowerCase()
  const match = stateMap.get(trimmed)

  if (!match) {
    throw new Error(`"${value}" is not a supported U.S. state input. Use a state name or abbreviation.`)
  }

  return match
}

export function parseOptionalNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string') {
    const normalized = value.replace(/[$,%\s,]/g, '')
    const parsed = Number(normalized)
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

export function parseFiscalYearSort(label: string | null | undefined): number | null {
  if (!label) {
    return null
  }

  const match = label.match(/(19|20)\d{2}/)
  return match ? Number(match[0]) : null
}

export function tryParseJson<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T
  } catch {
    return null
  }
}

export function extractJsonObject<T>(value: string): T {
  const direct = tryParseJson<T>(value)

  if (direct) {
    return direct
  }

  const fenced = value.match(/```(?:json)?\s*([\s\S]+?)```/i)
  if (fenced?.[1]) {
    const parsed = tryParseJson<T>(fenced[1].trim())
    if (parsed) {
      return parsed
    }
  }

  const start = value.indexOf('{')
  const end = value.lastIndexOf('}')

  if (start !== -1 && end !== -1 && end > start) {
    const parsed = tryParseJson<T>(value.slice(start, end + 1))
    if (parsed) {
      return parsed
    }
  }

  throw new Error('The Pi agent did not return valid JSON.')
}

export function formatDisplayName(city: string, state: string): string {
  return `${city}, ${state}`
}
