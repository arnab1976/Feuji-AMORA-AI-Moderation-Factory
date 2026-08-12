import { useEffect, useMemo, useState } from 'react'
import { api, ApiError, type G8Brief, type GateNode, type LogLine } from '../api/client'
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
  const [filterMode, setFilterMode] = useState<'all' | 'mandatory' | 'optional'>('all')
  const [includeOptionalInApproval, setIncludeOptionalInApproval] = useState(false)

  const a1Context = useMemo(() => {
    const catName = intake?.category_name || intake?.category_id || '1. Legacy source-code data'
    const projName =
      intake?.project_name ||
      'Convert old Fortran code to new Java based code. The business context or the outcome should be similar'
    const req =
      intake?.requirement ||
      'Modernizing the legacy Fortran code to Java is crucial for enhancing operational efficiency.'
    const strat = intake?.strategy_short || intake?.strategies?.[0] || 'Modular transition to Java'
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

  const rawChecklist = useMemo(() => {
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
        label: 'I confirm parallel run duration met business threshold (30 days clean)',
        required: true,
      },
      {
        id: 'c2',
        label: 'I confirm full data reconciliation and balance match',
        required: true,
      },
      {
        id: 'c3',
        label: 'I confirm legacy records are archived per retention policy',
        required: true,
      },
      {
        id: 'c4',
        label: 'I confirm disaster recovery restore from archive is verified',
        required: true,
      },
      {
        id: 'c5',
        label: `Confirm this step still belongs on the path for «${cat}»`,
        required: true,
      },
      {
        id: 'c6',
        label: `I confirm business stakeholders signed off on final decommission for «${truncate(proj, 90)}»`,
        required: false,
      },
      {
        id: 'c7',
        label: `I confirm scope still matches the A1 requirement: «${truncate(req, 110)}»`,
        required: false,
      },
      {
        id: 'c8',
        label: `I confirm the modernization strategy still applies: «${strat}»`,
        required: false,
      },
      {
        id: 'c9',
        label: `I confirm final switch-off review remains aligned under project «${truncate(proj, 100)}»`,
        required: false,
      },
    ]
  }, [brief?.checklist, a1Context])

  const displayedChecklist = useMemo(() => {
    if (filterMode === 'mandatory') {
      return rawChecklist.filter((item) => item.required !== false)
    }
    if (filterMode === 'optional') {
      return rawChecklist.filter((item) => item.required === false)
    }
    return rawChecklist
  }, [rawChecklist, filterMode])

  const mandatoryItems = useMemo(() => rawChecklist.filter((i) => i.required !== false), [rawChecklist])
  const optionalItems = useMemo(() => rawChecklist.filter((i) => i.required === false), [rawChecklist])

  const totalChecked = Object.values(checked).filter(Boolean).length
  const mandatoryCheckedCount = mandatoryItems.filter((i) => checked[i.id]).length
  const optionalCheckedCount = optionalItems.filter((i) => checked[i.id]).length
  const allMandatoryChecked = mandatoryCheckedCount === mandatoryItems.length
  const allChecked = totalChecked === rawChecklist.length

  const canApprove = includeOptionalInApproval ? allChecked : allMandatoryChecked

  function toggleAllDisplayed() {
    const allDisplayedChecked = displayedChecklist.every((item) => checked[item.id])
    const next = { ...checked }
    displayedChecklist.forEach((item) => {
      next[item.id] = !allDisplayedChecked
    })
    setChecked(next)
  }

  function selectAllMandatory() {
    const next = { ...checked }
    mandatoryItems.forEach((item) => {
      next[item.id] = true
    })
    setChecked(next)
  }

  function selectAllOptional() {
    const next = { ...checked }
    optionalItems.forEach((item) => {
      next[item.id] = true
    })
    setChecked(next)
  }

  async function handleDecision(approved: boolean) {
    if (approved && !canApprove) {
      setError(
        includeOptionalInApproval
          ? 'Please check all mandatory and optional checklist items before approving switch-off.'
          : 'Please complete all mandatory switch-off checklist items before approving.',
      )
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

  const categoryDisplay = brief?.cards?.from_a1 || a1Context.categoryName
  const strategyDisplay = brief?.cards?.strategy || a1Context.strategyShort
  const reqDisplay = brief?.cards?.requirement || a1Context.requirement

  const metricsDisplay = useMemo(() => {
    if (brief?.switchoff_metrics && brief.switchoff_metrics.length >= 4) {
      return brief.switchoff_metrics
    }
    return [
      { label: 'Time running in parallel', value: '30 days with no unexplained differences' },
      { label: 'Data reconciled', value: 'All balances match' },
      { label: 'Records retained', value: 'Archived per your retention policy' },
      { label: 'Recovery tested', value: 'Restore from archive proven to work' },
    ]
  }, [brief?.switchoff_metrics])

  return (
    <div className="g8-step step-page-content">
      {/* Top Meta Breadcrumb Header */}
      <div className="g8-top-meta">
        <span className="g8-breadcrumb">
          DOMAIN F · RELEASE SAFELY · GATE G8 · ACTIVE · ON PATH
        </span>
      </div>

      <h1 className="g8-main-title">
        {brief?.title || 'Approve switch-off'}{' '}
        {briefLoading ? <span className="g8-loading-badge">Loading LLM context…</span> : null}
      </h1>
      <p className="g8-sub-question">
        {brief?.lede || 'May we finally turn the old system off?'}
      </p>

      <div className="g8-approvers-strip">
        <span>{brief?.approvers ? `Approvers: ${brief.approvers}` : 'Approvers: Business and Operations'}</span>
      </div>

      <p className="g8-protection-note">
        {brief?.why || 'The last gate. After this the old system is gone.'}
      </p>

      {/* 4 Cards Grid Matching Snapshot */}
      <div className="g8-cards-grid">
        <div className="g8-card">
          <span className="g8-card-label">FROM A1</span>
          <h3 className="g8-card-value">{categoryDisplay}</h3>
        </div>

        <div className="g8-card">
          <span className="g8-card-label">STRATEGY</span>
          <h3 className="g8-card-value">{strategyDisplay}</h3>
        </div>

        <div className="g8-card">
          <span className="g8-card-label">REQUIREMENT</span>
          <h3 className="g8-card-value g8-req-text">{reqDisplay}</h3>
        </div>

        <div className="g8-card g8-card-map">
          <span className="g8-card-label">MAP STATUS</span>
          <div className="g8-map-circle-wrap">
            <span className="g8-map-status-text">Active · on path</span>
            <div className="g8-map-bg-circle" />
          </div>
        </div>
      </div>

      {/* 4 Switch-off Verification Metric Displays Matching Snapshot */}
      <div className="g8-metrics-list">
        {metricsDisplay.map((m, idx) => (
          <div key={`${idx}-${m.label}`} className="g8-metric-card">
            <span className="g8-metric-lbl">{m.label}</span>
            <h4 className="g8-metric-val">{m.value}</h4>
          </div>
        ))}
      </div>

      {/* Human Gate Checklist (Mandatory vs Optional) Matching Snapshot */}
      <div className="g8-checklist-box">
        <div className="g8-checklist-header">
          <div className="g8-checklist-title-group">
            <h3 className="g8-checklist-title">HUMAN GATE CHECKLIST</h3>
            <p className="g8-checklist-note">
              Checklist items combine the step&apos;s standard controls with your A1 category, requirement, strategy, and the agent &amp; gate map combination.
            </p>
          </div>
          <div className="g8-checklist-counter-group">
            <button
              type="button"
              className={`g8-checklist-count-btn ${allMandatoryChecked ? 'mandatory-done' : ''} ${allChecked ? 'all-done' : ''}`}
              onClick={toggleAllDisplayed}
              title={`Mandatory: ${mandatoryCheckedCount}/${mandatoryItems.length} · Optional: ${optionalCheckedCount}/${optionalItems.length}`}
            >
              {mandatoryCheckedCount}/{mandatoryItems.length} mandatory · {totalChecked}/{rawChecklist.length} total
            </button>
          </div>
        </div>

        {/* Capability Toolbar: Filter, Select Mandatory, Opt-into Optional */}
        <div className="g8-checklist-toolbar">
          <div className="g8-filter-pills">
            <button
              type="button"
              className={`g8-pill-btn ${filterMode === 'all' ? 'active' : ''}`}
              onClick={() => setFilterMode('all')}
            >
              All items ({rawChecklist.length})
            </button>
            <button
              type="button"
              className={`g8-pill-btn ${filterMode === 'mandatory' ? 'active' : ''}`}
              onClick={() => setFilterMode('mandatory')}
            >
              Mandatory ({mandatoryItems.length})
            </button>
            {optionalItems.length > 0 && (
              <button
                type="button"
                className={`g8-pill-btn ${filterMode === 'optional' ? 'active' : ''}`}
                onClick={() => setFilterMode('optional')}
              >
                Optional ({optionalItems.length})
              </button>
            )}
          </div>

          <div className="g8-quick-actions">
            <button
              type="button"
              className="g8-quick-btn"
              onClick={selectAllMandatory}
            >
              ✓ Select Mandatory
            </button>

            {optionalItems.length > 0 && (
              <button
                type="button"
                className={`g8-opt-in-btn ${includeOptionalInApproval ? 'opted-in' : ''}`}
                onClick={() => {
                  setIncludeOptionalInApproval(!includeOptionalInApproval)
                  if (!includeOptionalInApproval) {
                    selectAllOptional()
                  }
                }}
              >
                {includeOptionalInApproval ? '✓ Optional Enforcement Active' : '+ Opt into Optional Checklist'}
              </button>
            )}
          </div>
        </div>

        {/* Checklist Items List */}
        <div className="g8-checklist-items">
          {displayedChecklist.map((item) => {
            const isChecked = Boolean(checked[item.id])
            const isMandatory = item.required !== false
            return (
              <label
                key={item.id}
                className={`g8-checklist-item ${isChecked ? 'checked' : ''} ${isMandatory ? 'is-mandatory' : 'is-optional'}`}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={(e) =>
                    setChecked((prev) => ({ ...prev, [item.id]: e.target.checked }))
                  }
                />
                <div className="g8-checklist-content">
                  <span className="g8-checklist-item-text">{item.label}</span>
                  <span className={`g8-badge ${isMandatory ? 'badge-mandatory' : 'badge-optional'}`}>
                    {isMandatory ? 'Mandatory' : 'Optional'}
                  </span>
                </div>
              </label>
            )
          })}
        </div>
      </div>

      {error ? (
        <div className="g8-error-banner">
          <p>{error}</p>
        </div>
      ) : null}

      {/* Decision Actions Bar */}
      <div className="g8-actions-bar">
        <button
          type="button"
          className="g8-approve-btn"
          onClick={() => handleDecision(true)}
          disabled={busy || (!canApprove && approvedState === null)}
          title={!canApprove ? 'Complete mandatory checklist items to approve' : 'Approve switch-off gate'}
        >
          {busy ? <span className="g8-spinner" /> : null}
          Approve switch-off and continue →
        </button>

        <button
          type="button"
          className="g8-reject-btn"
          onClick={() => handleDecision(false)}
          disabled={busy}
        >
          ✕ Request changes
        </button>

        {approvedState !== null && onContinueNext ? (
          <button
            type="button"
            className="g8-continue-btn"
            onClick={onContinueNext}
          >
            {continueLabel || 'Continue to next step →'}
          </button>
        ) : null}
      </div>

      <p className="g8-reject-note">
        What happens if you reject? The pipeline rewinds to Agent A18 (Security and release) or Gate G7 (Approve the release) so parallel run workloads and data reconciliation can be re-examined.
      </p>

      {/* Log Output Terminal */}
      {actionLog.length > 0 ? (
        <div className="g8-terminal-box">
          <div className="g8-terminal-header">Gate Decision Audit Log</div>
          <ul className="g8-terminal-logs">
            {actionLog.map(([level, msg], idx) => (
              <li key={`${idx}-${msg}`} className={`g8-log-line ${level}`}>
                <span className="g8-log-icon">{level === 'ok' ? '✓' : '⚠'}</span>
                <span className="g8-log-msg">{msg}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
