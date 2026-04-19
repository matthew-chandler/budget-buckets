import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  formatCurrency as formatCurrencyBase,
  formatDate as formatDateBase,
  formatNumber as formatNumberBase,
  formatPercent as formatPercentBase,
} from '../lib/format'
import { ALL_STRINGS, formatStr, type UIStringKey } from './strings'
import { INTL_LOCALE, LOCALE_STORAGE_KEY, type AppLocale } from './types'

interface I18nContextValue {
  locale: AppLocale
  setLocale: (locale: AppLocale) => void
  intlLocale: string
  t: (key: UIStringKey) => string
  formatMessage: (key: UIStringKey, vars: Record<string, string | number>) => string
  formatCurrency: (amount: number | null, compact?: boolean) => string
  formatPercent: (value: number | null) => string
  formatNumber: (value: number | null) => string
  formatDate: (iso: string) => string
}

const I18nContext = createContext<I18nContextValue | null>(null)

function readStoredLocale(): AppLocale {
  try {
    const raw = localStorage.getItem(LOCALE_STORAGE_KEY)
    if (raw === 'en' || raw === 'es' || raw === 'zh') return raw
  } catch {
    /* ignore */
  }
  return 'en'
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<AppLocale>(() => readStoredLocale())

  const intlLocale = INTL_LOCALE[locale]

  const setLocale = useCallback((next: AppLocale) => {
    setLocaleState(next)
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, next)
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    document.documentElement.lang = intlLocale
  }, [intlLocale])

  const t = useCallback(
    (key: UIStringKey) => {
      return ALL_STRINGS[locale][key]
    },
    [locale],
  )

  const formatMessage = useCallback(
    (key: UIStringKey, vars: Record<string, string | number>) => {
      return formatStr(t(key), vars)
    },
    [t],
  )

  const formatCurrency = useCallback(
    (amount: number | null, compact = false) => formatCurrencyBase(amount, compact, intlLocale),
    [intlLocale],
  )

  const formatPercent = useCallback(
    (value: number | null) => formatPercentBase(value, intlLocale),
    [intlLocale],
  )

  const formatNumber = useCallback(
    (value: number | null) => formatNumberBase(value, intlLocale),
    [intlLocale],
  )

  const formatDate = useCallback(
    (iso: string) => formatDateBase(iso, intlLocale),
    [intlLocale],
  )

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      intlLocale,
      t,
      formatMessage,
      formatCurrency,
      formatPercent,
      formatNumber,
      formatDate,
    }),
    [
      locale,
      setLocale,
      intlLocale,
      t,
      formatMessage,
      formatCurrency,
      formatPercent,
      formatNumber,
      formatDate,
    ],
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext)
  if (!ctx) {
    throw new Error('useI18n must be used within I18nProvider')
  }
  return ctx
}
