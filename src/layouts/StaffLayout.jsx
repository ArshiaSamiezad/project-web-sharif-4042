import { NavLink, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useI18n } from '../i18n/I18nProvider'
import PageTransition from '../components/PageTransition'
import './StaffLayout.css'

const BASE_NAV = [
  { to: '/staff/inbox', labelKey: 'staff.navInbox', shortKey: 'staff.navInboxShort', icon: 'inbox' },
]

const ADMIN_NAV = [
  { to: '/staff/finance', labelKey: 'staff.navFinance', shortKey: 'staff.navFinanceShort', icon: 'finance' },
  {
    to: '/staff/subscriptions',
    labelKey: 'staff.navSubscriptions',
    shortKey: 'staff.navSubscriptionsShort',
    icon: 'subscriptions',
  },
]

function StaffIcon({ name }) {
  const props = {
    className: 'staff-shell__icon',
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
  }

  switch (name) {
    case 'inbox':
      return (
        <svg {...props}>
          <path d="M4 7h16v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7z" />
          <path d="M4 7l2.5-3h11L20 7" />
          <path d="M4 13h4.2l1.3 2h5l1.3-2H20" />
        </svg>
      )
    case 'finance':
      return (
        <svg {...props}>
          <path d="M4 19V5" />
          <path d="M4 19h16" />
          <path d="M8 15v-4M12 15V8M16 15v-6" />
        </svg>
      )
    case 'subscriptions':
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="8" />
          <path d="M12 8v8M9.5 10.5h5a2 2 0 0 1 0 4h-5" />
        </svg>
      )
    case 'app':
      return (
        <svg {...props}>
          <path d="M15 18l-6-6 6-6" />
        </svg>
      )
    case 'logout':
      return (
        <svg {...props}>
          <path d="M10 5H6a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h4" />
          <path d="M14 16l4-4-4-4M18 12H10" />
        </svg>
      )
    default:
      return null
  }
}

export default function StaffLayout() {
  const { currentUser, logout, isStaff, isAdmin } = useAuth()
  const { t } = useI18n()
  const navigate = useNavigate()
  const location = useLocation()

  if (!isStaff(currentUser)) {
    return <Navigate to="/home" replace />
  }

  const navItems = [...BASE_NAV, ...(isAdmin(currentUser) ? ADMIN_NAV : [])]
  const roleLabel =
    currentUser.role === 'admin' ? t('staff.roleAdmin') : t('staff.roleSupport')

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  function linkClass(item, isActive) {
    const inboxActive =
      item.to === '/staff/inbox' &&
      (location.pathname.startsWith('/staff/inbox') ||
        location.pathname.startsWith('/staff/artists') ||
        location.pathname.startsWith('/staff/tickets'))
    return isActive || inboxActive ? 'staff-shell__link is-active' : 'staff-shell__link'
  }

  return (
    <div className="staff-shell">
      <aside className="staff-shell__sidebar" aria-label={t('staff.brand')}>
        <div className="staff-shell__brand">
          <p className="staff-shell__brand-mark">{t('common.brand')}</p>
          <h1>{t('staff.brand')}</h1>
          <p className="staff-shell__role">{roleLabel}</p>
        </div>

        <nav className="staff-shell__nav" aria-label={t('staff.title')}>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => linkClass(item, isActive)}
            >
              <StaffIcon name={item.icon} />
              <span className="staff-shell__link-full">{t(item.labelKey)}</span>
              <span className="staff-shell__link-short">{t(item.shortKey)}</span>
            </NavLink>
          ))}
        </nav>

        <div className="staff-shell__footer">
          <button
            type="button"
            className="staff-shell__link staff-shell__link--action"
            onClick={() => navigate('/home')}
          >
            <StaffIcon name="app" />
            <span>{t('staff.backToApp')}</span>
          </button>
          <button
            type="button"
            className="staff-shell__link staff-shell__link--action"
            onClick={handleLogout}
          >
            <StaffIcon name="logout" />
            <span>{t('nav.logout')}</span>
          </button>
        </div>
      </aside>

      <div className="staff-shell__main">
        <header className="staff-shell__top">
          <div>
            <p className="staff-shell__user-name">{currentUser.displayName}</p>
            <p className="staff-shell__user-meta" dir="ltr">
              {currentUser.email}
            </p>
          </div>
        </header>
        <div className="staff-shell__page">
          <PageTransition />
        </div>
      </div>
    </div>
  )
}
