import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useI18n } from '../i18n/I18nProvider'
import './StaffPages.css'

function formatBytes(size, formatNumber) {
  const n = Number(size) || 0
  if (n < 1024) return `${formatNumber(n)} B`
  if (n < 1024 * 1024) return `${formatNumber(Math.round(n / 1024))} KB`
  return `${formatNumber(Math.round(n / (1024 * 1024)))} MB`
}

function statusClass(status) {
  if (status === 'open') return 'staff__badge staff__badge--open'
  if (status === 'answered') return 'staff__badge staff__badge--answered'
  return 'staff__badge staff__badge--closed'
}

export default function StaffInboxPage() {
  const { getPendingArtists, getTickets } = useAuth()
  const { t, formatNumber, language } = useI18n()
  const navigate = useNavigate()
  const [tab, setTab] = useState('artists')

  const pending = getPendingArtists()
  const tickets = getTickets()

  function formatDate(value) {
    try {
      return new Date(value).toLocaleString(language === 'en' ? 'en-US' : 'fa-IR', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    } catch {
      return value
    }
  }

  function statusLabel(status) {
    if (status === 'open') return t('staff.statusOpen')
    if (status === 'answered') return t('staff.statusAnswered')
    return t('staff.statusClosed')
  }

  return (
    <div className="staff">
      <header className="staff__header">
        <h1>{t('staff.inboxTitle')}</h1>
        <p>{t('staff.inboxSubtitle')}</p>
      </header>

      <div className="staff__tabs" role="tablist" aria-label={t('staff.inboxTitle')}>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'artists'}
          className={`staff__tab${tab === 'artists' ? ' is-active' : ''}`}
          onClick={() => setTab('artists')}
        >
          {t('staff.tabArtists')}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'tickets'}
          className={`staff__tab${tab === 'tickets' ? ' is-active' : ''}`}
          onClick={() => setTab('tickets')}
        >
          {t('staff.tabTickets')}
        </button>
      </div>

      {tab === 'artists' ? (
        pending.length === 0 ? (
          <div className="staff__empty">{t('staff.noPendingArtists')}</div>
        ) : (
          <div className="staff__table-wrap">
            <table className="staff__table">
              <thead>
                <tr>
                  <th>{t('staff.artistName')}</th>
                  <th>{t('staff.email')}</th>
                  <th>{t('staff.samples')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {pending.map((artist) => (
                  <tr
                    key={artist.id}
                    onClick={() => navigate(`/staff/artists/${artist.id}`)}
                  >
                    <td>{artist.artistName || artist.displayName}</td>
                    <td dir="ltr">{artist.email}</td>
                    <td>{formatNumber((artist.samples || []).length)}</td>
                    <td>
                      <button
                        type="button"
                        className="staff__btn staff__btn--primary"
                        onClick={(event) => {
                          event.stopPropagation()
                          navigate(`/staff/artists/${artist.id}`)
                        }}
                      >
                        {t('staff.viewSamples')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : tickets.length === 0 ? (
        <div className="staff__empty">{t('staff.noTickets')}</div>
      ) : (
        <div className="staff__table-wrap">
          <table className="staff__table">
            <thead>
              <tr>
                <th>{t('staff.ticketId')}</th>
                <th>{t('staff.userName')}</th>
                <th>{t('staff.subject')}</th>
                <th>{t('staff.createdAt')}</th>
                <th>{t('staff.status')}</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((ticket) => (
                <tr
                  key={ticket.id}
                  onClick={() => navigate(`/staff/tickets/${ticket.id}`)}
                >
                  <td dir="ltr">{ticket.id}</td>
                  <td>{ticket.userName}</td>
                  <td>{ticket.subject}</td>
                  <td>{formatDate(ticket.createdAt)}</td>
                  <td>
                    <span className={statusClass(ticket.status)}>
                      {statusLabel(ticket.status)}
                    </span>
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

export { formatBytes }
