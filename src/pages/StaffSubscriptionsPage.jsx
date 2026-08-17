import { useEffect, useState } from 'react'
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
  const { isAdmin, isStaff, getSubscriptionReportsOverview } = useAuth()
  const { t, formatNumber } = useI18n()

  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const staff = isStaff()
  const admin = isAdmin()

  useEffect(() => {
    if (!admin) {
      setLoading(false)
      return
    }
    let cancelled = false
    async function load() {
      setLoading(true)
      setError('')
      try {
        const data = await getSubscriptionReportsOverview()
        if (!cancelled) setReport(data)
      } catch (err) {
        if (!cancelled) {
          setError(err.status === 403 ? t('staff.accessDenied') : t('staff.reportLoadError'))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [admin])

  if (!staff) {
    return <Navigate to="/home" replace />
  }
  if (!admin) {
    return <Navigate to="/staff/inbox" replace />
  }

  const labels = {
    title: t('staff.pieTitle'),
    basic: t('staff.usersBasic'),
    silver: t('staff.usersSilver'),
    gold: t('staff.usersGold'),
  }

  const dist = report?.planDistribution
  const counts = {
    basic: dist?.basicUsers ?? 0,
    silver: dist?.silverUsers ?? 0,
    gold: dist?.goldUsers ?? 0,
  }
  const finance = report?.finance
  const subs = report?.subscriptions

  return (
    <div className="staff">
      <header className="staff__header">
        <h1>{t('staff.subscriptionsTitle')}</h1>
        <p>{t('staff.subscriptionsSubtitle')}</p>
      </header>

      {error ? <p className="staff__error">{error}</p> : null}

      {loading ? null : report ? (
        <>
          <section className="staff__panel">
            <h2>{t('staff.chartsTitle')}</h2>
            <div className="staff__charts">
              <div className="staff__pie-wrap">
                <h3>{t('staff.pieTitle')}</h3>
                <SubscriptionPie counts={counts} labels={labels} />
                <ul className="staff__legend">
                  <li>
                    <span>
                      <i className="staff__swatch" style={{ background: COLORS.basic }} />
                      {t('staff.usersBasic')}
                    </span>
                    <strong>{formatNumber(counts.basic)}</strong>
                  </li>
                  <li>
                    <span>
                      <i className="staff__swatch" style={{ background: COLORS.silver }} />
                      {t('staff.usersSilver')}
                    </span>
                    <strong>{formatNumber(counts.silver)}</strong>
                  </li>
                  <li>
                    <span>
                      <i className="staff__swatch" style={{ background: COLORS.gold }} />
                      {t('staff.usersGold')}
                    </span>
                    <strong>{formatNumber(counts.gold)}</strong>
                  </li>
                  <li>
                    <span>{t('staff.totalUsers')}</span>
                    <strong>{formatNumber(dist?.totalUsers ?? 0)}</strong>
                  </li>
                </ul>
              </div>

              <div className="staff__revenue-card">
                <span>{t('staff.revenueCard')}</span>
                <strong>{formatNumber(finance?.totalRevenue ?? 0)}</strong>
                <span>{t('staff.revenueHint')}</span>
                <div className="staff__stats" style={{ marginTop: '0.75rem' }}>
                  <div>
                    <strong>{formatNumber(finance?.successfulTransactionCount ?? 0)}</strong>
                    <span>{t('staff.successfulTx')}</span>
                  </div>
                  <div>
                    <strong>{formatNumber(finance?.pendingTransactionCount ?? 0)}</strong>
                    <span>{t('staff.pendingTx')}</span>
                  </div>
                  <div>
                    <strong>{formatNumber(finance?.failedTransactionCount ?? 0)}</strong>
                    <span>{t('staff.failedTx')}</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="staff__panel">
            <h2>{t('staff.revenueByPlanTitle')}</h2>
            {finance?.revenueByPlan?.length ? (
              <div className="staff__table-wrap">
                <table className="staff__table staff__table--static">
                  <thead>
                    <tr>
                      <th>{t('staff.tier')}</th>
                      <th>{t('staff.amount')}</th>
                      <th>{t('staff.successfulTx')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {finance.revenueByPlan.map((row) => (
                      <tr key={row.tier}>
                        <td>{row.tier}</td>
                        <td>{formatNumber(row.revenue)}</td>
                        <td>{formatNumber(row.count)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="staff__empty">{t('staff.noTransactions')}</div>
            )}
          </section>

          <section className="staff__panel">
            <h2>{t('staff.recentTransactionsTitle')}</h2>
            {finance?.recentTransactions?.length ? (
              <div className="staff__table-wrap">
                <table className="staff__table staff__table--static">
                  <thead>
                    <tr>
                      <th>{t('staff.tier')}</th>
                      <th>{t('staff.duration')}</th>
                      <th>{t('staff.amount')}</th>
                      <th>{t('staff.status')}</th>
                      <th>{t('staff.createdAt')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {finance.recentTransactions.map((txn) => (
                      <tr key={txn.transactionId}>
                        <td>{txn.planTierSnapshot}</td>
                        <td>{txn.durationMonths}</td>
                        <td>{formatNumber(txn.amount)}</td>
                        <td>{txn.status}</td>
                        <td dir="ltr">{new Date(txn.createdAt).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="staff__empty">{t('staff.noTransactions')}</div>
            )}
          </section>

          <section className="staff__panel">
            <h2>{t('staff.recentSubscriptionsTitle')}</h2>
            <p className="staff__hint">
              {t('staff.totalRecords')}: {formatNumber(subs?.totalSubscriptionRecords ?? 0)}
              {' · '}
              {t('staff.activeEffective')}: {formatNumber(subs?.activeEffectiveSubscriptions ?? 0)}
              {' · '}
              {t('staff.futureScheduled')}: {formatNumber(subs?.futureScheduledSubscriptions ?? 0)}
            </p>
            {subs?.recentSubscriptions?.length ? (
              <div className="staff__table-wrap">
                <table className="staff__table staff__table--static">
                  <thead>
                    <tr>
                      <th>{t('staff.tier')}</th>
                      <th>{t('payment.colStart')}</th>
                      <th>{t('payment.colEnd')}</th>
                      <th>{t('staff.status')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subs.recentSubscriptions.map((sub) => (
                      <tr key={sub.id}>
                        <td>{sub.planTier}</td>
                        <td dir="ltr">{sub.startDate}</td>
                        <td dir="ltr">{sub.endDate}</td>
                        <td>{sub.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="staff__empty">{t('staff.noRecentSubscriptions')}</div>
            )}
          </section>

          <p className="staff__hint">{t('staff.pricesReadOnlyNote')}</p>
        </>
      ) : null}
    </div>
  )
}
