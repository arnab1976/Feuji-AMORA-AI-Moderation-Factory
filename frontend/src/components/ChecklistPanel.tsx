export interface ChecklistItem {
  id: string
  label: string
  required?: boolean
  source?: string
}

interface Props {
  items: ChecklistItem[]
  checked: Record<string, boolean>
  onToggle: (id: string, value: boolean) => void
  title?: string
  note?: string
  disabled?: boolean
}

export function ChecklistPanel({
  items,
  checked,
  onToggle,
  title = 'Human Gate Checklist',
  note,
  disabled,
}: Props) {
  const mandatoryItems = items.filter((i) => i.required !== false)
  const optionalItems = items.filter((i) => i.required === false)

  const mandatoryDone = mandatoryItems.filter((i) => checked[i.id]).length
  const optionalDone = optionalItems.filter((i) => checked[i.id]).length
  const allMandatoryDone = mandatoryItems.length > 0 && mandatoryDone === mandatoryItems.length

  return (
    <section className={`chk-panel${allMandatoryDone ? ' chk-ready' : ''}`}>
      <div className="chk-head">
        <div className="chk-head-copy">
          <h4>{title}</h4>
          {note ? <p>{note}</p> : null}
        </div>
        <div className="chk-head-badges" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <span className={`chk-progress${allMandatoryDone ? ' on' : ''}`}>
            Mandatory: {mandatoryDone}/{mandatoryItems.length} complete
          </span>
          {optionalItems.length > 0 && (
            <span className="chk-progress optional-badge" style={{ borderColor: 'rgba(238, 187, 85, 0.4)', color: '#eebb55', background: 'rgba(238, 187, 85, 0.08)' }}>
              Optional: {optionalDone}/{optionalItems.length} selected
            </span>
          )}
        </div>
      </div>

      <div className="chk-sections" style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '12px' }}>
        {mandatoryItems.length > 0 && (
          <div className="chk-section mandatory-section">
            <div className="chk-section-header" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span className="chk-tag mandatory-tag" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 800, letterSpacing: '0.08em' }}>
                MANDATORY (MINIMUM REQUIRED)
              </span>
              <span style={{ fontSize: '11px', color: 'var(--ink2)' }}>
                Based on maximum semantic similarity with input requirement &amp; agent execution
              </span>
            </div>
            <ul className="chk-list">
              {mandatoryItems.map((item) => (
                <li key={item.id}>
                  <label className={checked[item.id] ? 'on' : ''} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                      <input
                        type="checkbox"
                        checked={Boolean(checked[item.id])}
                        disabled={disabled}
                        onChange={(e) => onToggle(item.id, e.target.checked)}
                      />
                      <span>{item.label}</span>
                    </div>
                    <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 6px', borderRadius: '3px', background: 'rgba(239, 68, 68, 0.12)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.25)', marginLeft: '8px', flexShrink: 0 }}>
                      Required
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        )}

        {optionalItems.length > 0 && (
          <div className="chk-section optional-section">
            <div className="chk-section-header" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', marginTop: '4px' }}>
              <span className="chk-tag optional-tag" style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.3)', padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 800, letterSpacing: '0.08em' }}>
                OPTIONAL CHECKLIST
              </span>
              <span style={{ fontSize: '11px', color: 'var(--ink2)' }}>
                Additional verification options — user can opt in if desired
              </span>
            </div>
            <ul className="chk-list">
              {optionalItems.map((item) => (
                <li key={item.id}>
                  <label className={checked[item.id] ? 'on' : ''} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                      <input
                        type="checkbox"
                        checked={Boolean(checked[item.id])}
                        disabled={disabled}
                        onChange={(e) => onToggle(item.id, e.target.checked)}
                      />
                      <span>{item.label}</span>
                    </div>
                    <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 6px', borderRadius: '3px', background: 'rgba(59, 130, 246, 0.12)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.25)', marginLeft: '8px', flexShrink: 0 }}>
                      Optional
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
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
