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

function truncate(text: string, n = 90): string {
  const t = text.trim()
  if (t.length <= n) return t
  return `${t.slice(0, n - 1)}…`
}

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
      if (approved && !res.rewound_to) {
        onContinueNext?.()
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const rawTitle = brief?.title || evidence?.name || 'Approve the new code'
  const title =
    /factory ui|modernization factory|for modernization/i.test(rawTitle) || rawTitle.length > 40
      ? 'Approve the new code'
      : rawTitle
  const lede =
    brief?.lede ||
    evidence?.question ||
    'Does this code look right to merge?'
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
  const pathLabel = brief?.path_status_label || 'Active · on path'
  const movementPath =
    brief?.movement_path && !/factory ui/i.test(brief.movement_path)
      ? brief.movement_path
      : 'A12 Code generation -> A13 Integration bridges -> G3'

  return (
    <div className="g3-step mf-req">
      <p className="dash-kicker">
        Domain {gate.domain} · {domainLabel} · Gate {gate.id} · {pathLabel}
      </p>
      <h2 className="dash-title">{briefLoading ? 'Approve the new code' : title}</h2>
      <p className="dash-lede">
        {briefLoading
          ? 'Building a plain-English code approval from Agents A12–A13 and your path map…'
          : lede}
      </p>
      <p className="dash-sub">
        Approvers: {brief?.expected_approvers || evidence?.approvers || 'Engineering lead'}
      </p>
      <p className="dash-sub">
        {brief?.paused_line ||
          evidence?.why ||
          'Generated code cannot merge itself. A person must approve.'}
      </p>

      <div className="step-context g3-context">
        <div>
          <b>From A1</b>
          <span>{a1Context.categoryName}</span>
        </div>
        <div>
          <b>Strategy</b>
          <span>{a1Context.strategyShort}</span>
        </div>
        <div>
          <b>Requirement</b>
          <span>
            {a1Context.requirement
              ? truncate(a1Context.requirement, 90)
              : truncate(brief?.requirement_summary || a1Context.projectName, 90)}
          </span>
        </div>
        <div>
          <b>Map status</b>
          <span className="g3-map-status">{pathLabel}</span>
        </div>
      </div>

      <p className="dash-sub g3-path-line">
        <b>Movement path</b> {movementPath}
      </p>

      {briefLoading ? (
        <p className="dash-empty">Synthesizing code evidence from A12–A13…</p>
      ) : (
        <div className="dash-evidence g3-evidence">
          {(displayItems.length ? displayItems : codeItems).map((item) => (
            <div key={`${item.label}-${item.value}`} className="dash-evr">
              <b>
                {item.label}
                {item.source ? ` · ${item.source}` : ''}
              </b>
              <span>{item.value}</span>
            </div>
          ))}
        </div>
      )}

      {!decided && (
        <ChecklistPanel
          title={brief?.checklist_heading || 'Human gate checklist'}
          items={checklist}
          checked={checked}
          note={
            brief?.checklist_note ||
            'Checklist items combine the step’s standard controls with your A1 category, requirement, strategy, and the agent & gate map combination.'
          }
          onToggle={(id, value) => setChecked((p) => ({ ...p, [id]: value }))}
        />
      )}

      <p className="g0-reject-note">
        {brief?.reject_consequence ||
          'What happens if you reject? The pipeline routes back to Code generation and asks A12/A13 to try again with your feedback.'}
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
            {busy ? 'Saving…' : 'Approve and continue'}
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
            {!checklistReady ? 'Complete all mandatory items' : 'Awaiting your decision'}
          </span>
        </div>
      )}
    </div>
  )
}
