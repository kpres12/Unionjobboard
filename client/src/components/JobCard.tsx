import { Link } from 'react-router-dom'
import { Briefcase, Users } from 'lucide-react'
import JobTypeBadge from './JobTypeBadge'
import type { Job } from '../types'
import { formatSalary } from '../utils/formatJob'

export default function JobCard({ job }: { job: Job }) {
  return (
    <article className="flex flex-col rounded-lg border-2 border-primary/20 bg-card p-6 shadow-sm transition-colors hover:border-primary/50">
      <div className="mb-4">
        <h3 className="text-xl font-semibold text-primary">
          <Link to={`/jobs/${job.id}`} className="hover:underline">
            {job.title}
          </Link>
        </h3>
        <p className="text-muted-foreground">{job.company}</p>
      </div>

      <div className="mb-6 space-y-2 text-muted-foreground">
        <p className="flex items-center">
          <Briefcase className="mr-2 h-5 w-5 shrink-0" />
          {job.location}
        </p>
        <p className="flex items-center">
          <Users className="mr-2 h-5 w-5 shrink-0" />
          {job.type}
        </p>
        {job.salary && <p className="text-sm font-medium">{formatSalary(job.salary) ?? job.salary}</p>}
      </div>

      <div className="mt-auto flex items-center justify-between">
        <JobTypeBadge type={job.type} />
        <Link
          to={`/jobs/${job.id}`}
          className="rounded-md border-2 border-primary px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
        >
          View Details
        </Link>
      </div>
    </article>
  )
}
