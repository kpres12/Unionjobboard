import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Activity,
  ArrowUpRight,
  Building2,
  MapPin,
  Radar,
  TrendingUp,
  Users,
} from 'lucide-react'
import { api } from '../api'
import { JOB_TYPE_BADGE_CLASSES } from '../constants/jobTypes'
import type { HiringIntentScore, LaborSignal } from '../types/intelligence'

const SIGNAL_LABELS: Record<string, string> = {
  hiring_surge: 'Hiring surge',
  job_posted: 'Job posted',
  capacity_expansion: 'Capacity expansion',
  public_infrastructure: 'Public infrastructure',
  grant_cycle: 'Grant cycle',
  infrastructure_permit: 'Infrastructure permit',
  regional_cluster: 'Regional cluster',
}

const SIGNAL_ORDER = [
  'regional_cluster',
  'capacity_expansion',
  'public_infrastructure',
  'infrastructure_permit',
  'grant_cycle',
  'hiring_surge',
  'job_posted',
]

function formatDate(value?: string | null) {
  if (!value) return 'Recently'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Recently'
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function scoreTone(score: number) {
  if (score >= 70) return { badge: 'text-emerald-700 bg-emerald-100', bar: 'bg-emerald-500' }
  if (score >= 45) return { badge: 'text-amber-800 bg-amber-100', bar: 'bg-amber-500' }
  return { badge: 'text-stone-600 bg-stone-100', bar: 'bg-stone-400' }
}

export default function IntelligencePage() {
  const [signals, setSignals] = useState<LaborSignal[]>([])
  const [scores, setScores] = useState<HiringIntentScore[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [signalFilter, setSignalFilter] = useState('all')

  useEffect(() => {
    Promise.all([api.getIntelligenceFeed({ limit: 100 }), api.getHiringIntent(50)])
      .then(([feed, intent]) => {
        setSignals(feed.signals)
        setScores(intent.scores)
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load intelligence'))
      .finally(() => setLoading(false))
  }, [])

  const signalTypes = useMemo(() => {
    const counts = new Map<string, number>()
    for (const signal of signals) {
      counts.set(signal.signalType, (counts.get(signal.signalType) || 0) + 1)
    }
    return [...counts.entries()].sort(
      (a, b) =>
        (SIGNAL_ORDER.indexOf(a[0]) === -1 ? 99 : SIGNAL_ORDER.indexOf(a[0])) -
        (SIGNAL_ORDER.indexOf(b[0]) === -1 ? 99 : SIGNAL_ORDER.indexOf(b[0]))
    )
  }, [signals])

  const filteredSignals = useMemo(() => {
    if (signalFilter === 'all') return signals
    return signals.filter((signal) => signal.signalType === signalFilter)
  }, [signals, signalFilter])

  const marketClusters = useMemo(
    () => signals.filter((signal) => signal.signalType === 'regional_cluster').slice(0, 4),
    [signals]
  )

  const uniqueEmployers = useMemo(
    () => new Set(signals.map((signal) => signal.organizationId)).size,
    [signals]
  )

  const avgLeadWeeks = useMemo(() => {
    if (signals.length === 0) return 0
    return Math.round(signals.reduce((sum, signal) => sum + signal.leadWeeks, 0) / signals.length)
  }, [signals])

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-2xl border border-amber-200 bg-white shadow-sm">
        <div className="bg-gradient-to-br from-amber-50 via-white to-red-50/30 p-8 md:p-10">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="max-w-3xl">
              <p className="text-sm font-semibold uppercase tracking-wide text-amber-700">
                Labor Intelligence
              </p>
              <h1 className="mt-2 text-3xl font-bold text-stone-900 md:text-4xl">
                Hiring intent before the job post
              </h1>
              <p className="mt-3 text-stone-600">
                Operational signals — posting velocity, sector cycles, regional clusters, and employer
                outcomes — surfaced before roles hit mainstream boards.
              </p>
            </div>
            <Link
              to="/labor-graph"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90"
            >
              <Radar className="h-4 w-4" />
              Open labor graph
            </Link>
          </div>

          {!loading && signals.length > 0 && (
            <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard icon={<Activity className="h-4 w-4" />} label="Active signals" value={signals.length} />
              <StatCard icon={<Users className="h-4 w-4" />} label="Employers tracked" value={uniqueEmployers} />
              <StatCard icon={<TrendingUp className="h-4 w-4" />} label="Intent leaders" value={scores.length} />
              <StatCard icon={<MapPin className="h-4 w-4" />} label="Avg lead time" value={`${avgLeadWeeks}w`} />
            </div>
          )}
        </div>
      </section>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">{error}</div>
      )}

      {loading ? (
        <p className="text-stone-500">Loading intelligence feed...</p>
      ) : (
        <div className="grid gap-8 xl:grid-cols-[minmax(0,1.6fr)_minmax(280px,1fr)]">
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-amber-700" />
                <h2 className="text-xl font-semibold text-stone-900">Signal feed</h2>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <FilterChip active={signalFilter === 'all'} onClick={() => setSignalFilter('all')}>
                  All ({signals.length})
                </FilterChip>
                {signalTypes.map(([type, count]) => (
                  <FilterChip
                    key={type}
                    active={signalFilter === type}
                    onClick={() => setSignalFilter(type)}
                  >
                    {SIGNAL_LABELS[type] || type} ({count})
                  </FilterChip>
                ))}
              </div>
            </div>

            {filteredSignals.length === 0 ? (
              <div className="rounded-xl border border-dashed border-amber-200 bg-white p-8 text-center text-stone-500">
                {signals.length === 0 ? (
                  <>
                    No signals yet. Run <code className="rounded bg-amber-50 px-1">npm run sync-signals</code>{' '}
                    after syncing jobs.
                  </>
                ) : (
                  'No signals match this filter.'
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredSignals.map((signal) => {
                  const tone = scoreTone(signal.score)
                  return (
                    <article
                      key={signal.id}
                      className="rounded-xl border border-amber-100 bg-white p-5 shadow-sm transition hover:border-amber-300 hover:shadow-md"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
                              {SIGNAL_LABELS[signal.signalType] || signal.signalType}
                            </span>
                            <span className="text-xs text-stone-500">{formatDate(signal.occurredAt)}</span>
                            <span className="text-xs text-stone-400">
                              {Math.round(signal.confidence * 100)}% confidence
                            </span>
                          </div>
                          <h3 className="mt-2 text-lg font-semibold text-stone-900">{signal.title}</h3>
                          <p className="mt-1 text-sm leading-relaxed text-stone-600">{signal.description}</p>
                        </div>
                        <div className="shrink-0 text-right">
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-sm font-semibold ${tone.badge}`}>
                            {Math.round(signal.score)}
                          </span>
                          <p className="mt-1 text-xs text-stone-500">{signal.leadWeeks}w lead</p>
                        </div>
                      </div>

                      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-stone-100">
                        <div
                          className={`h-full rounded-full ${tone.bar}`}
                          style={{ width: `${Math.min(signal.score, 100)}%` }}
                        />
                      </div>

                      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm">
                        <Link
                          to={`/employers/${signal.organizationSlug}`}
                          className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                        >
                          <Building2 className="h-4 w-4" />
                          {signal.organizationName}
                        </Link>
                        {signal.sourceUrl && (
                          <a
                            href={signal.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-stone-500 hover:text-primary"
                          >
                            Source <ArrowUpRight className="h-3.5 w-3.5" />
                          </a>
                        )}
                      </div>
                    </article>
                  )
                })}
              </div>
            )}
          </div>

          <aside className="space-y-5">
            {marketClusters.length > 0 && (
              <div className="rounded-xl border border-amber-200 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-amber-700" />
                  <h2 className="font-semibold text-stone-900">Market clusters</h2>
                </div>
                <ul className="mt-3 space-y-2">
                  {marketClusters.map((signal) => (
                    <li
                      key={signal.id}
                      className="rounded-lg bg-amber-50/70 px-3 py-2 text-sm text-stone-700"
                    >
                      {signal.title.replace('Regional hiring cluster: ', '')}
                    </li>
                  ))}
                </ul>
                <Link
                  to="/labor-graph"
                  className="mt-3 inline-flex text-sm font-medium text-primary hover:underline"
                >
                  Explore on labor graph
                </Link>
              </div>
            )}

            <div className="rounded-xl border border-amber-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-amber-700" />
                <h2 className="text-xl font-semibold text-stone-900">Hiring intent</h2>
              </div>

              {scores.length === 0 ? (
                <p className="mt-3 text-sm text-stone-500">Intent scores appear after signal sync.</p>
              ) : (
                <ul className="mt-4 space-y-4">
                  {scores.slice(0, 12).map((entry) => {
                    const tone = scoreTone(entry.score)
                    return (
                      <li key={entry.organizationId}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <Link
                              to={`/employers/${entry.organizationSlug}`}
                              className="truncate font-medium text-stone-900 hover:text-primary hover:underline"
                            >
                              {entry.organizationName}
                            </Link>
                            <div className="mt-0.5 flex flex-wrap items-center gap-2">
                              {entry.orgType && (
                                <span
                                  className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                                    JOB_TYPE_BADGE_CLASSES[entry.orgType as keyof typeof JOB_TYPE_BADGE_CLASSES] ||
                                    'bg-stone-100 text-stone-700'
                                  }`}
                                >
                                  {entry.orgType}
                                </span>
                              )}
                              {entry.location && (
                                <span className="text-xs text-stone-500">{entry.location}</span>
                              )}
                            </div>
                          </div>
                          <span className={`shrink-0 rounded-full px-2 py-0.5 text-sm font-semibold ${tone.badge}`}>
                            {Math.round(entry.score)}
                          </span>
                        </div>
                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-stone-100">
                          <div
                            className={`h-full rounded-full ${tone.bar}`}
                            style={{ width: `${Math.min(entry.score, 100)}%` }}
                          />
                        </div>
                        <p className="mt-1 text-xs text-stone-500">~{entry.leadWeeks} week lead</p>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </aside>
        </div>
      )}
    </div>
  )
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: number | string
}) {
  return (
    <div className="rounded-xl border border-amber-100 bg-white/80 px-4 py-3 backdrop-blur-sm">
      <div className="flex items-center gap-2 text-amber-700">{icon}</div>
      <p className="mt-2 text-2xl font-bold text-stone-900">{value}</p>
      <p className="text-xs text-stone-500">{label}</p>
    </div>
  )
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
        active
          ? 'bg-primary text-primary-foreground'
          : 'bg-white text-stone-600 ring-1 ring-amber-100 hover:bg-amber-50'
      }`}
    >
      {children}
    </button>
  )
}
