import { useI18n } from '../i18n/I18nProvider'
import { LOCALE_LABELS, type AppLocale } from '../i18n/types'

function formatToday(locale: string): string {
  return new Date().toLocaleDateString(locale, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

const LOCALE_OPTIONS: AppLocale[] = ['en', 'es', 'zh']

export function Masthead() {
  const { locale, setLocale, intlLocale, t } = useI18n()
  const today = formatToday(intlLocale)
  const issue = t('mastheadIssue')

  return (
    <header className="masthead">
      <div className="masthead__inner">
        <div className="masthead__mark">
          <span className="masthead__mark-logo" aria-hidden />
          <span className="masthead__mark-title">{t('mastheadTitle')}</span>
        </div>
        <div className="masthead__tag">{t('mastheadTag')}</div>
        <div className="masthead__meta">
          <select
            className="masthead__lang-select"
            value={locale}
            onChange={(e) => setLocale(e.target.value as AppLocale)}
            aria-label={t('mastheadLangAria')}
          >
            {LOCALE_OPTIONS.map((code) => (
              <option key={code} value={code}>
                {LOCALE_LABELS[code]}
              </option>
            ))}
          </select>
          <span>{issue}</span>
          <span aria-label={t('mastheadTodayAria')}>{today}</span>
        </div>
      </div>
    </header>
  )
}
