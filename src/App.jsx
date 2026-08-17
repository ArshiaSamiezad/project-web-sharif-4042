import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { PlayingProvider } from './context/PlayingContext'
import { I18nProvider } from './i18n/I18nProvider'
import ProtectedRoute from './components/ProtectedRoute'
import PageTransition from './components/PageTransition'
import AppShell from './layouts/AppShell'
import StaffLayout from './layouts/StaffLayout'
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
import PaymentResultPage from './pages/PaymentResultPage'
import NotificationsPage from './pages/NotificationsPage'
import ArtistWorksPage from './pages/ArtistWorksPage'
import ArtistWorkDetailPage from './pages/ArtistWorkDetailPage'
import StaffInboxPage from './pages/StaffInboxPage'
import StaffArtistDetailPage from './pages/StaffArtistDetailPage'
import StaffTicketDetailPage from './pages/StaffTicketDetailPage'
import StaffFinancePage from './pages/StaffFinancePage'
import StaffSubscriptionsPage from './pages/StaffSubscriptionsPage'

function AuthLayout({ children }) {
  return <PageTransition variant="auth">{children}</PageTransition>
}

export default function App() {
  return (
    <AuthProvider>
      <I18nProvider>
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
                    <StaffLayout />
                  </ProtectedRoute>
                }
              >
                <Route path="/staff" element={<Navigate to="/staff/inbox" replace />} />
                <Route path="/staff/inbox" element={<StaffInboxPage />} />
                <Route path="/staff/artists/:userId" element={<StaffArtistDetailPage />} />
                <Route path="/staff/tickets/:ticketId" element={<StaffTicketDetailPage />} />
                <Route path="/staff/finance" element={<StaffFinancePage />} />
                <Route path="/staff/subscriptions" element={<StaffSubscriptionsPage />} />
              </Route>
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
                <Route path="/artist/works" element={<ArtistWorksPage />} />
                <Route path="/artist/works/:kind/:workId" element={<ArtistWorkDetailPage />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/profile/:username" element={<ProfilePage />} />
                <Route path="/notifications" element={<NotificationsPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/payment" element={<PaymentPage />} />
                <Route path="/payment/result" element={<PaymentResultPage />} />
              </Route>
              <Route path="/" element={<Navigate to="/home" replace />} />
              <Route path="*" element={<Navigate to="/home" replace />} />
            </Routes>
          </BrowserRouter>
        </PlayingProvider>
      </I18nProvider>
    </AuthProvider>
  )
}
