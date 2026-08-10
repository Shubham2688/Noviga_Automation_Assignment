import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  TextField,
  Typography,
} from '@mui/material'
import { useLoginMutation } from '../store/api/baseApi'
import { useAppDispatch } from '../store/hooks'
import { setToken } from '../store/authSlice'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [validationError, setValidationError] = useState('')
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const [login, { isLoading, error }] = useLoginMutation()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setValidationError('')

    if (!username.trim() || !password.trim()) {
      setValidationError('Username and password are required.')
      return
    }

    try {
      const result = await login({ username: username.trim(), password }).unwrap()
      dispatch(setToken(result.access_token))
      navigate('/dashboard', { replace: true })
    } catch {
      // error handled below
    }
  }

  const apiError =
    error && 'status' in error && error.status === 401
      ? 'Invalid credentials. Please try again.'
      : error && 'data' in error
        ? String(error.data)
        : error
          ? 'Login failed. Please try again.'
          : null

  return (
    <Box
      minHeight="100vh"
      display="flex"
      alignItems="center"
      justifyContent="center"
      bgcolor="background.default"
      px={2}
    >
      <Card sx={{ width: '100%', maxWidth: 420 }}>
        <CardContent sx={{ p: 4 }}>
          <Typography variant="h5" fontWeight={600} gutterBottom>
            Timeline Dashboard
          </Typography>
          <Typography variant="body2" color="text.secondary" mb={3}>
            Sign in to view production analytics
          </Typography>

          <Box component="form" onSubmit={handleSubmit} display="flex" flexDirection="column" gap={2}>
            <TextField
              label="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              fullWidth
              disabled={isLoading}
            />
            <TextField
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              fullWidth
              disabled={isLoading}
            />

            {(validationError || apiError) && (
              <Alert severity="error">{validationError || apiError}</Alert>
            )}

            <Button
              type="submit"
              variant="contained"
              size="large"
              disabled={isLoading}
              startIcon={isLoading ? <CircularProgress size={18} color="inherit" /> : undefined}
            >
              {isLoading ? 'Signing in…' : 'Sign in'}
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Box>
  )
}
