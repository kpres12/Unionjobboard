export const JOB_TYPES = [
  'Union',
  'Co-op',
  'Nonprofit',
  'Public Sector',
  'Labor Organization',
  'B-Corp',
] as const

export type JobType = (typeof JOB_TYPES)[number]

export const JOB_TYPE_DESCRIPTIONS: Record<JobType, string> = {
  Union: 'Union shops with collective bargaining',
  'Co-op': 'Worker-owned cooperatives',
  Nonprofit: '501(c)(3) and mission-driven organizations',
  'Public Sector': 'Municipal, state, and federal positions',
  'Labor Organization': 'Worker centers, unions, and labor campaigns',
  'B-Corp': 'Certified B Corps with strong labor practices',
}

export const JOB_TYPE_BADGE_CLASSES: Record<JobType, string> = {
  Union: 'bg-red-100 text-red-800',
  'Co-op': 'bg-emerald-100 text-emerald-800',
  Nonprofit: 'bg-blue-100 text-blue-800',
  'Public Sector': 'bg-slate-100 text-slate-800',
  'Labor Organization': 'bg-amber-100 text-amber-900',
  'B-Corp': 'bg-violet-100 text-violet-800',
}

export function isValidJobType(type: string): type is JobType {
  return JOB_TYPES.includes(type as JobType)
}
