import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import StatusBadge from '../components/StatusBadge'
import type { Application } from '../types'

export default function MyApplicationsPage() {
  const [applications, setApplications] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = () => {
    api.getMyApplications()
      .then(({ applications }) => setApplications(applications))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load applications'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  const handleWithdraw = async (id: number) => {
    if (!confirm('Withdraw this application?')) return

    try {
      await api.withdrawApplication(id)
      setApplications((prev) => prev.filter((app) => app.id !== id))
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to withdraw')
    }
  }

  if (loading) return <p>Loading your applications...</p>
  if (error) return <p className="text-red-600">{error}</p>

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-8 text-3xl font-bold text-primary">My Applications</h1>

      {applications.length === 0 ? (
        <div className="rounded-lg border-2 border-primary/20 bg-white p-8 text-center">
          <p className="mb-4 text-muted-foreground">You haven't applied to any jobs yet.</p>
          <Link to="/" className="text-primary hover:underline">
            Browse job listings
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {applications.map((app) => (
            <article
              key={app.id}
              className="rounded-lg border-2 border-primary/20 bg-white p-6"
            >
              <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-primary">
                    <Link to={`/jobs/${app.jobId}`} className="hover:underline">
                      {app.jobTitle}
                    </Link>
                  </h2>
                  <p className="text-muted-foreground">{app.jobCompany}</p>
                </div>
                <StatusBadge status={app.status} />
              </div>

              <p className="mb-2 text-sm text-muted-foreground">
                Applied {new Date(app.createdAt).toLocaleDateString()}
                {app.matchScore != null && ` · Match score: ${app.matchScore}%`}
              </p>

              <p className="mb-4 whitespace-pre-wrap text-sm leading-relaxed">{app.coverLetter}</p>

              {app.status === 'pending' && (
                <button
                  onClick={() => handleWithdraw(app.id)}
                  className="text-sm text-red-600 hover:underline"
                >
                  Withdraw application
                </button>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
