import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Briefcase, Clock, Ghost, TrendingUp } from 'lucide-react'
import { api } from '../api'
import type { LaborSignal, Organization } from '../types/intelligence'

function pct(value: number | null | undefined) {
  if (value == null) return '—'
  return `${Math.round(value * 100)}%`
}

function days(value: number | null | undefined) {
  if (value == null) return '—'
  return `${Math.round(value)} days`
}

export default function EmployerProfilePage() {
  const { slug } = useParams<{ slug: string }>()
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [signals, setSignals] = useState<LaborSignal[]>([])
  const [jobs, setJobs] = useState<
    Array<{
      id: number
      title: string
      location: string
      type: string
      category: string
      salary?: string | null
      createdAt: string
    }>
  >([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!slug) return
    api
      .getOrganization(slug)
      .then((data) => {
        setOrganization(data.organization)
        setSignals(data.signals)
        setJobs(data.jobs)
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Employer not found'))
      .finally(() => setLoading(false))
  }, [slug])

  if (loading) return <p className="text-stone-500">Loading employer profile...</p>
  if (error || !organization) {
    return (
      <div className="space-y-4">
        <Link to="/intelligence" className="inline-flex items-center gap-2 text-primary hover:underline">
          <ArrowLeft className="h-4 w-4" /> Back to intelligence
        </Link>
        <p className="text-red-600">{error || 'Employer not found'}</p>
      </div>
    )
  }

  const metrics = organization.metrics

  return (
    <div className="space-y-8">
      <Link to="/intelligence" className="inline-flex items-center gap-2 text-sm text-primary hover:underline">
        <ArrowLeft className="h-4 w-4" /> Intelligence
      </Link>

      <section className="rounded-2xl border border-amber-200 bg-white p-8 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-amber-700">{organization.orgType || 'Employer'}</p>
            <h1 className="mt-1 text-3xl font-bold text-stone-900">{organization.name}</h1>
            {organization.location && (
              <p className="mt-2 text-stone-600">{organization.location}</p>
            )}
          </div>
          {organization.intent && (
            <div className="rounded-xl bg-amber-50 px-5 py-4 text-center">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Hiring intent</p>
              <p className="mt-1 text-3xl font-bold text-amber-900">{Math.round(organization.intent.score)}</p>
              <p className="text-xs text-stone-500">~{organization.intent.leadWeeks} week lead</p>
            </div>
          )}
        </div>
        {organization.intent?.summary && (
          <p className="mt-4 text-sm text-stone-600">{organization.intent.summary}</p>
        )}
      </section>

      <section>
        <h2 className="mb-4 text-xl font-semibold text-stone-900">Operational reputation</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            icon={<Briefcase className="h-5 w-5" />}
            label="Active listings"
            value={String(metrics?.activeListings ?? 0)}
          />
          <MetricCard
            icon={<TrendingUp className="h-5 w-5" />}
            label="Reviewed rate"
            value={pct(metrics?.reviewedRate)}
          />
          <MetricCard
            icon={<Ghost className="h-5 w-5" />}
            label="Ghost rate"
            value={pct(metrics?.ghostRate)}
            hint="Pending 21+ days"
          />
          <MetricCard
            icon={<Clock className="h-5 w-5" />}
            label="Median response"
            value={days(metrics?.medianResponseDays)}
          />
        </div>
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        <section>
          <h2 className="mb-4 text-xl font-semibold text-stone-900">Signals</h2>
          {signals.length === 0 ? (
            <p className="text-sm text-stone-500">No signals recorded yet.</p>
          ) : (
            <ul className="space-y-3">
              {signals.map((signal) => (
                <li key={signal.id} className="rounded-lg border border-amber-100 bg-white p-4">
                  <p className="font-medium text-stone-900">{signal.title}</p>
                  <p className="mt-1 text-sm text-stone-600">{signal.description}</p>
                  <p className="mt-2 text-xs text-stone-400">
                    Score {Math.round(signal.score)} · {signal.leadWeeks}w lead
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="mb-4 text-xl font-semibold text-stone-900">Open roles</h2>
          {jobs.length === 0 ? (
            <p className="text-sm text-stone-500">No active listings on Haymarket.</p>
          ) : (
            <ul className="space-y-3">
              {jobs.map((job) => (
                <li key={job.id} className="rounded-lg border border-amber-100 bg-white p-4">
                  <Link to={`/jobs/${job.id}`} className="font-medium text-primary hover:underline">
                    {job.title}
                  </Link>
                  <p className="mt-1 text-sm text-stone-600">
                    {job.type} · {job.location}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}

function MetricCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode
  label: string
  value: string
  hint?: string
}) {
  return (
    <div className="rounded-xl border border-amber-100 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 text-amber-700">{icon}</div>
      <p className="mt-2 text-2xl font-bold text-stone-900">{value}</p>
      <p className="text-sm text-stone-600">{label}</p>
      {hint && <p className="text-xs text-stone-400">{hint}</p>}
    </div>
  )
}
