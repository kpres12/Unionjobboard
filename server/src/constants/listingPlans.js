export const LISTING_TIERS = ['community', 'standard', 'featured'];

export const COMMUNITY_ELIGIBLE_TYPES = [
  'Union',
  'Co-op',
  'Nonprofit',
  'Public Sector',
  'Labor Organization',
];

export const LISTING_PLANS = {
  community: {
    id: 'community',
    name: 'Community',
    priceCents: 0,
    priceLabel: 'Free',
    durationDays: 30,
    featuredDays: 0,
    summary: 'For unions, co-ops, nonprofits, and public-sector employers.',
    details: 'One free listing per organization every 90 days. 30-day visibility.',
    eligibleTypes: COMMUNITY_ELIGIBLE_TYPES,
    quotaDays: 90,
    quotaLimit: 1,
  },
  standard: {
    id: 'standard',
    name: 'Standard',
    priceCents: 14900,
    priceLabel: '$149',
    durationDays: 60,
    featuredDays: 0,
    summary: 'Full listing for any labor-aligned employer.',
    details: '60-day listing with search visibility and in-app applications.',
  },
  featured: {
    id: 'featured',
    name: 'Featured',
    priceCents: 22800,
    priceLabel: '$228',
    durationDays: 60,
    featuredDays: 7,
    summary: 'Top placement plus everything in Standard.',
    details: '60-day listing pinned to the top of search for 7 days.',
  },
};

export function isValidListingTier(tier) {
  return LISTING_TIERS.includes(tier);
}

export function getListingPlan(tier) {
  return LISTING_PLANS[tier] ?? null;
}
