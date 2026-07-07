import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../context/AuthContext'
import type { UserRole } from '../types'

export default function AccountPage() {
  const { user, refreshUser } = useAuth()
  const [role, setRole] = useState<UserRole>(user?.role || 'seeker')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [roleMessage, setRoleMessage] = useState('')

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setMessage('')

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match')
      return
    }

    setSubmitting(true)
    try {
      await api.changePassword({ currentPassword, newPassword })
      setMessage('Password updated successfully')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update password')
    } finally {
      setSubmitting(false)
    }
  }

  const handleRoleUpdate = async () => {
    setRoleMessage('')
    try {
      await api.updateRole(role)
      await refreshUser()
      setRoleMessage('Role updated')
    } catch (err) {
      setRoleMessage(err instanceof Error ? err.message : 'Failed to update role')
    }
  }

  if (!user) return null

  const isLocalAccount = user.authProvider === 'local' || !user.authProvider

  return (
    <div className="mx-auto max-w-lg space-y-8">
      <div>
        <h1 className="mb-2 text-3xl font-bold text-primary">Account</h1>
        <p className="text-muted-foreground">
          {user.name} · {user.email}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Signed in via {user.authProvider || 'email'} · Role: {user.role || 'seeker'}
        </p>
      </div>

      <section className="rounded-lg border-2 border-primary/20 bg-white p-6">
        <h2 className="mb-4 text-xl font-semibold text-primary">Your Role</h2>
        <div className="flex flex-wrap gap-3">
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as UserRole)}
            className="rounded-md border border-border px-3 py-2"
          >
            <option value="seeker">Job Seeker</option>
            <option value="poster">Job Poster</option>
            <option value="both">Both</option>
          </select>
          <button
            onClick={handleRoleUpdate}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Update Role
          </button>
        </div>
        {roleMessage && <p className="mt-2 text-sm text-green-700">{roleMessage}</p>}
        <div className="mt-4 flex flex-wrap gap-4 text-sm">
          {(role === 'seeker' || role === 'both') && (
            <Link to="/dashboard?tab=seeking" className="text-primary hover:underline">
              Go to Dashboard →
            </Link>
          )}
          {(role === 'poster' || role === 'both') && (
            <Link to="/dashboard?tab=posting" className="text-primary hover:underline">
              Manage listings →
            </Link>
          )}
        </div>
      </section>

      {isLocalAccount ? (
        <section className="rounded-lg border-2 border-primary/20 bg-white p-6">
          <h2 className="mb-4 text-xl font-semibold text-primary">Change Password</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Your password is stored using bcrypt hashing and is never saved in plain text.
          </p>
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Current password</label>
              <input
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full rounded-md border border-border px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">New password</label>
              <input
                type="password"
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full rounded-md border border-border px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Confirm new password</label>
              <input
                type="password"
                required
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-md border border-border px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}
            {message && <p className="text-sm text-green-700">{message}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {submitting ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        </section>
      ) : (
        <section className="rounded-lg border-2 border-primary/20 bg-white p-6">
          <p className="text-muted-foreground">
            Password management is handled by {user.authProvider}. Use that provider to manage your
            account security.
          </p>
        </section>
      )}

      <p className="text-center text-sm">
        <Link to="/forgot-password" className="text-primary hover:underline">
          Forgot password?
        </Link>
      </p>
    </div>
  )
}
