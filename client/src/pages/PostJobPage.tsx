import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../context/AuthContext'
import { JOB_TYPES, JOB_TYPE_DESCRIPTIONS, type JobType } from '../constants/jobTypes'
import type { ListingPlan, ListingTier } from '../types'

const categories = [
  'Skilled Trades',
  'Healthcare',
  'Technology',
  'Marketing',
  'Food Service',
  'Education',
  'Manufacturing',
  'Other',
]

const COMMUNITY_TYPES: JobType[] = [
  'Union',
  'Co-op',
  'Nonprofit',
  'Public Sector',
  'Labor Organization',
]

export default function PostJobPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [plans, setPlans] = useState<ListingPlan[]>([])
  const [quotaRemaining, setQuotaRemaining] = useState(0)
  const [listingTier, setListingTier] = useState<ListingTier>('community')
  const [form, setForm] = useState({
    title: '',
    company: '',
    location: '',
    type: 'Union' as JobType,
    description: '',
    category: categories[0],
    salary: '',
    contactEmail: user?.email || '',
  })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!user) return
    api.getListingPlans().then(({ plans: listingPlans }) => setPlans(listingPlans))
    api.getListingQuota().then(({ quota }) => setQuotaRemaining(quota.remaining))
  }, [user])

  const update = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const communityAvailable =
    COMMUNITY_TYPES.includes(form.type) && quotaRemaining > 0 && form.type !== 'B-Corp'

  useEffect(() => {
    if (!communityAvailable && listingTier === 'community') {
      setListingTier('standard')
    }
  }, [communityAvailable, listingTier])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    setError('')
    setSubmitting(true)

    try {
      const { job, message, checkoutUrl } = await api.createJob({ ...form, listingTier })

      if (checkoutUrl) {
        window.location.href = checkoutUrl
        return
      }

      if (message) {
        navigate('/dashboard?tab=posting', { state: { notice: message } })
        return
      }

      navigate(`/jobs/${job.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to post job')
    } finally {
      setSubmitting(false)
    }
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-lg text-center">
        <h1 className="mb-4 text-3xl font-bold text-primary">Post a Job</h1>
        <p className="mb-6 text-muted-foreground">
          Sign in with a job poster account to list openings on Haymarket.
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-2 text-3xl font-bold text-primary">Post a Job</h1>
      <p className="mb-8 text-muted-foreground">
        Haymarket keeps job seeker access free. Employers fund the infrastructure through listings.
      </p>

      <form onSubmit={handleSubmit} className="space-y-5 rounded-lg border-2 border-primary/20 bg-white p-8">
        <section>
          <h2 className="mb-3 text-lg font-semibold text-primary">Choose a plan</h2>
          <div className="grid gap-3">
            {plans.map((plan) => {
              const disabled = plan.id === 'community' && !communityAvailable
              const selected = listingTier === plan.id

              return (
                <button
                  key={plan.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => setListingTier(plan.id)}
                  className={`rounded-lg border-2 p-4 text-left transition-colors ${
                    selected
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/40'
                  } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
                >
                  <div className="mb-1 flex items-center justify-between gap-3">
                    <span className="font-semibold text-primary">{plan.name}</span>
                    <span className="text-lg font-bold">{plan.priceLabel}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{plan.summary}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{plan.details}</p>
                  {plan.id === 'community' && (
                    <p className="mt-2 text-xs font-medium text-primary">
                      {quotaRemaining > 0
                        ? `${quotaRemaining} free listing${quotaRemaining === 1 ? '' : 's'} left this quarter`
                        : 'Free quota used for this quarter'}
                    </p>
                  )}
                </button>
              )
            })}
          </div>
        </section>

        <div>
          <label className="mb-1 block text-sm font-medium">Job Title</label>
          <input
            required
            value={form.title}
            onChange={(e) => update('title', e.target.value)}
            className="w-full rounded-md border border-border px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium">Company</label>
            <input
              required
              value={form.company}
              onChange={(e) => update('company', e.target.value)}
              className="w-full rounded-md border border-border px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Location</label>
            <input
              required
              value={form.location}
              onChange={(e) => update('location', e.target.value)}
              className="w-full rounded-md border border-border px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium">Type</label>
            <select
              value={form.type}
              onChange={(e) => update('type', e.target.value)}
              className="w-full rounded-md border border-border px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {JOB_TYPES.map((jobType) => (
                <option key={jobType} value={jobType}>
                  {jobType}
                </option>
              ))}
            </select>
            {form.type === 'B-Corp' && (
              <p className="mt-2 text-sm text-muted-foreground">
                {JOB_TYPE_DESCRIPTIONS['B-Corp']} Requires a paid plan and admin review.
              </p>
            )}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Category</label>
            <select
              value={form.category}
              onChange={(e) => update('category', e.target.value)}
              className="w-full rounded-md border border-border px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Salary (optional)</label>
          <input
            value={form.salary}
            onChange={(e) => update('salary', e.target.value)}
            placeholder="e.g. $25/hr or $60,000 - $70,000"
            className="w-full rounded-md border border-border px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Contact Email</label>
          <input
            required
            type="email"
            value={form.contactEmail}
            onChange={(e) => update('contactEmail', e.target.value)}
            className="w-full rounded-md border border-border px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Description</label>
          <textarea
            required
            rows={6}
            value={form.description}
            onChange={(e) => update('description', e.target.value)}
            className="w-full rounded-md border border-border px-3 py-2 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-primary px-4 py-3 font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {submitting
            ? 'Processing...'
            : listingTier === 'community'
              ? 'Publish free listing'
              : `Continue to payment`}
        </button>
      </form>
    </div>
  )
}
