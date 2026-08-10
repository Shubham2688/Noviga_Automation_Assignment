import { Navigate, useLocation } from 'react-router-dom'
import { useAppSelector } from '../store/hooks'
import { CircularProgress, Box } from '@mui/material'

interface ProtectedRouteProps {
  children: React.ReactNode
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isInitializing, token } = useAppSelector((s) => s.auth)
  const location = useLocation()

  if (isInitializing || (token && !isAuthenticated)) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
        <CircularProgress />
      </Box>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <>{children}</>
}
