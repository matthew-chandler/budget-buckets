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
  aliases: string[]
}

export const bucketDefinitions: BucketDefinition[] = [
  {
    key: 'public-safety-justice',
    label: 'Public Safety & Justice',
    color: '#c65d3b',
    description:
      'Police, fire, EMS, courts, jails, emergency dispatch, and related safety services.',
    examples: [
      'Police and fire departments',
      'Emergency medical services',
      '911 dispatch',
      'Court systems',
      'Prisons',
      'Animal control',
    ],
    aliases: ['public safety', 'justice', 'safety'],
  },
  {
    key: 'public-works-infrastructure',
    label: 'Public Works & Infrastructure',
    color: '#3f7c85',
    description:
      'Streets, sanitation, utilities, lighting, wastewater, and other core infrastructure.',
    examples: [
      'Street repair and potholes',
      'Trash and recycling',
      'Water and wastewater',
      'Street lighting',
    ],
    aliases: ['public works', 'infrastructure', 'utilities'],
  },
  {
    key: 'community-recreation',
    label: 'Community & Recreation',
    color: '#7a9e48',
    description:
      'Parks, libraries, arts, recreation centers, youth development, and civic programming.',
    examples: [
      'Parks and recreation',
      'Public libraries',
      'Arts and cultural affairs',
      'Youth programs',
    ],
    aliases: ['community', 'recreation', 'parks', 'libraries'],
  },
  {
    key: 'health-human-services',
    label: 'Health & Human Services',
    color: '#6e5a8a',
    description:
      'Public health, housing support, homelessness programs, mental health, and family services.',
    examples: [
      'Public health initiatives',
      'Mental health and addiction services',
      'Homeless outreach',
      'Affordable housing',
      'Child welfare',
    ],
    aliases: ['health', 'human services', 'housing'],
  },
  {
    key: 'transportation',
    label: 'Transportation',
    color: '#4f6d7a',
    description:
      'Transit systems, traffic control, airports, harbors, bike lanes, and mobility projects.',
    examples: [
      'Public transit',
      'Bike lanes',
      'Traffic control',
      'Municipal airports or harbors',
    ],
    aliases: ['transit', 'mobility', 'traffic'],
  },
  {
    key: 'government-operations-administration',
    label: 'Government Operations & Administration',
    color: '#a76d60',
    description:
      'City administration, HR, IT, inspections, finance, tax collection, and elected office operations.',
    examples: [
      'Mayor and city council salaries',
      'Human resources',
      'IT infrastructure',
      'Building and safety inspections',
      'Finance and tax collection',
    ],
    aliases: ['administration', 'operations', 'general government'],
  },
  {
    key: 'pensions-debt',
    label: 'Pensions & Debt',
    color: '#5d6d5a',
    description:
      'Debt service, bond repayment, pension obligations, and other legacy liabilities.',
    examples: [
      'City loans and bonds',
      'Retirement benefits',
      'Pension contributions',
    ],
    aliases: ['debt', 'pensions', 'retirement'],
  },
  {
    key: 'economic-development',
    label: 'Economic Development',
    color: '#d08c3f',
    description:
      'Planning, zoning, workforce programs, tourism, and business growth initiatives.',
    examples: [
      'Small business grants',
      'Workforce training',
      'Tourism marketing',
      'City planning and zoning',
    ],
    aliases: ['economic development', 'planning', 'tourism'],
  },
  {
    key: 'miscellaneous',
    label: 'Miscellaneous',
    color: '#8e8f95',
    description:
      'Reserve funds, settlements, and unusual local categories that do not fit elsewhere.',
    examples: [
      'Emergency reserve funds',
      'Legal settlements',
      'Highly specific local expenditures',
    ],
    aliases: ['misc', 'other', 'reserves'],
  },
]

const bucketLookup = new Map<string, BucketKey>()

for (const bucket of bucketDefinitions) {
  bucketLookup.set(bucket.key, bucket.key)
  bucketLookup.set(bucket.label.toLowerCase(), bucket.key)

  for (const alias of bucket.aliases) {
    bucketLookup.set(alias.toLowerCase(), bucket.key)
  }
}

export function normalizeBucketKey(input: string | null | undefined): BucketKey | null {
  if (!input) {
    return null
  }

  const normalized = input
    .toLowerCase()
    .trim()
    .replace(/[&/]/g, ' ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return bucketLookup.get(normalized) ?? bucketLookup.get(input.toLowerCase().trim()) ?? null
}

export function getBucketDefinition(key: BucketKey): BucketDefinition {
  return bucketDefinitions.find((bucket) => bucket.key === key)!
}
