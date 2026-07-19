import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
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

export default function PaymentPage() {
  const { currentUser } = useAuth()

  return (
    <div className="settings">
      <header className="settings__header">
        <div>
          <h1>پرداخت و اشتراک</h1>
          <p>ارتقا یا تغییر نوع اشتراک</p>
        </div>
      </header>

      <section className="settings__card">
        <div className="settings__card-head">
          <h2>اشتراک فعلی</h2>
          <span className={`settings__plan settings__plan--${currentUser.subscription || 'basic'}`}>
            {subscriptionLabel(currentUser.subscription)}
          </span>
        </div>
        <p className="settings__hint">
          درگاه پرداخت و تغییر اشتراک جزو نیازمندی‌های فاز دوم است و هنوز فعال نشده است.
          می‌توانید از صفحه تنظیمات نوع اشتراک فعلی خود را مشاهده کنید.
        </p>
        <div className="settings__form-actions">
          <Link to="/settings" className="settings__btn settings__btn--ghost">
            بازگشت به تنظیمات
          </Link>
        </div>
      </section>
    </div>
  )
}
