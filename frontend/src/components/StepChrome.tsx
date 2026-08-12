import type { ReactNode } from 'react'

interface Props {
  title?: string
  subtitle?: string
  onHome: () => void
  onBack: () => void
  onEdit: () => void
  children?: ReactNode
}

/** Shared Home / Back / Edit chrome for agents, gates, and the path map. */
export function StepChrome({ title, subtitle, onHome, onBack, onEdit, children }: Props) {
  return (
    <div className="step-chrome">
      <div className="step-chrome-bar">
        <div className="step-chrome-brand">
          <span className="landing-mark amora-mark">A</span>
          <div>
            <strong>{title || 'AMORA'}</strong>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
        </div>
        <div className="step-chrome-nav">
          <button type="button" className="pm-btn pm-btn-ghost" onClick={onBack}>
            ← Back
          </button>
          <button type="button" className="pm-btn pm-btn-ghost" onClick={onEdit}>
            Edit intake
          </button>
          <button type="button" className="pm-btn pm-btn-primary" onClick={onHome}>
            Home
          </button>
        </div>
      </div>
      {children}
    </div>
  )
}
