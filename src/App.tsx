import { Navigate, Route, Routes } from 'react-router-dom'
import { useAppSelector } from './store/hooks'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import ProtectedRoute from './routes/ProtectedRoute'
import AuthInitializer from './components/auth/AuthInitializer'
import AuthRedirect from './components/auth/AuthRedirect'

function AppRoutes() {
  const { isAuthenticated, isInitializing, token } = useAppSelector((s) => s.auth)

  return (
    <Routes>
      <Route
        path="/login"
        element={
          isAuthenticated ? (
            <Navigate to="/dashboard" replace />
          ) : isInitializing && token ? null : (
            <LoginPage />
          )
        }
      />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthInitializer>
      <AuthRedirect />
      <AppRoutes />
    </AuthInitializer>
  )
}
