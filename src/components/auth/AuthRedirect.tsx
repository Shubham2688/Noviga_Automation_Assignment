import { useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAppSelector } from '../../store/hooks'

export default function AuthRedirect() {
  const { isAuthenticated, token } = useAppSelector((s) => s.auth)
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    if (!token && !isAuthenticated && location.pathname !== '/login') {
      navigate('/login', { replace: true })
    }
  }, [token, isAuthenticated, location.pathname, navigate])

  return null
}
