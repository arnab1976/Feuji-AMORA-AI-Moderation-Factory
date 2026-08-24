import { useEffect, useMemo, useState } from 'react'
import { api, ApiError, type G2Brief, type GateNode } from '../api/client'
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
  { id: 'shape_ok', label: 'I approve the proposed service / domain boundaries', required: true },
  { id: 'build_ok', label: 'I approve the build order for this modernization strategy', required: true },
  { id: 'contracts_ok', label: 'Interface contracts cover partners and piece boundaries', required: true },
  { id: 'path_ok', label: 'I confirm Agents A9–A11 on the movement path produced this design', required: true },
  { id: 'data_ok', label: 'Data ownership and cutover strategy are clear and acceptable', required: true },
  { id: 'strategy_ok', label: 'I confirm the target architecture matches the A1 requirement and strategy', required: true },
  { id: 'compare_ok', label: 'I confirm previous → target deltas are understood and acceptable', required: true },
  { id: 'security_ok', label: 'Security / auth design for the target architecture has been reviewed', required: true },
]

export function G2ArchitectureApprovalStep({
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
  const [brief, setBrief] = useState<G2Brief | null>(null)
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
      log: [['info', 'Loading G2 design approval from A9–A11 + path map…']],
      synthesis: null,
      projectName: a1Context.projectName !== '—' ? a1Context.projectName : '',
      status: 'G2 · synthesizing architecture approval…',
      pageTitle: 'Approve the design',
      pageContext: a1Context.categoryName,
      evidenceItems: [],
    })

    Promise.all([api.g2Brief(runId), api.gate(runId, gate.id)])
      .then(([b, ev]) => {
        if (cancelled) return
        setBrief(b)
        setEvidence(ev)
        onEvidence(ev)

        const gloss = (b.glossary || []).map((g) => ({ term: g.term, def: g.def }))
        const items = (b.architecture_items || []).map((p) => ({
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
          status: ev.decided ? 'G2 decided' : b.activity_status || 'G2 awaiting approval',
          pageTitle: /factory ui|modernization factory/i.test(b.title || '')
            ? 'Approve the design'
            : b.title || ev.name || 'Approve the design',
          pageContext: a1Context.categoryName,
          evidenceItems: items.length
            ? items
            : (ev.evidence || []).map((e) => ({ label: e.label, value: e.value })),
          glossary: gloss.length ? gloss : undefined,
          glossaryStatus: gloss.length ? 'Terms for this approval' : undefined,
        })
        if (b.warning) {
          setNotice(
            'Could not fully synthesize from the LLM — showing design approval built from Agents A9–A11.',
          )
        }
      })
      .catch((e) => {
        if (cancelled) return
        setBrief(null)
        setNotice(
          'Could not load the LLM brief — you can still review architecture evidence and decide.',
        )
        setError(e instanceof ApiError ? e.message : String(e))
        onResults({
          log: [['warn', e instanceof Error ? e.message : String(e)]],
          synthesis: null,
          projectName: a1Context.projectName !== '—' ? a1Context.projectName : '',
          status: 'G2 · awaiting approval',
          pageTitle: 'Approve the design',
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
            approved ? 'G2 approved — pipeline continues' : 'G2 rejected — rewound to A11',
          ],
        ],
        synthesis: null,
        projectName: a1Context.projectName !== '—' ? a1Context.projectName : '',
        status: approved ? 'G2 approved' : 'G2 rejected',
        pageTitle: brief?.title || 'Approve the design',
        pageContext: a1Context.categoryName,
        evidenceItems: (brief?.architecture_items || []).map((p) => ({
          label: p.label,
          value: p.value,
        })),
      })
      onDecided(approved ? null : res.rewound_to || 'A10')
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const decided = Boolean(evidence?.decided)
  const architectureItems = (
    brief?.architecture_items?.length
      ? brief.architecture_items
      : (evidence?.evidence || []).map((e) => ({ label: e.label, value: e.value, source: '' }))
  ).filter((item) => !/factory ui|bounded service design from a10/i.test(`${item.label} ${item.value}`))
  const displayItems =
    architectureItems.length >= 3
      ? architectureItems
      : (evidence?.evidence || []).map((e) => ({ label: e.label, value: e.value, source: '' }))
  const deltas = brief?.comparison_deltas || []
  const movementPath =
    brief?.movement_path && !/factory ui/i.test(brief.movement_path)
      ? brief.movement_path
      : 'A9 Domain decomposition -> A10 Target architecture -> A11 Data modernization -> G2'

  const activeLang = useMemo(() => {
    const reqLower = (a1Context.requirement || '').toLowerCase()
    const projLower = (a1Context.projectName || '').toLowerCase()
    const catLower = (a1Context.categoryName || '').toLowerCase()
    const combined = `${reqLower} ${projLower} ${catLower}`

    if (combined.includes('sas')) return 'SAS'
    if (combined.includes('fortran')) return 'Fortran'
    if (combined.includes('cobol')) return 'COBOL'
    if (combined.includes('pl/i') || combined.includes('pli')) return 'PL/I'
    if (combined.includes('natural')) return 'Natural'
    if (combined.includes('rpg')) return 'RPG'
    if (combined.includes('pascal') || combined.includes('delphi')) return 'Delphi/Pascal'
    if (combined.includes('vb6') || combined.includes('visual basic')) return 'VB6'
    if (combined.includes('assembler') || combined.includes('asm')) return 'Assembler'
    if (combined.includes('java')) return 'Java'
    if (combined.includes('c#') || combined.includes('.net')) return '.NET'
    return 'Legacy'
  }, [a1Context])

  const cleanedDeltas = useMemo(() => {
    const rawDeltas = deltas
    const isCobol = activeLang === 'COBOL'

    return rawDeltas.map((d) => {
      let frm = d.from || ''
      if (!isCobol && frm.toLowerCase().includes('cobol')) {
        frm = frm.replace(/\bCOBOL monolith\b/gi, `${activeLang} monolith`)
                 .replace(/\bCOBOL system\b/gi, `${activeLang} system`)
                 .replace(/\bCOBOL\b/gi, activeLang)
      }
      return { ...d, from: frm }
    })
  }, [deltas, activeLang])

  return (
    <div className="g2-step mf-req">
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
              A10 · Target Architecture
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

      {/* 2. GOVERNANCE CONTROLS & ARCHITECTURE EVIDENCE (Single compact card) */}
      <section className="g0-policy-card g1-evidence-card" style={{ padding: '10px 14px', background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.9))', border: '1px solid rgba(56, 189, 248, 0.35)', borderRadius: '8px', margin: '0 0 10px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
          <h4 style={{ fontSize: '13px', fontWeight: 900, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>
            ⚙️ GOVERNANCE CONTROLS &amp; ARCHITECTURE EVIDENCE
          </h4>
          <span style={{ fontSize: '10px', fontWeight: 800, padding: '2px 6px', borderRadius: '4px', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.3)' }}>
            A9 → A10
          </span>
        </div>

        <p style={{ fontSize: '11px', color: '#94a3b8', margin: '0 0 8px', lineHeight: '1.4' }}>
          Expected Approver: <strong style={{ color: '#f8fafc' }}>{brief?.expected_approvers || evidence?.approvers || 'Business Domain Owner & Systems Analyst'}</strong>. Review target architecture contracts and bounded context design before code transpilation.
        </p>

        {briefLoading ? (
          <p className="dash-empty" style={{ fontSize: '11px' }}>Synthesizing architecture evidence from A9–A10…</p>
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

      {/* 3. SLEEK SIDE-BY-SIDE ARCHITECTURAL MATRIX (Zero Clutter) */}
      {!briefLoading && (
        <section style={{ padding: '10px 14px', background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(56, 189, 248, 0.25)', borderRadius: '8px', margin: '0 0 10px 0' }}>
          <h4 style={{ fontSize: '11.5px', fontWeight: 900, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 8px' }}>
            📊 ARCHITECTURAL COMPARISON &amp; TO-BE PROPOSAL
          </h4>
          <div style={{ background: 'rgba(15, 23, 42, 0.5)', borderRadius: '6px', border: '1px solid rgba(255, 255, 255, 0.08)', overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.4fr 1.4fr', background: 'rgba(30, 41, 59, 0.8)', borderBottom: '1px solid rgba(56, 189, 248, 0.25)', padding: '6px 10px' }}>
              <span style={{ fontSize: '10px', fontWeight: 900, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>ARCHITECTURAL ASPECT</span>
              <span style={{ fontSize: '10px', fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>PREVIOUS MONOLITH (AS-IS)</span>
              <span style={{ fontSize: '10px', fontWeight: 900, color: '#4ade80', textTransform: 'uppercase', letterSpacing: '0.06em' }}>TARGET MICROSERVICES (TO-BE)</span>
            </div>

            {cleanedDeltas.length > 0 ? (
              cleanedDeltas.map((d, idx) => (
                <div
                  key={`${d.aspect}-${idx}`}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1.2fr 1.4fr 1.4fr',
                    padding: '6px 10px',
                    borderBottom: idx === cleanedDeltas.length - 1 ? 'none' : '1px solid rgba(255, 255, 255, 0.04)',
                    background: idx % 2 === 0 ? 'transparent' : 'rgba(255, 255, 255, 0.015)',
                    alignItems: 'center',
                    fontSize: '11px',
                  }}
                >
                  <strong style={{ color: '#cbd5e1', fontWeight: 700 }}>{d.aspect}</strong>
                  <span style={{ color: '#94a3b8' }}>{d.from}</span>
                  <span style={{ color: '#f8fafc', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ color: '#4ade80', fontSize: '9.5px' }}>→</span> {d.to}
                    {d.change ? <span style={{ fontSize: '9px', padding: '1px 5px', borderRadius: '3px', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8' }}>{d.change}</span> : null}
                  </span>
                </div>
              ))
            ) : (
              <div style={{ padding: '8px 10px', fontSize: '11px', color: '#cbd5e1' }}>
                <span>{brief?.target_summary || 'Target architecture proposals synthesized and ready for gate review.'}</span>
              </div>
            )}
          </div>
        </section>
      )}

      {/* 4. VERIFICATION CHECKLIST */}
      {!decided && (
        <ChecklistPanel
          title={brief?.checklist_heading || 'OPTIONAL / MANDATORY VERIFICATION CHECKLIST'}
          gateId="G2"
          gateName="Target Architecture & Microservice Sign-Off"
          items={checklist}
          checked={checked}
          note={brief?.checklist_note || 'Confirm each mandatory verification item before approving this architecture gate.'}
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
            {continueLabel || '▶ Move Forward to A12: Code Transpilation Agent →'}
          </button>
          <span className="g0-await-pill g1-approved-pill">✓ Gate G2 approved</span>
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
            {busy ? 'Saving…' : '▶ Approve — Continue Next Agent: A12 Code Transpilation Agent →'}
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
