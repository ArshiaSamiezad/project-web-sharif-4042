import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import PrivacyModal from '../components/PrivacyModal'
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
      state: { notice: 'ثبت‌نام با موفقیت انجام شد. وارد شوید.' },
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
      state: {
        notice: 'درخواست هنرمند ثبت شد و در وضعیت «در انتظار تأیید» قرار گرفت. پس از تأیید می‌توانید وارد شوید.',
      },
    })
  }

  return (
    <main className="auth-page">
      <div className="auth-page__atmosphere" aria-hidden="true" />
      <div className="auth-page__grain" aria-hidden="true" />

      <div className="auth-page__content auth-page__content--wide">
        <header className="auth-page__brand">
          <p className="auth-page__mark">Sepatify</p>
          <h1 className="auth-page__headline">ثبت‌نام</h1>
          <p className="auth-page__sub">حساب شنونده یا درخواست عضویت به‌عنوان هنرمند بسازید.</p>
        </header>

        <div className="auth-tabs" role="tablist" aria-label="نوع ثبت‌نام">
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
            شنونده
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
            هنرمند
          </button>
        </div>

        {tab === 'listener' ? (
          <form className="auth-form" onSubmit={handleListenerSubmit} noValidate>
            <label className="auth-form__field">
              <span>نام نمایشی</span>
              <input
                type="text"
                value={listener.displayName}
                onChange={(e) => patchListener({ displayName: e.target.value })}
                required
              />
              <small>با نام کاربری که سامانه اختصاص می‌دهد متفاوت است.</small>
            </label>

            <label className="auth-form__field">
              <span>ایمیل</span>
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
              <span>رمز عبور</span>
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
              <span>تأیید رمز عبور</span>
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
              <span>تاریخ تولد</span>
              <input
                type="date"
                value={listener.birthDate}
                onChange={(e) => patchListener({ birthDate: e.target.value })}
                required
                dir="ltr"
              />
            </label>

            <label className="auth-form__field">
              <span>جنسیت</span>
              <select
                value={listener.gender}
                onChange={(e) => patchListener({ gender: e.target.value })}
                required
              >
                <option value="">انتخاب کنید</option>
                <option value="female">زن</option>
                <option value="male">مرد</option>
                <option value="other">سایر</option>
                <option value="unspecified">ترجیح می‌دهم نگویم</option>
              </select>
            </label>

            <label className="auth-form__check">
              <input
                type="checkbox"
                checked={listener.acceptedPrivacy}
                onChange={(e) => patchListener({ acceptedPrivacy: e.target.checked })}
              />
              <span>
                سیاست{' '}
                <button
                  type="button"
                  className="auth-form__inline-link"
                  onClick={() => setPrivacyOpen(true)}
                >
                  حریم خصوصی
                </button>{' '}
                را می‌پذیرم.
              </span>
            </label>

            {error ? (
              <p className="auth-form__error" role="alert">
                {error}
              </p>
            ) : null}

            <button className="auth-form__submit" type="submit" disabled={submitting}>
              ثبت‌نام
            </button>
          </form>
        ) : (
          <form className="auth-form" onSubmit={handleArtistSubmit} noValidate>
            <label className="auth-form__field">
              <span>ایمیل</span>
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
              <span>رمز عبور</span>
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
              <span>تأیید رمز عبور</span>
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
              <span>نام هنری</span>
              <input
                type="text"
                value={artist.artistName}
                onChange={(e) => patchArtist({ artistName: e.target.value })}
                required
              />
            </label>

            <label className="auth-form__field">
              <span>نمونه کارها</span>
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
                <small>یک یا چند فایل نمونه بارگذاری کنید.</small>
              )}
            </label>

            {error ? (
              <p className="auth-form__error" role="alert">
                {error}
              </p>
            ) : null}

            <button className="auth-form__submit" type="submit" disabled={submitting}>
              ارسال درخواست
            </button>
          </form>
        )}

        <p className="auth-page__switch">
          حساب دارید؟ <Link to="/login">ورود</Link>
        </p>
      </div>

      <PrivacyModal open={privacyOpen} onClose={() => setPrivacyOpen(false)} />
    </main>
  )
}
