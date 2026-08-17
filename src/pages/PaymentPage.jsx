import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useI18n } from '../i18n/I18nProvider'
import './SettingsPage.css'

const DURATIONS = [1, 3, 6, 12]
const PRICE_FIELD_BY_DURATION = {
  1: 'price1Month',
  3: 'price3Months',
  6: 'price6Months',
  12: 'price12Months',
}

export default function PaymentPage() {
  const {
    currentSubscription,
    refreshCurrentSubscription,
    getSubscriptionPlans,
    getSubscriptionHistory,
    purchaseSubscription,
    verifySubscriptionTransaction,
  } = useAuth()
  const { t, formatNumber, subscriptionLabel } = useI18n()

  const [plans, setPlans] = useState([])
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [selectedDuration, setSelectedDuration] = useState({})
  const [purchasingPlanId, setPurchasingPlanId] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setLoadError('')
      try {
        const [planList, historyList] = await Promise.all([
          getSubscriptionPlans(),
          getSubscriptionHistory(),
        ])
        if (cancelled) return
        setPlans(planList || [])
        setHistory(historyList || [])
        await refreshCurrentSubscription()
      } catch {
        if (!cancelled) setLoadError(t('payment.loadError'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const statusLabel = {
    active: t('payment.statusActive'),
    expired: t('payment.statusExpired'),
    cancelled: t('payment.statusCancelled'),
  }

  function durationFor(planId) {
    return selectedDuration[planId] || 1
  }

  async function handlePurchase(plan) {
    if (purchasingPlanId) return
    setError('')
    setNotice('')
    setPurchasingPlanId(plan.id)
    try {
      const duration = durationFor(plan.id)
      const purchaseResult = await purchaseSubscription(plan.id, duration)
      if (!purchaseResult.ok) {
        setError(purchaseResult.error)
        return
      }
      // Development/mock provider only — see the disclosure rendered below.
      // Real money never moves; this immediately calls the existing verify
      // endpoint the same way a gateway callback would.
      const verifyResult = await verifySubscriptionTransaction(
        purchaseResult.transaction.transactionId,
      )
      if (!verifyResult.ok) {
        setError(verifyResult.error)
        return
      }
      setNotice(t('payment.purchaseSuccess'))
      setHistory((await getSubscriptionHistory()) || [])
    } catch (err) {
      setError(err.message || t('errors.purchaseFailed'))
    } finally {
      setPurchasingPlanId(null)
    }
  }

  return (
    <div className="settings">
      <header className="settings__header">
        <div>
          <h1>{t('payment.title')}</h1>
          <p>{t('payment.subtitle')}</p>
        </div>
      </header>

      {notice ? <p className="settings__ok">{notice}</p> : null}
      {error ? <p className="settings__error">{error}</p> : null}
      {loadError ? <p className="settings__error">{loadError}</p> : null}

      <section className="settings__card">
        <div className="settings__card-head">
          <h2>{t('payment.currentPlan')}</h2>
          {currentSubscription ? (
            <span className={`settings__plan settings__plan--${currentSubscription.tier}`}>
              {subscriptionLabel(currentSubscription.tier)}
            </span>
          ) : null}
        </div>
        {currentSubscription?.startDate && currentSubscription?.endDate ? (
          <p className="settings__hint" dir="ltr">
            {t('payment.periodLabel', {
              start: currentSubscription.startDate,
              end: currentSubscription.endDate,
            })}
            {' — '}
            {statusLabel[currentSubscription.status] || currentSubscription.status}
          </p>
        ) : (
          <p className="settings__hint">{t('payment.currentPlanNone')}</p>
        )}
      </section>

      {!loading && plans.length > 0 ? (
        <section className="settings__card">
          <div className="settings__card-head">
            <h2>{t('payment.plansTitle')}</h2>
          </div>
          <p className="settings__note">{t('payment.mockNotice')}</p>
          <div className="settings__stats" style={{ display: 'grid', gap: '1rem' }}>
            {plans.map((plan) => {
              const isCurrent = currentSubscription?.tier === plan.tier
              const isPurchasable = plan.tier !== 'basic'
              const duration = durationFor(plan.id)
              const price = plan[PRICE_FIELD_BY_DURATION[duration]]

              return (
                <div key={plan.id} className="settings__card" style={{ margin: 0 }}>
                  <div className="settings__card-head">
                    <h2>{plan.name}</h2>
                    {isCurrent ? (
                      <span className={`settings__plan settings__plan--${plan.tier}`}>
                        {t('payment.currentPlanBadge')}
                      </span>
                    ) : null}
                  </div>
                  <ul>
                    <li>
                      {plan.dailyStreamLimit == null
                        ? t('payment.featureUnlimitedStreams')
                        : t('payment.featureStreamLimit', {
                            limit: formatNumber(plan.dailyStreamLimit),
                          })}
                    </li>
                    <li>
                      {plan.playlistLimit == null
                        ? t('payment.featureUnlimitedPlaylists')
                        : t('payment.featurePlaylistLimit', {
                            limit: formatNumber(plan.playlistLimit),
                          })}
                    </li>
                    <li>
                      {plan.canDownload
                        ? t('payment.featureDownloadYes')
                        : t('payment.featureDownloadNo')}
                    </li>
                    <li>
                      {plan.canUploadProfilePhoto
                        ? t('payment.featureAvatarYes')
                        : t('payment.featureAvatarNo')}
                    </li>
                    <li>
                      {plan.hasEarlyAccess
                        ? t('payment.featureEarlyAccessYes')
                        : t('payment.featureEarlyAccessNo')}
                    </li>
                  </ul>

                  {isPurchasable ? (
                    <>
                      <label className="settings__field">
                        {t('payment.durationLabel')}
                        <select
                          value={duration}
                          onChange={(e) =>
                            setSelectedDuration((d) => ({
                              ...d,
                              [plan.id]: Number(e.target.value),
                            }))
                          }
                        >
                          {DURATIONS.map((months) => (
                            <option key={months} value={months}>
                              {t('payment.durationMonths', { count: months })}
                            </option>
                          ))}
                        </select>
                      </label>
                      <p className="settings__hint">
                        {t('payment.priceAmount', { amount: formatNumber(price) })}
                      </p>
                      <div className="settings__actions">
                        <button
                          type="button"
                          className="settings__btn"
                          disabled={purchasingPlanId === plan.id}
                          onClick={() => handlePurchase(plan)}
                        >
                          {purchasingPlanId === plan.id
                            ? t('payment.purchaseProcessing')
                            : t('payment.purchaseButton')}
                        </button>
                      </div>
                    </>
                  ) : null}
                </div>
              )
            })}
          </div>
        </section>
      ) : null}

      <section className="settings__card">
        <div className="settings__card-head">
          <h2>{t('payment.historyTitle')}</h2>
        </div>
        {history.length === 0 ? (
          <p className="settings__hint">{t('payment.historyEmpty')}</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th>{t('payment.colPlan')}</th>
                <th>{t('payment.colStart')}</th>
                <th>{t('payment.colEnd')}</th>
                <th>{t('payment.colStatus')}</th>
              </tr>
            </thead>
            <tbody>
              {history.map((item) => (
                <tr key={item.id}>
                  <td>{item.plan?.name || subscriptionLabel(item.planTier)}</td>
                  <td dir="ltr">{item.startDate}</td>
                  <td dir="ltr">{item.endDate}</td>
                  <td>{statusLabel[item.status] || item.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
