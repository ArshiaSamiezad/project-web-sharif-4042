import { Outlet, useLocation } from 'react-router-dom'
import './PageTransition.css'

export default function PageTransition({ children, variant = 'app' }) {
  const location = useLocation()
  const content = children ?? <Outlet />

  return (
    <div
      key={location.pathname}
      className={
        variant === 'auth'
          ? 'page-transition page-transition--auth'
          : 'page-transition page-transition--app'
      }
    >
      {content}
    </div>
  )
}
