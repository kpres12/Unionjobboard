import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, Briefcase, LayoutDashboard } from 'lucide-react'
import { api } from '../api'
import JobCard from '../components/JobCard'
import { JOB_TYPES } from '../constants/jobTypes'
import { useAuth } from '../context/AuthContext'
import { canPost, canSeek } from '../utils/roles'
import type { Job, PosterDashboard } from '../types'

export default function HomePage() {
  const { user } = useAuth()
  const [jobs, setJobs] = useState<Job[]>([])
  const [posterSummary, setPosterSummary] = useState<PosterDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [location, setLocation] = useState('')
  const [type, setType] = useState('')

  const isSeeker = canSeek(user)
  const isPoster = canPost(user)

  const fetchJobs = async () => {
    setLoading(true)
    setError('')
    try {
      const { jobs } = await api.getJobs({
        q: query || undefined,
        location: location || undefined,
        type: type || undefined,
      })
      setJobs(jobs)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load jobs')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchJobs()
  }, [])

  useEffect(() => {
    if (!user || !isPoster) {
      setPosterSummary(null)
      return
    }

    api.getPosterDashboard().then(setPosterSummary).catch(() => {})
  }, [user, isPoster])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    fetchJobs()
  }

  const recommendedJobs = jobs.slice(0, 6)

  return (
    <div>
      <section className="mb-12">
        <h1 className="mb-3 text-4xl font-bold text-primary md:text-5xl">
          Labor-aligned jobs, in one place
        </h1>
        <p className="mb-8 max-w-2xl text-lg text-muted-foreground">
          Haymarket connects workers with union shops, co-ops, nonprofits, public-sector roles,
          labor organizations, and curated B Corps — workplaces where workers have a real voice.
        </p>

        <form onSubmit={handleSearch} className="flex flex-col gap-4 md:flex-row">
          <input
            placeholder="Job title or keywords"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-grow rounded-md border border-border px-4 py-3 text-lg focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <input
            placeholder="Location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="flex-grow rounded-md border border-border px-4 py-3 text-lg focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="rounded-md border border-border px-4 py-3 text-lg focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">All types</option>
            {JOB_TYPES.map((jobType) => (
              <option key={jobType} value={jobType}>
                {jobType}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="flex items-center justify-center gap-2 rounded-md bg-secondary px-8 py-3 text-lg font-medium text-secondary-foreground hover:bg-secondary/90"
          >
            <Search className="h-5 w-5" />
            Search
          </button>
        </form>
      </section>

      {isPoster && (
        <section className="mb-12 rounded-lg border-2 border-primary/20 bg-white p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="rounded-full bg-primary/10 p-3 text-primary">
                <Briefcase className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-primary">Your listings</h2>
                <p className="text-muted-foreground">
                  {posterSummary
                    ? `${posterSummary.stats.totalListings} active listings · ${posterSummary.stats.pendingReview} applications pending review`
                    : 'Manage jobs you have posted and review applicants.'}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                to="/dashboard?tab=posting"
                className="inline-flex items-center gap-2 rounded-md border-2 border-primary px-4 py-2 font-medium text-primary hover:bg-primary hover:text-primary-foreground"
              >
                <LayoutDashboard className="h-4 w-4" />
                Open dashboard
              </Link>
              <Link
                to="/post-job"
                className="rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground hover:bg-primary/90"
              >
                Post a job
              </Link>
            </div>
          </div>
        </section>
      )}

      {isSeeker && user && recommendedJobs.length > 0 && (
        <section className="mb-12">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-2xl font-semibold text-primary">Recommended for you</h2>
            <Link to="/dashboard?tab=seeking" className="text-sm text-primary hover:underline">
              View your applications
            </Link>
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {recommendedJobs.map((job) => (
              <JobCard key={`rec-${job.id}`} job={job} />
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-8 text-3xl font-semibold text-primary">
          {query || location || type ? 'Search results' : 'All job listings'}
        </h2>

        {loading && <p className="text-muted-foreground">Loading jobs...</p>}
        {error && <p className="text-red-600">{error}</p>}

        {!loading && !error && jobs.length === 0 && (
          <p className="text-muted-foreground">No jobs match your search. Try different filters.</p>
        )}

        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {jobs.map((job) => (
            <JobCard key={job.id} job={job} />
          ))}
        </div>
      </section>
    </div>
  )
}
