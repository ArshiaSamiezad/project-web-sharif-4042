import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getUserSettings, useAuth } from '../context/AuthContext'
import { usePlaying } from '../context/PlayingContext'
import './SettingsPage.css'

function subscriptionLabel(type) {
  switch (type) {
    case 'gold':
      return 'طلایی'
    case 'silver':
      return 'نقره‌ای'
    default:
      return 'عادی (پایه)'
  }
}

function subscriptionHint(type) {
  switch (type) {
    case 'gold':
      return 'دسترسی کامل، پلی‌لیست نامحدود و محتوای زودهنگام.'
    case 'silver':
      return 'پلی‌لیست بیشتر و امکان تغییر عکس نمایه.'
    default:
      return 'اشتراک پایه با محدودیت پلی‌لیست و امکانات محدود.'
  }
}

const NOTIFICATION_OPTIONS = [
  { value: 'all', label: 'همه اعلان‌ها' },
  { value: 'important', label: 'فقط اعلان‌های مهم' },
  { value: 'none', label: 'بدون اعلان' },
]

export default function SettingsPage() {
  const { currentUser, updateSettings, deleteAccount } = useAuth()
  const { volume, setVolume } = usePlaying()
  const navigate = useNavigate()

  const saved = getUserSettings(currentUser)
  const [notifications, setNotifications] = useState(saved.notifications)
  const [language, setLanguage] = useState(saved.language)
  const [localVolume, setLocalVolume] = useState(saved.volume ?? volume)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    const next = getUserSettings(currentUser)
    setNotifications(next.notifications)
    setLanguage(next.language)
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
      setError(result.error || 'ذخیره انجام نشد.')
      return
    }
    flashOk('محدودیت اعلان‌ها ذخیره شد.')
  }

  function saveLanguage(value) {
    setLanguage(value)
    const result = updateSettings({ language: value })
    if (!result.ok) {
      setError(result.error || 'ذخیره انجام نشد.')
      return
    }
    flashOk(value === 'en' ? 'Language updated.' : 'زبان سامانه به‌روز شد.')
  }

  function handleVolumeChange(value) {
    const next = Number(value)
    setLocalVolume(next)
    setVolume(next)
  }

  function commitVolume() {
    const result = updateSettings({ volume: localVolume })
    if (!result.ok) {
      setError(result.error || 'ذخیره صدا انجام نشد.')
      return
    }
    flashOk('صدای سامانه ذخیره شد.')
  }

  function handleDeleteAccount() {
    setDeleting(true)
    const result = deleteAccount()
    setDeleting(false)
    if (!result.ok) {
      setError(result.error || 'حذف حساب انجام نشد.')
      setConfirmDelete(false)
      return
    }
    navigate('/login', { replace: true })
  }

  return (
    <div className="settings">
      <header className="settings__header">
        <div>
          <h1>تنظیمات برنامه</h1>
          <p>اعلان‌ها، صدا، زبان و مدیریت حساب</p>
        </div>
      </header>

      {message ? <p className="settings__ok">{message}</p> : null}
      {error ? <p className="settings__error">{error}</p> : null}

      <section className="settings__card">
        <div className="settings__card-head">
          <h2>محدودیت اعلان‌ها</h2>
        </div>
        <p className="settings__hint">
          مشخص کنید کدام اعلان‌ها برای شما نمایش داده شوند.
        </p>
        <div className="settings__options" role="radiogroup" aria-label="محدودیت اعلان‌ها">
          {NOTIFICATION_OPTIONS.map((option) => (
            <label key={option.value} className="settings__option">
              <input
                type="radio"
                name="notifications"
                value={option.value}
                checked={notifications === option.value}
                onChange={() => saveNotifications(option.value)}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      </section>

      <section className="settings__card">
        <div className="settings__card-head">
          <h2>صدای سامانه</h2>
          <span className="settings__volume-value" dir="ltr">
            {localVolume}%
          </span>
        </div>
        <p className="settings__hint">بلندی صدای پخش و اعلان‌های سامانه را تنظیم کنید.</p>
        <label className="settings__range">
          <span className="settings__sr-only">میزان صدا</span>
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
          <h2>زبان</h2>
        </div>
        <p className="settings__hint">زبان نمایش رابط کاربری را انتخاب کنید.</p>
        <label className="settings__field">
          <span>زبان سامانه</span>
          <select
            value={language}
            onChange={(e) => saveLanguage(e.target.value)}
          >
            <option value="fa">فارسی</option>
            <option value="en">English</option>
          </select>
        </label>
      </section>

      <section className="settings__card">
        <div className="settings__card-head">
          <h2>نوع اشتراک</h2>
          <span className={`settings__plan settings__plan--${currentUser.subscription || 'basic'}`}>
            {subscriptionLabel(currentUser.subscription)}
          </span>
        </div>
        <p className="settings__hint">{subscriptionHint(currentUser.subscription)}</p>
        <div className="settings__actions">
          <Link to="/payment" className="settings__btn">
            ارتقا یا تغییر اشتراک
          </Link>
          <p className="settings__note">
            پرداخت و تغییر اشتراک در فاز دوم پیاده‌سازی می‌شود؛ فعلاً به صفحه پرداخت هدایت می‌شوید.
          </p>
        </div>
      </section>

      <section className="settings__card settings__card--danger">
        <div className="settings__card-head">
          <h2>حذف حساب کاربری</h2>
        </div>
        <p className="settings__hint">
          با حذف حساب، داده‌های نمایه و پلی‌لیست‌های شما از این مرورگر پاک می‌شود و قابل بازگردانی نیست.
        </p>
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
            حذف حساب کاربری
          </button>
        ) : (
          <div className="settings__confirm">
            <p className="settings__confirm-text">
              مطمئن هستید که می‌خواهید حساب «{currentUser.displayName}» را حذف کنید؟
            </p>
            <div className="settings__form-actions">
              <button
                type="button"
                className="settings__btn settings__btn--danger"
                disabled={deleting}
                onClick={handleDeleteAccount}
              >
                {deleting ? 'در حال حذف…' : 'بله، حذف شود'}
              </button>
              <button
                type="button"
                className="settings__btn settings__btn--ghost"
                disabled={deleting}
                onClick={() => setConfirmDelete(false)}
              >
                انصراف
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
