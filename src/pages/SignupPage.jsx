import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import PrivacyModal from '../components/PrivacyModal'
import { useI18n } from '../i18n/I18nProvider'
import './AuthPages.css'

const initialListener = {
  displayName: '',
  email: '',
  password: '',
  confirmPassword: '',
  birthDate: '',
  gender: '',
  acceptedPrivacy: false,
}

const initialArtist = {
  email: '',
  password: '',
  confirmPassword: '',
  artistName: '',
  samples: [],
}

export default function SignupPage() {
  const { ready, currentUser, registerListener, registerArtist } = useAuth()
  const { t } = useI18n()
  const navigate = useNavigate()
  const [tab, setTab] = useState('listener')
  const [listener, setListener] = useState(initialListener)
  const [artist, setArtist] = useState(initialArtist)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [privacyOpen, setPrivacyOpen] = useState(false)

  if (!ready) return null
  if (currentUser) return <Navigate to="/home" replace />

  function patchListener(patch) {
    setError('')
    setListener((prev) => ({ ...prev, ...patch }))
  }

  function patchArtist(patch) {
    setError('')
    setArtist((prev) => ({ ...prev, ...patch }))
  }

  function handleSampleFiles(fileList) {
    const files = Array.from(fileList || [])
    const samples = files.map((f) => ({
      name: f.name,
      size: f.size,
      type: f.type,
    }))
    patchArtist({ samples })
  }

  async function handleListenerSubmit(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    const result = await registerListener(listener)
    setSubmitting(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    navigate('/login', {
      replace: true,
      state: { noticeKey: 'auth.signupSuccess' },
    })
  }

  async function handleArtistSubmit(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    const result = await registerArtist(artist)
    setSubmitting(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    navigate('/login', {
      replace: true,
      state: { noticeKey: 'auth.artistPendingNotice' },
    })
  }

  return (
    <main className="auth-page">
      <div className="auth-page__atmosphere" aria-hidden="true" />
      <div className="auth-page__grain" aria-hidden="true" />

      <div className="auth-page__content auth-page__content--wide">
        <header className="auth-page__brand">
          <p className="auth-page__mark">{t('common.brand')}</p>
          <h1 className="auth-page__headline">{t('auth.signupTitle')}</h1>
          <p className="auth-page__sub">{t('auth.signupSub')}</p>
        </header>

        <div className="auth-tabs" role="tablist" aria-label={t('auth.signupType')}>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'listener'}
            className={tab === 'listener' ? 'auth-tabs__btn is-active' : 'auth-tabs__btn'}
            onClick={() => {
              setTab('listener')
              setError('')
            }}
          >
            {t('auth.listener')}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'artist'}
            className={tab === 'artist' ? 'auth-tabs__btn is-active' : 'auth-tabs__btn'}
            onClick={() => {
              setTab('artist')
              setError('')
            }}
          >
            {t('auth.artist')}
          </button>
        </div>

        {tab === 'listener' ? (
          <form className="auth-form" onSubmit={handleListenerSubmit} noValidate>
            <label className="auth-form__field">
              <span>{t('auth.displayName')}</span>
              <input
                type="text"
                value={listener.displayName}
                onChange={(e) => patchListener({ displayName: e.target.value })}
                required
              />
              <small>{t('auth.displayNameHint')}</small>
            </label>

            <label className="auth-form__field">
              <span>{t('auth.email')}</span>
              <input
                type="email"
                autoComplete="email"
                value={listener.email}
                onChange={(e) => patchListener({ email: e.target.value })}
                required
                dir="ltr"
              />
            </label>

            <label className="auth-form__field">
              <span>{t('auth.password')}</span>
              <input
                type="password"
                autoComplete="new-password"
                value={listener.password}
                onChange={(e) => patchListener({ password: e.target.value })}
                required
                dir="ltr"
              />
            </label>

            <label className="auth-form__field">
              <span>{t('auth.confirmPassword')}</span>
              <input
                type="password"
                autoComplete="new-password"
                value={listener.confirmPassword}
                onChange={(e) => patchListener({ confirmPassword: e.target.value })}
                required
                dir="ltr"
              />
            </label>

            <label className="auth-form__field">
              <span>{t('auth.birthDate')}</span>
              <input
                type="date"
                value={listener.birthDate}
                onChange={(e) => patchListener({ birthDate: e.target.value })}
                required
                dir="ltr"
              />
            </label>

            <label className="auth-form__field">
              <span>{t('auth.gender')}</span>
              <select
                value={listener.gender}
                onChange={(e) => patchListener({ gender: e.target.value })}
                required
              >
                <option value="">{t('common.genderPlaceholder')}</option>
                <option value="female">{t('common.genderFemale')}</option>
                <option value="male">{t('common.genderMale')}</option>
                <option value="other">{t('common.genderOther')}</option>
                <option value="unspecified">{t('common.genderUnspecified')}</option>
              </select>
            </label>

            <label className="auth-form__check">
              <input
                type="checkbox"
                checked={listener.acceptedPrivacy}
                onChange={(e) => patchListener({ acceptedPrivacy: e.target.checked })}
              />
              <span>
                {t('auth.acceptPrivacyBefore')}{' '}
                <button
                  type="button"
                  className="auth-form__inline-link"
                  onClick={() => setPrivacyOpen(true)}
                >
                  {t('auth.privacyPolicy')}
                </button>{' '}
                {t('auth.acceptPrivacyAfter')}
              </span>
            </label>

            {error ? (
              <p className="auth-form__error" role="alert">
                {error}
              </p>
            ) : null}

            <button className="auth-form__submit" type="submit" disabled={submitting}>
              {t('auth.signupSubmit')}
            </button>
          </form>
        ) : (
          <form className="auth-form" onSubmit={handleArtistSubmit} noValidate>
            <label className="auth-form__field">
              <span>{t('auth.email')}</span>
              <input
                type="email"
                autoComplete="email"
                value={artist.email}
                onChange={(e) => patchArtist({ email: e.target.value })}
                required
                dir="ltr"
              />
            </label>

            <label className="auth-form__field">
              <span>{t('auth.password')}</span>
              <input
                type="password"
                autoComplete="new-password"
                value={artist.password}
                onChange={(e) => patchArtist({ password: e.target.value })}
                required
                dir="ltr"
              />
            </label>

            <label className="auth-form__field">
              <span>{t('auth.confirmPassword')}</span>
              <input
                type="password"
                autoComplete="new-password"
                value={artist.confirmPassword}
                onChange={(e) => patchArtist({ confirmPassword: e.target.value })}
                required
                dir="ltr"
              />
            </label>

            <label className="auth-form__field">
              <span>{t('auth.artistName')}</span>
              <input
                type="text"
                value={artist.artistName}
                onChange={(e) => patchArtist({ artistName: e.target.value })}
                required
              />
            </label>

            <label className="auth-form__field">
              <span>{t('auth.samples')}</span>
              <input
                type="file"
                accept="audio/*,image/*,.mp3,.wav,.flac,.jpg,.png"
                multiple
                onChange={(e) => handleSampleFiles(e.target.files)}
              />
              {artist.samples.length > 0 ? (
                <ul className="auth-form__files">
                  {artist.samples.map((s) => (
                    <li key={s.name + s.size}>{s.name}</li>
                  ))}
                </ul>
              ) : (
                <small>{t('auth.samplesHint')}</small>
              )}
            </label>

            {error ? (
              <p className="auth-form__error" role="alert">
                {error}
              </p>
            ) : null}

            <button className="auth-form__submit" type="submit" disabled={submitting}>
              {t('auth.artistSubmit')}
            </button>
          </form>
        )}

        <p className="auth-page__switch">
          {t('auth.haveAccount')} <Link to="/login">{t('auth.loginLink')}</Link>
        </p>
      </div>

      <PrivacyModal open={privacyOpen} onClose={() => setPrivacyOpen(false)} />
    </main>
  )
}
