import { Link } from 'react-router-dom'

interface HaymarketLogoProps {
  className?: string
}

function HaymarketMark({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className={`h-9 w-9 shrink-0 ${className}`}
    >
      {/* Abstract convergence: two forms leaning together */}
      <path
        fill="currentColor"
        fillOpacity="0.42"
        d="M8.5 24.5 11 7.5c.6-2.4 3.4-2.6 4.2-.3l4.3 12.8-8 4.5Z"
      />
      <path
        fill="currentColor"
        d="M23.5 24.5 21 7.5c-.6-2.4-3.4-2.6-4.2-.3l-4.3 12.8 8 4.5Z"
      />
      <path
        fill="currentColor"
        fillOpacity="0.9"
        d="M13.5 25.5h5c1.1 0 1.7 1.3.9 2.1l-2.4 2.2a1.2 1.2 0 0 1-1.6 0l-2.4-2.2c-.8-.8-.2-2.1.9-2.1Z"
      />
    </svg>
  )
}

export default function HaymarketLogo({ className = '' }: HaymarketLogoProps) {
  return (
    <Link to="/" className={`inline-flex items-center gap-3 ${className}`}>
      <HaymarketMark />
      <span className="text-2xl font-bold tracking-tight md:text-3xl">Haymarket</span>
    </Link>
  )
}

export { HaymarketMark }
