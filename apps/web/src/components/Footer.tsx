import { useI18n } from '../i18n/I18nProvider'

export function Footer() {
  const { t } = useI18n()

  return (
    <footer className="footer">
      <div className="footer__col">
        <div className="footer__mark">{t('footerMark')}</div>
        <p>{t('footerCol1')}</p>
        <p className="footer__legal">
          <a href="#privacy">{t('footerPrivacyLink')}</a>
        </p>
      </div>
      <div className="footer__col">
        <h4>{t('footerHowTitle')}</h4>
        <p>{t('footerHowBody')}</p>
      </div>
      <div className="footer__col">
        <h4>{t('footerTransparencyTitle')}</h4>
        <p>{t('footerTransparencyBody')}</p>
      </div>
    </footer>
  )
}
