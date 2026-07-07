import type {
  AdminStats,
  Application,
  ApplicationStatus,
  ApprovalStatus,
  AuthResponse,
  Job,
  OAuthProviders,
  PosterDashboard,
  SeekerDashboard,
  User,
  UserRole,
} from './types'

const API_BASE = '/api'

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('token')
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  }

  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`
  }

  const response = await fetch(`${API_BASE}${path}`, { ...options, headers })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }))
    throw new Error(error.error || 'Request failed')
  }

  return response.json()
}

export const api = {
  register: (data: { email: string; password: string; name: string; role?: UserRole }) =>
    request<AuthResponse>('/auth/register', { method: 'POST', body: JSON.stringify(data) }),

  login: (data: { email: string; password: string }) =>
    request<AuthResponse>('/auth/login', { method: 'POST', body: JSON.stringify(data) }),

  me: () => request<{ user: User }>('/auth/me'),

  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    request<{ success: boolean }>('/auth/password', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  updateRole: (role: UserRole) =>
    request<{ user: User }>('/auth/role', { method: 'PUT', body: JSON.stringify({ role }) }),

  forgotPassword: (email: string) =>
    request<{ success: boolean; message: string; devResetUrl?: string }>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  resetPassword: (token: string, newPassword: string) =>
    request<{ success: boolean; message: string }>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, newPassword }),
    }),

  getOAuthProviders: () => request<OAuthProviders>('/auth/oauth/providers'),

  loginWithGoogle: (idToken: string, role?: UserRole) =>
    request<AuthResponse>('/auth/oauth/google', {
      method: 'POST',
      body: JSON.stringify({ idToken, role }),
    }),

  getSeekerDashboard: () => request<SeekerDashboard>('/dashboard/seeker'),

  getPosterDashboard: () => request<PosterDashboard>('/dashboard/poster'),

  getJobs: (params?: { q?: string; location?: string; type?: string }) => {
    const search = new URLSearchParams()
    if (params?.q) search.set('q', params.q)
    if (params?.location) search.set('location', params.location)
    if (params?.type) search.set('type', params.type)
    const query = search.toString()
    return request<{ jobs: Job[] }>(`/jobs${query ? `?${query}` : ''}`)
  },

  getJob: (id: number) => request<{ job: Job }>(`/jobs/${id}`),

  createJob: (data: Omit<Job, 'id' | 'postedBy' | 'posterName' | 'createdAt' | 'approvalStatus'>) =>
    request<{ job: Job; message?: string }>('/jobs', { method: 'POST', body: JSON.stringify(data) }),

  deleteJob: (id: number) =>
    request<{ success: boolean }>(`/jobs/${id}`, { method: 'DELETE' }),

  applyToJob: (data: { jobId: number; coverLetter: string }) =>
    request<{ application: Application }>('/applications', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getMyApplications: () => request<{ applications: Application[] }>('/applications/mine'),

  getJobApplications: (jobId: number) =>
    request<{ applications: Application[] }>(`/applications/job/${jobId}`),

  updateApplicationStatus: (id: number, status: ApplicationStatus) =>
    request<{ application: Application }>(`/applications/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),

  withdrawApplication: (id: number) =>
    request<{ success: boolean }>(`/applications/${id}`, { method: 'DELETE' }),

  getAdminStats: () => request<{ stats: AdminStats }>('/admin/stats'),

  getAdminUsers: () => request<{ users: User[] }>('/admin/users'),

  getAdminJobs: (params?: { status?: 'pending' }) => {
    const query = params?.status ? `?status=${params.status}` : ''
    return request<{ jobs: Job[] }>(`/admin/jobs${query}`)
  },

  getAdminApplications: () => request<{ applications: Application[] }>('/admin/applications'),

  toggleUserAdmin: (id: number, isAdmin: boolean) =>
    request<{ user: User }>(`/admin/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ isAdmin }),
    }),

  deleteAdminUser: (id: number) =>
    request<{ success: boolean }>(`/admin/users/${id}`, { method: 'DELETE' }),

  updateJobApproval: (id: number, status: ApprovalStatus) =>
    request<{ job: Job }>(`/admin/jobs/${id}/approval`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),

  deleteAdminJob: (id: number) =>
    request<{ success: boolean }>(`/admin/jobs/${id}`, { method: 'DELETE' }),
}

export function getAppleSignInUrl(role: UserRole = 'seeker') {
  return `${API_BASE}/auth/oauth/apple/start?role=${role}`
}

export function getGoogleSignInUrl(role: UserRole = 'seeker') {
  return `${API_BASE}/auth/oauth/google/start?role=${role}`
}
