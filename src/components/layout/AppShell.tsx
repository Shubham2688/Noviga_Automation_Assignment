import { useState } from 'react'
import {
  AppBar,
  Avatar,
  Box,
  Menu,
  MenuItem,
  Toolbar,
  Typography,
} from '@mui/material'
import LogoutIcon from '@mui/icons-material/Logout'
import { useNavigate } from 'react-router-dom'
import { useLogoutMutation } from '../../store/api/baseApi'
import { useAppDispatch, useAppSelector } from '../../store/hooks'
import { clearAuth } from '../../store/authSlice'

interface AppShellProps {
  children: React.ReactNode
}

export default function AppShell({ children }: AppShellProps) {
  const user = useAppSelector((s) => s.auth.user)
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const [logout] = useLogoutMutation()
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)

  const handleLogout = async () => {
    setAnchorEl(null)
    try {
      await logout().unwrap()
    } catch {
      // clear locally even if API fails
    }
    dispatch(clearAuth())
    navigate('/login', { replace: true })
  }

  return (
    <Box minHeight="100vh" bgcolor="background.default">
      <AppBar position="sticky">
        <Toolbar>
          <Typography variant="h6" fontWeight={600} sx={{ flexGrow: 1 }}>
            Production Timeline
          </Typography>
          {user && (
            <>
              <Box
                display="flex"
                alignItems="center"
                gap={1}
                sx={{ cursor: 'pointer' }}
                onClick={(e) => setAnchorEl(e.currentTarget)}
              >
                <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main', fontSize: 14 }}>
                  {user.name.charAt(0).toUpperCase()}
                </Avatar>
                <Typography variant="body2" fontWeight={500}>
                  {user.name}
                </Typography>
              </Box>
              <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
                <MenuItem disabled>
                  <Typography variant="caption" color="text.secondary">
                    {user.email}
                  </Typography>
                </MenuItem>
                <MenuItem onClick={handleLogout}>
                  <LogoutIcon fontSize="small" sx={{ mr: 1 }} />
                  Logout
                </MenuItem>
              </Menu>
            </>
          )}
        </Toolbar>
      </AppBar>
      <Box p={2}>{children}</Box>
    </Box>
  )
}
