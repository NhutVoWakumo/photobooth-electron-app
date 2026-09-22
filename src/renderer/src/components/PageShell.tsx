import type { ReactNode, JSX } from 'react'

interface PageShellProps {
  className: string
  eyebrow?: ReactNode
  title: ReactNode
  description?: ReactNode
  backLabel?: ReactNode
  onBack?: () => void
  actions?: ReactNode
  children: ReactNode
}

/** Shared shell for non-kiosk pages: back/action rails stay in the same place. */
export function PageShell({ className, eyebrow, title, description, backLabel, onBack, actions, children }: PageShellProps): JSX.Element {
  return <section className={`design-page ${onBack ? 'has-page-back ' : ''}${className}`}>
    <header className="design-page-header">
      <div className="design-page-heading">
        {onBack && <button className="design-page-back" onClick={onBack}>← <span>{backLabel}</span></button>}
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {description && <p className="design-page-description">{description}</p>}
      </div>
      {actions && <div className="design-page-actions">{actions}</div>}
    </header>
    {children}
  </section>
}
