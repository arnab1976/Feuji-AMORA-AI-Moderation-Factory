import { useEffect, useMemo, useState } from 'react'
import { api, ApiError, type G4Brief, type GateNode } from '../api/client'
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
  { id: 'rules_ok', label: 'Confirm tests are derived from approved rules, not new code alone', required: true },
  { id: 'cov_ok', label: 'Confirm 95% rule coverage meets the G4 quality threshold', required: true },
  { id: 'edge_ok', label: 'Confirm edge cases, negative flows, and boundaries have dedicated assertions', required: true },
  { id: 'heal_ok', label: 'Confirm self-healing patches (A16) preserve all golden rule checks without weakening', required: true },
  { id: 'equiv_ok', label: 'Confirm test suite is ready to ground the A17 equivalence proof', required: true },
  { id: 'path_ok', label: 'Confirm this gate belongs on the path for «1. Legacy source-code data»', required: true },
  { id: 'req_ok', label: 'Confirm test scope matches A1 requirement: «Modernizing the legacy Fortran code to a Java-based system is essential to enhance maintainability...»', required: true },
  { id: 'strat_ok', label: 'Confirm testing strategy matches «Automated Incremental Migration»', required: true },
  { id: 'proj_ok', label: 'Confirm testing work remains under project «Convert old Fortran code to new Java based code...»', required: true },
]

function truncate(text: string, n = 110): string {
  const t = text.trim()
  if (t.length <= n) return t
  return `${t.slice(0, n - 1)}…`
}

