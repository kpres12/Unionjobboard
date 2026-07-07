import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import ApprovalStatusBadge from '../components/ApprovalStatusBadge'
import JobTypeBadge from '../components/JobTypeBadge'
import StatusBadge from '../components/StatusBadge'
import { JOB_TYPES } from '../constants/jobTypes'
import type { AdminStats, Application, ApplicationStatus, ApprovalStatus, Job, User } from '../types'

type Tab = 'overview' | 'users' | 'jobs' | 'bcorp' | 'applications'

export default function AdminDashboardPage() {
  const [tab, setTab] = useState<Tab>('overview')
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [users, setUsers] = useState<User[]>([])
  const [jobs, setJobs] = useState<Job[]>([])
  const [pendingBCorps, setPendingBCorps] = useState<Job[]>([])
  const [applications, setApplications] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadTab = async (activeTab: Tab) => {
    setLoading(true)
    setError('')

    try {
      if (activeTab === 'overview') {
        const { stats } = await api.getAdminStats()
        setStats(stats)
      } else if (activeTab === 'users') {
        const { users } = await api.getAdminUsers()
        setUsers(users)
      } else if (activeTab === 'jobs') {
        const { jobs } = await api.getAdminJobs()
        setJobs(jobs)
      } else if (activeTab === 'bcorp') {
        const { jobs } = await api.getAdminJobs({ status: 'pending' })
        setPendingBCorps(jobs)
      } else {
        const { applications } = await api.getAdminApplications()
        setApplications(applications)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load admin data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTab(tab)
  }, [tab])

  const handleToggleAdmin = async (user: User) => {
    try {
      const { user: updated } = await api.toggleUserAdmin(user.id, !user.isAdmin)
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? { ...u, ...updated } : u)))
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update user')
    }
  }

  const handleDeleteUser = async (id: number) => {
    if (!confirm('Delete this user and all their data?')) return

    try {
      await api.deleteAdminUser(id)
      setUsers((prev) => prev.filter((u) => u.id !== id))
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete user')
    }
  }

  const handleDeleteJob = async (id: number) => {
    if (!confirm('Delete this job listing?')) return

    try {
      await api.deleteAdminJob(id)
      setJobs((prev) => prev.filter((j) => j.id !== id))
      setPendingBCorps((prev) => prev.filter((j) => j.id !== id))
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete job')
    }
  }

  const handleJobApproval = async (id: number, status: ApprovalStatus) => {
    try {
      const { job } = await api.updateJobApproval(id, status)
      setPendingBCorps((prev) => prev.filter((j) => j.id !== id))
      setJobs((prev) => prev.map((j) => (j.id === id ? job : j)))
      if (stats) {
        const { stats: refreshed } = await api.getAdminStats()
        setStats(refreshed)
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update listing approval')
    }
  }

  const handleUpdateApplication = async (id: number, status: ApplicationStatus) => {
    try {
      const { application } = await api.updateApplicationStatus(id, status)
      setApplications((prev) => prev.map((a) => (a.id === id ? application : a)))
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update application')
    }
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'bcorp', label: 'B-Corp Queue' },
    { id: 'users', label: 'Users' },
    { id: 'jobs', label: 'Jobs' },
    { id: 'applications', label: 'Applications' },
  ]

  return (
    <div>
      <h1 className="mb-2 text-3xl font-bold text-primary">Admin Dashboard</h1>
      <p className="mb-8 text-muted-foreground">Manage users, jobs, B-Corp reviews, and applications.</p>

      <div className="mb-8 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.id
                ? 'bg-primary text-primary-foreground'
                : 'bg-white text-primary hover:bg-primary/10'
            }`}
          >
            {t.label}
            {t.id === 'bcorp' && stats?.pendingBCorpJobs ? ` (${stats.pendingBCorpJobs})` : ''}
          </button>
        ))}
      </div>

      {loading && <p>Loading...</p>}
      {error && <p className="text-red-600">{error}</p>}

      {!loading && !error && tab === 'overview' && stats && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { label: 'Total Users', value: stats.users },
            { label: 'Job Listings', value: stats.jobs },
            { label: 'Applications', value: stats.applications },
            { label: 'Pending Applications', value: stats.pendingApplications },
            { label: 'B-Corps Awaiting Review', value: stats.pendingBCorpJobs },
            ...JOB_TYPES.map((jobType) => ({
              label: jobType,
              value: stats.jobsByType?.[jobType] ?? 0,
            })),
          ].map((item) => (
            <div key={item.label} className="rounded-lg border-2 border-primary/20 bg-white p-6">
              <p className="text-sm text-muted-foreground">{item.label}</p>
              <p className="text-3xl font-bold text-primary">{item.value}</p>
            </div>
          ))}
        </div>
      )}

      {!loading && !error && tab === 'bcorp' && (
        <div className="space-y-4">
          {pendingBCorps.length === 0 && (
            <p className="text-muted-foreground">No B-Corp listings are waiting for review.</p>
          )}
          {pendingBCorps.map((job) => (
            <div key={job.id} className="rounded-lg border-2 border-primary/20 bg-white p-6">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-semibold text-primary">{job.title}</h2>
                    <JobTypeBadge type={job.type} />
                    <ApprovalStatusBadge status={job.approvalStatus || 'pending'} />
                  </div>
                  <p className="text-muted-foreground">
                    {job.company} · {job.location}
                    {job.source ? ` · via ${job.source}` : ''}
                  </p>
                  {job.posterName && (
                    <p className="mt-1 text-sm text-muted-foreground">Posted by {job.posterName}</p>
                  )}
                </div>
                <Link to={`/jobs/${job.id}`} className="text-sm text-primary hover:underline">
                  Preview listing
                </Link>
              </div>
              <p className="mb-4 line-clamp-4 text-sm leading-relaxed text-foreground/90">
                {job.description}
              </p>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => handleJobApproval(job.id, 'approved')}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  Approve
                </button>
                <button
                  onClick={() => handleJobApproval(job.id, 'rejected')}
                  className="rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                >
                  Reject
                </button>
                <button
                  onClick={() => handleDeleteJob(job.id)}
                  className="rounded-md border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-muted/40"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && !error && tab === 'users' && (
        <div className="overflow-x-auto rounded-lg border-2 border-primary/20 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-muted/50">
              <tr>
                <th className="p-4">Name</th>
                <th className="p-4">Email</th>
                <th className="p-4">Applications</th>
                <th className="p-4">Admin</th>
                <th className="p-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-border last:border-0">
                  <td className="p-4 font-medium">{user.name}</td>
                  <td className="p-4">{user.email}</td>
                  <td className="p-4">{user.applicationCount ?? 0}</td>
                  <td className="p-4">{user.isAdmin ? 'Yes' : 'No'}</td>
                  <td className="p-4 space-x-2">
                    <button
                      onClick={() => handleToggleAdmin(user)}
                      className="text-primary hover:underline"
                    >
                      {user.isAdmin ? 'Revoke admin' : 'Make admin'}
                    </button>
                    <button
                      onClick={() => handleDeleteUser(user.id)}
                      className="text-red-600 hover:underline"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && !error && tab === 'jobs' && (
        <div className="space-y-4">
          {jobs.map((job) => (
            <div key={job.id} className="flex flex-wrap items-center justify-between gap-4 rounded-lg border-2 border-primary/20 bg-white p-4">
              <div>
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-primary">{job.title}</p>
                  {job.type === 'B-Corp' && (
                    <ApprovalStatusBadge status={job.approvalStatus || 'approved'} />
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  {job.company} · {job.location} · {job.applicationCount ?? 0} applications
                </p>
              </div>
              <button
                onClick={() => handleDeleteJob(job.id)}
                className="text-sm text-red-600 hover:underline"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}

      {!loading && !error && tab === 'applications' && (
        <div className="space-y-4">
          {applications.map((app) => (
            <div key={app.id} className="rounded-lg border-2 border-primary/20 bg-white p-4">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium">{app.applicantName}</p>
                  <p className="text-sm text-muted-foreground">
                    {app.jobTitle} at {app.jobCompany}
                  </p>
                </div>
                <StatusBadge status={app.status} />
              </div>
              <p className="mb-3 text-sm leading-relaxed">{app.coverLetter}</p>
              <select
                value={app.status}
                onChange={(e) => handleUpdateApplication(app.id, e.target.value as ApplicationStatus)}
                className="rounded-md border border-border px-2 py-1 text-sm"
              >
                {(['pending', 'reviewed', 'accepted', 'rejected'] as ApplicationStatus[]).map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
