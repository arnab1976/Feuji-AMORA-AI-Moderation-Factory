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

function truncate(text: string, n = 90): string {
  const t = text.trim()
  if (t.length <= n) return t
  return `${t.slice(0, n - 1)}…`
}

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
      if (approved && !res.rewound_to) {
        onContinueNext?.()
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const rawTitle = brief?.title || evidence?.name || 'Approve the design'
  const title =
    /factory ui|modernization factory|for modernization/i.test(rawTitle) || rawTitle.length > 36
      ? 'Approve the design'
      : rawTitle
  const lede =
    brief?.lede ||
    evidence?.question ||
    'Do you approve this shape and this build order?'
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
  const pathLabel = brief?.path_status_label || 'Active · on path'
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

  const cleanedPrevSummary = useMemo(() => {
    const raw = brief?.previous_summary || ''
    if (!raw) {
      return `Derived from discovery — the ${a1Context.categoryName} estate still runs as a tightly coupled legacy system without explicit service contracts.`
    }
    const isCobol = activeLang === 'COBOL'
    if (!isCobol && raw.toLowerCase().includes('cobol')) {
      return raw.replace(/\bCOBOL monolith\b/gi, `${activeLang} monolith`)
                .replace(/\bCOBOL system\b/gi, `${activeLang} system`)
                .replace(/\bCOBOL\b/gi, activeLang)
    }
    return raw
  }, [brief?.previous_summary, a1Context, activeLang])

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
      <p className="dash-kicker">
        Domain {gate.domain} · {domainLabel} · Gate {gate.id} · {pathLabel}
      </p>
      <h2 className="dash-title">{briefLoading ? 'Approve the design' : title}</h2>
      <p className="dash-lede">
        {briefLoading
          ? 'Building a plain-English design approval from Agents A9–A11 and your path map…'
          : lede}
      </p>
      <p className="dash-sub">
        Approvers: {brief?.expected_approvers || evidence?.approvers || 'Architecture board'}
      </p>
      <p className="dash-sub">
        {brief?.paused_line ||
          evidence?.why ||
          'Changing the design after code is written costs roughly ten times more.'}
      </p>

      <div className="step-context g2-context">
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
          <span className="g2-map-status">{pathLabel}</span>
        </div>
      </div>

      <p className="dash-sub g2-path-line">
        <b>Movement path</b> {movementPath}
      </p>

      {briefLoading ? (
        <p className="dash-empty">Synthesizing design evidence from A9–A11…</p>
      ) : (
        <div className="dash-evidence g2-evidence">
          {(displayItems.length ? displayItems : architectureItems).map((item) => (
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

      {(brief?.previous_summary || brief?.target_summary || cleanedDeltas.length > 0) && !briefLoading ? (
        <section className="a10-compare-grid g2-compare" aria-label="Architecture comparison">
          {(brief?.previous_summary || brief?.target_summary) && (
            <>
              <article className="a10-compare-col a10-compare-prev">
                <header className="a10-compare-head">
                  <span className="a10-compare-badge prev">Previous</span>
                  <h3>Previous architecture</h3>
                </header>
                <div className="a6-banner a7-banner a10-banner a10-banner-prev">
                  <strong>As-is</strong>
                  <p>{cleanedPrevSummary}</p>
                </div>
              </article>
              <article className="a10-compare-col a10-compare-target">
                <header className="a10-compare-head">
                  <span className="a10-compare-badge target">Target</span>
                  <h3>Target architecture</h3>
                </header>
                <div className="a6-banner a7-banner a10-banner">
                  <strong>To approve</strong>
                  <p>
                    {brief?.target_summary ||
                      'Target design defines how the new pieces talk and own data.'}
                  </p>
                </div>
              </article>
            </>
          )}
          {cleanedDeltas.length ? (
            <section className="a10-deltas g2-deltas" aria-label="What changed">
              <h4>What changed</h4>
              <ul className="a10-delta-list">
                {cleanedDeltas.map((d) => (
                  <li key={`${d.aspect}-${d.from}-${d.to}`}>
                    <span className="a10-delta-aspect">{d.aspect}</span>
                    <span className="a10-delta-from">{d.from}</span>
                    <span className="a10-delta-arrow" aria-hidden>
                      →
                    </span>
                    <span className="a10-delta-to">{d.to}</span>
                    {d.change ? <span className="a10-delta-tag">{d.change}</span> : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </section>
      ) : null}

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
          'What happens if you reject? The pipeline routes back to Data Modernization and asks the agent to try again with your feedback.'}
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
