export type AppLocale = 'en' | 'es' | 'zh'

export const LOCALE_STORAGE_KEY = 'budget-buckets-locale'

export const INTL_LOCALE: Record<AppLocale, string> = {
  en: 'en-US',
  es: 'es',
  zh: 'zh-CN',
}

export const LOCALE_LABELS: Record<AppLocale, string> = {
  en: 'English',
  es: 'Español',
  zh: '中文（普通话）',
}
