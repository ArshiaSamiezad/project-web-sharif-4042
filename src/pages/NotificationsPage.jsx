import { Link } from 'react-router-dom'
import { getUserSettings, useAuth } from '../context/AuthContext'
import { useI18n } from '../i18n/I18nProvider'
import './NotificationsPage.css'

const TYPE_KEYS = {
  subscription_expiry: 'subscriptionExpiry',
  new_release: 'newRelease',
  artist_approved: 'artistApproved',
  artist_rejected: 'artistRejected',
  monthly_finance: 'monthlyFinance',
  new_ticket: 'newTicket',
  artist_verification: 'artistVerification',
}

function formatNotificationDate(iso, language) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString(language === 'en' ? 'en-US' : 'fa-IR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function formatFinanceMonth(params, language) {
  const year = Number(params?.year)
  const month = Number(params?.month)
  if (!year || !month) return ''
  return new Date(year, month - 1, 1).toLocaleDateString(
    language === 'en' ? 'en-US' : 'fa-IR',
    { month: 'long', year: 'numeric' },
  )
}

function buildCopy(notification, { t, formatNumber, language, subscriptionLabel }) {
  const typeKey = TYPE_KEYS[notification.type] || notification.type
  const params = notification.params || {}
  const base = {
    ...params,
    days: params.days != null ? formatNumber(params.days) : undefined,
    amount: params.amount != null ? formatNumber(params.amount) : undefined,
    plan: params.plan ? subscriptionLabel(params.plan) : undefined,
  }

  if (notification.type === 'artist_rejected') {
    base.reason = language === 'en' ? params.reasonEn || params.reasonFa : params.reasonFa || params.reasonEn
  }

  if (notification.type === 'monthly_finance') {
    base.month = formatFinanceMonth(params, language)
  }

  return {
    title: t(`notifications.types.${typeKey}.title`),
    body: t(`notifications.types.${typeKey}.body`, base),
  }
}

export default function NotificationsPage() {
  const {
    currentUser,
    getNotifications,
    markNotificationRead,
    markAllNotificationsRead,
    deleteNotification,
  } = useAuth()
  const { t, formatNumber, language, subscriptionLabel } = useI18n()

  const preference = getUserSettings(currentUser).notifications
  const items = getNotifications()
  const unread = items.filter((n) => !n.read)
  const read = items.filter((n) => n.read)
  const hasUnread = unread.length > 0

  function handleMarkRead(id) {
    markNotificationRead(id)
  }

  function handleMarkAll() {
    markAllNotificationsRead()
  }

  function handleDelete(id) {
    deleteNotification(id)
  }

  function renderCard(notification) {
    const copy = buildCopy(notification, { t, formatNumber, language, subscriptionLabel })
    const isUnread = !notification.read

    return (
      <article
        key={notification.id}
        className={`notifications__card${isUnread ? ' is-unread' : ''}`}
      >
        <div className="notifications__card-main">
          {isUnread ? <span className="notifications__dot" aria-hidden="true" /> : null}
          <div className="notifications__card-body">
            <div className="notifications__card-top">
              <h3>{copy.title}</h3>
              <time dateTime={notification.createdAt}>
                {formatNotificationDate(notification.createdAt, language)}
              </time>
            </div>
            <p>{copy.body}</p>
            {notification.link ? (
              <Link
                to={notification.link}
                className="notifications__link"
                onClick={() => {
                  if (isUnread) markNotificationRead(notification.id)
                }}
              >
                {t('notifications.openLink')}
              </Link>
            ) : null}
          </div>
        </div>

        <div className="notifications__card-actions">
          {isUnread ? (
            <button
              type="button"
              className="notifications__btn"
              onClick={() => handleMarkRead(notification.id)}
            >
              {t('notifications.markRead')}
            </button>
          ) : null}
          <button
            type="button"
            className="notifications__btn notifications__btn--danger"
            onClick={() => handleDelete(notification.id)}
          >
            {t('notifications.delete')}
          </button>
        </div>
      </article>
    )
  }

  return (
    <div className="notifications">
      <header className="notifications__header">
        <div>
          <h1>{t('notifications.title')}</h1>
          <p>{t('notifications.subtitle')}</p>
        </div>
        {hasUnread ? (
          <button
            type="button"
            className="notifications__btn notifications__btn--primary"
            onClick={handleMarkAll}
          >
            {t('notifications.markAllRead')}
          </button>
        ) : null}
      </header>

      {items.length === 0 ? (
        <div className="notifications__empty">
          <div className="notifications__empty-art" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <h2>{t('notifications.emptyTitle')}</h2>
          <p>
            {preference === 'none' || preference === 'important'
              ? t('notifications.emptyFiltered')
              : t('notifications.emptyBody')}
          </p>
          {preference === 'none' || preference === 'important' ? (
            <Link to="/settings" className="notifications__btn notifications__btn--primary">
              {t('nav.settings')}
            </Link>
          ) : null}
        </div>
      ) : (
        <div className="notifications__panel">
          {unread.length > 0 ? (
            <section className="notifications__section" aria-label={t('notifications.unreadSection')}>
              <div className="notifications__section-head">
                <h2>{t('notifications.unreadSection')}</h2>
                <span>{t('notifications.unreadBadge', { count: formatNumber(unread.length) })}</span>
              </div>
              <div className="notifications__list">{unread.map(renderCard)}</div>
            </section>
          ) : null}

          {read.length > 0 ? (
            <section className="notifications__section" aria-label={t('notifications.readSection')}>
              <div className="notifications__section-head">
                <h2>{t('notifications.readSection')}</h2>
              </div>
              <div className="notifications__list">{read.map(renderCard)}</div>
            </section>
          ) : null}
        </div>
      )}
    </div>
  )
}
