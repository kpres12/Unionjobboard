import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../api'

export default function BillingSuccessPage() {
  const [searchParams] = useSearchParams()
  const sessionId = searchParams.get('session_id')
  const [jobId, setJobId] = useState<number | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!sessionId) {
      setError('Missing checkout session.')
      return
    }

    api
      .confirmCheckout(sessionId)
      .then(({ jobId: id }) => setJobId(id))
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not confirm payment'))
  }, [sessionId])

  return (
    <div className="mx-auto max-w-lg text-center">
      <h1 className="mb-4 text-3xl font-bold text-primary">Payment received</h1>
      {error && <p className="mb-4 text-red-600">{error}</p>}
      {!error && !jobId && <p className="text-muted-foreground">Confirming your listing...</p>}
      {jobId && (
        <>
          <p className="mb-6 text-muted-foreground">
            Your listing is live. B-Corp posts may still need admin review before appearing in search.
          </p>
          <Link
            to={`/jobs/${jobId}`}
            className="inline-block rounded-md bg-primary px-6 py-3 font-medium text-primary-foreground hover:bg-primary/90"
          >
            View listing
          </Link>
        </>
      )}
    </div>
  )
}
