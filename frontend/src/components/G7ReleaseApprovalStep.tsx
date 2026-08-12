import { useEffect, useMemo, useState } from 'react'
import { api, ApiError, type G7Brief, type GateNode, type LogLine } from '../api/client'
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

export function G7ReleaseApprovalStep({
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
  const [brief, setBrief] = useState<G7Brief | null>(null)
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
      'Modernizing the legacy Fortran system is essential to enhance maintainability and improve integration with contemporary systems and support cloud deployment.'
    const strat = intake?.strategy_short || intake?.strategies?.[0] || 'Phased conversion to Java'
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
      log: [['info', 'Loading Gate G7 brief from A1 intake, movement path, and A18/G6 execution results…']],
      synthesis: null,
      projectName: a1Context.projectName,
      status: 'G7 · preparing release approval gate…',
      glossaryStatus: 'Personalizing change authority glossary for G7 operational handover…',
      evidenceItems: [],
      pageTitle: 'Approve the release',
      pageContext: a1Context.categoryName,
    })

    const briefPromise = api.g7Brief(runId)
    const timeout = new Promise<never>((_, reject) => {
      window.setTimeout(
        () => reject(new Error('G7 brief timed out — using defaults')),
        25000,
      )
    })

    Promise.race([briefPromise, timeout])
      .then((r) => {
        if (cancelled) return
        setBrief(r)
        setBriefLoading(false)
        onResults({
          log: [['ok', r.warning || 'G7 release brief ready — grounded in operational readiness, handover plan, and rollback posture']],
          synthesis: null,
          projectName: a1Context.projectName,
          status: r.movement_path
            ? `G7 · ${r.movement_path}`
            : 'G7 · Approve the release ready',
          glossaryStatus: 'Glossary ready for change authority governance gate',
          evidenceItems: [
            { label: 'Handover plan', value: '5 stages, smallest first' },
            { label: 'Automatic rollback', value: 'Armed on 1 conditions' },
            { label: 'Old system', value: 'Stays running and ready to switch back' },
            { label: 'Support runbook', value: 'Written and handed to operations' },
          ],
          pageTitle: r.title || 'Approve the release',
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
        label: 'I approve the staged handover plan',
        required: true,
      },
      {
        id: 'c2',
        label: 'I confirm automatic rollback triggers are armed',
        required: true,
      },
      {
        id: 'c3',
        label: 'I confirm old system stays running and ready to switch back',
        required: true,
      },
      {
        id: 'c4',
        label: 'I confirm support runbook is handed to the operations team',
        required: true,
      },
      {
        id: 'c5',
        label: `Confirm this step still belongs on the path for «${cat}»`,
        required: true,
      },
      {
        id: 'c6',
        label: 'I confirm incident response channels are configured for target services: «Policy Core Service, Pricing Service»',
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
        label: `I confirm operational readiness review remains aligned under project «${truncate(proj, 100)}»`,
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
          ? 'Please check all mandatory and optional checklist items before approving.'
          : 'Please complete all mandatory release checklist items before approving.',
      )
      return
    }

    setBusy(true)
    setError(null)
    const logAction: LogLine[] = [
      [
        approved ? 'ok' : 'warn',
        approved
          ? 'G7 Release approved — handover authorized, operations team notified'
          : 'G7 Release rejected — rewinding to A18 Security and release',
      ],
    ]
    setActionLog(logAction)

    try {
      await api.decideGate(runId, 'G7', approved)
      setApprovedState(approved)
      onResults({
        log: logAction,
        synthesis: null,
        projectName: a1Context.projectName,
        status: approved
          ? 'G7 approved — continuing to G8 Approve switch-off'
          : 'G7 rejected — rewound to A18 Security and release',
        pageTitle: 'Approve the release',
        pageContext: a1Context.categoryName,
      })
      onDecided(approved ? null : 'A18')
      if (approved && onContinueNext) {
        onContinueNext()
      }
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
    if (brief?.release_metrics && brief.release_metrics.length >= 4) {
      return brief.release_metrics
    }
    return [
      { label: 'Handover plan', value: '5 stages, smallest first' },
      { label: 'Automatic rollback', value: 'Armed on 1 conditions' },
      { label: 'Old system', value: 'Stays running and ready to switch back' },
      { label: 'Support runbook', value: 'Written and handed to the operations team' },
    ]
  }, [brief?.release_metrics])

  return (
    <div className="g7-step step-page-content">
      {/* Top Meta Breadcrumb Header */}
      <div className="g7-top-meta">
        <span className="g7-breadcrumb">
          DOMAIN F · RELEASE SAFELY · GATE G7 · ACTIVE · ON PATH
        </span>
      </div>

      <h1 className="g7-main-title">
        {brief?.title || 'Approve the release'}{' '}
        {briefLoading ? <span className="g7-loading-badge">Loading LLM context…</span> : null}
      </h1>
      <p className="g7-sub-question">
        {brief?.lede || 'Are we operationally ready to hand over?'}
      </p>

      <div className="g7-approvers-strip">
        <span>{brief?.approvers ? `Approvers: ${brief.approvers}` : 'Approvers: Change authority'}</span>
      </div>

      <p className="g7-protection-note">
        {brief?.why || 'Approves the handover, not the switch-off.'}
      </p>

      {/* 4 Cards Grid Matching Snapshot */}
      <div className="g7-cards-grid">
        <div className="g7-card">
          <span className="g7-card-label">FROM A1</span>
          <h3 className="g7-card-value">{categoryDisplay}</h3>
        </div>

        <div className="g7-card">
          <span className="g7-card-label">STRATEGY</span>
          <h3 className="g7-card-value">{strategyDisplay}</h3>
        </div>

        <div className="g7-card">
          <span className="g7-card-label">REQUIREMENT</span>
          <h3 className="g7-card-value g7-req-text">{reqDisplay}</h3>
        </div>

        <div className="g7-card g7-card-map">
          <span className="g7-card-label">MAP STATUS</span>
          <div className="g7-map-circle-wrap">
            <span className="g7-map-status-text">Active · on path</span>
            <div className="g7-map-bg-circle" />
          </div>
        </div>
      </div>

      {/* 4 Release Metric Displays Matching Snapshot */}
      <div className="g7-metrics-list">
        {metricsDisplay.map((m, idx) => (
          <div key={`${idx}-${m.label}`} className="g7-metric-card">
            <span className="g7-metric-lbl">{m.label}</span>
            <h4 className="g7-metric-val">{m.value}</h4>
          </div>
        ))}
      </div>

      {/* Human Gate Checklist (Mandatory vs Optional) Matching Snapshot */}
      <div className="g7-checklist-box">
        <div className="g7-checklist-header">
          <div className="g7-checklist-title-group">
            <h3 className="g7-checklist-title">HUMAN GATE CHECKLIST</h3>
            <p className="g7-checklist-note">
              Checklist items combine the step&apos;s standard controls with your A1 category, requirement, strategy, and the agent &amp; gate map combination.
            </p>
          </div>
          <div className="g7-checklist-counter-group">
            <button
              type="button"
              className={`g7-checklist-count-btn ${allMandatoryChecked ? 'mandatory-done' : ''} ${allChecked ? 'all-done' : ''}`}
              onClick={toggleAllDisplayed}
              title={`Mandatory: ${mandatoryCheckedCount}/${mandatoryItems.length} · Optional: ${optionalCheckedCount}/${optionalItems.length}`}
            >
              {mandatoryCheckedCount}/{mandatoryItems.length} mandatory · {totalChecked}/{rawChecklist.length} total
            </button>
          </div>
        </div>

        {/* Capability Toolbar: Filter, Select Mandatory, Opt-into Optional */}
        <div className="g7-checklist-toolbar">
          <div className="g7-filter-pills">
            <button
              type="button"
              className={`g7-pill-btn ${filterMode === 'all' ? 'active' : ''}`}
              onClick={() => setFilterMode('all')}
            >
              All items ({rawChecklist.length})
            </button>
            <button
              type="button"
              className={`g7-pill-btn ${filterMode === 'mandatory' ? 'active' : ''}`}
              onClick={() => setFilterMode('mandatory')}
            >
              Mandatory ({mandatoryItems.length})
            </button>
            {optionalItems.length > 0 && (
              <button
                type="button"
                className={`g7-pill-btn ${filterMode === 'optional' ? 'active' : ''}`}
                onClick={() => setFilterMode('optional')}
              >
                Optional ({optionalItems.length})
              </button>
            )}
          </div>

          <div className="g7-quick-actions">
            <button
              type="button"
              className="g7-quick-btn"
              onClick={selectAllMandatory}
            >
              ✓ Select Mandatory
            </button>

            {optionalItems.length > 0 && (
              <button
                type="button"
                className={`g7-opt-in-btn ${includeOptionalInApproval ? 'opted-in' : ''}`}
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
        <div className="g7-checklist-items">
          {displayedChecklist.map((item) => {
            const isChecked = Boolean(checked[item.id])
            const isMandatory = item.required !== false
            return (
              <label
                key={item.id}
                className={`g7-checklist-item ${isChecked ? 'checked' : ''} ${isMandatory ? 'is-mandatory' : 'is-optional'}`}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={(e) =>
                    setChecked((prev) => ({ ...prev, [item.id]: e.target.checked }))
                  }
                />
                <div className="g7-checklist-content">
                  <span className="g7-checklist-item-text">{item.label}</span>
                  <span className={`g7-badge ${isMandatory ? 'badge-mandatory' : 'badge-optional'}`}>
                    {isMandatory ? 'Mandatory' : 'Optional'}
                  </span>
                </div>
              </label>
            )
          })}
        </div>
      </div>

      {error ? (
        <div className="g7-error-banner">
          <p>{error}</p>
        </div>
      ) : null}

      {/* Decision Actions Bar */}
      <div className="g7-actions-bar">
        <button
          type="button"
          className="g7-approve-btn"
          onClick={() => handleDecision(true)}
          disabled={busy || (!canApprove && approvedState === null)}
          title={!canApprove ? 'Complete mandatory checklist items to approve' : 'Approve release gate'}
        >
          {busy ? <span className="g7-spinner" /> : null}
          Approve release and continue →
        </button>

        <button
          type="button"
          className="g7-reject-btn"
          onClick={() => handleDecision(false)}
          disabled={busy}
        >
          ✕ Request changes
        </button>

        {onContinueNext ? (
          <button
            type="button"
            className="g7-continue-btn"
            onClick={onContinueNext}
          >
            {continueLabel || 'Continue to G8 Approve switch-off →'}
          </button>
        ) : null}
      </div>

      <p className="g7-reject-note">
        What happens if you reject? The pipeline rewinds to Agent A18 (Security and release) so operational readiness, handover staging, and support runbooks can be refined.
      </p>

      {/* Log Output Terminal */}
      {actionLog.length > 0 ? (
        <div className="g7-terminal-box">
          <div className="g7-terminal-header">Gate Decision Audit Log</div>
          <ul className="g7-terminal-logs">
            {actionLog.map(([level, msg], idx) => (
              <li key={`${idx}-${msg}`} className={`g7-log-line ${level}`}>
                <span className="g7-log-icon">{level === 'ok' ? '✓' : '⚠'}</span>
                <span className="g7-log-msg">{msg}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
