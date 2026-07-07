import { JOB_TYPE_BADGE_CLASSES, type JobType } from '../constants/jobTypes'

export default function JobTypeBadge({ type }: { type: JobType | string }) {
  const classes =
    type in JOB_TYPE_BADGE_CLASSES
      ? JOB_TYPE_BADGE_CLASSES[type as JobType]
      : 'bg-accent text-accent-foreground'

  return <span className={`rounded-full px-3 py-1 text-sm font-medium ${classes}`}>{type}</span>
}
