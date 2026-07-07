import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { api, getAppleSignInUrl, getGoogleSignInUrl } from '../api'
import { useAuth } from '../context/AuthContext'
import type { OAuthProviders, UserRole } from '../types'

type Mode = 'login' | 'register' | 'forgot'

function GoogleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  )
}

function AppleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
    </svg>
  )
}

export default function LoginDialog() {
  const { login, register } = useAuth()
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<Mode>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<UserRole>('seeker')
  const [providers, setProviders] = useState<OAuthProviders>({ google: false, apple: false })
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    api.getOAuthProviders().then(setProviders).catch(() => {})
  }, [open])

  const reset = () => {
    setName('')
    setEmail('')
    setPassword('')
    setRole('seeker')
    setError('')
    setMessage('')
    setMode('login')
  }

  const close = () => {
    setOpen(false)
    reset()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setMessage('')
    setSubmitting(true)

    try {
      if (mode === 'forgot') {
        const result = await api.forgotPassword(email)
        setMessage(result.message)
        if (result.devResetUrl) {
          setMessage(`${result.message} Check the server console for the dev link.`)
        }
      } else if (mode === 'login') {
        await login(email, password)
        close()
      } else {
        await register(name, email, password, role)
        close()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  const startGoogleSignIn = () => {
    if (!providers.google) {
      setError('Google sign-in is not configured yet. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to server/.env')
      return
    }
    window.location.href = getGoogleSignInUrl(role)
  }

  const startAppleSignIn = () => {
    if (!providers.apple) {
      setError('Apple sign-in is not configured yet. Add Apple credentials to server/.env')
      return
    }
    window.location.href = getAppleSignInUrl(role)
  }

  const openDialog = (nextMode: Mode) => {
    setMode(nextMode)
    setOpen(true)
  }

  if (!open) {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={() => openDialog('register')}
          className="rounded-md border border-primary-foreground/60 px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-foreground/10"
        >
          Register
        </button>
        <button
          onClick={() => openDialog('login')}
          className="rounded-md border border-secondary bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground hover:bg-secondary/90"
        >
          Sign In
        </button>
      </div>
    )
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg bg-white p-6 text-gray-900 shadow-xl">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-primary">
            {mode === 'login' && 'Sign In'}
            {mode === 'register' && 'Create Account'}
            {mode === 'forgot' && 'Reset Password'}
          </h2>
          <button onClick={close} className="text-gray-500 hover:text-primary" aria-label="Close">
            ✕
          </button>
        </div>

        {mode !== 'forgot' && (
          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium text-gray-900">I am a...</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-gray-900"
            >
              <option value="seeker">Job Seeker</option>
              <option value="poster">Job Poster</option>
              <option value="both">Both</option>
            </select>
          </div>
        )}

        {mode !== 'forgot' && (
          <div className="mb-4 space-y-3">
            <button
              type="button"
              onClick={startGoogleSignIn}
              className="flex w-full items-center justify-center gap-3 rounded-md border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-800 hover:bg-gray-50"
            >
              <GoogleIcon />
              Continue with Google
            </button>
            <button
              type="button"
              onClick={startAppleSignIn}
              className="flex w-full items-center justify-center gap-3 rounded-md border border-gray-900 bg-black px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-900"
            >
              <AppleIcon />
              Continue with Apple
            </button>
            {(!providers.google || !providers.apple) && (
              <p className="text-center text-xs text-gray-500">
                {!providers.google && !providers.apple
                  ? 'Social sign-in requires OAuth credentials in server/.env'
                  : !providers.google
                    ? 'Google: add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to server/.env'
                    : 'Apple: add Apple Sign In credentials to server/.env'}
              </p>
            )}
            <div className="relative text-center text-xs text-gray-500">
              <span className="relative z-10 bg-white px-2">or continue with email</span>
              <div className="absolute inset-x-0 top-1/2 border-t border-gray-200" />
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (
            <div>
              <label htmlFor="name" className="mb-1 block text-sm font-medium text-gray-900">
                Name
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full rounded-md border border-border bg-white px-3 py-2 text-gray-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          )}

          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium text-gray-900">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-md border border-border bg-white px-3 py-2 text-gray-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {mode !== 'forgot' && (
            <div>
              <div className="mb-1 flex items-center justify-between">
                <label htmlFor="password" className="text-sm font-medium text-gray-900">
                  Password
                </label>
                {mode === 'login' && (
                  <button
                    type="button"
                    onClick={() => setMode('forgot')}
                    className="text-xs text-primary hover:underline"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                className="w-full rounded-md border border-border bg-white px-3 py-2 text-gray-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
              {mode === 'register' && (
                <p className="mt-1 text-xs text-gray-500">
                  At least 8 characters with one letter and one number. Stored with bcrypt hashing.
                </p>
              )}
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}
          {message && <p className="text-sm text-green-700">{message}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {submitting
              ? 'Please wait...'
              : mode === 'login'
                ? 'Sign In'
                : mode === 'register'
                  ? 'Create Account'
                  : 'Send Reset Link'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-gray-700">
          {mode === 'login' && (
            <>
              Need an account?{' '}
              <button onClick={() => setMode('register')} className="text-primary hover:underline">
                Register
              </button>
            </>
          )}
          {mode === 'register' && (
            <>
              Already have an account?{' '}
              <button onClick={() => setMode('login')} className="text-primary hover:underline">
                Sign in
              </button>
            </>
          )}
          {mode === 'forgot' && (
            <>
              Remember your password?{' '}
              <button onClick={() => setMode('login')} className="text-primary hover:underline">
                Sign in
              </button>
              {' · '}
              <Link to="/forgot-password" onClick={close} className="text-primary hover:underline">
                Full page
              </Link>
            </>
          )}
        </p>
      </div>
    </div>,
    document.body,
  )
}
