import { Link, useSearchParams } from 'react-router-dom'

export default function BillingCancelPage() {
  const [searchParams] = useSearchParams()
  const jobId = searchParams.get('job_id')

  return (
    <div className="mx-auto max-w-lg text-center">
      <h1 className="mb-4 text-3xl font-bold text-primary">Payment canceled</h1>
      <p className="mb-6 text-muted-foreground">
        Your listing was not published. You can try again whenever you are ready.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <Link
          to="/post-job"
          className="rounded-md bg-primary px-6 py-3 font-medium text-primary-foreground hover:bg-primary/90"
        >
          Back to Post a Job
        </Link>
        {jobId && (
          <Link
            to="/dashboard?tab=posting"
            className="rounded-md border-2 border-primary px-6 py-3 font-medium text-primary hover:bg-primary hover:text-primary-foreground"
          >
            Open dashboard
          </Link>
        )}
      </div>
    </div>
  )
}
