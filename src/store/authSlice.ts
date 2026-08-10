import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { User } from '../types/api'
import { clearStoredToken, getStoredToken, setStoredToken } from '../api/client'

interface AuthState {
  token: string | null
  user: User | null
  isAuthenticated: boolean
  isInitializing: boolean
}

const initialState: AuthState = {
  token: getStoredToken(),
  user: null,
  isAuthenticated: false,
  isInitializing: !!getStoredToken(),
}

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setToken(state, action: PayloadAction<string>) {
      state.token = action.payload
      state.isInitializing = true
      setStoredToken(action.payload)
    },
    setUser(state, action: PayloadAction<User>) {
      state.user = action.payload
      state.isAuthenticated = true
      state.isInitializing = false
    },
    clearAuth(state) {
      state.token = null
      state.user = null
      state.isAuthenticated = false
      state.isInitializing = false
      clearStoredToken()
    },
    setInitializing(state, action: PayloadAction<boolean>) {
      state.isInitializing = action.payload
    },
    finishInit(state) {
      state.isInitializing = false
    },
  },
})

export const { setToken, setUser, clearAuth, setInitializing, finishInit } =
  authSlice.actions
export default authSlice.reducer
