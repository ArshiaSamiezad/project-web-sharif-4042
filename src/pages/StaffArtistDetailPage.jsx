import { useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useI18n } from '../i18n/I18nProvider'
import { formatBytes } from './StaffInboxPage'
import './StaffPages.css'

export default function StaffArtistDetailPage() {
  const { userId } = useParams()
  const navigate = useNavigate()
  const { getUserById, approveArtist, rejectArtist, isStaff } = useAuth()
  const { t, formatNumber } = useI18n()

  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')

  const artist = getUserById(userId)

  if (!isStaff()) {
    return <Navigate to="/home" replace />
  }

  if (!artist || artist.role !== 'artist') {
    return <Navigate to="/staff/inbox" replace />
  }

  const samples = artist.samples || []
  const isPending = artist.status === 'pending'

  function handleApprove() {
    setError('')
    const result = approveArtist(artist.id)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setNotice(t('staff.approvedOk'))
    setTimeout(() => navigate('/staff/inbox', { replace: true }), 700)
  }

  function handleReject(event) {
    event.preventDefault()
    setError('')
    const result = rejectArtist(artist.id, reason)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setNotice(t('staff.rejectedOk'))
    setTimeout(() => navigate('/staff/inbox', { replace: true }), 700)
  }

  return (
    <div className="staff">
      <button type="button" className="staff__back" onClick={() => navigate('/staff/inbox')}>
        {t('staff.backToInbox')}
      </button>

      <header className="staff__header">
        <h1>{t('staff.artistDetailTitle')}</h1>
        <p>
          {artist.artistName || artist.displayName}
          {' · '}
          <span dir="ltr">{artist.email}</span>
        </p>
      </header>

      {notice ? <p className="staff__ok">{notice}</p> : null}
      {error ? <p className="staff__error">{error}</p> : null}

      <section className="staff__panel">
        <h2>{t('staff.sampleList')}</h2>
        {samples.length === 0 ? (
          <p className="staff__hint">{t('staff.noSamples')}</p>
        ) : (
          <ul className="staff__samples">
            {samples.map((file) => (
              <li key={`${file.name}-${file.size}`}>
                <span>{file.name}</span>
                <span>{formatBytes(file.size, formatNumber)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {isPending ? (
        <section className="staff__panel">
          <div className="staff__actions">
            <button type="button" className="staff__btn staff__btn--primary" onClick={handleApprove}>
              {t('staff.approve')}
            </button>
            {!rejecting ? (
              <button
                type="button"
                className="staff__btn staff__btn--danger"
                onClick={() => setRejecting(true)}
              >
                {t('staff.reject')}
              </button>
            ) : null}
          </div>

          {rejecting ? (
            <form className="staff__reject" onSubmit={handleReject} noValidate>
              <label>
                <span>{t('staff.rejectReason')}</span>
                <textarea
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={t('staff.rejectReasonPlaceholder')}
                  autoFocus
                />
              </label>
              <div className="staff__actions">
                <button type="submit" className="staff__btn staff__btn--danger">
                  {t('staff.confirmReject')}
                </button>
                <button
                  type="button"
                  className="staff__btn"
                  onClick={() => {
                    setRejecting(false)
                    setReason('')
                  }}
                >
                  {t('common.cancel')}
                </button>
              </div>
            </form>
          ) : null}
        </section>
      ) : (
        <p className="staff__hint">{t('errors.artistNotPending')}</p>
      )}
    </div>
  )
}
