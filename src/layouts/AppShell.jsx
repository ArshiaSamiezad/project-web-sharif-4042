import { useState } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useI18n } from '../i18n/I18nProvider'
import { getItem, setItem } from '../lib/storage'
import PageTransition from '../components/PageTransition'
import './AppShell.css'

const NAV = [
  { to: '/home', labelKey: 'nav.home', shortKey: 'nav.homeShort', end: true, icon: 'home' },
  { to: '/playlists', labelKey: 'nav.playlists', shortKey: 'nav.playlistsShort', icon: 'playlists' },
  { to: '/catalog', labelKey: 'nav.catalog', shortKey: 'nav.catalogShort', icon: 'catalog' },
  { to: '/profile', labelKey: 'nav.profile', shortKey: 'nav.profileShort', icon: 'profile' },
  { to: '/settings', labelKey: 'nav.settings', shortKey: 'nav.settingsShort', icon: 'settings' },
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
    case 'home':
      return (
        <svg {...props}>
          <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5z" />
        </svg>
      )
    case 'playlists':
      return (
        <svg {...props}>
          <path d="M8 6h12M8 12h12M8 18h8" />
          <circle cx="4" cy="6" r="1.2" fill="currentColor" stroke="none" />
          <circle cx="4" cy="12" r="1.2" fill="currentColor" stroke="none" />
          <circle cx="4" cy="18" r="1.2" fill="currentColor" stroke="none" />
        </svg>
      )
    case 'catalog':
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="8" />
          <circle cx="12" cy="12" r="2.2" fill="currentColor" stroke="none" />
          <path d="M12 4v3M12 17v3M4 12h3M17 12h3" />
        </svg>
      )
    case 'profile':
      return (
        <svg {...props}>
          <circle cx="12" cy="8" r="3.2" />
          <path d="M5 19.5c1.6-3.2 4-4.8 7-4.8s5.4 1.6 7 4.8" />
        </svg>
      )
    case 'settings':
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="3" />
          <path d="M12 3.5v2.2M12 18.3v2.2M4.9 6.5l1.6 1.5M17.5 16l1.6 1.5M3.5 12h2.2M18.3 12h2.2M4.9 17.5l1.6-1.5M17.5 8l1.6-1.5" />
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

export default function AppShell() {
  const { currentUser, logout, defaultAvatar } = useAuth()
  const { t, subscriptionLabel } = useI18n()
  const navigate = useNavigate()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(() => Boolean(getItem('sidebarCollapsed', false)))

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
    const profileActive =
      item.to === '/profile' && location.pathname.startsWith('/profile')
    return isActive || profileActive ? 'shell__link is-active' : 'shell__link'
  }

  const expandLabel = collapsed ? t('nav.expand') : t('nav.collapse')
  const logoutLabel = t('nav.logout')

  return (
    <div className={`shell${collapsed ? ' shell--collapsed' : ''}`}>
      <aside className="shell__sidebar" aria-label={t('nav.sidebar')}>
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

        <nav className="shell__nav" aria-label={t('nav.mainMenu')}>
          {NAV.map((item) => {
            const label = t(item.labelKey)
            const shortLabel = t(item.shortKey)
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => linkClass(item, isActive)}
                title={label}
              >
                <NavIcon name={item.icon} />
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
              {currentUser.subscription === 'gold' ? (
                <span className="shell__badge">{subscriptionLabel('gold')}</span>
              ) : currentUser.subscription === 'silver' ? (
                <span className="shell__badge shell__badge--silver">
                  {subscriptionLabel('silver')}
                </span>
              ) : null}
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
