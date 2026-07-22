import { useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useI18n } from '../i18n/I18nProvider'
import './StaffPages.css'

export default function StaffTicketDetailPage() {
  const { ticketId } = useParams()
  const navigate = useNavigate()
  const {
    currentUser,
    isStaff,
    getTicketById,
    replyToTicket,
    updateTicketStatus,
  } = useAuth()
  const { t, language } = useI18n()

  const [reply, setReply] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const ticket = getTicketById(ticketId)

  if (!isStaff()) {
    return <Navigate to="/home" replace />
  }
  if (!ticket) {
    return <Navigate to="/staff/inbox" replace />
  }

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

  function handleReply(event) {
    event.preventDefault()
    setError('')
    const result = replyToTicket(ticket.id, reply)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setReply('')
    setNotice(t('staff.sendReply'))
  }

  function handleToggleClose() {
    setError('')
    const next = ticket.status === 'closed' ? 'open' : 'closed'
    const result = updateTicketStatus(ticket.id, next)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setNotice(next === 'closed' ? t('staff.closeTicket') : t('staff.reopenTicket'))
  }

  return (
    <div className="staff">
      <button type="button" className="staff__back" onClick={() => navigate('/staff/inbox')}>
        {t('staff.backToInbox')}
      </button>

      <header className="staff__header">
        <h1>{t('staff.ticketDetailTitle')}</h1>
        <p>
          <span dir="ltr">{ticket.id}</span>
          {' · '}
          {ticket.subject}
          {' · '}
          {ticket.userName}
        </p>
        <p className="staff__hint">
          <span
            className={
              ticket.status === 'open'
                ? 'staff__badge staff__badge--open'
                : ticket.status === 'answered'
                  ? 'staff__badge staff__badge--answered'
                  : 'staff__badge staff__badge--closed'
            }
          >
            {statusLabel(ticket.status)}
          </span>
        </p>
      </header>

      {notice ? <p className="staff__ok">{notice}</p> : null}
      {error ? <p className="staff__error">{error}</p> : null}

      <section className="staff__chat">
        <div className="staff__messages">
          {(ticket.messages || []).map((message) => {
            const isStaffMsg = message.senderRole === 'staff'
            return (
              <article
                key={message.id}
                className={`staff__bubble${isStaffMsg ? ' staff__bubble--staff' : ' staff__bubble--user'}`}
              >
                <div className="staff__bubble-meta">
                  <strong>
                    {isStaffMsg
                      ? message.senderId === currentUser.id
                        ? t('staff.you')
                        : t('staff.roleSupport')
                      : t('staff.user')}
                  </strong>
                  <span>{formatDate(message.createdAt)}</span>
                </div>
                <p>{message.body}</p>
              </article>
            )
          })}
        </div>

        {ticket.status !== 'closed' ? (
          <form className="staff__chat-form" onSubmit={handleReply} noValidate>
            <label>
              <span>{t('staff.replyPlaceholder')}</span>
              <textarea
                rows={3}
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder={t('staff.replyPlaceholder')}
              />
            </label>
            <div className="staff__actions">
              <button type="submit" className="staff__btn staff__btn--primary">
                {t('staff.sendReply')}
              </button>
              <button type="button" className="staff__btn" onClick={handleToggleClose}>
                {t('staff.closeTicket')}
              </button>
            </div>
          </form>
        ) : (
          <div className="staff__actions">
            <button type="button" className="staff__btn staff__btn--primary" onClick={handleToggleClose}>
              {t('staff.reopenTicket')}
            </button>
          </div>
        )}
      </section>
    </div>
  )
}
