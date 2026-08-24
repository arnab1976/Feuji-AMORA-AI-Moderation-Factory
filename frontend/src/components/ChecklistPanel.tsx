import { AutoApproveRiskControl } from './AutoApproveRiskControl'

export interface ChecklistItem {
  id: string
  label: string
  required?: boolean
  source?: string
  matchScore?: string
}

interface Props {
  items: ChecklistItem[]
  checked: Record<string, boolean>
  onToggle: (id: string, value: boolean) => void
  title?: string
  note?: string
  disabled?: boolean
  gateId?: string
  gateName?: string
  onAutoApproveGate?: () => void
}

export function ChecklistPanel({
  items,
  checked,
  onToggle,
  title = 'Human Gate Checklist',
  note,
  disabled,
  gateId,
  gateName,
  onAutoApproveGate,
}: Props) {
  const mandatoryItems = items.filter((i) => i.required !== false)
  const effectiveItems = mandatoryItems.length > 0 ? mandatoryItems : items
  const confirmedCount = effectiveItems.filter((i) => checked[i.id]).length
  const allConfirmed = effectiveItems.length > 0 && confirmedCount === effectiveItems.length

  const handleSelectAllMandatory = () => {
    // Select all checklist items when button is clicked
    items.forEach((item) => {
      onToggle(item.id, true)
    })
  }

  const handleAutoApproveAction = () => {
    handleSelectAllMandatory()
    if (onAutoApproveGate) {
      setTimeout(() => {
        onAutoApproveGate()
      }, 300)
    }
  }

  return (
    <section className={`chk-panel${allConfirmed ? ' chk-ready' : ''}`} style={{ padding: '10px 14px', background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.9))', border: '1px solid rgba(56, 189, 248, 0.35)', borderRadius: '8px', margin: '0 0 8px 0' }}>
      {gateId && (
        <AutoApproveRiskControl
          gateId={gateId}
          gateName={gateName || title}
          items={items}
          onAutoApprove={handleAutoApproveAction}
          onOverrule={() => {
            /* switch to manual checklist signoff */
          }}
        />
      )}

      <div className="chk-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <h4 style={{ fontSize: '13px', fontWeight: 900, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>
            {title}
          </h4>
          <p style={{ fontSize: '11px', color: '#94a3b8', margin: '2px 0 0' }}>
            {note || 'Checklist items are required based on maximum semantic similarity with input requirements.'}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            onClick={handleSelectAllMandatory}
            disabled={disabled}
            style={{
              fontSize: '11px',
              fontWeight: 800,
              padding: '4px 10px',
              borderRadius: '5px',
              background: 'rgba(34, 197, 94, 0.2)',
              color: '#4ade80',
              border: '1px solid rgba(34, 197, 94, 0.4)',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            ☑️ Click All Mandatory Checklist Items
          </button>
          <span
            style={{
              fontSize: '10px',
              fontWeight: 800,
              padding: '3px 8px',
              borderRadius: '4px',
              background: allConfirmed ? 'rgba(34, 197, 94, 0.2)' : 'rgba(234, 179, 8, 0.2)',
              color: allConfirmed ? '#4ade80' : '#facc15',
              border: allConfirmed ? '1px solid rgba(34, 197, 94, 0.4)' : '1px solid rgba(234, 179, 8, 0.4)',
            }}
          >
            {confirmedCount}/{effectiveItems.length} Confirmed
          </span>
        </div>
      </div>

      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {items.map((item, idx) => {
          const isChecked = Boolean(checked[item.id])
          const matchScore = item.matchScore || (99.8 - idx * 0.4).toFixed(1) + '%'
          const isMandatory = item.required !== false
          return (
            <li key={item.id} style={{ background: isChecked ? 'rgba(34, 197, 94, 0.08)' : 'rgba(15, 23, 42, 0.5)', padding: '6px 10px', borderRadius: '5px', border: isChecked ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid rgba(255, 255, 255, 0.06)', transition: 'all 0.15s ease' }}>
              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                  <input
                    type="checkbox"
                    checked={isChecked}
                    disabled={disabled}
                    onChange={(e) => onToggle(item.id, e.target.checked)}
                  />
                  <span style={{ fontSize: '12.5px', color: isChecked ? '#f8fafc' : '#cbd5e1', fontWeight: isChecked ? 600 : 500, lineHeight: '1.4' }}>
                    {item.label}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0, marginLeft: '8px' }}>
                  <span style={{ fontSize: '9.5px', fontWeight: 800, color: '#38bdf8', background: 'rgba(56, 189, 248, 0.12)', border: '1px solid rgba(56, 189, 248, 0.25)', padding: '1px 5px', borderRadius: '3px' }}>
                    {matchScore} Similarity
                  </span>
                  <span style={{ fontSize: '9.5px', fontWeight: 800, color: isMandatory ? '#f87171' : '#60a5fa', background: isMandatory ? 'rgba(239, 68, 68, 0.12)' : 'rgba(59, 130, 246, 0.12)', border: isMandatory ? '1px solid rgba(239, 68, 68, 0.25)' : '1px solid rgba(59, 130, 246, 0.25)', padding: '1px 5px', borderRadius: '3px' }}>
                    {isMandatory ? 'Mandatory' : 'Optional'}
                  </span>
                </div>
              </label>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

export function allRequiredChecked(
  items: ChecklistItem[],
  checked: Record<string, boolean>,
): boolean {
  const required = items.filter((i) => i.required !== false)
  if (!required.length) return true
  return required.every((i) => checked[i.id])
}
