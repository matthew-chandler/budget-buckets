import { useI18n } from '../i18n/I18nProvider'
import { SectionHeading } from './SectionHeading'

export function PrivacySection() {
  const { t } = useI18n()

  return (
    <section id="privacy" className="section privacy-section" aria-label={t('privacyTitle')}>
      <SectionHeading
        num="06"
        eyebrow={t('privacyEyebrow')}
        title={t('privacyTitle')}
      />
      <div className="privacy-prose">
        <p className="privacy-meta">{t('privacyUpdated')}</p>
        <p className="privacy-lede">{t('privacyIntro')}</p>

        <h3>{t('privacyCollectTitle')}</h3>
        <p>{t('privacyCollectBody')}</p>

        <h3>{t('privacyUseTitle')}</h3>
        <p>{t('privacyUseBody')}</p>

        <h3>{t('privacyAgentsTitle')}</h3>
        <p>{t('privacyAgentsBody')}</p>

        <h3>{t('privacyCookiesTitle')}</h3>
        <p>{t('privacyCookiesBody')}</p>

        <h3>{t('privacyRetentionTitle')}</h3>
        <p>{t('privacyRetentionBody')}</p>

        <h3>{t('privacyChildrenTitle')}</h3>
        <p>{t('privacyChildrenBody')}</p>

        <h3>{t('privacyChangesTitle')}</h3>
        <p>{t('privacyChangesBody')}</p>
      </div>
    </section>
  )
}
