import type { ApprovalStatus } from '../types'

const STATUS_CLASSES: Record<ApprovalStatus, string> = {
  approved: 'bg-green-100 text-green-800',
  pending: 'bg-amber-100 text-amber-900',
  rejected: 'bg-red-100 text-red-800',
}

const STATUS_LABELS: Record<ApprovalStatus, string> = {
  approved: 'Approved',
  pending: 'Pending review',
  rejected: 'Rejected',
}

export default function ApprovalStatusBadge({ status }: { status: ApprovalStatus }) {
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_CLASSES[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  )
}
