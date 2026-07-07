import { useState } from 'react'
import { api } from '../api'
import { useAuth } from '../context/AuthContext'
import type { Application, Job } from '../types'

interface ApplyFormProps {
  job: Job
  existingApplication?: Application | null
  onApplied: (application: Application) => void
}

export default function ApplyForm({ job, existingApplication, onApplied }: ApplyFormProps) {
  const { user } = useAuth()
  const [coverLetter, setCoverLetter] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  if (!user) {
    return (
      <p className="text-muted-foreground">
        Log in to apply for this position through the job board.
      </p>
    )
  }

  if (user.id === job.postedBy) {
    return null
  }

  if (existingApplication) {
    return (
      <div className="rounded-md border border-green-200 bg-green-50 p-4">
        <p className="font-medium text-green-800">You applied on {new Date(existingApplication.createdAt).toLocaleDateString()}</p>
        {existingApplication.matchScore != null && (
          <p className="mt-1 text-sm text-green-700">Match score: {existingApplication.matchScore}%</p>
        )}
      </div>
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      const { application } = await api.applyToJob({ jobId: job.id, coverLetter })
      onApplied(application)
      setCoverLetter('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit application')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="coverLetter" className="mb-1 block text-sm font-medium">
          Cover Letter
        </label>
        <textarea
          id="coverLetter"
          required
          rows={5}
          value={coverLetter}
          onChange={(e) => setCoverLetter(e.target.value)}
          placeholder="Tell the employer why you're a great fit..."
          className="w-full rounded-md border border-border px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="rounded-md bg-primary px-6 py-3 font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {submitting ? 'Submitting...' : 'Submit Application'}
      </button>
    </form>
  )
}
