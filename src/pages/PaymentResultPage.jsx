import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useI18n } from '../i18n/I18nProvider'
import './SettingsPage.css'

// Reached only via the backend's gateway callback redirect
// (PAYMENT_CALLBACK_URL -> FRONTEND_PAYMENT_RESULT_URL). By the time this
// page loads, the backend has already independently verified the payment
// with the gateway server-side and — only on real success — activated the
// subscription. This page never activates or verifies anything itself; it
// only reads the outcome the backend already decided and refreshes local
// state to match it.
export default function PaymentResultPage() {
  const { refreshAfterPaymentResult } = useAuth()
  const { t } = useI18n()
  const [searchParams] = useSearchParams()
  const [refreshing, setRefreshing] = useState(true)
  const ranRef = useRef(false)

  const status = searchParams.get('status')
  const isSuccess = status === 'success'

  useEffect(() => {
    if (ranRef.current) return
    ranRef.current = true

    if (!isSuccess) {
      setRefreshing(false)
      return
    }
    let cancelled = false
    refreshAfterPaymentResult().finally(() => {
      if (!cancelled) setRefreshing(false)
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuccess])

  return (
    <div className="settings">
      <header className="settings__header">
        <div>
          <h1>{isSuccess ? t('payment.resultSuccessTitle') : t('payment.resultFailedTitle')}</h1>
        </div>
      </header>

      <section className="settings__card">
        {refreshing ? (
          <p className="settings__hint">{t('payment.resultProcessing')}</p>
        ) : (
          <>
            {isSuccess ? (
              <p className="settings__ok">{t('payment.resultSuccessBody')}</p>
            ) : (
              <p className="settings__error">{t('payment.resultFailedBody')}</p>
            )}
            <div className="settings__actions">
              <Link className="settings__btn" to={isSuccess ? '/home' : '/payment'}>
                {isSuccess ? t('payment.resultBackToApp') : t('payment.resultTryAgain')}
              </Link>
            </div>
          </>
        )}
      </section>
    </div>
  )
}
