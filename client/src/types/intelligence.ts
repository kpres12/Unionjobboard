export type SignalType =
  | 'hiring_surge'
  | 'job_posted'
  | 'capacity_expansion'
  | 'public_infrastructure'
  | 'grant_cycle'
  | 'infrastructure_permit'
  | 'regional_cluster'

export interface LaborSignal {
  id: number
  organizationId: number
  organizationName: string
  organizationSlug: string
  signalType: SignalType
  title: string
  description: string
  source: string
  sourceUrl?: string | null
  confidence: number
  score: number
  leadWeeks: number
  occurredAt?: string | null
  createdAt: string
  metadata?: Record<string, unknown> | null
}

export interface HiringIntentScore {
  organizationId: number
  organizationName?: string
  organizationSlug?: string
  location?: string
  orgType?: string
  score: number
  leadWeeks: number
  summary: string
  computedAt: string
}

export interface EmployerMetrics {
  organizationId: number
  applicationCount: number
  pendingApplications: number
  reviewedRate: number | null
  acceptedRate: number | null
  ghostRate: number | null
  medianResponseDays: number | null
  activeListings: number
  computedAt: string
}

export interface Organization {
  id: number
  name: string
  slug: string
  location?: string | null
  orgType?: string | null
  domain?: string | null
  description?: string | null
  createdAt: string
  intentScore?: number | null
  intentLeadWeeks?: number | null
  activeListings?: number
  ghostRate?: number | null
  reviewedRate?: number | null
  intent?: HiringIntentScore | null
  metrics?: EmployerMetrics | null
}

export interface LaborGraphNode {
  id: number
  slug: string
  name: string
  location?: string | null
  orgType?: string | null
  intentScore?: number | null
  activeListings: number
  ghostRate?: number | null
  cluster: string
  index: number
}

export interface LaborGraphEdge {
  source: number
  target: number
  type: string
  weight: number
}

export interface LaborGraph {
  nodes: LaborGraphNode[]
  edges: LaborGraphEdge[]
}
