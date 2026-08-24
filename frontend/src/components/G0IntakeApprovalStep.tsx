import { useEffect, useMemo, useState } from 'react'
import { api, ApiError, type G0Brief, type GateNode } from '../api/client'
import type { PathMapIntakeSnapshot } from './AgentGateMapStep'
import type { ActivityPayload } from './A1IntakeWizard'
import { ChecklistPanel, allRequiredChecked, type ChecklistItem } from './ChecklistPanel'

interface Props {
  runId: string
  gate: GateNode
  domainLabel: string
  intake?: PathMapIntakeSnapshot | null
  onDecided: (rewoundTo: string | null) => void
  onEvidence: (ev: Awaited<ReturnType<typeof api.gate>> | null) => void
  onResults: (payload: ActivityPayload) => void
  onContinueNext?: () => void
  continueLabel?: string
}

const FALLBACK_CHECKS: ChecklistItem[] = [
  { id: 'business_case', label: 'The business case for this work is clear', required: true },
  { id: 'data_class', label: 'Sensitive data classes from Governance & Risk look right', required: true },
  { id: 'access_policy', label: 'The AI access policy matches how careful we must be', required: true },
  { id: 'scope_ok', label: 'I approve reading this system under these rules', required: true },
]



export function G0IntakeApprovalStep({
  runId,
  gate,
  domainLabel,
  intake,
  onDecided,
  onEvidence,
  onResults,
  onContinueNext,
  continueLabel,
}: Props) {
  const [brief, setBrief] = useState<G0Brief | null>(null)
  const [evidence, setEvidence] = useState<Awaited<ReturnType<typeof api.gate>> | null>(null)
  const [briefLoading, setBriefLoading] = useState(true)
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [portfolio, setPortfolio] = useState<{
    criticality?: string
    regulations?: string
    location?: string
  }>({})
  const [policySnap, setPolicySnap] = useState<{
    sensitive?: string
    modelRule?: string
    modelPolicy?: string
  }>({})

  const a1Context = useMemo(
    () => ({
      categoryName: intake?.category_name || intake?.category_id || '—',
      projectName: intake?.project_name || '—',
      requirement: intake?.requirement || '',
      strategies: intake?.strategies || [],
      strategyShort: intake?.strategy_short || intake?.strategies?.[0] || '—',
      why: intake?.why_modernize || '',
    }),
    [intake],
  )

  const checklist: ChecklistItem[] = useMemo(() => {
    if (brief?.checklist?.length) {
      return brief.checklist.map((c) => ({
        id: c.id,
        label: c.label,
        required: c.required !== false,
      }))
    }
    return FALLBACK_CHECKS
  }, [brief])

  const checklistReady = useMemo(
    () => allRequiredChecked(checklist, checked),
    [checklist, checked],
  )

  useEffect(() => {
    let cancelled = false
    setBriefLoading(true)
    setError(null)
    setNotice(null)
    setChecked({})
    onResults({
      log: [['info', 'Loading G0 Intake Approval from A1 + A2 + A3…']],
      synthesis: null,
      projectName: a1Context.projectName !== '—' ? a1Context.projectName : '',
      status: 'G0 · synthesizing approval policy…',
      pageTitle: 'Intake Approval',
      pageContext: a1Context.categoryName,
      evidenceItems: [],
    })

    Promise.all([api.g0Brief(runId), api.gate(runId, gate.id), api.getRun(runId)])
      .then(([b, ev, run]) => {
        if (cancelled) return
        setBrief(b)
        setEvidence(ev)
        onEvidence(ev)

        const inv = (run.state?.inventory || {}) as Record<string, unknown>
        const port = (inv.portfolio || {}) as Record<string, unknown>
        const pol = (run.state?.policy || {}) as Record<string, unknown>
        const regs = port.regulation_labels || port.regulations
        const sens = pol.sensitive_labels || pol.sensitive_fields
        setPortfolio({
          criticality: String(port.criticality_label || port.criticality || ''),
          regulations: Array.isArray(regs) ? regs.map(String).join(', ') : String(regs || ''),
          location: String(port.code_location || ''),
        })
        setPolicySnap({
          sensitive: Array.isArray(sens) ? sens.map(String).join(', ') : String(sens || ''),
          modelRule: String(pol.model_rule || ''),
          modelPolicy: String(pol.model_policy || ''),
        })

        const gloss = (b.glossary || []).map((g) => ({ term: g.term, def: g.def }))
        onResults({
          log: [
            ['ok', b.title],
            ['info', b.context_line || b.requirement_summary || ''],
            ...(b.warning ? [['warn', b.warning] as [string, string]] : []),
          ],
          synthesis: null,
          projectName: a1Context.projectName !== '—' ? a1Context.projectName : '',
          status: ev.decided ? 'G0 decided' : b.activity_status || 'G0 awaiting approval',
          pageTitle: b.title || 'Intake Approval',
          pageContext: a1Context.categoryName,
          evidenceItems: (b.policy_items || []).map((p) => ({
            label: p.label,
            value: p.value,
          })),
          glossary: gloss.length ? gloss : undefined,
          glossaryStatus: gloss.length ? 'Terms for this approval' : undefined,
        })
        if (b.warning) {
          setNotice(
            'Could not fully synthesize from the LLM — showing approval policy built from your A1–A3 answers.',
          )
        }
      })
      .catch((e) => {
        if (cancelled) return
        setBrief(null)
        setNotice(
          'Could not load the LLM brief — you can still review the prior answers and decide.',
        )
        setError(e instanceof ApiError ? e.message : String(e))
        onResults({
          log: [['warn', e instanceof Error ? e.message : String(e)]],
          synthesis: null,
          projectName: a1Context.projectName !== '—' ? a1Context.projectName : '',
          status: 'G0 · awaiting approval',
          pageTitle: 'Intake Approval',
          pageContext: a1Context.categoryName,
          evidenceItems: [],
        })
        void api.gate(runId, gate.id).then((ev) => {
          if (!cancelled) {
            setEvidence(ev)
            onEvidence(ev)
          }
        })
      })
      .finally(() => {
        if (!cancelled) setBriefLoading(false)
      })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId, gate.id])

  async function decide(approved: boolean) {
    if (approved && !checklistReady) {
      setError('Confirm every checklist item before approving.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const res = await api.decideGate(runId, gate.id, approved)
      onDecided(res.rewound_to)
      const ev = await api.gate(runId, gate.id)
      setEvidence(ev)
      onEvidence(ev)
      onResults({
        log: [
          [approved ? 'ok' : 'warn', approved ? 'G0 approved — pipeline continues' : 'G0 rejected — rewound'],
        ],
        synthesis: null,
        projectName: a1Context.projectName !== '—' ? a1Context.projectName : '',
        status: approved ? 'G0 approved' : 'G0 rejected',
        pageTitle: brief?.title || 'Intake Approval',
        pageContext: a1Context.categoryName,
        evidenceItems: (brief?.policy_items || []).map((p) => ({ label: p.label, value: p.value })),
      })
      onDecided(approved ? null : res.rewound_to || 'A1')
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const [isContextLocked, setIsContextLocked] = useState(true)
  const [editCategory, setEditCategory] = useState('')
  const [editProject, setEditProject] = useState('')
  const [editStrategy, setEditStrategy] = useState('')
  const [editRequirement, setEditRequirement] = useState('')

  useEffect(() => {
    if (!editCategory && a1Context.categoryName && a1Context.categoryName !== '—') {
      setEditCategory(a1Context.categoryName)
    }
    if (!editProject && a1Context.projectName && a1Context.projectName !== '—') {
      setEditProject(a1Context.projectName)
    }
    if (!editStrategy && a1Context.strategyShort && a1Context.strategyShort !== '—') {
      setEditStrategy(a1Context.strategyShort)
    }
    if (!editRequirement && a1Context.requirement) {
      setEditRequirement(a1Context.requirement)
    }
  }, [a1Context])

  const decided = Boolean(evidence?.decided)
  const policyItems = brief?.policy_items?.length
    ? brief.policy_items
    : (evidence?.evidence || []).map((e) => ({ label: e.label, value: e.value, source: '' }))

  return (
    <div className="g0-step a1-wizard mf-req" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {/* 1. DOMAIN LEVEL INTAKE & CONTEXT MATRIX (Single unified card, editable & lockable) */}
      <section className="a2-a1-context" style={{ padding: '10px 14px', background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.9))', border: '1px solid rgba(245, 158, 11, 0.45)', borderRadius: '8px', margin: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h4 style={{ fontSize: '13px', fontWeight: 900, color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>
              🌐 DOMAIN LEVEL INTAKE &amp; CONTEXT MATRIX
            </h4>
            <span
              style={{
                fontSize: '10px',
                fontWeight: 800,
                padding: '2px 8px',
                borderRadius: '4px',
                background: isContextLocked ? 'rgba(34, 197, 94, 0.15)' : 'rgba(234, 179, 8, 0.15)',
                color: isContextLocked ? '#4ade80' : '#facc15',
                border: isContextLocked ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid rgba(234, 179, 8, 0.3)',
              }}
            >
              {isContextLocked ? '🔒 LOCKED' : '✏️ EDITABLE'}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setIsContextLocked(!isContextLocked)}
            style={{
              fontSize: '11px',
              fontWeight: 800,
              padding: '4px 10px',
              borderRadius: '5px',
              background: isContextLocked ? 'rgba(56, 189, 248, 0.15)' : 'rgba(34, 197, 94, 0.2)',
              color: isContextLocked ? '#38bdf8' : '#4ade80',
              border: isContextLocked ? '1px solid rgba(56, 189, 248, 0.4)' : '1px solid rgba(34, 197, 94, 0.4)',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            {isContextLocked ? '✏️ Edit Context' : '🔒 Lock & Save'}
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '6px', background: 'rgba(15, 23, 42, 0.45)', padding: '8px 10px', borderRadius: '6px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
          <div>
            <span style={{ display: 'block', fontSize: '9.5px', fontWeight: 900, color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>
              CATEGORY
            </span>
            {isContextLocked ? (
              <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#cbd5e1' }}>
                {editCategory || a1Context.categoryName}
              </span>
            ) : (
              <input
                type="text"
                value={editCategory}
                onChange={(e) => setEditCategory(e.target.value)}
                style={{ width: '100%', background: '#0f172a', border: '1px solid #fbbf24', color: '#f8fafc', padding: '3px 6px', borderRadius: '4px', fontSize: '11.5px' }}
              />
            )}
          </div>

          <div>
            <span style={{ display: 'block', fontSize: '9.5px', fontWeight: 900, color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>
              PROJECT
            </span>
            {isContextLocked ? (
              <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#cbd5e1' }}>
                {editProject || a1Context.projectName}
              </span>
            ) : (
              <input
                type="text"
                value={editProject}
                onChange={(e) => setEditProject(e.target.value)}
                style={{ width: '100%', background: '#0f172a', border: '1px solid #fbbf24', color: '#f8fafc', padding: '3px 6px', borderRadius: '4px', fontSize: '11.5px' }}
              />
            )}
          </div>

          <div>
            <span style={{ display: 'block', fontSize: '9.5px', fontWeight: 900, color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>
              STRATEGY
            </span>
            {isContextLocked ? (
              <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#cbd5e1' }}>
                {editStrategy || a1Context.strategyShort}
              </span>
            ) : (
              <input
                type="text"
                value={editStrategy}
                onChange={(e) => setEditStrategy(e.target.value)}
                style={{ width: '100%', background: '#0f172a', border: '1px solid #fbbf24', color: '#f8fafc', padding: '3px 6px', borderRadius: '4px', fontSize: '11.5px' }}
              />
            )}
          </div>

          <div>
            <span style={{ display: 'block', fontSize: '9.5px', fontWeight: 900, color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>
              A2 CRITICALITY
            </span>
            <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#cbd5e1' }}>
              {portfolio.criticality || '—'}
            </span>
          </div>

          <div>
            <span style={{ display: 'block', fontSize: '9.5px', fontWeight: 900, color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>
              A3 DATA CARE
            </span>
            <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#cbd5e1' }}>
              {policySnap.modelRule || policySnap.modelPolicy || 'Private + public (balanced)'}
            </span>
          </div>

          <div>
            <span style={{ display: 'block', fontSize: '9.5px', fontWeight: 900, color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>
              SENSITIVE DATA
            </span>
            <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#cbd5e1' }}>
              {policySnap.sensitive || 'PII / Secrets masked'}
            </span>
          </div>

          <div style={{ gridColumn: '1 / -1', marginTop: '2px' }}>
            <span style={{ display: 'block', fontSize: '9.5px', fontWeight: 900, color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>
              REQUIREMENT / TREND
            </span>
            {isContextLocked ? (
              <span style={{ fontSize: '11.5px', fontWeight: 500, color: '#cbd5e1', lineHeight: '1.4' }}>
                {editRequirement || a1Context.requirement || 'Modernizing legacy code to Python.'}
              </span>
            ) : (
              <textarea
                rows={2}
                value={editRequirement}
                onChange={(e) => setEditRequirement(e.target.value)}
                style={{ width: '100%', background: '#0f172a', border: '1px solid #fbbf24', color: '#f8fafc', padding: '4px 6px', borderRadius: '4px', fontSize: '11.5px', fontFamily: 'inherit' }}
              />
            )}
          </div>
        </div>
      </section>

      {/* 2. APPROVAL POLICY (Single unified card, linear list, no sub-cards) */}
      <section className="g0-policy-card" style={{ padding: '10px 14px', background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.9))', border: '1px solid rgba(245, 158, 11, 0.45)', borderRadius: '8px', margin: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
          <h4 style={{ fontSize: '13px', fontWeight: 900, color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>
            📋 APPROVAL POLICY &amp; GOVERNANCE RULES
          </h4>
          <span style={{ fontSize: '10px', color: '#fbbf24', fontWeight: 800, background: 'rgba(245, 158, 11, 0.15)', padding: '2px 6px', borderRadius: '4px' }}>
            Synthesized from Intake &amp; Risk Posture
          </span>
        </div>
        {briefLoading ? (
          <p className="dash-empty" style={{ fontSize: '11px', margin: '4px 0' }}>Synthesizing approval policy…</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', background: 'rgba(15, 23, 42, 0.45)', padding: '8px 10px', borderRadius: '6px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
            {policyItems.map((item) => (
              <div key={`${item.label}-${item.value}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600 }}>{item.label}</span>
                  {item.source ? <span style={{ fontSize: '9.5px', color: '#38bdf8', background: 'rgba(56, 189, 248, 0.12)', padding: '1px 4px', borderRadius: '3px' }}>{item.source}</span> : null}
                </div>
                <span style={{ fontSize: '11.5px', color: '#f8fafc', fontWeight: 700 }}>{item.value}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 3. CHECKLIST PANEL */}
      {!decided && (
        <ChecklistPanel
          title={brief?.checklist_heading || 'Gate G0 Mandatory & Fidelity Checklist'}
          gateId="G0"
          gateName="Strategic Intake & Risk Sign-Off"
          items={checklist}
          checked={checked}
          note={brief?.checklist_note || 'Checklist items are required based on maximum semantic similarity match with intake requirements.'}
          onAutoApproveGate={() => void decide(true)}
          onToggle={(id, value) => setChecked((p) => ({ ...p, [id]: value }))}
        />
      )}

      {notice && <p className="a3-notice">{notice}</p>}
      {error && <p className="err">{error}</p>}
      {evidence?.blocker && <p className="err">{evidence.blocker}</p>}

      {/* 4. DECISION & ADVANCEMENT CONTROLS */}
      {decided ? (
        <div className="dash-run-row g0-run-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginTop: '6px', padding: '10px 14px', background: 'rgba(34, 197, 94, 0.08)', border: '1px solid rgba(34, 197, 94, 0.3)', borderRadius: '8px' }}>
          <div>
            <strong style={{ fontSize: '12.5px', color: '#4ade80', display: 'block' }}>✓ Gate G0 Approved &amp; Governance Record Saved</strong>
            <p style={{ fontSize: '11px', color: '#94a3b8', margin: '2px 0 0' }}>Review your approval audit above and click below to move forward.</p>
          </div>
          <button className="landing-start" type="button" onClick={() => onContinueNext?.()} style={{ fontSize: '12.5px', fontWeight: 800, padding: '8px 16px' }}>
            {continueLabel || '▶ Move Forward to Next Agent →'}
          </button>
        </div>
      ) : (
        <div className="dash-run-row g0-run-row" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '6px' }}>
          <button
            className="landing-start g0-approve"
            type="button"
            disabled={busy || !checklistReady || briefLoading}
            onClick={() => void decide(true)}
            style={{ fontSize: '12.5px', fontWeight: 800, padding: '8px 16px', background: 'linear-gradient(90deg, #16a34a, #0d9488)', flex: '1 1 auto' }}
          >
            {busy ? 'Saving Approval…' : `✓ ${continueLabel ? continueLabel.replace('▶ Move Forward to', 'Approve — Move Forward to') : 'Approve — Move Forward to Next Agent'}`}
          </button>
          <button
            className="g0-reject"
            type="button"
            disabled={busy || briefLoading}
            onClick={() => void decide(false)}
            style={{ fontSize: '12px', padding: '8px 14px' }}
          >
            ✕ Request changes
          </button>
        </div>
      )}
    </div>
  )
}
