import type { BucketKey } from '../lib/types'
import type { AppLocale } from './types'

const labels: Record<BucketKey, Record<AppLocale, string>> = {
  'public-safety-justice': {
    en: 'Public Safety & Justice',
    es: 'Seguridad pública y justicia',
    zh: '公共安全与司法',
  },
  'public-works-infrastructure': {
    en: 'Public Works & Infrastructure',
    es: 'Obras públicas e infraestructura',
    zh: '公共工程与基础设施',
  },
  'community-recreation': {
    en: 'Community & Recreation',
    es: 'Comunidad y recreación',
    zh: '社区与文娱',
  },
  'health-human-services': {
    en: 'Health & Human Services',
    es: 'Salud y servicios humanos',
    zh: '卫生与人类服务',
  },
  transportation: {
    en: 'Transportation',
    es: 'Transporte',
    zh: '交通',
  },
  'government-operations-administration': {
    en: 'Government Operations & Administration',
    es: 'Operaciones y administración gubernamental',
    zh: '政府运作与行政',
  },
  'pensions-debt': {
    en: 'Pensions & Debt',
    es: 'Pensiones y deuda',
    zh: '养老金与债务',
  },
  'economic-development': {
    en: 'Economic Development',
    es: 'Desarrollo económico',
    zh: '经济发展',
  },
  miscellaneous: {
    en: 'Miscellaneous',
    es: 'Varios',
    zh: '其他',
  },
}

/** Short labels for donut leaders (narrow space). */
const shortLabels: Record<BucketKey, Record<AppLocale, string>> = {
  'public-safety-justice': {
    en: 'Public Safety',
    es: 'Seg. pública',
    zh: '公共安全',
  },
  'public-works-infrastructure': {
    en: 'Public Works',
    es: 'Obras púb.',
    zh: '公共工程',
  },
  'community-recreation': {
    en: 'Community & Rec.',
    es: 'Comunidad',
    zh: '社区文娱',
  },
  'health-human-services': {
    en: 'Health & Hum. Svc.',
    es: 'Salud',
    zh: '卫生服务',
  },
  transportation: {
    en: 'Transportation',
    es: 'Transporte',
    zh: '交通',
  },
  'government-operations-administration': {
    en: 'Gov. Operations',
    es: 'Gobierno',
    zh: '政府运作',
  },
  'pensions-debt': {
    en: 'Pensions & Debt',
    es: 'Pens. y deuda',
    zh: '养老金/债务',
  },
  'economic-development': {
    en: 'Econ. Development',
    es: 'Des. económico',
    zh: '经济发展',
  },
  miscellaneous: {
    en: 'Misc.',
    es: 'Varios',
    zh: '其他',
  },
}

export function bucketLabel(key: BucketKey, locale: AppLocale): string {
  return labels[key][locale]
}

export function bucketShortLabel(key: BucketKey, locale: AppLocale): string {
  return shortLabels[key][locale]
}

export function donutUnmappedLabel(locale: AppLocale): string {
  const m = {
    en: 'Unmapped / other funds',
    es: 'Sin mapear / otros fondos',
    zh: '未归类 / 其他资金',
  }
  return m[locale]
}

export function donutUnmappedShort(locale: AppLocale): string {
  const m = {
    en: 'Unmapped',
    es: 'Sin mapear',
    zh: '未归类',
  }
  return m[locale]
}
