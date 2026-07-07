import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function AuthCallbackPage() {
  const [searchParams] = useSearchParams()
  const { loginWithToken } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState('')

  useEffect(() => {
    const token = searchParams.get('token')
    const authError = searchParams.get('error')

    if (authError) {
      setError(authError)
      return
    }

    if (!token) {
      setError('Missing authentication token')
      return
    }

    loginWithToken(token)
      .then(() => navigate('/dashboard', { replace: true }))
      .catch((err) => setError(err instanceof Error ? err.message : 'Sign-in failed'))
  }, [searchParams, loginWithToken, navigate])

  if (error) {
    return (
      <div className="mx-auto max-w-md text-center">
        <h1 className="mb-4 text-2xl font-bold text-primary">Sign-in failed</h1>
        <p className="mb-6 text-red-600">{error}</p>
        <Link to="/" className="text-primary hover:underline">
          Return home
        </Link>
      </div>
    )
  }

  return <p className="text-center text-muted-foreground">Completing sign-in...</p>
}
