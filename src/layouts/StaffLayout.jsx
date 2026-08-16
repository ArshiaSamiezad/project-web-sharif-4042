import { useState } from 'react'
import { NavLink, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useI18n } from '../i18n/I18nProvider'
import { getItem, setItem } from '../lib/storage'
import PageTransition from '../components/PageTransition'
import './AppShell.css'

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

function NavIcon({ name }) {
  const props = {
    className: 'shell__icon',
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
    case 'home':
      return (
        <svg {...props}>
          <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5z" />
        </svg>
      )
    case 'logout':
      return (
        <svg {...props}>
          <path d="M10 5H6a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h4" />
          <path d="M14 16l4-4-4-4M18 12H10" />
        </svg>
      )
    case 'collapse':
      return (
        <svg {...props}>
          <path d="M9 6l-5 6 5 6M20 6l-5 6 5 6" />
        </svg>
      )
    case 'expand':
      return (
        <svg {...props}>
          <path d="M15 6l5 6-5 6M4 6l5 6-5 6" />
        </svg>
      )
    default:
      return null
  }
}

export default function StaffLayout() {
  const { currentUser, logout, defaultAvatar, isStaff, isAdmin } = useAuth()
  const { t } = useI18n()
  const navigate = useNavigate()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(() => Boolean(getItem('sidebarCollapsed', false)))

  if (!isStaff(currentUser)) {
    return <Navigate to="/home" replace />
  }

  const navItems = [
    ...BASE_NAV,
    ...(isAdmin(currentUser) ? ADMIN_NAV : []),
    { to: '/home', labelKey: 'staff.backToApp', shortKey: 'nav.homeShort', icon: 'home' },
  ]

  const roleLabel =
    currentUser.role === 'admin' ? t('staff.roleAdmin') : t('staff.roleSupport')
  const expandLabel = collapsed ? t('nav.expand') : t('nav.collapse')
  const logoutLabel = t('nav.logout')

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev
      setItem('sidebarCollapsed', next)
      return next
    })
  }

  function linkClass(item, isActive) {
    const inboxActive =
      item.to === '/staff/inbox' &&
      (location.pathname.startsWith('/staff/inbox') ||
        location.pathname.startsWith('/staff/artists') ||
        location.pathname.startsWith('/staff/tickets'))
    return isActive || inboxActive ? 'shell__link is-active' : 'shell__link'
  }

  return (
    <div className={`shell${collapsed ? ' shell--collapsed' : ''}`}>
      <aside className="shell__sidebar" aria-label={t('staff.brand')}>
        <div className="shell__sidebar-head">
          <p className="shell__brand" title={t('common.brand')}>
            <span className="shell__brand-full">{t('common.brand')}</span>
            <span className="shell__brand-short" aria-hidden="true">
              S
            </span>
          </p>
          <button
            type="button"
            className="shell__collapse"
            onClick={toggleCollapsed}
            aria-expanded={!collapsed}
            aria-label={expandLabel}
            title={expandLabel}
          >
            <NavIcon name={collapsed ? 'expand' : 'collapse'} />
          </button>
        </div>

        <nav className="shell__nav" aria-label={t('staff.title')}>
          {navItems.map((item) => {
            const label = t(item.labelKey)
            const shortLabel = t(item.shortKey)
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => linkClass(item, isActive)}
                title={label}
              >
                <span className="shell__icon-wrap">
                  <NavIcon name={item.icon} />
                </span>
                <span className="shell__link-label">
                  <span className="shell__link-label-full">{label}</span>
                  <span className="shell__link-label-short">{shortLabel}</span>
                </span>
              </NavLink>
            )
          })}
        </nav>

        <button
          type="button"
          className="shell__logout shell__logout--sidebar"
          onClick={handleLogout}
          title={logoutLabel}
        >
          <NavIcon name="logout" />
          <span className="shell__link-label">{logoutLabel}</span>
        </button>
      </aside>

      <div className="shell__main">
        <header className="shell__top">
          <div className="shell__user">
            <img
              src={currentUser.avatar || defaultAvatar}
              alt=""
              width={44}
              height={44}
            />
            <div>
              <p className="shell__name">{currentUser.displayName}</p>
              <span className="shell__badge">{roleLabel}</span>
            </div>
          </div>
          <button
            type="button"
            className="shell__logout shell__logout--top"
            onClick={handleLogout}
            title={logoutLabel}
          >
            <NavIcon name="logout" />
            <span className="shell__link-label">{logoutLabel}</span>
          </button>
        </header>
        <div className="shell__page">
          <PageTransition />
        </div>
      </div>
    </div>
  )
}