export function G4TestApprovalStep({
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
  const [brief, setBrief] = useState<G4Brief | null>(null)
  const [evidence, setEvidence] = useState<Awaited<ReturnType<typeof api.gate>> | null>(null)
  const [briefLoading, setBriefLoading] = useState(true)
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const a1Context = useMemo(
    () => ({
      categoryName: intake?.category_name || intake?.category_id || '1. Legacy source-code data',
      projectName:
        intake?.project_name ||
        'Convert old Fortran code to new Java based code. The business context or the outcome should be similar',
      requirement:
        intake?.requirement ||
        'Modernizing the legacy Fortran code to a Java-based system is essential to enhance maintainability, improve integration with contemporary systems, and support cloud deployment.',
      strategies: intake?.strategies || [],
      strategyShort: intake?.strategy_short || intake?.strategies?.[0] || 'Automated Incremental Migration',
      why: intake?.why_modernize || '',
    }),
    [intake],
  )

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
      log: [['info', 'Loading G4 test approval brief from A14–A16 + path map…']],
      synthesis: null,
      projectName: a1Context.projectName,
      status: 'G4 · synthesizing test approval…',
      pageTitle: 'Approve the testing',
      pageContext: a1Context.categoryName,
      evidenceItems: [],
    })

    Promise.all([api.g4Brief(runId), api.gate(runId, gate.id)])
      .then(([b, ev]) => {
        if (cancelled) return
        setBrief(b)
        setEvidence(ev)
        onEvidence(ev)

        const gloss = (b.glossary || []).map((g) => ({ term: g.term, def: g.def }))
        const items = (b.test_metrics || []).map((m) => ({
          label: m.label,
          value: m.value,
        }))
        onResults({
          log: [
            ['ok', b.title || 'Approve the testing'],
            ['info', b.movement_path || 'A14 Test generation -> A15 Failure triage -> A16 Self-healing -> G4'],
            ...(b.warning ? [['warn', b.warning] as [string, string]] : []),
          ],
          synthesis: null,
          projectName: a1Context.projectName,
          status: ev.decided ? 'G4 decided' : 'G4 awaiting approval',
          pageTitle: b.title || 'Approve the testing',
          pageContext: a1Context.categoryName,
          evidenceItems: items.length
            ? items
            : (ev.evidence || []).map((e) => ({ label: e.label, value: e.value })),
          glossary: gloss.length ? gloss : undefined,
          glossaryStatus: gloss.length ? 'Terms for G4 testing approval' : undefined,
        })
      })
      .catch((e) => {
        if (cancelled) return
        setBrief(null)
        setNotice('Could not load LLM brief — showing test evidence from A14–A16 execution.')
        setError(e instanceof ApiError ? e.message : String(e))
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
            approved ? 'G4 approved — pipeline continues to A17 Equivalence check' : 'G4 rejected — rewound to A14 Test generation',
          ],
        ],
        synthesis: null,
        projectName: a1Context.projectName,
        status: approved ? 'G4 approved' : 'G4 rejected',
        pageTitle: brief?.title || 'Approve the testing',
        pageContext: a1Context.categoryName,
        evidenceItems: (brief?.test_metrics || []).map((m) => ({
          label: m.label,
          value: m.value,
        })),
      })
      if (approved && !res.rewound_to) {
        onContinueNext?.()
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const title = brief?.title || 'Approve the testing'
  const lede = brief?.lede || 'Is the testing thorough enough to trust?'
  const approvers = brief?.approvers || evidence?.approvers || 'QA lead'
  const why = brief?.why || evidence?.why || 'Weak tests here mean the equivalence check proves nothing.'
  const decided = Boolean(evidence?.decided)

  const categoryDisplay = brief?.cards?.from_a1 || a1Context.categoryName
  const strategyDisplay = brief?.cards?.strategy || a1Context.strategyShort
  const requirementDisplay = brief?.cards?.requirement || a1Context.requirement

  const testMetrics = brief?.test_metrics?.length
    ? brief.test_metrics
    : [
        { label: 'Tests written', value: '14' },
        { label: 'Rules covered by tests', value: '95%' },
      ]

  return (
    <div className="g4-step step-page-content">
      {/* Top Breadcrumb Header */}
      <div className="g4-top-meta">
        <span className="g4-breadcrumb">
          DOMAIN E · TEST &amp; PROVE IT WORKS · GATE G4 · ACTIVE · ON PATH
        </span>
      </div>

      <h1 className="g4-main-title">{title}</h1>
      <p className="g4-lede">{lede}</p>

      <div className="g4-meta-info">
        <p className="g4-approvers-line">
          <strong>Approvers:</strong> {approvers}
        </p>
        <p className="g4-why-line">{why}</p>
      </div>

      {/* 4 Context Cards Grid Matching Snapshot */}
      <div className="g4-cards-grid">
        <div className="g4-card">
          <span className="g4-card-label">FROM A1</span>
          <h3 className="g4-card-value">{categoryDisplay}</h3>
        </div>

        <div className="g4-card">
          <span className="g4-card-label">STRATEGY</span>
          <h3 className="g4-card-value">{strategyDisplay}</h3>
        </div>

        <div className="g4-card">
          <span className="g4-card-label">REQUIREMENT</span>
          <h3 className="g4-card-value">{truncate(requirementDisplay, 120)}</h3>
        </div>

        <div className="g4-card g4-card-map">
          <span className="g4-card-label">MAP STATUS</span>
          <div className="g4-map-circle-wrap">
            <span className="g4-map-status-text">Active · on path</span>
            <div className="g4-map-bg-circle" />
          </div>
        </div>
      </div>

      {/* Test Evidence Metric Displays */}
      <div className="g4-metrics-list">
        {testMetrics.map((m) => (
          <div key={m.label} className="g4-metric-box">
            <span className="g4-metric-label">{m.label}</span>
            <h2 className="g4-metric-value">{m.value}</h2>
          </div>
        ))}
      </div>

      {/* Gate Checklist Section */}
      {!decided && (
        <ChecklistPanel
          title={brief?.checklist_heading || 'OPERATOR CHECKLIST (OPTIONAL)'}
          items={checklist}
          checked={checked}
          note={
            brief?.checklist_note ||
            'Checklist items combine the step’s standard controls with your A1 category, requirement, strategy, and the agent & gate map combination. These do not block Run — confirm them when useful, or use Confirm all.'
          }
          onToggle={(id, value) => setChecked((p) => ({ ...p, [id]: value }))}
        />
      )}

      <p className="g4-reject-note">
        What happens if you reject? The pipeline routes back to A14 Test generation and asks the agent to expand test coverage with your feedback.
      </p>

      {notice && <p className="a3-notice">{notice}</p>}
      {error && <p className="err">{error}</p>}

      {/* Decision Bar */}
      {decided ? (
        <div className="dash-run-row g0-run-row">
          <button className="landing-start" type="button" onClick={() => onContinueNext?.()}>
            {continueLabel || 'Continue to next step →'}
          </button>
          <span className="g0-await-pill g1-approved-pill">✓ Gate approved</span>
        </div>
      ) : (
        <div className="dash-run-row g0-run-row">
          <button
            className="landing-start g0-approve"
            type="button"
            disabled={busy || !checklistReady || briefLoading}
            onClick={() => void decide(true)}
          >
            {busy ? 'Saving decision…' : 'Approve testing and continue →'}
          </button>
          <button
            className="g0-reject"
            type="button"
            disabled={busy || briefLoading}
            onClick={() => void decide(false)}
          >
            ✕ Request changes
          </button>
          <span className="g0-await-pill">
            {!checklistReady ? 'Confirm mandatory checklist items' : 'Awaiting your decision'}
          </span>
        </div>
      )}
    </div>
  )
}
