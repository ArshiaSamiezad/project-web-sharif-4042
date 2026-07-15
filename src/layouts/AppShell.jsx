import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import PageTransition from '../components/PageTransition'
import './AppShell.css'

const NAV = [
  { to: '/home', label: 'خانه', end: true },
  { to: '/playlists', label: 'پلی‌لیست‌ها' },
  { to: '/catalog', label: 'آلبوم‌ها و تک‌آهنگ‌ها' },
  { to: '/profile', label: 'نمایه کاربری' },
  { to: '/settings', label: 'تنظیمات برنامه' },
]

export default function AppShell() {
  const { currentUser, logout, defaultAvatar } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="shell">
      <aside className="shell__sidebar">
        <p className="shell__brand">Sepatify</p>
        <nav className="shell__nav" aria-label="منوی اصلی">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => {
                const profileActive =
                  item.to === '/profile' && location.pathname.startsWith('/profile')
                return isActive || profileActive ? 'shell__link is-active' : 'shell__link'
              }}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <button type="button" className="shell__logout" onClick={handleLogout}>
          خروج
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
                <span className="shell__badge">طلایی</span>
              ) : currentUser.subscription === 'silver' ? (
                <span className="shell__badge shell__badge--silver">نقره‌ای</span>
              ) : null}
            </div>
          </div>
        </header>
        <div className="shell__page">
          <PageTransition />
        </div>
      </div>
    </div>
  )
}
