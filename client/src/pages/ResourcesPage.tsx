const resources = [
  {
    title: 'U.S. Federation of Worker Cooperatives',
    description: 'National grassroots membership organization for worker cooperatives.',
    url: 'https://www.usworker.coop/',
  },
  {
    title: 'AFL-CIO',
    description: 'The largest federation of unions in the United States.',
    url: 'https://aflcio.org/',
  },
  {
    title: 'Democracy at Work Institute',
    description: 'Resources for starting and growing worker cooperatives.',
    url: 'https://institute.coop/',
  },
  {
    title: 'IBEW — International Brotherhood of Electrical Workers',
    description: 'Union representing electrical workers nationwide.',
    url: 'https://ibew.org/',
  },
  {
    title: '1worker1vote',
    description: 'Connecting the worker co-op and union co-op movements.',
    url: 'https://1worker1vote.org/',
  },
]

export default function ResourcesPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-6 text-4xl font-bold text-primary">Resources</h1>
      <p className="mb-8 text-lg text-muted-foreground">
        Learn more about unions, cooperatives, and the labor movement.
      </p>

      <div className="space-y-4">
        {resources.map((resource) => (
          <a
            key={resource.url}
            href={resource.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block rounded-lg border-2 border-primary/20 bg-white p-6 transition-colors hover:border-primary/50"
          >
            <h2 className="mb-2 text-xl font-semibold text-primary">{resource.title}</h2>
            <p className="text-muted-foreground">{resource.description}</p>
          </a>
        ))}
      </div>
    </div>
  )
}
