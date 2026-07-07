const SOURCE_LABELS: Record<string, string> = {
  jobicy: 'Jobicy',
  remoteok: 'RemoteOK',
  arbeitnow: 'Arbeitnow',
  usfwc: 'USFWC',
  usajobs: 'USAJobs',
  idealist: 'Idealist',
  haymarket: 'Haymarket',
}

export function formatJobSource(source?: string | null) {
  if (!source) return null
  if (SOURCE_LABELS[source]) return SOURCE_LABELS[source]
  if (/^\d{4}-\d{2}-\d{2}/.test(source)) return null
  return source.charAt(0).toUpperCase() + source.slice(1)
}

export function formatJobDate(value?: string | null) {
  if (!value) return null

  const normalized = value.includes('T') ? value : value.replace(' ', 'T')
  const date = new Date(normalized)
  if (Number.isNaN(date.getTime())) return null

  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export function formatSalary(salary?: string | null) {
  if (!salary) return null

  const match = salary.match(
    /^([A-Z]{3})\s([\d,]+)\s*-\s*([\d,]+)\s*\/\s*(\w+)$/i
  )

  if (!match) return salary

  const [, currency, min, max, period] = match
  const periodLabel = period.toLowerCase() === 'yearly' ? 'year' : period.toLowerCase()

  return `${currency} $${min} – $${max} / ${periodLabel}`
}

export function jobMetaItems(job: {
  location: string
  category: string
  salary?: string | null
  source?: string | null
  sourceUrl?: string | null
  publishedAt?: string | null
  createdAt: string
}) {
  const source = formatJobSource(job.source)
  const posted =
    formatJobDate(job.publishedAt) ||
    formatJobDate(job.createdAt)

  return [
    { label: 'Location', value: job.location },
    { label: 'Category', value: job.category },
    job.salary ? { label: 'Salary', value: formatSalary(job.salary) ?? job.salary } : null,
    source ? { label: 'Source', value: source, href: job.sourceUrl ?? undefined } : null,
    posted ? { label: 'Posted', value: posted } : null,
  ].filter(Boolean) as Array<{ label: string; value: string; href?: string }>
}
