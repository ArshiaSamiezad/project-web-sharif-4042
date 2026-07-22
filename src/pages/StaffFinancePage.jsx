import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useI18n } from '../i18n/I18nProvider'
import './StaffPages.css'

export default function StaffFinancePage() {
  const { isAdmin, isStaff, getPayouts, settlePayout } = useAuth()
  const { t, formatNumber, language } = useI18n()
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  if (!isStaff()) {
    return <Navigate to="/home" replace />
  }
  if (!isAdmin()) {
    return <Navigate to="/staff/inbox" replace />
  }

  const payouts = getPayouts()
  const admin = isAdmin()

  function formatMonth(month) {
    const [year, mon] = String(month || '').split('-')
    if (!year || !mon) return month
    try {
      return new Date(Number(year), Number(mon) - 1, 1).toLocaleDateString(
        language === 'en' ? 'en-US' : 'fa-IR',
        { year: 'numeric', month: 'long' },
      )
    } catch {
      return month
    }
  }

  function handleSettle(payoutId) {
    setError('')
    const result = settlePayout(payoutId)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setNotice(t('staff.settleOk'))
  }

  return (
    <div className="staff">
      <header className="staff__header">
        <h1>{t('staff.financeTitle')}</h1>
        <p>{t('staff.financeSubtitle')}</p>
      </header>

      {!admin ? <p className="staff__hint">{t('staff.adminOnlyHint')}</p> : null}
      {notice ? <p className="staff__ok">{notice}</p> : null}
      {error ? <p className="staff__error">{error}</p> : null}

      {payouts.length === 0 ? (
        <div className="staff__empty">{t('staff.noPayouts')}</div>
      ) : (
        <div className="staff__table-wrap">
          <table className="staff__table staff__table--static">
            <thead>
              <tr>
                <th>{t('staff.artistName')}</th>
                <th>{t('staff.artistCode')}</th>
                <th>{t('staff.month')}</th>
                <th>{t('staff.uniqueListeners')}</th>
                <th>{t('staff.streams')}</th>
                <th>{t('staff.reward')}</th>
                <th>{t('staff.paymentStatus')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {payouts.map((row) => (
                <tr key={row.id}>
                  <td>{row.artistName}</td>
                  <td dir="ltr">{row.artistCode}</td>
                  <td>{formatMonth(row.month)}</td>
                  <td>{formatNumber(row.uniqueListeners)}</td>
                  <td>{formatNumber(row.streams)}</td>
                  <td>{formatNumber(row.rewardAmount)}</td>
                  <td>
                    <span
                      className={
                        row.status === 'settled'
                          ? 'staff__badge staff__badge--settled'
                          : 'staff__badge staff__badge--pending'
                      }
                    >
                      {row.status === 'settled'
                        ? t('staff.settled')
                        : t('staff.pendingPayment')}
                    </span>
                  </td>
                  <td>
                    {row.status === 'pending' ? (
                      <button
                        type="button"
                        className="staff__btn staff__btn--primary"
                        disabled={!admin}
                        title={!admin ? t('staff.adminOnlyHint') : undefined}
                        onClick={() => handleSettle(row.id)}
                      >
                        {t('staff.settle')}
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
