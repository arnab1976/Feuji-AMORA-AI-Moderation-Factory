import { useEffect, useMemo, useState } from 'react'
import { api, ApiError, type G1Brief, type GateNode } from '../api/client'
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
  { id: 'rules_ok', label: 'All extracted business rules make sense for this estate', required: true },
  { id: 'deps_ok', label: 'The dependency / structure map from code analysis looks complete', required: true },
  { id: 'tx_ok', label: 'Critical transactions from runtime mining are identified', required: true },
  { id: 'gaps_ok', label: 'No obvious gaps remain before we redesign', required: true },
]

function truncate(text: string, n = 180): string {
  const t = text.trim()
  if (t.length <= n) return t
  return `${t.slice(0, n - 1)}…`
}

export function G1DiscoveryApprovalStep({
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
  const [brief, setBrief] = useState<G1Brief | null>(null)
  const [evidence, setEvidence] = useState<Awaited<ReturnType<typeof api.gate>> | null>(null)
  const [briefLoading, setBriefLoading] = useState(true)
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

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
      log: [['info', 'Loading G1 Discovery Approval from A5–A8…']],
      synthesis: null,
      projectName: a1Context.projectName !== '—' ? a1Context.projectName : '',
      status: 'G1 · synthesizing discovery approval…',
      pageTitle: 'Discovery Approval',
      pageContext: a1Context.categoryName,
      evidenceItems: [],
    })

    Promise.all([api.g1Brief(runId), api.gate(runId, gate.id), api.getRun(runId)])
      .then(([b, ev]) => {
        if (cancelled) return
        setBrief(b)
        setEvidence(ev)
        onEvidence(ev)

        const gloss = (b.glossary || []).map((g) => ({ term: g.term, def: g.def }))
        const items = (b.discovery_items || []).map((p) => ({
          label: p.label,
          value: p.value,
        }))
        onResults({
          log: [
            ['ok', b.title],
            ['info', b.context_line || b.requirement_summary || ''],
            ...(b.warning ? [['warn', b.warning] as [string, string]] : []),
          ],
          synthesis: null,
          projectName: a1Context.projectName !== '—' ? a1Context.projectName : '',
          status: ev.decided ? 'G1 decided' : b.activity_status || 'G1 awaiting approval',
          pageTitle: b.title || 'Discovery Approval',
          pageContext: a1Context.categoryName,
          evidenceItems: items.length
            ? items
            : (ev.evidence || []).map((e) => ({ label: e.label, value: e.value })),
          glossary: gloss.length ? gloss : undefined,
          glossaryStatus: gloss.length ? 'Terms for this approval' : undefined,
        })
        if (b.warning) {
          setNotice(
            'Could not fully synthesize from the LLM — showing discovery approval built from Agents A5–A8.',
          )
        }
      })
      .catch((e) => {
        if (cancelled) return
        setBrief(null)
        setNotice(
          'Could not load the LLM brief — you can still review discovery evidence and decide.',
        )
        setError(e instanceof ApiError ? e.message : String(e))
        onResults({
          log: [['warn', e instanceof Error ? e.message : String(e)]],
          synthesis: null,
          projectName: a1Context.projectName !== '—' ? a1Context.projectName : '',
          status: 'G1 · awaiting approval',
          pageTitle: 'Discovery Approval',
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
          [
            approved ? 'ok' : 'warn',
            approved ? 'G1 approved — pipeline continues' : 'G1 rejected — rewound to A8',
          ],
        ],
        synthesis: null,
        projectName: a1Context.projectName !== '—' ? a1Context.projectName : '',
        status: approved ? 'G1 approved' : 'G1 rejected',
        pageTitle: brief?.title || 'Discovery Approval',
        pageContext: a1Context.categoryName,
        evidenceItems: (brief?.discovery_items || []).map((p) => ({
          label: p.label,
          value: p.value,
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

  const title = brief?.title || evidence?.name || 'Gate 1 · Discovery Approval'
  const lede =
    brief?.lede ||
    evidence?.question ||
    'The most critical gate. Humans confirm we understood the old system correctly before we start rebuilding.'
  const decided = Boolean(evidence?.decided)
  const discoveryItems = brief?.discovery_items?.length
    ? brief.discovery_items
    : (evidence?.evidence || []).map((e) => ({ label: e.label, value: e.value, source: '' }))

  return (
    <div className="g0-step g1-step a1-wizard mf-req">
      <p className="dash-kicker">
        Domain {gate.domain} · {domainLabel} · Gate {gate.id} · Active · on path
      </p>
      <h2 className="dash-title">{briefLoading ? 'Gate 1 · Discovery Approval' : title}</h2>
      <p className="dash-lede">
        {briefLoading
          ? 'Building a plain-English discovery approval from Agents A5–A8…'
          : lede}
      </p>

      <section className="a2-a1-context">
        <div className="a2-a1-context-head">
          <h4>Intake context · locked from A1</h4>
          <span className="a2-a1-lock">Read-only</span>
        </div>
        <p className="a2-a1-intro">
          {brief?.requirement_summary ||
            brief?.context_line ||
            'This gate confirms discovery for the requirement and strategy you already locked in.'}
        </p>
        <dl className="a2-a1-grid">
          <div>
            <dt>From A1</dt>
            <dd>{a1Context.categoryName}</dd>
          </div>
          <div>
            <dt>Strategy</dt>
            <dd>{a1Context.strategyShort}</dd>
          </div>
          <div>
            <dt>Project</dt>
            <dd>{a1Context.projectName}</dd>
          </div>
          <div>
            <dt>Prior agent</dt>
            <dd>{brief?.prior_agent_name || 'Runtime Behaviour Mining'}</dd>
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

      <section className="g0-approver-card g1-approver-card">
        <h4>{brief?.approver_heading || 'You are the approver'}</h4>
        <p>
          {brief?.paused_line ||
            "The pipeline has paused. Nothing downstream can happen until you decide. You're reviewing the work produced by Runtime Behaviour Mining."}
        </p>
        <div className="g0-expected">
          <span className="g0-expected-label">Expected approver</span>
          <span className="g0-expected-value">
            {brief?.expected_approvers ||
              evidence?.approvers ||
              'Subject matter expert + architect'}
          </span>
        </div>
      </section>

      <section className="g0-policy-card g1-evidence-card">
        <div className="g0-policy-head">
          <h4>{brief?.evidence_heading || 'Discovery evidence · from prior agents'}</h4>
          <span className="g0-policy-chip">A5 → A8</span>
        </div>
        <p className="g0-policy-intro">
          {brief?.evidence_intro ||
            'These facts were produced by Agents A5–A8. Approve only if they match how the estate works today.'}
        </p>
        {briefLoading ? (
          <p className="dash-empty">Synthesizing discovery evidence…</p>
        ) : (
          <div className="g0-policy-grid">
            {discoveryItems.map((item) => (
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
          'What happens if you reject? The pipeline routes back to Runtime Behaviour Mining and asks the agent to try again with your feedback.'}
      </p>

      {notice && <p className="a3-notice">{notice}</p>}
      {error && <p className="err">{error}</p>}
      {evidence?.blocker && <p className="err">{evidence.blocker}</p>}

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
