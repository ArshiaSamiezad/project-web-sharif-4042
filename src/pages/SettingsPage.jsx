import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getUserSettings, useAuth } from '../context/AuthContext'
import { usePlaying } from '../context/PlayingContext'
import { useI18n } from '../i18n/I18nProvider'
import './SettingsPage.css'

const NOTIFICATION_OPTIONS = [
  { value: 'all', labelKey: 'settings.notifAll' },
  { value: 'important', labelKey: 'settings.notifImportant' },
  { value: 'none', labelKey: 'settings.notifNone' },
]

const LANGUAGE_OPTIONS = [
  { value: 'fa', labelKey: 'settings.languageFa' },
  { value: 'en', labelKey: 'settings.languageEn' },
]

function subscriptionHint(type, t) {
  switch (type) {
    case 'gold':
      return t('settings.planGoldHint')
    case 'silver':
      return t('settings.planSilverHint')
    default:
      return t('settings.planBasicHint')
  }
}

export default function SettingsPage() {
  const { currentUser, updateSettings, deleteAccount } = useAuth()
  const { volume, setVolume } = usePlaying()
  const { t, subscriptionLabel, setLanguage } = useI18n()
  const navigate = useNavigate()

  const saved = getUserSettings(currentUser)
  const [notifications, setNotifications] = useState(saved.notifications)
  const [language, setLanguageState] = useState(saved.language)
  const [localVolume, setLocalVolume] = useState(saved.volume ?? volume)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    const next = getUserSettings(currentUser)
    setNotifications(next.notifications)
    setLanguageState(next.language)
    setLocalVolume(next.volume)
    setVolume(next.volume)
  }, [currentUser])

  function flashOk(text) {
    setError('')
    setMessage(text)
  }

  function saveNotifications(value) {
    setNotifications(value)
    const result = updateSettings({ notifications: value })
    if (!result.ok) {
      setError(result.error || t('settings.saveFailed'))
      return
    }
    flashOk(t('settings.notifSaved'))
  }

  function saveLanguage(value) {
    setLanguageState(value)
    setLanguage(value)
    const result = updateSettings({ language: value })
    if (!result.ok) {
      setError(result.error || t('settings.saveFailed'))
      return
    }
    flashOk(t('settings.languageSaved'))
  }

  function handleVolumeChange(value) {
    const next = Number(value)
    setLocalVolume(next)
    setVolume(next)
  }

  function commitVolume() {
    const result = updateSettings({ volume: localVolume })
    if (!result.ok) {
      setError(result.error || t('settings.volumeSaveFailed'))
      return
    }
    flashOk(t('settings.volumeSaved'))
  }

  function handleDeleteAccount() {
    setDeleting(true)
    const result = deleteAccount()
    setDeleting(false)
    if (!result.ok) {
      setError(result.error || t('settings.deleteFailed'))
      setConfirmDelete(false)
      return
    }
    navigate('/login', { replace: true })
  }

  return (
    <div className="settings">
      <header className="settings__header">
        <div>
          <h1>{t('settings.title')}</h1>
          <p>{t('settings.subtitle')}</p>
        </div>
      </header>

      {message ? <p className="settings__ok">{message}</p> : null}
      {error ? <p className="settings__error">{error}</p> : null}

      <section className="settings__card">
        <div className="settings__card-head">
          <h2>{t('settings.notifications')}</h2>
        </div>
        <p className="settings__hint">{t('settings.notificationsHint')}</p>
        <div
          className="settings__options"
          role="radiogroup"
          aria-label={t('settings.notifications')}
        >
          {NOTIFICATION_OPTIONS.map((option) => (
            <label key={option.value} className="settings__option">
              <input
                type="radio"
                name="notifications"
                value={option.value}
                checked={notifications === option.value}
                onChange={() => saveNotifications(option.value)}
              />
              <span>{t(option.labelKey)}</span>
            </label>
          ))}
        </div>
      </section>

      <section className="settings__card">
        <div className="settings__card-head">
          <h2>{t('settings.volume')}</h2>
          <span className="settings__volume-value" dir="ltr">
            {localVolume}%
          </span>
        </div>
        <p className="settings__hint">{t('settings.volumeHint')}</p>
        <label className="settings__range">
          <span className="settings__sr-only">{t('settings.volumeAria')}</span>
          <input
            type="range"
            min="0"
            max="100"
            step="1"
            value={localVolume}
            onChange={(e) => handleVolumeChange(e.target.value)}
            onMouseUp={commitVolume}
            onTouchEnd={commitVolume}
            onKeyUp={(e) => {
              if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'Home' || e.key === 'End') {
                commitVolume()
              }
            }}
          />
        </label>
      </section>

      <section className="settings__card">
        <div className="settings__card-head">
          <h2>{t('settings.language')}</h2>
        </div>
        <p className="settings__hint">{t('settings.languageHint')}</p>
        <div
          className="settings__options"
          role="radiogroup"
          aria-label={t('settings.language')}
        >
          {LANGUAGE_OPTIONS.map((option) => (
            <label key={option.value} className="settings__option">
              <input
                type="radio"
                name="language"
                value={option.value}
                checked={language === option.value}
                onChange={() => saveLanguage(option.value)}
              />
              <span>{t(option.labelKey)}</span>
            </label>
          ))}
        </div>
      </section>

      <section className="settings__card">
        <div className="settings__card-head">
          <h2>{t('settings.subscription')}</h2>
          <span className={`settings__plan settings__plan--${currentUser.subscription || 'basic'}`}>
            {subscriptionLabel(currentUser.subscription)}
          </span>
        </div>
        <p className="settings__hint">{subscriptionHint(currentUser.subscription, t)}</p>
        <div className="settings__actions">
          <Link to="/payment" className="settings__btn">
            {t('settings.upgrade')}
          </Link>
          <p className="settings__note">{t('settings.upgradeNote')}</p>
        </div>
      </section>

      <section className="settings__card settings__card--danger">
        <div className="settings__card-head">
          <h2>{t('settings.deleteTitle')}</h2>
        </div>
        <p className="settings__hint">{t('settings.deleteHint')}</p>
        {!confirmDelete ? (
          <button
            type="button"
            className="settings__btn settings__btn--danger"
            onClick={() => {
              setMessage('')
              setError('')
              setConfirmDelete(true)
            }}
          >
            {t('settings.deleteButton')}
          </button>
        ) : (
          <div className="settings__confirm">
            <p className="settings__confirm-text">
              {t('settings.deleteConfirm', { name: currentUser.displayName })}
            </p>
            <div className="settings__form-actions">
              <button
                type="button"
                className="settings__btn settings__btn--danger"
                disabled={deleting}
                onClick={handleDeleteAccount}
              >
                {deleting ? t('settings.deleting') : t('settings.deleteYes')}
              </button>
              <button
                type="button"
                className="settings__btn settings__btn--ghost"
                disabled={deleting}
                onClick={() => setConfirmDelete(false)}
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
