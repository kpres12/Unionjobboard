import type { ApplicationStatus } from '../types'

const statusStyles: Record<ApplicationStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  reviewed: 'bg-blue-100 text-blue-800',
  accepted: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
}

export default function StatusBadge({ status }: { status: ApplicationStatus }) {
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${statusStyles[status]}`}>
      {status}
    </span>
  )
}
