import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useI18n } from '../i18n/I18nProvider'
import './AuthPages.css'

export default function LoginPage() {
  const { ready, currentUser, login, requestPasswordReset } = useAuth()
  const { t } = useI18n()
  const location = useLocation()
  const navigate = useNavigate()
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [resetEmail, setResetEmail] = useState('')
  const [feedback, setFeedback] = useState(null)
  const [notice, setNotice] = useState('')
  const [resetMessage, setResetMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (location.state?.noticeKey) {
      setNotice(location.state.noticeKey)
      navigate(location.pathname, { replace: true, state: {} })
    } else if (location.state?.notice) {
      setNotice(location.state.notice)
      navigate(location.pathname, { replace: true, state: {} })
    }
  }, [location, navigate])

  if (!ready) return null
  if (currentUser) return <Navigate to="/home" replace />

  async function handleLogin(e) {
    e.preventDefault()
    setFeedback(null)
    setNotice('')
    setSubmitting(true)
    const result = await login(email, password)
    setSubmitting(false)
    if (!result.ok) {
      setFeedback({ type: 'error', text: result.error })
      return
    }
    navigate('/home', { replace: true })
  }

  async function handleReset(e) {
    e.preventDefault()
    setFeedback(null)
    setResetMessage('')
    const result = await requestPasswordReset(resetEmail)
    if (!result.ok) {
      setFeedback({ type: 'error', text: result.error })
      return
    }
    setResetMessage(result.message)
  }

  const noticeText = notice.includes('.') ? t(notice) : notice

  return (
    <main className="auth-page">
      <div className="auth-page__atmosphere" aria-hidden="true" />
      <div className="auth-page__grain" aria-hidden="true" />

      <div className="auth-page__content">
        <header className="auth-page__brand">
          <p className="auth-page__mark">{t('common.brand')}</p>
          <h1 className="auth-page__headline">
            {mode === 'login' ? t('auth.loginTitle') : t('auth.resetTitle')}
          </h1>
          <p className="auth-page__sub">
            {mode === 'login' ? t('auth.loginSub') : t('auth.resetSub')}
          </p>
        </header>

        {mode === 'login' ? (
          <form className="auth-form" onSubmit={handleLogin} noValidate>
            <label className="auth-form__field">
              <span>{t('auth.email')}</span>
              <input
                type="email"
                name="email"
                autoComplete="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  setFeedback(null)
                }}
                required
                dir="ltr"
              />
            </label>

            <label className="auth-form__field">
              <span>{t('auth.password')}</span>
              <input
                type="password"
                name="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  setFeedback(null)
                }}
                required
                dir="ltr"
              />
            </label>

            {notice ? (
              <p className="auth-form__success" role="status">
                {noticeText}
              </p>
            ) : null}

            {feedback ? (
              <p
                className={
                  feedback.type === 'success' ? 'auth-form__success' : 'auth-form__error'
                }
                role={feedback.type === 'success' ? 'status' : 'alert'}
              >
                {feedback.text}
              </p>
            ) : null}

            <button className="auth-form__submit" type="submit" disabled={submitting}>
              {t('auth.login')}
            </button>

            <button
              type="button"
              className="auth-form__link"
              onClick={() => {
                setMode('reset')
                setFeedback(null)
                setNotice('')
                setResetMessage('')
                setResetEmail(email)
              }}
            >
              {t('auth.forgotPassword')}
            </button>
          </form>
        ) : (
          <form className="auth-form" onSubmit={handleReset} noValidate>
            <label className="auth-form__field">
              <span>{t('auth.email')}</span>
              <input
                type="email"
                name="resetEmail"
                autoComplete="email"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                required
                dir="ltr"
              />
            </label>

            {feedback?.type === 'error' ? (
              <p className="auth-form__error" role="alert">
                {feedback.text}
              </p>
            ) : null}
            {resetMessage ? (
              <p className="auth-form__success" role="status">
                {resetMessage}
              </p>
            ) : null}

            <button className="auth-form__submit" type="submit">
              {t('auth.sendReset')}
            </button>

            <button
              type="button"
              className="auth-form__link"
              onClick={() => {
                setMode('login')
                setFeedback(null)
                setResetMessage('')
              }}
            >
              {t('auth.backToLogin')}
            </button>
          </form>
        )}

        {mode === 'login' ? (
          <p className="auth-page__switch">
            {t('auth.noAccount')} <Link to="/signup">{t('auth.signupLink')}</Link>
          </p>
        ) : null}

        <aside className="auth-page__hints">
          <p>{t('auth.demoAccounts')}</p>
          <ul>
            <li>listener@sepatify.test</li>
            <li>silver@sepatify.test</li>
            <li>gold@sepatify.test</li>
            <li>artist@sepatify.test</li>
            <li>support@sepatify.test</li>
            <li>admin@sepatify.test</li>
          </ul>
        </aside>
      </div>
    </main>
  )
}
