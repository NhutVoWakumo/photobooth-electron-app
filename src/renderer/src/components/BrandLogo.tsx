import type { JSX } from 'react'

interface BrandLogoProps {
  compact?: boolean
}

export function BrandLogo({ compact = false }: BrandLogoProps): JSX.Element {
  return (
    <span className={`luma-logo ${compact ? 'compact' : ''}`} aria-label="LUMA Booth">
      <svg aria-hidden="true" viewBox="0 0 64 64">
        <rect className="luma-logo-field" x="2" y="2" width="60" height="60" rx="21" />
        <path className="luma-logo-corners" d="M24 18h-4a2 2 0 0 0-2 2v5m22-7h4a2 2 0 0 1 2 2v5M18 39v5a2 2 0 0 0 2 2h5m21-7v5a2 2 0 0 1-2 2h-5" />
        <path className="luma-logo-flash" d="M32 20.5c1.55 7.1 4.4 9.95 11.5 11.5-7.1 1.55-9.95 4.4-11.5 11.5-1.55-7.1-4.4-9.95-11.5-11.5 7.1-1.55 9.95-4.4 11.5-11.5Z" />
        <circle className="luma-logo-core" cx="32" cy="32" r="3.15" />
      </svg>
      {!compact && <span className="luma-wordmark"><strong>LUMA</strong><small>PHOTOBOOTH</small></span>}
    </span>
  )
}
