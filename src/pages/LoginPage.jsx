import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import './AuthPages.css'

export default function LoginPage() {
  const { ready, currentUser, login, requestPasswordReset } = useAuth()
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
    if (location.state?.notice) {
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

  return (
    <main className="auth-page">
      <div className="auth-page__atmosphere" aria-hidden="true" />
      <div className="auth-page__grain" aria-hidden="true" />

      <div className="auth-page__content">
        <header className="auth-page__brand">
          <p className="auth-page__mark">Sepatify</p>
          <h1 className="auth-page__headline">
            {mode === 'login' ? 'ورود به حساب' : 'بازیابی رمز عبور'}
          </h1>
          <p className="auth-page__sub">
            {mode === 'login'
              ? 'با ایمیل و رمز عبور وارد شوید.'
              : 'ایمیل حساب خود را وارد کنید تا لینک بازیابی ارسال شود.'}
          </p>
        </header>

        {mode === 'login' ? (
          <form className="auth-form" onSubmit={handleLogin} noValidate>
            <label className="auth-form__field">
              <span>ایمیل</span>
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
              <span>رمز عبور</span>
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
                {notice}
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
              ورود
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
              فراموشی رمز عبور
            </button>
          </form>
        ) : (
          <form className="auth-form" onSubmit={handleReset} noValidate>
            <label className="auth-form__field">
              <span>ایمیل</span>
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
              ارسال لینک بازیابی
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
              بازگشت به ورود
            </button>
          </form>
        )}

        {mode === 'login' ? (
          <p className="auth-page__switch">
            حساب ندارید؟ <Link to="/signup">ثبت‌نام</Link>
          </p>
        ) : null}

        <aside className="auth-page__hints">
          <p>حساب‌های نمونه (رمز: password)</p>
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
