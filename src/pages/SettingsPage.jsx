import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import './SettingsPage.css'

const defaults = { theme: 'system', language: 'fa', autoplay: true, explicitContent: false, emailNotifications: true }

export default function SettingsPage() {
  const [settings, setSettings] = useState(defaults)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api('/auth/preferences/').then(setSettings).catch((e) => setError(e.message)).finally(() => setLoading(false))
  }, [])

  async function save(e) {
    e.preventDefault(); setError(''); setMessage('')
    try { setSettings(await api('/auth/preferences/', { method: 'PATCH', body: settings })); setMessage('تنظیمات روی حساب شما ذخیره شد.') }
    catch (e) { setError(e.message) }
  }

  if (loading) return <p className="settings-page">در حال دریافت تنظیمات…</p>
  return (
    <div className="settings-page">
      <header><p className="settings-page__eyebrow">حساب کاربری</p><h1>تنظیمات برنامه</h1><p>این انتخاب‌ها روی همه دستگاه‌های شما همگام می‌شوند.</p></header>
      <form className="settings-card" onSubmit={save}>
        <label>پوسته<select value={settings.theme} onChange={(e) => setSettings({ ...settings, theme: e.target.value })}><option value="system">مطابق دستگاه</option><option value="dark">تیره</option><option value="light">روشن</option></select></label>
        <label>زبان<select value={settings.language} onChange={(e) => setSettings({ ...settings, language: e.target.value })}><option value="fa">فارسی</option><option value="en">English</option></select></label>
        <label className="settings-toggle"><input type="checkbox" checked={settings.autoplay} onChange={(e) => setSettings({ ...settings, autoplay: e.target.checked })} /><span>پخش خودکار آهنگ بعدی</span></label>
        <label className="settings-toggle"><input type="checkbox" checked={settings.explicitContent} onChange={(e) => setSettings({ ...settings, explicitContent: e.target.checked })} /><span>نمایش محتوای صریح</span></label>
        <label className="settings-toggle"><input type="checkbox" checked={settings.emailNotifications} onChange={(e) => setSettings({ ...settings, emailNotifications: e.target.checked })} /><span>اعلان‌های ایمیلی</span></label>
        {error ? <p className="settings-error" role="alert">{error}</p> : null}
        {message ? <p className="settings-success" role="status">{message}</p> : null}
        <button type="submit">ذخیره تنظیمات</button>
      </form>
    </div>
  )
}
