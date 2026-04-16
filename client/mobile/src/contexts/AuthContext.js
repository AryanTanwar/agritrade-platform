import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { authApi } from '../api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    AsyncStorage.getItem('accessToken').then(token => {
      if (!token) { setLoading(false); return }
      authApi.getMe()
        .then(({ data }) => setUser(data))
        .catch(() => AsyncStorage.multiRemove(['accessToken', 'refreshToken']))
        .finally(() => setLoading(false))
    })
  }, [])

  const login = useCallback(async (credentials) => {
    const { data } = await authApi.login(credentials)
    await AsyncStorage.setItem('accessToken',  data.accessToken)
    await AsyncStorage.setItem('refreshToken', data.refreshToken)
    const { data: me } = await authApi.getMe()
    setUser(me)
    return me
  }, [])

  const logout = useCallback(async () => {
    try { await authApi.logout() } catch { /* ignore */ }
    await AsyncStorage.multiRemove(['accessToken', 'refreshToken'])
    setUser(null)
  }, [])

  const register = useCallback(async (role, data) => {
    const fn = role === 'farmer' ? authApi.registerFarmer : authApi.registerBuyer
    return (await fn(data)).data
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, register }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
