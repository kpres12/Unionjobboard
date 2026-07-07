import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { canPost } from '../utils/roles'

export function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) return <p>Loading...</p>
  if (!user?.isAdmin) return <Navigate to="/" replace />

  return <>{children}</>
}

export function AuthRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) return <p>Loading...</p>
  if (!user) return <Navigate to="/" replace />

  return <>{children}</>
}

export function PosterRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) return <p>Loading...</p>
  if (!user) return <Navigate to="/" replace />
  if (!canPost(user)) return <Navigate to="/dashboard" replace />

  return <>{children}</>
}
