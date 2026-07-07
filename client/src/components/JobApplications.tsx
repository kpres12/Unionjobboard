import { useEffect, useState } from 'react'
import { api } from '../api'
import StatusBadge from '../components/StatusBadge'
import type { Application, ApplicationStatus } from '../types'

const statuses: ApplicationStatus[] = ['pending', 'reviewed', 'accepted', 'rejected']

interface JobApplicationsProps {
  jobId: number
}

export default function JobApplications({ jobId }: JobApplicationsProps) {
  const [applications, setApplications] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    api.getJobApplications(jobId)
      .then(({ applications }) => setApplications(applications))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load applications'))
      .finally(() => setLoading(false))
  }, [jobId])

  const updateStatus = async (id: number, status: ApplicationStatus) => {
    try {
      const { application } = await api.updateApplicationStatus(id, status)
      setApplications((prev) => prev.map((app) => (app.id === id ? application : app)))
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update status')
    }
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading applications...</p>
  if (error) return <p className="text-sm text-red-600">{error}</p>
  if (applications.length === 0) {
    return <p className="text-sm text-muted-foreground">No applications yet.</p>
  }

  return (
    <div className="space-y-4">
      {applications.map((app) => (
        <div key={app.id} className="rounded-md border border-border bg-amber-50/50 p-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-medium">{app.applicantName}</p>
              <a href={`mailto:${app.applicantEmail}`} className="text-sm text-primary hover:underline">
                {app.applicantEmail}
              </a>
            </div>
            <div className="flex items-center gap-2">
              {app.matchScore != null && (
                <span className="text-xs text-muted-foreground">{app.matchScore}% match</span>
              )}
              <StatusBadge status={app.status} />
            </div>
          </div>

          <p className="mb-3 whitespace-pre-wrap text-sm leading-relaxed">{app.coverLetter}</p>

          <select
            value={app.status}
            onChange={(e) => updateStatus(app.id, e.target.value as ApplicationStatus)}
            className="rounded-md border border-border px-2 py-1 text-sm"
          >
            {statuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>
      ))}
    </div>
  )
}
