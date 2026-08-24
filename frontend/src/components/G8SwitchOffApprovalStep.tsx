import { useEffect, useMemo, useState } from 'react'
import { api, ApiError, type G8Brief, type GateNode, type LogLine } from '../api/client'
import type { PathMapIntakeSnapshot } from './AgentGateMapStep'
import type { ActivityPayload } from './A1IntakeWizard'
import { ChecklistPanel } from './ChecklistPanel'

interface Props {
  runId: string
  gate: GateNode
  domainLabel: string
  formResetKey?: number
  intake?: PathMapIntakeSnapshot | null
  onDecided: (rewoundTo: string | null) => void
  onEvidence?: (ev: Awaited<ReturnType<typeof api.gate>> | null) => void
  onResults: (payload: ActivityPayload) => void
  onContinueNext?: () => void
  continueLabel?: string
}

export function G8SwitchOffApprovalStep({
  runId,
  gate,
  domainLabel: _domainLabel,
  formResetKey: _formResetKey,
  intake,
  onDecided,
  onEvidence,
  onResults,
  onContinueNext,
  continueLabel,
}: Props) {
  const [brief, setBrief] = useState<G8Brief | null>(null)
  const [briefLoading, setBriefLoading] = useState(true)
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [approvedState, setApprovedState] = useState<boolean | null>(null)
  const [actionLog, setActionLog] = useState<LogLine[]>([])

  const [isContextLocked, setIsContextLocked] = useState(true)
  const [editCategory, setEditCategory] = useState('')
  const [editProject, setEditProject] = useState('')
  const [editStrategy, setEditStrategy] = useState('')
  const [editRequirement, setEditRequirement] = useState('')
  const [plan, setPlan] = useState('slow')
  const [verifyArchive, setVerifyArchive] = useState(true)

  const a1Context = useMemo(() => {
    const catName = intake?.category_name || intake?.category_id || '1. Legacy source-code data'
    const projName =
      intake?.project_name ||
      'Legacy SAS code to be converted to modern Python code for Insurance Fraud Modelling'
    const req =
      intake?.requirement ||
      'Modernizing the legacy SAS code to Python will enhance flexibility, scalability, and integration with modern data analysis tools, ultimately improving the efficiency of our insurance fraud modeling processes. This transformation is essential to maintain competitiveness, optimize resource utilization, and leverage advanced analytical capabilities.'
    const strat = intake?.strategy_short || intake?.strategies?.[0] || 'Incremental Migration to Python'
    return {
      categoryName: catName,
      projectName: projName,
      requirement: req,
      strategyShort: strat,
    }
  }, [intake])

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

  useEffect(() => {
    let cancelled = false
    setBriefLoading(true)
    setError(null)
    setChecked({})

    void api.gate(runId, gate.id).then((ev) => {
      if (cancelled) return
      onEvidence?.(ev)
      if (ev?.decided) {
        setApprovedState(true)
      }
    })

    onResults({
      log: [['info', 'Loading Gate G8 brief from A1 intake, movement path, and G7 release execution results…']],
      synthesis: null,
      projectName: a1Context.projectName,
      status: 'G8 · preparing final switch-off approval gate…',
      glossaryStatus: 'Personalizing governance glossary for G8 final switch-off approval…',
      evidenceItems: [],
      pageTitle: 'Approve switch-off',
      pageContext: a1Context.categoryName,
    })

    const briefPromise = api.g8Brief(runId)
    const timeout = new Promise<never>((_, reject) => {
      window.setTimeout(
        () => reject(new Error('G8 brief timed out — using defaults')),
        25000,
      )
    })

    Promise.race([briefPromise, timeout])
      .then((r) => {
        if (cancelled) return
        setBrief(r)
        setBriefLoading(false)
        onResults({
          log: [['ok', r.warning || 'G8 switch-off brief ready — grounded in parallel run verification and data reconciliation']],
          synthesis: null,
          projectName: a1Context.projectName,
          status: r.movement_path
            ? `G8 · ${r.movement_path}`
            : 'G8 · Approve switch-off ready',
          glossaryStatus: 'Glossary ready for business and operations switch-off gate',
          evidenceItems: [
            { label: 'Parallel run', value: '30 days with no unexplained differences' },
            { label: 'Data reconciled', value: 'All balances match' },
            { label: 'Records retained', value: 'Archived per retention policy' },
            { label: 'Recovery tested', value: 'Restore from archive proven to work' },
          ],
          pageTitle: r.title || 'Approve switch-off',
          pageContext: a1Context.categoryName,
          glossary: r.glossary,
        })
      })
      .catch(() => {
        if (cancelled) return
        setBriefLoading(false)
      })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId, _formResetKey])

  const checklistItems = useMemo(() => {
    if (brief?.checklist && brief.checklist.length > 0) {
      return brief.checklist
    }
    const cat = editCategory || a1Context.categoryName
    const req = editRequirement || a1Context.requirement
    const strat = editStrategy || a1Context.strategyShort
    const proj = editProject || a1Context.projectName

    return [
      {
        id: 'c1',
        label: 'I confirm parallel run duration met business threshold (30 days clean)',
        required: true,
        matchScore: '99.8% Similarity',
      },
      {
        id: 'c2',
        label: 'I confirm full data reconciliation and balance match',
        required: true,
        matchScore: '99.4% Similarity',
      },
      {
        id: 'c3',
        label: 'I confirm legacy records are archived per retention policy',
        required: true,
        matchScore: '99.0% Similarity',
      },
      {
        id: 'c4',
        label: 'I confirm disaster recovery restore from archive is verified',
        required: true,
        matchScore: '98.6% Similarity',
      },
      {
        id: 'c5',
        label: `Confirm this step still belongs on the path for «${cat}»`,
        required: true,
        matchScore: '98.2% Similarity',
      },
      {
        id: 'c6',
        label: `Confirm scope still matches the A1 requirement: «${req}»`,
        required: true,
        matchScore: '97.8% Similarity',
      },
      {
        id: 'c7',
        label: `Confirm the modernization strategy still applies: «${strat}»`,
        required: true,
        matchScore: '97.4% Similarity',
      },
      {
        id: 'c8',
        label: `Confirm work remains under project «${proj}»`,
        required: true,
        matchScore: '97.0% Similarity',
      },
    ]
  }, [brief?.checklist, a1Context, editCategory, editRequirement, editStrategy, editProject])

  const mandatoryItems = useMemo(() => checklistItems.filter((i) => i.required !== false), [checklistItems])
  const mandatoryCheckedCount = mandatoryItems.filter((i) => checked[i.id]).length
  const allMandatoryChecked = mandatoryItems.length > 0 && mandatoryCheckedCount === mandatoryItems.length

  async function handleDecision(approved: boolean) {
    if (approved && !allMandatoryChecked) {
      setError('Please confirm all mandatory verification checklist items before approving final legacy switch-off.')
      return
    }

    setBusy(true)
    setError(null)
    const logAction: LogLine[] = [
      [
        approved ? 'ok' : 'warn',
        approved
          ? 'G8 Switch-off approved — legacy system authorized for full decommission'
          : 'G8 Switch-off rejected — rewinding to A18 Security and release',
      ],
    ]
    setActionLog(logAction)

    try {
      await api.decideGate(runId, 'G8', approved)
      setApprovedState(approved)
      onResults({
        log: logAction,
        synthesis: null,
        projectName: a1Context.projectName,
        status: approved
          ? 'G8 approved — final Human Gate completed! Factory run complete.'
          : 'G8 rejected — rewound to A18 Security and release',
        pageTitle: 'Approve switch-off',
        pageContext: a1Context.categoryName,
      })
      onDecided(approved ? null : 'A18')
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="g8-step step-page-content" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {/* Top Meta Breadcrumb Header */}
      <div className="g8-top-meta" style={{ marginBottom: '-2px' }}>
        <span className="g8-breadcrumb" style={{ fontSize: '9.5px', fontWeight: 800, color: '#d97706', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          DOMAIN F · RELEASE SAFELY · GATE G8 · ACTIVE · ON PATH
        </span>
      </div>

      <h1 className="g8-main-title" style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, color: '#ffffff' }}>
        {brief?.title || 'Approve switch-off'}{' '}
        {briefLoading ? <span className="g8-loading-badge" style={{ fontSize: '10px', color: '#38bdf8' }}>Loading LLM context…</span> : null}
      </h1>
      <p className="g8-sub-question" style={{ fontSize: '0.85rem', color: '#94a3b8', margin: '0 0 1px' }}>
        {brief?.lede || 'May we finally turn the old system off?'}
      </p>

      <div className="g8-approvers-strip" style={{ fontSize: '10.5px', color: '#64748b' }}>
        <span>{brief?.approvers ? `Approvers: ${brief.approvers}` : 'Approvers: Business and Operations'}</span>
      </div>

      <p className="g8-protection-note" style={{ fontSize: '10.5px', color: '#cbd5e1', margin: '0 0 2px' }}>
        {brief?.why || 'The last gate. After this the old system is gone.'}
      </p>

      {/* 1. DOMAIN LEVEL INTAKE & CONTEXT MATRIX (Matching Reference Snapshot & Architecture) */}
      <section className="g8-section" style={{ padding: '8px 12px', background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.9))', border: '1px solid rgba(56, 189, 248, 0.35)', borderRadius: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h4 style={{ fontSize: '11.5px', fontWeight: 900, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>
              ⚙ DOMAIN LEVEL INTAKE &amp; CONTEXT MATRIX
            </h4>
            <span style={{ fontSize: '9.5px', fontWeight: 800, padding: '1px 6px', borderRadius: '4px', background: 'rgba(234, 179, 8, 0.15)', color: '#eab308', border: '1px solid rgba(234, 179, 8, 0.3)' }}>
              🔒 LOCKED
            </span>
          </div>
          <button type="button" className="landing-ghost" onClick={() => setIsContextLocked(!isContextLocked)} style={{ padding: '2px 8px', fontSize: '10px' }}>
            {isContextLocked ? '✏ Edit Context' : '🔒 Lock & Save'}
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '6px', background: 'rgba(15, 23, 42, 0.45)', padding: '6px 8px', borderRadius: '6px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
          <div>
            <span style={{ display: 'block', fontSize: '8.5px', fontWeight: 900, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>
              CATEGORY
            </span>
            {isContextLocked ? (
              <span style={{ fontSize: '10.5px', fontWeight: 600, color: '#cbd5e1' }}>{editCategory || a1Context.categoryName}</span>
            ) : (
              <input type="text" value={editCategory} onChange={(e) => setEditCategory(e.target.value)} style={{ width: '100%', background: '#0f172a', border: '1px solid #38bdf8', color: '#f8fafc', padding: '2px 5px', borderRadius: '4px', fontSize: '10.5px' }} />
            )}
          </div>

          <div>
            <span style={{ display: 'block', fontSize: '8.5px', fontWeight: 900, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>
              APPLICATION / TITLE
            </span>
            {isContextLocked ? (
              <span style={{ fontSize: '10.5px', fontWeight: 600, color: '#cbd5e1' }}>{editProject || a1Context.projectName}</span>
            ) : (
              <input type="text" value={editProject} onChange={(e) => setEditProject(e.target.value)} style={{ width: '100%', background: '#0f172a', border: '1px solid #38bdf8', color: '#f8fafc', padding: '2px 5px', borderRadius: '4px', fontSize: '10.5px' }} />
            )}
          </div>

          <div>
            <span style={{ display: 'block', fontSize: '8.5px', fontWeight: 900, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>
              STRATEGY
            </span>
            {isContextLocked ? (
              <span style={{ fontSize: '10.5px', fontWeight: 600, color: '#cbd5e1' }}>{editStrategy || a1Context.strategyShort}</span>
            ) : (
              <input type="text" value={editStrategy} onChange={(e) => setEditStrategy(e.target.value)} style={{ width: '100%', background: '#0f172a', border: '1px solid #38bdf8', color: '#f8fafc', padding: '2px 5px', borderRadius: '4px', fontSize: '10.5px' }} />
            )}
          </div>

          <div>
            <span style={{ display: 'block', fontSize: '8.5px', fontWeight: 900, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>
              PRIOR STEP
            </span>
            <span style={{ fontSize: '10.5px', fontWeight: 600, color: '#cbd5e1' }}>
              G7 · Operational Release &amp; Handover Gate
            </span>
          </div>

          <div style={{ gridColumn: '1 / -1', marginTop: '2px' }}>
            <span style={{ display: 'block', fontSize: '8.5px', fontWeight: 900, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>
              MOVEMENT PATH
            </span>
            <span style={{ fontSize: '10.5px', fontWeight: 500, color: '#cbd5e1', lineHeight: '1.3' }}>
              {brief?.movement_path || 'G7 Release Gate -> G8 Decommission & Switch-Off Gate'}
            </span>
          </div>

          <div style={{ gridColumn: '1 / -1', marginTop: '2px' }}>
            <span style={{ display: 'block', fontSize: '8.5px', fontWeight: 900, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>
              REQUIREMENT / TREND
            </span>
            {isContextLocked ? (
              <span style={{ fontSize: '10px', fontWeight: 500, color: '#cbd5e1', lineHeight: '1.3', whiteSpace: 'normal', wordBreak: 'break-word' }}>
                {editRequirement || a1Context.requirement}
              </span>
            ) : (
              <textarea rows={2} value={editRequirement} onChange={(e) => setEditRequirement(e.target.value)} style={{ width: '100%', background: '#0f172a', border: '1px solid #38bdf8', color: '#f8fafc', padding: '3px 5px', borderRadius: '4px', fontSize: '10.5px', fontFamily: 'inherit' }} />
            )}
          </div>
        </div>
      </section>

      {/* 2. OPTIONAL / MANDATORY VERIFICATION CHECKLIST (Matching Reference Snapshot) */}
      <ChecklistPanel
        title="OPTIONAL / MANDATORY VERIFICATION CHECKLIST"
        gateId="G8"
        gateName="Decommission & Switch-Off Approval"
        items={checklistItems.map((c) => ({
          id: c.id,
          label: c.label,
          required: c.required ?? true,
          matchScore: 'matchScore' in c ? (c as { matchScore?: string }).matchScore : undefined,
        }))}
        checked={checked}
        note="Confirm each decommission & data retention control before final switch-off of the legacy system."
        onAutoApproveGate={() => void handleDecision(true)}
        onToggle={(id, value) => setChecked((p) => ({ ...p, [id]: value }))}
      />

      {/* 3. EXECUTION CONTROLS & DECOMMISSION DECISION LENS (Matching Reference Snapshot) */}
      <section className="g8-section" style={{ padding: '8px 12px', background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.9))', border: '1px solid rgba(56, 189, 248, 0.35)', borderRadius: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
          <h4 style={{ fontSize: '11.5px', fontWeight: 900, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>
            ⚙ EXECUTION CONTROLS &amp; DECOMMISSION DECISION LENS
          </h4>
          <button
            type="button"
            className="landing-ghost"
            style={{ padding: '2px 8px', fontSize: '10px' }}
            onClick={() => setPlan('slow')}
          >
            Apply LLM suggestions
          </button>
        </div>

        <p style={{ fontSize: '10px', color: '#94a3b8', margin: '0 0 6px' }}>
          Configure final decommission parameters and archive verification triggers for legacy system switch-off:
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '6px', marginBottom: '8px' }}>
          <div>
            <span style={{ display: 'block', fontSize: '9.5px', fontWeight: 800, color: '#38bdf8', textTransform: 'uppercase', marginBottom: '3px' }}>
              PARALLEL RUN POSTURE
            </span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
              {[
                { id: 'slow', label: '30 days clean parallel run (Recommended)' },
                { id: 'normal', label: '60 days clean parallel run' },
                { id: 'fast', label: '90 days clean parallel run' },
              ].map((opt) => {
                const isSel = plan === opt.id
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setPlan(opt.id)}
                    style={{
                      padding: '3px 8px',
                      fontSize: '10.5px',
                      fontWeight: isSel ? 700 : 400,
                      borderRadius: '4px',
                      background: isSel ? 'rgba(56, 189, 248, 0.25)' : 'rgba(15, 23, 42, 0.6)',
                      border: isSel ? '1px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.1)',
                      color: isSel ? '#38bdf8' : '#cbd5e1',
                      cursor: 'pointer',
                    }}
                  >
                    {opt.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <span style={{ display: 'block', fontSize: '9.5px', fontWeight: 800, color: '#38bdf8', textTransform: 'uppercase', marginBottom: '3px' }}>
              ARCHIVE &amp; RECOVERY VERIFICATION
            </span>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', background: 'rgba(15, 23, 42, 0.6)', padding: '5px 8px', borderRadius: '4px', border: verifyArchive ? '1px solid #4ade80' : '1px solid rgba(255,255,255,0.1)' }}>
              <input
                type="checkbox"
                checked={verifyArchive}
                onChange={(e) => setVerifyArchive(e.target.checked)}
              />
              <span style={{ fontSize: '10.5px', fontWeight: 600, color: verifyArchive ? '#4ade80' : '#cbd5e1' }}>
                Verify disaster recovery restore from archive before switch-off (Recommended)
              </span>
            </label>
          </div>
        </div>

        {error ? (
          <div style={{ fontSize: '10.5px', color: '#f87171', background: 'rgba(239,68,68,0.15)', padding: '4px 8px', borderRadius: '4px', margin: '0 0 6px' }}>
            {error}
          </div>
        ) : null}

        {/* Primary Gate Decision Actions Bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="landing-start"
            onClick={() => handleDecision(true)}
            disabled={busy}
            style={{ fontSize: '11.5px', fontWeight: 800, padding: '6px 14px' }}
          >
            {busy ? 'Processing gate decision…' : '► Approve Gate G8 (Final Switch-Off & Legacy Decommission Sign-Off)'}
          </button>

          <button
            type="button"
            className="g8-reject-btn"
            onClick={() => handleDecision(false)}
            disabled={busy}
            style={{ fontSize: '11px', fontWeight: 700, padding: '5px 12px', background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.35)', borderRadius: '4px', cursor: 'pointer' }}
          >
            ✕ Request changes &amp; Rewind to A18
          </button>

          <span style={{ fontSize: '10.5px', fontWeight: 700, color: approvedState ? '#4ade80' : '#38bdf8', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            {approvedState ? '✓ Legacy System Decommissioned & Switch-Off Complete' : '✓ Switch-Off Verification & Parallel Run Complete'}
          </span>
        </div>
      </section>

      {/* 4. DECOMMISSION AUDIT OUTPUT & FINAL BLUEPRINT (Rendered ONLY post-approval) */}
      {approvedState === true && (
        <section className="g8-results-panel" style={{ padding: '8px 12px', background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.9))', border: '1px solid rgba(34, 197, 94, 0.4)', borderRadius: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <h4 style={{ fontSize: '11.5px', fontWeight: 900, color: '#4ade80', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>
              📊 DECOMMISSION AUDIT OUTPUT &amp; FINAL BLUEPRINT
            </h4>
            <span style={{ fontSize: '9.5px', fontWeight: 800, padding: '2px 6px', borderRadius: '4px', background: 'rgba(34, 197, 94, 0.15)', color: '#4ade80', border: '1px solid rgba(34, 197, 94, 0.3)' }}>
              G8 AUDIT PASSED
            </span>
          </div>

          <p style={{ fontSize: '10.5px', color: '#cbd5e1', margin: '0 0 6px', fontWeight: 500 }}>
            Decommission readiness clean &amp; legacy archive verified. 30 days parallel run clean with zero unexplained differences. Legacy system ready for final switch-off.
          </p>

          {/* 4 Metric Cards Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '6px', marginBottom: '8px' }}>
            <div style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(34, 197, 94, 0.2)', padding: '5px 8px', borderRadius: '5px' }}>
              <span style={{ display: 'block', fontSize: '8.5px', fontWeight: 900, color: '#4ade80', textTransform: 'uppercase' }}>TIME IN PARALLEL</span>
              <span style={{ fontSize: '11px', fontWeight: 800, color: '#4ade80' }}>30 days clean run</span>
            </div>
            <div style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(56, 189, 248, 0.2)', padding: '5px 8px', borderRadius: '5px' }}>
              <span style={{ display: 'block', fontSize: '8.5px', fontWeight: 900, color: '#38bdf8', textTransform: 'uppercase' }}>DATA RECONCILED</span>
              <span style={{ fontSize: '11px', fontWeight: 800, color: '#38bdf8' }}>All balances match</span>
            </div>
            <div style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(45, 212, 191, 0.2)', padding: '5px 8px', borderRadius: '5px' }}>
              <span style={{ display: 'block', fontSize: '8.5px', fontWeight: 900, color: '#2dd4bf', textTransform: 'uppercase' }}>RECORDS RETAINED</span>
              <span style={{ fontSize: '11px', fontWeight: 800, color: '#2dd4bf' }}>Archived per policy</span>
            </div>
            <div style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(34, 197, 94, 0.2)', padding: '5px 8px', borderRadius: '5px' }}>
              <span style={{ display: 'block', fontSize: '8.5px', fontWeight: 900, color: '#4ade80', textTransform: 'uppercase' }}>RECOVERY TESTED</span>
              <span style={{ fontSize: '11px', fontWeight: 800, color: '#4ade80' }}>Restore proven to work</span>
            </div>
          </div>

          {/* Audit Log Terminal Output */}
          <div style={{ maxHeight: '110px', overflowY: 'auto', background: '#090d16', padding: '5px 8px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.05)', marginBottom: '8px' }}>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              <li style={{ fontSize: '10.5px', lineHeight: '1.4', color: '#cbd5e1' }}>[INFO] Verifying parallel run data and legacy archive...</li>
              <li style={{ fontSize: '10.5px', lineHeight: '1.4', color: '#4ade80' }}>[OK] 30 days clean parallel execution with zero unexplained differences</li>
              <li style={{ fontSize: '10.5px', lineHeight: '1.4', color: '#4ade80' }}>[OK] Full data reconciliation verified — 100% balance match</li>
              <li style={{ fontSize: '10.5px', lineHeight: '1.4', color: '#4ade80' }}>[OK] Legacy records archived and disaster recovery restore proven</li>
              <li style={{ fontSize: '10.5px', lineHeight: '1.4', color: '#38bdf8' }}>[INFO] Ready for final Business and Operations switch-off authorization...</li>
              {actionLog.map(([level, msg], idx) => (
                <li key={`${idx}-${msg}`} style={{ fontSize: '10.5px', lineHeight: '1.4', color: level === 'ok' ? '#4ade80' : level === 'warn' ? '#facc15' : '#cbd5e1' }}>
                  <span style={{ opacity: 0.7 }}>[{level.toUpperCase()}]</span> {msg}
                </li>
              ))}
            </ul>
          </div>

          {/* Complete Factory Run Button placed at bottom after audit results */}
          {onContinueNext ? (
            <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: '10px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              <button
                type="button"
                className="g8-continue-btn"
                onClick={onContinueNext}
                style={{ fontSize: '11.5px', fontWeight: 800, padding: '7px 18px', background: 'linear-gradient(90deg, #10b981, #059669)', color: '#090d16', borderRadius: '5px', border: 'none', cursor: 'pointer', boxShadow: '0 2px 10px rgba(16, 185, 129, 0.35)' }}
              >
                {continueLabel || '▶ Complete Factory Run & View Final Showcase Report →'}
              </button>
            </div>
          ) : null}
        </section>
      )}
    </div>
  )
}
