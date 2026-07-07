import { useEffect, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { api } from '../api'
import ApprovalStatusBadge from '../components/ApprovalStatusBadge'
import StatusBadge from '../components/StatusBadge'
import { useAuth } from '../context/AuthContext'
import { canPost, canSeek } from '../utils/roles'
import type { PosterDashboard, SeekerDashboard } from '../types'

type Tab = 'seeking' | 'posting'

export default function DashboardPage() {
  const { user } = useAuth()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const [seekerData, setSeekerData] = useState<SeekerDashboard | null>(null)
  const [posterData, setPosterData] = useState<PosterDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const isSeeker = canSeek(user)
  const isPoster = canPost(user)
  const showTabs = isSeeker && isPoster

  const requestedTab = searchParams.get('tab') as Tab | null
  const activeTab: Tab =
    requestedTab === 'posting' && isPoster
      ? 'posting'
      : requestedTab === 'seeking' && isSeeker
        ? 'seeking'
        : isSeeker
          ? 'seeking'
          : 'posting'

  useEffect(() => {
    if (!user) return

    setLoading(true)
    setError('')

    const requests: Promise<void>[] = []

    if (isSeeker) {
      requests.push(
        api.getSeekerDashboard().then(setSeekerData).catch(() => {
          throw new Error('Failed to load seeking dashboard')
        })
      )
    }

    if (isPoster) {
      requests.push(
        api.getPosterDashboard().then(setPosterData).catch(() => {
          throw new Error('Failed to load posting dashboard')
        })
      )
    }

    Promise.all(requests)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load dashboard'))
      .finally(() => setLoading(false))
  }, [user, isSeeker, isPoster])

  const setTab = (tab: Tab) => {
    setSearchParams({ tab })
  }

  if (loading) return <p>Loading your dashboard...</p>
  if (error) return <p className="text-red-600">{error}</p>

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-primary">Dashboard</h1>
        <p className="text-muted-foreground">Welcome back, {user?.name}</p>
      </div>

      {location.state?.notice && (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900">
          {location.state.notice}
        </div>
      )}

      {showTabs && (
        <div className="mb-8 flex gap-2 border-b border-border">
          <button
            onClick={() => setTab('seeking')}
            className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 'seeking'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-primary'
            }`}
          >
            Seeking
          </button>
          <button
            onClick={() => setTab('posting')}
            className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 'posting'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-primary'
            }`}
          >
            Posting
          </button>
        </div>
      )}

      {activeTab === 'seeking' && isSeeker && seekerData && (
        <div>
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <p className="text-muted-foreground">Track applications and find your next role.</p>
            <Link
              to="/"
              className="rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground hover:bg-primary/90"
            >
              Browse Jobs
            </Link>
          </div>

          <div className="mb-8 grid gap-4 sm:grid-cols-3">
            {[
              { label: 'Total Applications', value: seekerData.stats.totalApplications },
              { label: 'Pending', value: seekerData.stats.pending },
              { label: 'Accepted', value: seekerData.stats.accepted },
            ].map((item) => (
              <div key={item.label} className="rounded-lg border-2 border-primary/20 bg-white p-6">
                <p className="text-sm text-muted-foreground">{item.label}</p>
                <p className="text-3xl font-bold text-primary">{item.value}</p>
              </div>
            ))}
          </div>

          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-primary">Recent Applications</h2>
              <Link to="/my-applications" className="text-sm text-primary hover:underline">
                View all
              </Link>
            </div>

            {seekerData.recentApplications.length === 0 ? (
              <div className="rounded-lg border-2 border-primary/20 bg-white p-8 text-center">
                <p className="mb-4 text-muted-foreground">You haven't applied to any jobs yet.</p>
                <Link to="/" className="text-primary hover:underline">
                  Start browsing
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {seekerData.recentApplications.map((app) => (
                  <div
                    key={app.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border-2 border-primary/20 bg-white p-4"
                  >
                    <div>
                      <Link to={`/jobs/${app.jobId}`} className="font-medium text-primary hover:underline">
                        {app.jobTitle}
                      </Link>
                      <p className="text-sm text-muted-foreground">{app.jobCompany}</p>
                    </div>
                    <StatusBadge status={app.status} />
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {activeTab === 'posting' && isPoster && posterData && (
        <div>
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <p className="text-muted-foreground">Manage listings and review applicants.</p>
            <Link
              to="/post-job"
              className="rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground hover:bg-primary/90"
            >
              Post a Job
            </Link>
          </div>

          <div className="mb-8 grid gap-4 sm:grid-cols-3">
            {[
              { label: 'Active Listings', value: posterData.stats.totalListings },
              { label: 'Total Applications', value: posterData.stats.totalApplications },
              { label: 'Pending Review', value: posterData.stats.pendingReview },
            ].map((item) => (
              <div key={item.label} className="rounded-lg border-2 border-primary/20 bg-white p-6">
                <p className="text-sm text-muted-foreground">{item.label}</p>
                <p className="text-3xl font-bold text-primary">{item.value}</p>
              </div>
            ))}
          </div>

          <section className="mb-10">
            <h2 className="mb-4 text-xl font-semibold text-primary">Your Listings</h2>
            {posterData.listings.length === 0 ? (
              <div className="rounded-lg border-2 border-primary/20 bg-white p-8 text-center">
                <p className="mb-4 text-muted-foreground">You haven't posted any jobs yet.</p>
                <Link to="/post-job" className="text-primary hover:underline">
                  Post your first job
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {posterData.listings.map((job) => (
                  <div
                    key={job.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border-2 border-primary/20 bg-white p-4"
                  >
                    <div>
                      <Link to={`/jobs/${job.id}`} className="font-medium text-primary hover:underline">
                        {job.title}
                      </Link>
                      <p className="text-sm text-muted-foreground">
                        {job.company} · {job.location}
                      </p>
                    </div>
                    <div className="text-right text-sm">
                      {job.type === 'B-Corp' && job.approvalStatus && job.approvalStatus !== 'approved' && (
                        <div className="mb-2 flex justify-end">
                          <ApprovalStatusBadge status={job.approvalStatus} />
                        </div>
                      )}
                      <p>{job.applicationCount ?? 0} applications</p>
                      {(job.pendingApplications ?? 0) > 0 && (
                        <p className="text-primary">{job.pendingApplications} pending</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="mb-4 text-xl font-semibold text-primary">Recent Applications</h2>
            {posterData.recentApplications.length === 0 ? (
              <p className="text-muted-foreground">No applications received yet.</p>
            ) : (
              <div className="space-y-3">
                {posterData.recentApplications.map((app) => (
                  <div
                    key={app.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border-2 border-primary/20 bg-white p-4"
                  >
                    <div>
                      <p className="font-medium">{app.applicantName}</p>
                      <p className="text-sm text-muted-foreground">
                        Applied for{' '}
                        <Link to={`/jobs/${app.jobId}`} className="text-primary hover:underline">
                          {app.jobTitle}
                        </Link>
                      </p>
                    </div>
                    <StatusBadge status={app.status} />
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  )
}
