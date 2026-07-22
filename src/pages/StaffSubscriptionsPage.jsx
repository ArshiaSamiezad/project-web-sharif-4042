import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useI18n } from '../i18n/I18nProvider'
import './StaffPages.css'

const COLORS = {
  basic: '#939597',
  silver: '#c0c5ce',
  gold: '#f5d76e',
}

function polarToCartesian(cx, cy, r, angleDeg) {
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

function describeSlice(cx, cy, r, startAngle, endAngle) {
  const start = polarToCartesian(cx, cy, r, endAngle)
  const end = polarToCartesian(cx, cy, r, startAngle)
  const largeArc = endAngle - startAngle <= 180 ? 0 : 1
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y} Z`
}

function SubscriptionPie({ counts, labels }) {
  const total = counts.basic + counts.silver + counts.gold
  if (total === 0) {
    return (
      <svg className="staff__pie" viewBox="0 0 120 120" aria-hidden="true">
        <circle cx="60" cy="60" r="48" fill="var(--color-stroke)" />
      </svg>
    )
  }

  const slices = [
    { key: 'basic', value: counts.basic, color: COLORS.basic, label: labels.basic },
    { key: 'silver', value: counts.silver, color: COLORS.silver, label: labels.silver },
    { key: 'gold', value: counts.gold, color: COLORS.gold, label: labels.gold },
  ].filter((s) => s.value > 0)

  let angle = 0
  const paths = slices.map((slice) => {
    const sweep = (slice.value / total) * 360
    const start = angle
    const end = angle + sweep
    angle = end
    if (sweep >= 359.9) {
      return (
        <circle key={slice.key} cx="60" cy="60" r="48" fill={slice.color} />
      )
    }
    return (
      <path
        key={slice.key}
        d={describeSlice(60, 60, 48, start, end)}
        fill={slice.color}
      />
    )
  })

  return (
    <svg className="staff__pie" viewBox="0 0 120 120" role="img" aria-label={labels.title}>
      {paths}
      <circle cx="60" cy="60" r="22" fill="var(--color-surface)" />
    </svg>
  )
}

export default function StaffSubscriptionsPage() {
  const {
    isAdmin,
    isStaff,
    getSubscriptionStats,
    getSubscriptionPrices,
    updateSubscriptionPrices,
  } = useAuth()
  const { t, formatNumber } = useI18n()

  const prices = getSubscriptionPrices()
  const stats = getSubscriptionStats()

  const [silver, setSilver] = useState(String(prices.silver))
  const [gold, setGold] = useState(String(prices.gold))
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  if (!isStaff()) {
    return <Navigate to="/home" replace />
  }
  if (!isAdmin()) {
    return <Navigate to="/staff/inbox" replace />
  }

  function handleUpdate(event) {
    event.preventDefault()
    setError('')
    const result = updateSubscriptionPrices({ silver, gold })
    if (!result.ok) {
      setError(result.error)
      return
    }
    setSilver(String(result.prices.silver))
    setGold(String(result.prices.gold))
    setNotice(t('staff.pricesUpdated'))
  }

  const labels = {
    title: t('staff.pieTitle'),
    basic: t('staff.usersBasic'),
    silver: t('staff.usersSilver'),
    gold: t('staff.usersGold'),
  }

  return (
    <div className="staff">
      <header className="staff__header">
        <h1>{t('staff.subscriptionsTitle')}</h1>
        <p>{t('staff.subscriptionsSubtitle')}</p>
      </header>

      {notice ? <p className="staff__ok">{notice}</p> : null}
      {error ? <p className="staff__error">{error}</p> : null}

      <section className="staff__panel">
        <h2>{t('staff.pricePanel')}</h2>
        <form className="staff__form-grid" onSubmit={handleUpdate} noValidate>
          <label>
            <span>{t('staff.priceSilver')}</span>
            <input
              type="number"
              min="0"
              step="1000"
              value={silver}
              onChange={(e) => setSilver(e.target.value)}
              dir="ltr"
            />
          </label>
          <label>
            <span>{t('staff.priceGold')}</span>
            <input
              type="number"
              min="0"
              step="1000"
              value={gold}
              onChange={(e) => setGold(e.target.value)}
              dir="ltr"
            />
          </label>
          <div className="staff__actions" style={{ gridColumn: '1 / -1' }}>
            <button type="submit" className="staff__btn staff__btn--primary">
              {t('staff.updatePrices')}
            </button>
          </div>
        </form>
      </section>

      <section className="staff__panel">
        <h2>{t('staff.chartsTitle')}</h2>
        <div className="staff__charts">
          <div className="staff__pie-wrap">
            <h3>{t('staff.pieTitle')}</h3>
            <SubscriptionPie counts={stats.counts} labels={labels} />
            <ul className="staff__legend">
              <li>
                <span>
                  <i className="staff__swatch" style={{ background: COLORS.basic }} />
                  {t('staff.usersBasic')}
                </span>
                <strong>{formatNumber(stats.counts.basic)}</strong>
              </li>
              <li>
                <span>
                  <i className="staff__swatch" style={{ background: COLORS.silver }} />
                  {t('staff.usersSilver')}
                </span>
                <strong>{formatNumber(stats.counts.silver)}</strong>
              </li>
              <li>
                <span>
                  <i className="staff__swatch" style={{ background: COLORS.gold }} />
                  {t('staff.usersGold')}
                </span>
                <strong>{formatNumber(stats.counts.gold)}</strong>
              </li>
              <li>
                <span>{t('staff.totalUsers')}</span>
                <strong>{formatNumber(stats.totalUsers)}</strong>
              </li>
            </ul>
          </div>

          <div className="staff__revenue-card">
            <span>{t('staff.revenueCard')}</span>
            <strong>{formatNumber(stats.monthlyRevenue)}</strong>
            <span>{t('staff.revenueHint')}</span>
            <div className="staff__stats" style={{ marginTop: '0.75rem' }}>
              <div>
                <strong>{formatNumber(stats.prices.silver)}</strong>
                <span>{t('payment.silverPrice')}</span>
              </div>
              <div>
                <strong>{formatNumber(stats.prices.gold)}</strong>
                <span>{t('payment.goldPrice')}</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
