import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import './LoginPage.css'

export default function LoginPage() {
  const { ready, login, requestPasswordReset } = useAuth()
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [resetEmail, setResetEmail] = useState('')
  const [feedback, setFeedback] = useState(null)
  const [resetMessage, setResetMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (!ready) return null

  function handleLogin(e) {
    e.preventDefault()
    setFeedback(null)
    setSubmitting(true)
    const result = login(email, password)
    setSubmitting(false)
    if (!result.ok) {
      setFeedback({ type: 'error', text: result.error })
      return
    }
    setFeedback({ type: 'success', text: 'درست است.' })
  }

  function handleReset(e) {
    e.preventDefault()
    setFeedback(null)
    setResetMessage('')
    const result = requestPasswordReset(resetEmail)
    if (!result.ok) {
      setFeedback({ type: 'error', text: result.error })
      return
    }
    setResetMessage(result.message)
  }

  return (
    <main className="login-page">
      <div className="login-page__atmosphere" aria-hidden="true" />
      <div className="login-page__grain" aria-hidden="true" />

      <div className="login-page__content">
        <header className="login-page__brand">
          <p className="login-page__mark">Sepatify</p>
          <h1 className="login-page__headline">
            {mode === 'login' ? 'ورود به حساب' : 'بازیابی رمز عبور'}
          </h1>
          <p className="login-page__sub">
            {mode === 'login'
              ? 'با ایمیل و رمز عبور وارد شوید.'
              : 'ایمیل حساب خود را وارد کنید تا لینک بازیابی ارسال شود.'}
          </p>
        </header>

        {mode === 'login' ? (
          <form className="login-form" onSubmit={handleLogin} noValidate>
            <label className="login-form__field">
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

            <label className="login-form__field">
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

            {feedback ? (
              <p
                className={
                  feedback.type === 'success' ? 'login-form__success' : 'login-form__error'
                }
                role={feedback.type === 'success' ? 'status' : 'alert'}
              >
                {feedback.text}
              </p>
            ) : null}

            <button className="login-form__submit" type="submit" disabled={submitting}>
              ورود
            </button>

            <button
              type="button"
              className="login-form__link"
              onClick={() => {
                setMode('reset')
                setFeedback(null)
                setResetMessage('')
                setResetEmail(email)
              }}
            >
              فراموشی رمز عبور
            </button>
          </form>
        ) : (
          <form className="login-form" onSubmit={handleReset} noValidate>
            <label className="login-form__field">
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
              <p className="login-form__error" role="alert">
                {feedback.text}
              </p>
            ) : null}
            {resetMessage ? (
              <p className="login-form__success" role="status">
                {resetMessage}
              </p>
            ) : null}

            <button className="login-form__submit" type="submit">
              ارسال لینک بازیابی
            </button>

            <button
              type="button"
              className="login-form__link"
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

        <aside className="login-page__hints">
          <p>حساب‌های نمونه (رمز: password)</p>
          <ul>
            <li>listener@sepatify.test</li>
            <li>artist@sepatify.test</li>
            <li>support@sepatify.test</li>
            <li>admin@sepatify.test</li>
          </ul>
        </aside>
      </div>
    </main>
  )
}
