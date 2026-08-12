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

function truncate(text: string, n = 180): string {
  const t = text.trim()
  if (t.length <= n) return t
  return `${t.slice(0, n - 1)}…`
}

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
      if (approved && !res.rewound_to) {
        onContinueNext?.()
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const title = brief?.title || evidence?.name || 'Gate 0 · Intake Approval'
  const lede =
    brief?.lede ||
    evidence?.question ||
    'A human approves the scope, data classification, and access policy before anything else runs.'
  const decided = Boolean(evidence?.decided)
  const policyItems = brief?.policy_items?.length
    ? brief.policy_items
    : (evidence?.evidence || []).map((e) => ({ label: e.label, value: e.value, source: '' }))

  return (
    <div className="g0-step a1-wizard mf-req">
      <p className="dash-kicker">
        Domain {gate.domain} · {domainLabel} · Gate {gate.id} · Human approval required
      </p>
      <h2 className="dash-title">{briefLoading ? 'Gate 0 · Intake Approval' : title}</h2>
      <p className="dash-lede">
        {briefLoading
          ? 'Building a plain-English approval from your A1, A2 and A3 answers…'
          : lede}
      </p>

      <section className="a2-a1-context">
        <div className="a2-a1-context-head">
          <h4>Prior decisions · locked from A1 → A3</h4>
          <span className="a2-a1-lock">Read-only</span>
        </div>
        <p className="a2-a1-intro">
          {brief?.requirement_summary ||
            brief?.context_line ||
            'This approval is built from the answers you already gave — not a blank form.'}
        </p>
        <dl className="a2-a1-grid">
          <div>
            <dt>Category</dt>
            <dd>{a1Context.categoryName}</dd>
          </div>
          <div>
            <dt>Project</dt>
            <dd>{a1Context.projectName}</dd>
          </div>
          <div>
            <dt>Strategy</dt>
            <dd>{a1Context.strategyShort}</dd>
          </div>
          <div>
            <dt>A2 criticality</dt>
            <dd>{portfolio.criticality || '—'}</dd>
          </div>
          <div>
            <dt>A3 data care</dt>
            <dd>{policySnap.modelRule || policySnap.modelPolicy || '—'}</dd>
          </div>
          <div>
            <dt>Sensitive data</dt>
            <dd>{policySnap.sensitive || '—'}</dd>
          </div>
        </dl>
        {a1Context.requirement ? (
          <p className="a2-a1-why">
            <b>Requirement</b> {truncate(a1Context.requirement, 220)}
          </p>
        ) : null}
        {a1Context.why ? (
          <p className="a2-a1-why">
            <b>Why modernise</b> {truncate(a1Context.why, 220)}
          </p>
        ) : null}
      </section>

      <section className="g0-approver-card">
        <h4>{brief?.approver_heading || 'You are the approver'}</h4>
        <p>
          {brief?.paused_line ||
            "The pipeline has paused. Nothing downstream can happen until you decide. You're reviewing the work produced by Governance & Risk."}
        </p>
        <div className="g0-expected">
          <span className="g0-expected-label">Expected approver</span>
          <span className="g0-expected-value">
            {brief?.expected_approvers || evidence?.approvers || 'Application owner + Security'}
          </span>
        </div>
      </section>

      <section className="g0-policy-card">
        <div className="g0-policy-head">
          <h4>{brief?.policy_heading || 'Approval policy'}</h4>
          <span className="g0-policy-chip">From your earlier answers</span>
        </div>
        <p className="g0-policy-intro">
          {brief?.policy_intro ||
            'These rules were built from your earlier answers — nothing new is invented here.'}
        </p>
        {briefLoading ? (
          <p className="dash-empty">Synthesizing approval policy…</p>
        ) : (
          <div className="g0-policy-grid">
            {policyItems.map((item) => (
              <div key={`${item.label}-${item.value}`} className="g0-policy-item">
                <div className="g0-policy-item-top">
                  <b>{item.label}</b>
                  {item.source ? <span className="g0-src">{item.source}</span> : null}
                </div>
                <span>{item.value}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {!decided && (
        <ChecklistPanel
          title={brief?.checklist_heading || 'Checklist · click each item to confirm'}
          items={checklist}
          checked={checked}
          note={brief?.checklist_note || 'Click each item to confirm — nothing is ticked for you.'}
          onToggle={(id, value) => setChecked((p) => ({ ...p, [id]: value }))}
        />
      )}

      <p className="g0-reject-note">
        {brief?.reject_consequence ||
          'What happens if you reject? The pipeline routes back to the earlier step and asks the agent to try again with your feedback.'}
      </p>

      {notice && <p className="a3-notice">{notice}</p>}
      {error && <p className="err">{error}</p>}
      {evidence?.blocker && <p className="err">{evidence.blocker}</p>}

      {decided ? (
        <div className="dash-run-row g0-run-row">
          <p className="dash-empty">Already decided. Continue to the next step.</p>
          <button className="landing-start" type="button" onClick={() => onContinueNext?.()}>
            {continueLabel || 'Continue to next step →'}
          </button>
        </div>
      ) : (
        <div className="dash-run-row g0-run-row">
          <button
            className="landing-start g0-approve"
            type="button"
            disabled={busy || !checklistReady || briefLoading}
            onClick={() => void decide(true)}
          >
            {busy ? 'Saving…' : '✓ Approve — continue pipeline'}
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
            {!checklistReady ? 'Complete the checklist' : 'Awaiting your decision'}
          </span>
        </div>
      )}
    </div>
  )
}
