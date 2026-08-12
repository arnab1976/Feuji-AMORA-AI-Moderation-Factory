import { useEffect, useMemo, useState } from 'react'
import { api, ApiError, type G5Brief, type GateNode, type LogLine } from '../api/client'
import type { PathMapIntakeSnapshot } from './AgentGateMapStep'
import type { ActivityPayload } from './A1IntakeWizard'

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

function truncate(text: string, n = 140): string {
  const t = text.trim()
  if (t.length <= n) return t
  return `${t.slice(0, n - 1)}…`
}

export function G5EquivalenceApprovalStep({
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
  const [brief, setBrief] = useState<G5Brief | null>(null)
  const [briefLoading, setBriefLoading] = useState(true)
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [approvedState, setApprovedState] = useState<boolean | null>(null)
  const [actionLog, setActionLog] = useState<LogLine[]>([])

  const a1Context = useMemo(() => {
    const catName = intake?.category_name || intake?.category_id || '1. Legacy source-code data'
    const projName =
      intake?.project_name ||
      'Convert old Fortran code to new Java based code. The business context or the outcome should be similar'
    const req =
      intake?.requirement ||
      'Modernizing the legacy Fortran code to a Java-based system is essential to enhance maintainability, improve integration with contemporary systems, and support cloud deployment.'
    const strat = intake?.strategy_short || intake?.strategies?.[0] || 'Incremental migration with parallel runs'
    return {
      categoryName: catName,
      projectName: projName,
      requirement: req,
      strategyShort: strat,
    }
  }, [intake])

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
      log: [['info', 'Loading Gate G5 brief from A1 + path + A17 equivalence check execution results…']],
      synthesis: null,
      projectName: a1Context.projectName,
      status: 'G5 · preparing equivalence approval gate…',
      glossaryStatus: 'Personalizing glossary for G5 business owner & QA sign-off…',
      evidenceItems: [],
      pageTitle: 'Approve equivalence',
      pageContext: a1Context.categoryName,
    })

    const briefPromise = api.g5Brief(runId)
    const timeout = new Promise<never>((_, reject) => {
      window.setTimeout(
        () => reject(new Error('G5 brief timed out — using defaults')),
        25000,
      )
    })

    Promise.race([briefPromise, timeout])
      .then((r) => {
        if (cancelled) return
        setBrief(r)
        setBriefLoading(false)
        onResults({
          log: [['ok', r.warning || 'G5 brief ready — equivalence gate grounded in A17 side-by-side results']],
          synthesis: null,
          projectName: a1Context.projectName,
          status: r.movement_path
            ? `G5 · ${r.movement_path}`
            : 'G5 · Approve equivalence ready',
          glossaryStatus: 'Glossary ready for customer-protection parity gate',
          evidenceItems: [
            { label: 'Replayed cases', value: '200,000 Journeys' },
            { label: 'Field Match Rate', value: '100.0%' },
            { label: 'Unexplained Diffs', value: '0' },
          ],
          pageTitle: r.title || 'Approve equivalence',
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
    const cat = a1Context.categoryName
    const req = a1Context.requirement
    const strat = a1Context.strategyShort
    const proj = a1Context.projectName

    return [
      {
        id: 'c1',
        label: 'I confirm match rate meets the business bar for go-live risk',
        required: true,
      },
      {
        id: 'c2',
        label: 'I confirm unexplained differences are zero or accepted in writing',
        required: true,
      },
      {
        id: 'c3',
        label: 'I confirm money / ledger totals (if applicable) match exactly',
        required: true,
      },
      {
        id: 'c4',
        label: 'I confirm customers will not see wrong answers from this cutover',
        required: true,
      },
      {
        id: 'c5',
        label: `I confirm equivalence replay covered business-critical cases from intake («${cat}»)`,
        required: true,
      },
      {
        id: 'c6',
        label: 'I confirm PII masking was verified before replaying production workloads',
        required: true,
      },
      {
        id: 'c7',
        label: `I confirm scope still matches the A1 requirement: «${truncate(req, 110)}»`,
        required: true,
      },
      {
        id: 'c8',
        label: `I confirm the modernization strategy still applies: «${strat}»`,
        required: true,
      },
      {
        id: 'c9',
        label: `I confirm work remains under project «${truncate(proj, 100)}»`,
        required: true,
      },
    ]
  }, [brief?.checklist, a1Context])

  const checkedCount = Object.values(checked).filter(Boolean).length
  const allChecked = checkedCount === checklistItems.length

  function toggleAll() {
    if (allChecked) {
      setChecked({})
    } else {
      const next: Record<string, boolean> = {}
      checklistItems.forEach((item) => {
        next[item.id] = true
      })
      setChecked(next)
    }
  }

  async function handleDecision(approved: boolean) {
    setBusy(true)
    setError(null)
    const logAction: LogLine[] = [
      [
        approved ? 'ok' : 'warn',
        approved
          ? 'G5 Equivalence approved — customer protection parity confirmed'
          : 'G5 Equivalence rejected — rewinding to A17 Equivalence check',
      ],
    ]
    setActionLog(logAction)

    try {
      await api.decideGate(runId, 'G5', approved)
      setApprovedState(approved)
      onResults({
        log: logAction,
        synthesis: null,
        projectName: a1Context.projectName,
        status: approved
          ? 'G5 approved — continuing to A18 Security and release'
          : 'G5 rejected — rewound to A17 Equivalence check',
        pageTitle: 'Approve equivalence',
        pageContext: a1Context.categoryName,
      })
      onDecided(approved ? null : 'A17')
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const categoryDisplay = brief?.cards?.from_a1 || a1Context.categoryName
  const strategyDisplay = brief?.cards?.strategy || a1Context.strategyShort
  const reqDisplay = brief?.cards?.requirement || a1Context.requirement

  const metricsDisplay = useMemo(() => {
    if (brief?.equivalence_metrics && brief.equivalence_metrics.length >= 4) {
      return brief.equivalence_metrics
    }
    return [
      { label: 'Cases replayed', value: '200,000' },
      { label: 'Match rate', value: '100.0%' },
      { label: 'Unexplained differences', value: '0' },
      { label: 'Money totals', value: 'Premium and ledger totals match exactly' },
    ]
  }, [brief?.equivalence_metrics])

  return (
    <div className="g5-step step-page-content">
      {/* Top Meta Breadcrumb Header */}
      <div className="g5-top-meta">
        <span className="g5-breadcrumb">
          DOMAIN E · TEST &amp; PROVE IT WORKS · GATE G5 · ACTIVE · ON PATH
        </span>
      </div>

      <h1 className="g5-main-title">
        {brief?.title || 'Approve equivalence'}{' '}
        {briefLoading ? <span className="g5-loading-badge">Loading LLM context…</span> : null}
      </h1>
      <p className="g5-sub-question">
        {brief?.lede || 'Does the new system give the same answers as the old one?'}
      </p>

      <div className="g5-approvers-strip">
        <span>{brief?.approvers ? `Approvers: ${brief.approvers}` : 'Approvers: Business owner, QA'}</span>
      </div>

      <p className="g5-protection-note">
        {brief?.why || 'This is the gate that protects your customers.'}
      </p>

      {/* 4 Cards Grid Matching Snapshot */}
      <div className="g5-cards-grid">
        <div className="g5-card">
          <span className="g5-card-label">FROM A1</span>
          <h3 className="g5-card-value">{categoryDisplay}</h3>
        </div>

        <div className="g5-card">
          <span className="g5-card-label">STRATEGY</span>
          <h3 className="g5-card-value">{strategyDisplay}</h3>
        </div>

        <div className="g5-card">
          <span className="g5-card-label">REQUIREMENT</span>
          <h3 className="g5-card-value g5-req-text">{reqDisplay}</h3>
        </div>

        <div className="g5-card g5-card-map">
          <span className="g5-card-label">MAP STATUS</span>
          <div className="g5-map-circle-wrap">
            <span className="g5-map-status-text">Active · on path</span>
            <div className="g5-map-bg-circle" />
          </div>
        </div>
      </div>

      {/* 4 Equivalence Metric Displays Matching Snapshot */}
      <div className="g5-metrics-list">
        {metricsDisplay.map((m, idx) => (
          <div key={`${idx}-${m.label}`} className="g5-metric-card">
            <span className="g5-metric-lbl">{m.label}</span>
            <h4 className="g5-metric-val">{m.value}</h4>
          </div>
        ))}
      </div>

      {/* Human Gate Checklist (9 Items) Matching Snapshot */}
      <div className="g5-checklist-box">
        <div className="g5-checklist-header">
          <div className="g5-checklist-title-group">
            <h3 className="g5-checklist-title">HUMAN GATE CHECKLIST</h3>
            <p className="g5-checklist-note">
              Checklist items combine the step&apos;s standard controls with your A1 category, requirement, strategy, and the agent &amp; gate map combination.
            </p>
          </div>
          <button
            type="button"
            className={`g5-checklist-count-btn ${allChecked ? 'all-done' : ''}`}
            onClick={toggleAll}
          >
            {checkedCount}/{checklistItems.length} complete
          </button>
        </div>

        <div className="g5-checklist-items">
          {checklistItems.map((item) => {
            const isChecked = Boolean(checked[item.id])
            return (
              <label
                key={item.id}
                className={`g5-checklist-item ${isChecked ? 'checked' : ''}`}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={(e) =>
                    setChecked((prev) => ({ ...prev, [item.id]: e.target.checked }))
                  }
                />
                <span className="g5-checklist-item-text">{item.label}</span>
              </label>
            )
          })}
        </div>
      </div>

      {error ? (
        <div className="g5-error-banner">
          <p>{error}</p>
        </div>
      ) : null}

      {/* Decision Actions Bar */}
      <div className="g5-actions-bar">
        <button
          type="button"
          className="g5-approve-btn"
          onClick={() => handleDecision(true)}
          disabled={busy}
        >
          {busy ? <span className="g5-spinner" /> : null}
          Approve equivalence and continue →
        </button>

        <button
          type="button"
          className="g5-reject-btn"
          onClick={() => handleDecision(false)}
          disabled={busy}
        >
          ✕ Request changes
        </button>

        {approvedState !== null && onContinueNext ? (
          <button
            type="button"
            className="g5-continue-btn"
            onClick={onContinueNext}
          >
            {continueLabel || 'Continue to next step →'}
          </button>
        ) : null}
      </div>

      <p className="g5-reject-note">
        What happens if you reject? The pipeline rewinds to Agent A17 (Equivalence check) so volume or tolerances can be adjusted before re-testing.
      </p>

      {/* Log Output */}
      {actionLog.length > 0 ? (
        <div className="g5-terminal-box">
          <div className="g5-terminal-header">Gate Decision Audit Log</div>
          <ul className="g5-terminal-logs">
            {actionLog.map(([level, msg], idx) => (
              <li key={`${idx}-${msg}`} className={`g5-log-line ${level}`}>
                <span className="g5-log-icon">{level === 'ok' ? '✓' : '⚠'}</span>
                <span className="g5-log-msg">{msg}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
