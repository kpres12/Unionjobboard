export const JOB_TYPES = [
  'Union',
  'Co-op',
  'Nonprofit',
  'Public Sector',
  'Labor Organization',
  'B-Corp',
];

export const JOB_TYPE_DESCRIPTIONS = {
  Union: 'Union shops with collective bargaining',
  'Co-op': 'Worker-owned cooperatives',
  Nonprofit: '501(c)(3) and mission-driven organizations',
  'Public Sector': 'Municipal, state, and federal positions',
  'Labor Organization': 'Worker centers, unions, and labor campaigns',
  'B-Corp': 'Certified B Corps with strong labor practices',
};

export function isValidJobType(type) {
  return JOB_TYPES.includes(type);
}
