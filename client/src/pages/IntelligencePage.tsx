import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Activity, ArrowUpRight, Building2, Radar, TrendingUp } from 'lucide-react'
import { api } from '../api'
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

function formatDate(value?: string | null) {
  if (!value) return 'Recently'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Recently'
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function scoreColor(score: number) {
  if (score >= 70) return 'text-emerald-700 bg-emerald-100'
  if (score >= 45) return 'text-amber-800 bg-amber-100'
  return 'text-stone-600 bg-stone-100'
}

export default function IntelligencePage() {
  const [signals, setSignals] = useState<LaborSignal[]>([])
  const [scores, setScores] = useState<HiringIntentScore[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([api.getIntelligenceFeed(), api.getHiringIntent()])
      .then(([feed, intent]) => {
        setSignals(feed.signals)
        setScores(intent.scores)
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load intelligence'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-10">
      <section className="rounded-2xl border border-amber-200 bg-white p-8 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-amber-700">Labor Intelligence</p>
            <h1 className="mt-2 text-3xl font-bold text-stone-900">Hiring intent before the job post</h1>
            <p className="mt-3 max-w-3xl text-stone-600">
              Haymarket tracks operational signals — posting velocity, sector cycles, regional clusters, and
              employer outcomes — to surface where labor demand is building before roles go mainstream.
            </p>
          </div>
          <Link
            to="/labor-graph"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Radar className="h-4 w-4" />
            Labor graph
          </Link>
        </div>
      </section>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">{error}</div>
      )}

      {loading ? (
        <p className="text-stone-500">Loading intelligence feed...</p>
      ) : (
        <div className="grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-amber-700" />
              <h2 className="text-xl font-semibold text-stone-900">Signal feed</h2>
            </div>

            {signals.length === 0 ? (
              <div className="rounded-xl border border-dashed border-amber-200 bg-white p-8 text-center text-stone-500">
                No signals yet. Run <code className="rounded bg-amber-50 px-1">npm run sync-signals</code> after
                syncing jobs.
              </div>
            ) : (
              <div className="space-y-3">
                {signals.map((signal) => (
                  <article
                    key={signal.id}
                    className="rounded-xl border border-amber-100 bg-white p-5 shadow-sm transition hover:border-amber-300"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
                            {SIGNAL_LABELS[signal.signalType] || signal.signalType}
                          </span>
                          <span className="text-xs text-stone-500">{formatDate(signal.occurredAt)}</span>
                        </div>
                        <h3 className="mt-2 text-lg font-semibold text-stone-900">{signal.title}</h3>
                        <p className="mt-1 text-sm text-stone-600">{signal.description}</p>
                      </div>
                      <div className="text-right">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-sm font-semibold ${scoreColor(signal.score)}`}>
                          {Math.round(signal.score)}
                        </span>
                        <p className="mt-1 text-xs text-stone-500">{signal.leadWeeks}w lead</p>
                      </div>
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
                ))}
              </div>
            )}
          </div>

          <aside className="space-y-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-amber-700" />
              <h2 className="text-xl font-semibold text-stone-900">Hiring intent</h2>
            </div>

            <div className="rounded-xl border border-amber-100 bg-white p-4 shadow-sm">
              {scores.length === 0 ? (
                <p className="text-sm text-stone-500">Intent scores appear after signal sync.</p>
              ) : (
                <ul className="space-y-3">
                  {scores.map((entry) => (
                    <li key={entry.organizationId} className="border-b border-amber-50 pb-3 last:border-0 last:pb-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <Link
                            to={`/employers/${entry.organizationSlug}`}
                            className="font-medium text-stone-900 hover:text-primary hover:underline"
                          >
                            {entry.organizationName}
                          </Link>
                          {entry.location && (
                            <p className="text-xs text-stone-500">{entry.location}</p>
                          )}
                        </div>
                        <span className={`rounded-full px-2 py-0.5 text-sm font-semibold ${scoreColor(entry.score)}`}>
                          {Math.round(entry.score)}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-stone-600 line-clamp-2">{entry.summary}</p>
                      <p className="mt-1 text-xs text-stone-400">~{entry.leadWeeks} week lead</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </aside>
        </div>
      )}
    </div>
  )
}
