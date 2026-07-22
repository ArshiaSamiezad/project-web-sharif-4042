import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useI18n } from '../i18n/I18nProvider'
import './SettingsPage.css'

export default function PaymentPage() {
  const { currentUser } = useAuth()
  const { t, subscriptionLabel } = useI18n()

  return (
    <div className="settings">
      <header className="settings__header">
        <div>
          <h1>{t('payment.title')}</h1>
          <p>{t('payment.subtitle')}</p>
        </div>
      </header>

      <section className="settings__card">
        <div className="settings__card-head">
          <h2>{t('payment.currentPlan')}</h2>
          <span className={`settings__plan settings__plan--${currentUser.subscription || 'basic'}`}>
            {subscriptionLabel(currentUser.subscription)}
          </span>
        </div>
        <p className="settings__hint">{t('payment.phase2Hint')}</p>
        <div className="settings__form-actions">
          <Link to="/settings" className="settings__btn settings__btn--ghost">
            {t('payment.backToSettings')}
          </Link>
        </div>
      </section>
    </div>
  )
}
