import type { JSX } from 'react'

interface DevicePillProps {
  label: string
  value: string
  status: 'ready' | 'pending'
}

export function DevicePill({ label, value, status }: DevicePillProps): JSX.Element {
  return (
    <div className="device-pill" aria-label={`${label}: ${value}`}>
      <span className={`status-dot ${status}`} aria-hidden="true" />
      <span className="device-meta"><small>{label}</small><strong>{value}</strong></span>
    </div>
  )
}
