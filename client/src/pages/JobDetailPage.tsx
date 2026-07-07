import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Briefcase, Calendar, DollarSign, ExternalLink, Mail, MapPin, Tag } from 'lucide-react'
import { api } from '../api'
import ApplyForm from '../components/ApplyForm'
import ApprovalStatusBadge from '../components/ApprovalStatusBadge'
import JobApplications from '../components/JobApplications'
import JobDescription from '../components/JobDescription'
import JobTypeBadge from '../components/JobTypeBadge'
import { useAuth } from '../context/AuthContext'
import { jobMetaItems } from '../utils/formatJob'
import type { Application, Job } from '../types'

const metaIcons: Record<string, typeof MapPin> = {
  Location: MapPin,
  Category: Tag,
  Salary: DollarSign,
  Source: ExternalLink,
  Posted: Calendar,
}

export default function JobDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [job, setJob] = useState<Job | null>(null)
  const [myApplication, setMyApplication] = useState<Application | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!id) return

    const jobId = Number(id)

    Promise.all([
      api.getJob(jobId),
      user ? api.getMyApplications().catch(() => ({ applications: [] as Application[] })) : Promise.resolve({ applications: [] }),
    ])
      .then(([{ job }, { applications }]) => {
        setJob(job)
        setMyApplication(applications.find((app) => app.jobId === jobId) ?? null)
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Job not found'))
      .finally(() => setLoading(false))
  }, [id, user])

  const handleDelete = async () => {
    if (!job || !confirm('Delete this job listing?')) return

    try {
      await api.deleteJob(job.id)
      navigate('/')
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete job')
    }
  }

  if (loading) return <p>Loading...</p>
  if (error || !job) return <p className="text-red-600">{error || 'Job not found'}</p>

  const isOwner = user?.id === job.postedBy
  const isAdmin = user?.isAdmin
  const meta = jobMetaItems(job)

  return (
    <div className="mx-auto max-w-3xl">
      <Link to="/" className="mb-6 inline-block text-primary hover:underline">
        ← Back to listings
      </Link>

      <article className="overflow-hidden rounded-lg border-2 border-primary/20 bg-white shadow-sm">
        <header className="border-b border-border bg-primary/5 px-8 py-8">
          {job.approvalStatus && job.approvalStatus !== 'approved' && (isOwner || isAdmin) && (
            <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <ApprovalStatusBadge status={job.approvalStatus} />
              <span>
                {job.approvalStatus === 'pending'
                  ? 'This B-Corp listing is hidden from public search until an admin approves it.'
                  : 'This B-Corp listing was rejected and is not visible to job seekers.'}
              </span>
            </div>
          )}
          <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="mb-2 text-3xl font-bold text-primary">{job.title}</h1>
              <p className="text-xl text-muted-foreground">{job.company}</p>
            </div>
            <JobTypeBadge type={job.type} />
          </div>

          <dl className="grid gap-3 sm:grid-cols-2">
            {meta.map((item) => {
              const Icon = metaIcons[item.label] ?? Briefcase
              return (
                <div key={item.label} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary/70" />
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground/80">
                      {item.label}
                    </dt>
                    <dd className="text-base text-foreground">
                      {item.href ? (
                        <a
                          href={item.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          {item.value}
                        </a>
                      ) : (
                        item.value
                      )}
                    </dd>
                  </div>
                </div>
              )
            })}
          </dl>
        </header>

        <section className="px-8 py-8">
          <h2 className="mb-4 text-xl font-semibold text-primary">About this role</h2>
          <JobDescription description={job.description} />
        </section>

        <section className="border-t border-border px-8 py-8">
          <h2 className="mb-4 text-xl font-semibold text-primary">Apply for this position</h2>
          {job.approvalStatus !== 'approved' ? (
            <p className="text-muted-foreground">
              Applications are not open for this listing yet.
            </p>
          ) : (
            <ApplyForm
              job={job}
              existingApplication={myApplication}
              onApplied={setMyApplication}
            />
          )}
        </section>

        <div className="flex flex-wrap items-center gap-4 border-t border-border bg-muted/20 px-8 py-6">
          {job.sourceUrl && (
            <a
              href={job.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-md bg-primary px-6 py-3 font-medium text-primary-foreground hover:bg-primary/90"
            >
              <ExternalLink className="h-5 w-5" />
              Apply on original site
            </a>
          )}
          <a
            href={`mailto:${job.contactEmail}?subject=Application for ${job.title}`}
            className="inline-flex items-center gap-2 rounded-md border-2 border-primary px-6 py-3 font-medium text-primary hover:bg-primary hover:text-primary-foreground"
          >
            <Mail className="h-5 w-5" />
            Apply via email
          </a>

          {(isOwner || isAdmin) && (
            <button
              onClick={handleDelete}
              className="rounded-md border border-red-300 px-4 py-2 text-red-600 hover:bg-red-50"
            >
              Delete listing
            </button>
          )}
        </div>

        {(isOwner || isAdmin) && (
          <section className="border-t border-border px-8 py-8">
            <h2 className="mb-4 text-xl font-semibold text-primary">Applications</h2>
            <JobApplications jobId={job.id} />
          </section>
        )}
      </article>
    </div>
  )
}
