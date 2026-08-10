import { useEffect } from 'react'
import { useGetMeQuery } from '../../store/api/baseApi'
import { useAppDispatch, useAppSelector } from '../../store/hooks'
import { clearAuth, finishInit, setUser } from '../../store/authSlice'

export default function AuthInitializer({ children }: { children: React.ReactNode }) {
  const dispatch = useAppDispatch()
  const token = useAppSelector((s) => s.auth.token)

  const { data, error, isLoading } = useGetMeQuery(undefined, {
    skip: !token,
  })

  useEffect(() => {
    if (!token) {
      dispatch(finishInit())
      return
    }
    if (data) {
      dispatch(setUser(data))
    } else if (error) {
      dispatch(clearAuth())
    } else if (!isLoading) {
      dispatch(finishInit())
    }
  }, [token, data, error, isLoading, dispatch])

  return <>{children}</>
}
