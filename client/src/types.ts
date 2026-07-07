import type { JobType } from './constants/jobTypes'

export type UserRole = 'seeker' | 'poster' | 'both'
export type AuthProvider = 'local' | 'google' | 'apple'

export interface User {
  id: number
  email: string
  name: string
  isAdmin?: boolean
  authProvider?: AuthProvider
  role?: UserRole
  createdAt?: string
  applicationCount?: number
}

export type ApprovalStatus = 'approved' | 'pending' | 'rejected'

export interface Job {
  id: number
  title: string
  company: string
  location: string
  type: JobType
  description: string
  category: string
  salary?: string | null
  contactEmail: string
  postedBy: number
  posterName?: string
  createdAt: string
  publishedAt?: string | null
  score?: number
  applicationCount?: number
  pendingApplications?: number
  source?: string | null
  sourceUrl?: string | null
  externalId?: string | null
  approvalStatus?: ApprovalStatus
}

export type ApplicationStatus = 'pending' | 'reviewed' | 'accepted' | 'rejected'

export interface Application {
  id: number
  jobId: number
  userId: number
  coverLetter: string
  status: ApplicationStatus
  matchScore?: number | null
  createdAt: string
  updatedAt: string
  jobTitle?: string
  jobCompany?: string
  applicantName?: string
  applicantEmail?: string
}

export interface AdminStats {
  users: number
  jobs: number
  applications: number
  pendingApplications: number
  pendingBCorpJobs: number
  jobsByType: Record<string, number>
  unionJobs: number
  coopJobs: number
}

export interface SeekerDashboard {
  stats: {
    totalApplications: number
    pending: number
    accepted: number
  }
  recentApplications: Application[]
}

export interface PosterDashboard {
  stats: {
    totalListings: number
    totalApplications: number
    pendingReview: number
  }
  listings: Job[]
  recentApplications: Application[]
}

export interface OAuthProviders {
  google: boolean
  apple: boolean
}

export interface AuthResponse {
  user: User
  token: string
}
