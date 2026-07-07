import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { api } from '../api'
import type { User, UserRole } from '../types'

interface AuthContextValue {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (name: string, email: string, password: string, role?: UserRole) => Promise<void>
  loginWithToken: (token: string) => Promise<void>
  logout: () => void
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const refreshUser = async () => {
    const { user } = await api.me()
    setUser(user)
  }

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      setLoading(false)
      return
    }

    api.me()
      .then(({ user }) => setUser(user))
      .catch(() => localStorage.removeItem('token'))
      .finally(() => setLoading(false))
  }, [])

  const loginWithToken = async (token: string) => {
    localStorage.setItem('token', token)
    await refreshUser()
  }

  const login = async (email: string, password: string) => {
    const { user, token } = await api.login({ email, password })
    localStorage.setItem('token', token)
    setUser(user)
  }

  const register = async (name: string, email: string, password: string, role: UserRole = 'seeker') => {
    const { user, token } = await api.register({ name, email, password, role })
    localStorage.setItem('token', token)
    setUser(user)
  }

  const logout = () => {
    localStorage.removeItem('token')
    setUser(null)
  }

  return (
    <AuthContext.Provider
      value={{ user, loading, login, register, loginWithToken, logout, refreshUser }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
