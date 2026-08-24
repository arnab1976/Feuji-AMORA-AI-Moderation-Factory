import { useEffect, useMemo, useState } from 'react'
import { api, ApiError, type G3Brief, type GateNode } from '../api/client'
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
  { id: 'merge_ok', label: 'I approve merging the generated code for this slice', required: true },
  { id: 'stack_ok', label: 'I confirm the generation stack matches the approved target architecture', required: true },
  { id: 'prov_ok', label: 'I confirm provenance links code to approved rules', required: true },
  { id: 'path_ok', label: 'I confirm Agents A12–A13 on the movement path produced this code', required: true },
  { id: 'bridge_ok', label: 'I confirm bridges / facades are safe for dual-run', required: true },
  { id: 'strategy_ok', label: 'I confirm the code matches the A1 requirement and strategy', required: true },
  { id: 'sec_ok', label: 'I confirm no high-severity security findings remain open', required: true },
  { id: 'trace_ok', label: 'I confirm traceability is on so the merge can be audited', required: true },
  { id: 'slice_ok', label: 'I confirm this slice is ready to hand off to test generation', required: true },
]

export function G3CodeApprovalStep({
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
  const [brief, setBrief] = useState<G3Brief | null>(null)
  const [evidence, setEvidence] = useState<Awaited<ReturnType<typeof api.gate>> | null>(null)
  const [briefLoading, setBriefLoading] = useState(true)
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const [isContextLocked, setIsContextLocked] = useState(true)
  const [editCategory, setEditCategory] = useState('')
  const [editProject, setEditProject] = useState('')
  const [editStrategy, setEditStrategy] = useState('')
  const [editRequirement, setEditRequirement] = useState('')

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

  const checklist: ChecklistItem[] = useMemo(() => {
    const source = brief?.checklist?.length ? brief.checklist : FALLBACK_CHECKS
    return source.map((c) => ({
      id: c.id,
      label: c.label,
      required: true,
    }))
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
      log: [['info', 'Loading G3 code approval from A12–A13 + path map…']],
      synthesis: null,
      projectName: a1Context.projectName !== '—' ? a1Context.projectName : '',
      status: 'G3 · synthesizing code approval…',
      pageTitle: 'Approve the new code',
      pageContext: a1Context.categoryName,
      evidenceItems: [],
    })

    Promise.all([api.g3Brief(runId), api.gate(runId, gate.id)])
      .then(([b, ev]) => {
        if (cancelled) return
        setBrief(b)
        setEvidence(ev)
        onEvidence(ev)

        const gloss = (b.glossary || []).map((g) => ({ term: g.term, def: g.def }))
        const items = (b.code_items || []).map((p) => ({
          label: p.label,
          value: p.value,
        }))
        onResults({
          log: [
            ['ok', b.title],
            ['info', b.movement_path || b.context_line || b.requirement_summary || ''],
            ...(b.warning ? [['warn', b.warning] as [string, string]] : []),
          ],
          synthesis: null,
          projectName: a1Context.projectName !== '—' ? a1Context.projectName : '',
          status: ev.decided ? 'G3 decided' : b.activity_status || 'G3 awaiting approval',
          pageTitle: /factory ui|modernization factory/i.test(b.title || '')
            ? 'Approve the new code'
            : b.title || ev.name || 'Approve the new code',
          pageContext: a1Context.categoryName,
          evidenceItems: items.length
            ? items
            : (ev.evidence || []).map((e) => ({ label: e.label, value: e.value })),
          glossary: gloss.length ? gloss : undefined,
          glossaryStatus: gloss.length ? 'Terms for this approval' : undefined,
        })
        if (b.warning) {
          setNotice(
            'Could not fully synthesize from the LLM — showing code approval built from Agents A12–A13.',
          )
        }
      })
      .catch((e) => {
        if (cancelled) return
        setBrief(null)
        setNotice(
          'Could not load the LLM brief — you can still review code evidence and decide.',
        )
        setError(e instanceof ApiError ? e.message : String(e))
        onResults({
          log: [['warn', e instanceof Error ? e.message : String(e)]],
          synthesis: null,
          projectName: a1Context.projectName !== '—' ? a1Context.projectName : '',
          status: 'G3 · awaiting approval',
          pageTitle: 'Approve the new code',
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
      setError('Confirm every mandatory checklist item before approving.')
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
          [
            approved ? 'ok' : 'warn',
            approved ? 'G3 approved — pipeline continues' : 'G3 rejected — rewound to code generation',
          ],
        ],
        synthesis: null,
        projectName: a1Context.projectName !== '—' ? a1Context.projectName : '',
        status: approved ? 'G3 approved' : 'G3 rejected',
        pageTitle: brief?.title || 'Approve the new code',
        pageContext: a1Context.categoryName,
        evidenceItems: (brief?.code_items || []).map((p) => ({
          label: p.label,
          value: p.value,
        })),
      })
      onDecided(approved ? null : res.rewound_to || 'A12')
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const decided = Boolean(evidence?.decided)
  const codeItems = (
    brief?.code_items?.length
      ? brief.code_items
      : (evidence?.evidence || []).map((e) => ({ label: e.label, value: e.value, source: '' }))
  ).filter((item) => !/factory ui/i.test(`${item.label} ${item.value}`))
  const displayItems =
    codeItems.length >= 3
      ? codeItems
      : (evidence?.evidence || []).map((e) => ({ label: e.label, value: e.value, source: '' }))
  const movementPath =
    brief?.movement_path && !/factory ui/i.test(brief.movement_path)
      ? brief.movement_path
      : 'A12 Code generation -> A13 Integration bridges -> G3'

  return (
    <div className="g3-step mf-req">
      {/* 1. DOMAIN LEVEL INTAKE & CONTEXT MATRIX (Single flat card, captioned, editable/lockable) */}
      <section className="a2-a1-context" style={{ padding: '10px 14px', background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.9))', border: '1px solid rgba(56, 189, 248, 0.35)', borderRadius: '8px', margin: '0 0 10px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h4 style={{ fontSize: '13px', fontWeight: 900, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>
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
            <span style={{ display: 'block', fontSize: '9.5px', fontWeight: 900, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>
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
                style={{ width: '100%', background: '#0f172a', border: '1px solid #38bdf8', color: '#f8fafc', padding: '3px 6px', borderRadius: '4px', fontSize: '11.5px' }}
              />
            )}
          </div>

          <div>
            <span style={{ display: 'block', fontSize: '9.5px', fontWeight: 900, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>
              APPLICATION / TITLE
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
                style={{ width: '100%', background: '#0f172a', border: '1px solid #38bdf8', color: '#f8fafc', padding: '3px 6px', borderRadius: '4px', fontSize: '11.5px' }}
              />
            )}
          </div>

          <div>
            <span style={{ display: 'block', fontSize: '9.5px', fontWeight: 900, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>
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
                style={{ width: '100%', background: '#0f172a', border: '1px solid #38bdf8', color: '#f8fafc', padding: '3px 6px', borderRadius: '4px', fontSize: '11.5px' }}
              />
            )}
          </div>

          <div>
            <span style={{ display: 'block', fontSize: '9.5px', fontWeight: 900, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>
              PRIOR AGENT
            </span>
            <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#cbd5e1' }}>
              A12 · Code Generation
            </span>
          </div>

          <div style={{ gridColumn: '1 / -1', marginTop: '2px' }}>
            <span style={{ display: 'block', fontSize: '9.5px', fontWeight: 900, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>
              MOVEMENT PATH
            </span>
            <span style={{ fontSize: '11.5px', fontWeight: 500, color: '#cbd5e1', lineHeight: '1.4' }}>
              {movementPath}
            </span>
          </div>

          <div style={{ gridColumn: '1 / -1', marginTop: '2px' }}>
            <span style={{ display: 'block', fontSize: '9.5px', fontWeight: 900, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>
              REQUIREMENT / TREND
            </span>
            {isContextLocked ? (
              <span style={{ fontSize: '11.5px', fontWeight: 500, color: '#cbd5e1', lineHeight: '1.4' }}>
                {editRequirement || a1Context.requirement || 'Modernizing legacy application estate.'}
              </span>
            ) : (
              <textarea
                rows={2}
                value={editRequirement}
                onChange={(e) => setEditRequirement(e.target.value)}
                style={{ width: '100%', background: '#0f172a', border: '1px solid #38bdf8', color: '#f8fafc', padding: '4px 6px', borderRadius: '4px', fontSize: '11.5px', fontFamily: 'inherit' }}
              />
            )}
          </div>
        </div>
      </section>

      {/* 2. GOVERNANCE CONTROLS & CODE EVIDENCE (Single compact card) */}
      <section className="g0-policy-card g1-evidence-card" style={{ padding: '10px 14px', background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.9))', border: '1px solid rgba(56, 189, 248, 0.35)', borderRadius: '8px', margin: '0 0 10px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
          <h4 style={{ fontSize: '13px', fontWeight: 900, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>
            ⚙️ GOVERNANCE CONTROLS &amp; CODE EVIDENCE
          </h4>
          <span style={{ fontSize: '10px', fontWeight: 800, padding: '2px 6px', borderRadius: '4px', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.3)' }}>
            A12 → G3
          </span>
        </div>

        <p style={{ fontSize: '11px', color: '#94a3b8', margin: '0 0 8px', lineHeight: '1.4' }}>
          Expected Approver: <strong style={{ color: '#f8fafc' }}>{brief?.expected_approvers || evidence?.approvers || 'Engineering Lead & Quality Gatekeeper'}</strong>. Review transpiled code quality, rule traceability, and unit test readiness before security scanning.
        </p>

        {briefLoading ? (
          <p className="dash-empty" style={{ fontSize: '11px' }}>Synthesizing code evidence from A12–A13…</p>
        ) : (
          <div className="g0-policy-grid" style={{ gap: '6px' }}>
            {displayItems.map((item) => (
              <div key={`${item.label}-${item.value}`} className="g0-policy-item" style={{ padding: '6px 8px', background: 'rgba(15, 23, 42, 0.5)', borderRadius: '4px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                <div className="g0-policy-item-top" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                  <b style={{ fontSize: '11px', color: '#38bdf8' }}>{item.label}</b>
                  {item.source ? <span className="g0-src" style={{ fontSize: '9.5px', color: '#94a3b8' }}>{item.source}</span> : null}
                </div>
                <span style={{ fontSize: '11px', color: '#cbd5e1', lineHeight: '1.3' }}>{item.value}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 3. VERIFICATION CHECKLIST */}
      {!decided && (
        <ChecklistPanel
          title={brief?.checklist_heading || 'OPTIONAL / MANDATORY VERIFICATION CHECKLIST'}
          gateId="G3"
          gateName="Code Generation Sign-Off"
          items={checklist}
          checked={checked}
          note={brief?.checklist_note || 'Confirm each mandatory verification item before approving this code quality gate.'}
          onAutoApproveGate={() => void decide(true)}
          onToggle={(id, value) => setChecked((p) => ({ ...p, [id]: value }))}
        />
      )}

      {notice && <p className="a3-notice">{notice}</p>}
      {error && <p className="err">{error}</p>}
      {evidence?.blocker && <p className="err">{evidence.blocker}</p>}

      {decided ? (
        <div className="dash-run-row g0-run-row" style={{ marginTop: '10px' }}>
          <button className="landing-start" type="button" onClick={() => onContinueNext?.()} style={{ fontSize: '12.5px', fontWeight: 800, padding: '8px 16px' }}>
            {continueLabel || '▶ Move Forward to A14: Security & Compliance Agent →'}
          </button>
          <span className="g0-await-pill g1-approved-pill">✓ Gate G3 approved</span>
        </div>
      ) : (
        <div className="dash-run-row g0-run-row" style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            className="landing-start g0-approve"
            type="button"
            disabled={busy || !checklistReady || briefLoading}
            onClick={() => void decide(true)}
            style={{ fontSize: '12.5px', fontWeight: 800, padding: '8px 16px' }}
          >
            {busy ? 'Saving…' : '▶ Approve — Continue Next Agent: A14 Security & Compliance Agent →'}
          </button>
          <button
            className="g0-reject"
            type="button"
            disabled={busy || briefLoading}
            onClick={() => void decide(false)}
            style={{ fontSize: '11.5px', padding: '6px 12px' }}
          >
            ✕ Request changes
          </button>
          <span className="g0-await-pill" style={{ fontSize: '11px' }}>
            {!checklistReady ? 'Complete mandatory checklist' : 'Awaiting decision'}
          </span>
        </div>
      )}
    </div>
  )
}
