import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { PlayingProvider } from './context/PlayingContext'
import ProtectedRoute from './components/ProtectedRoute'
import PageTransition from './components/PageTransition'
import AppShell from './layouts/AppShell'
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
import HomePage from './pages/HomePage'
import ProfilePage from './pages/ProfilePage'
import PlaylistsPage from './pages/PlaylistsPage'
import PlaylistDetailPage from './pages/PlaylistDetailPage'
import CatalogPage from './pages/CatalogPage'
import AlbumPage from './pages/AlbumPage'
import SettingsPage from './pages/SettingsPage'
import PaymentPage from './pages/PaymentPage'

function AuthLayout({ children }) {
  return <PageTransition variant="auth">{children}</PageTransition>
}

export default function App() {
  return (
    <AuthProvider>
      <PlayingProvider>
        <BrowserRouter>
          <Routes>
            <Route
              path="/login"
              element={
                <AuthLayout>
                  <LoginPage />
                </AuthLayout>
              }
            />
            <Route
              path="/signup"
              element={
                <AuthLayout>
                  <SignupPage />
                </AuthLayout>
              }
            />
            <Route
              element={
                <ProtectedRoute>
                  <AppShell />
                </ProtectedRoute>
              }
            >
              <Route path="/home" element={<HomePage />} />
              <Route path="/playlists" element={<PlaylistsPage />} />
              <Route path="/playlist/:playlistId" element={<PlaylistDetailPage />} />
              <Route path="/catalog" element={<CatalogPage />} />
              <Route path="/album/:albumId" element={<AlbumPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/profile/:username" element={<ProfilePage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/payment" element={<PaymentPage />} />
            </Route>
            <Route path="/" element={<Navigate to="/home" replace />} />
            <Route path="*" element={<Navigate to="/home" replace />} />
          </Routes>
        </BrowserRouter>
      </PlayingProvider>
    </AuthProvider>
  )
}
