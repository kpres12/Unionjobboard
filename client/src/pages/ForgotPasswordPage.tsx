import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [devResetUrl, setDevResetUrl] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setMessage('')
    setDevResetUrl('')
    setSubmitting(true)

    try {
      const result = await api.forgotPassword(email)
      setMessage(result.message)
      if (result.devResetUrl) setDevResetUrl(result.devResetUrl)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <h1 className="mb-2 text-3xl font-bold text-primary">Forgot Password</h1>
      <p className="mb-8 text-muted-foreground">
        Enter your email and we'll send you a link to reset your password.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border-2 border-primary/20 bg-white p-6">
        <div>
          <label htmlFor="email" className="mb-1 block text-sm font-medium">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border border-border px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {message && <p className="text-sm text-green-700">{message}</p>}
        {devResetUrl && (
          <p className="break-all text-sm text-muted-foreground">
            Dev reset link:{' '}
            <Link to={devResetUrl.replace(/^https?:\/\/[^/]+/, '')} className="text-primary hover:underline">
              click here
            </Link>
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {submitting ? 'Sending...' : 'Send Reset Link'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm">
        <Link to="/" className="text-primary hover:underline">
          Back to home
        </Link>
      </p>
    </div>
  )
}
