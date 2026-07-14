import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ children }) {
  const { ready, currentUser } = useAuth()
  if (!ready) return null
  if (!currentUser) return <Navigate to="/login" replace />
  return children
}
