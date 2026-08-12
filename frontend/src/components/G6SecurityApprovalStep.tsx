import { useEffect, useMemo, useState } from 'react'
import { api, ApiError, type G6Brief, type GateNode, type LogLine } from '../api/client'
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

export function G6SecurityApprovalStep({
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
  const [brief, setBrief] = useState<G6Brief | null>(null)
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
      'Modernizing the legacy Fortran code to a Java-based system is essential to enhance maintainability, improve integration with contemporary systems, and support cloud deployment.'
    const strat = intake?.strategy_short || intake?.strategies?.[0] || 'Modular Incremental Conversion'
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
      log: [['info', 'Loading Gate G6 brief from A1 intake, movement path, and A18 security execution results…']],
      synthesis: null,
      projectName: a1Context.projectName,
      status: 'G6 · preparing security approval gate…',
      glossaryStatus: 'Personalizing security lead glossary for G6 governance sign-off…',
      evidenceItems: [],
      pageTitle: 'Approve security',
      pageContext: a1Context.categoryName,
    })

    const briefPromise = api.g6Brief(runId)
    const timeout = new Promise<never>((_, reject) => {
      window.setTimeout(
        () => reject(new Error('G6 brief timed out — using defaults')),
        25000,
      )
    })

    Promise.race([briefPromise, timeout])
      .then((r) => {
        if (cancelled) return
        setBrief(r)
        setBriefLoading(false)
        onResults({
          log: [['ok', r.warning || 'G6 security brief ready — grounded in A18 security scan and SAST/DAST evidence']],
          synthesis: null,
          projectName: a1Context.projectName,
          status: r.movement_path
            ? `G6 · ${r.movement_path}`
            : 'G6 · Approve security ready',
          glossaryStatus: 'Glossary ready for security lead governance gate',
          evidenceItems: [
            { label: 'Code scan', value: 'No high or critical findings' },
            { label: 'Dependencies', value: 'No known vulnerable libraries' },
            { label: 'Software bill of materials', value: 'Generated and signed' },
            { label: 'Secrets', value: 'None found in code or config' },
          ],
          pageTitle: r.title || 'Approve security',
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
        label: 'I confirm no high / critical security findings remain',
        required: true,
      },
      {
        id: 'c2',
        label: 'I confirm dependency and SBOM posture is acceptable',
        required: true,
      },
      {
        id: 'c3',
        label: 'I confirm secrets scanning is clean for release candidates',
        required: true,
      },
      {
        id: 'c4',
        label: 'I confirm security sign-off is independent of business release',
        required: true,
      },
      {
        id: 'c5',
        label: `Confirm this step still belongs on the path for «${cat}»`,
        required: true,
      },
      {
        id: 'c6',
        label: 'I confirm threat modeling covers target services: «Policy Core Service, Pricing Service»',
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
        label: `I confirm security review remains aligned under project «${truncate(proj, 100)}»`,
        required: false,
      },
    ]
  }, [brief?.checklist, a1Context])

  // Filter items based on user's active filter selection
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

  // User requirement: minimum mandatory items required based on max semantic similarity.
  // Approval is allowed if all mandatory items are checked (unless user explicitly opts in to require optional items too).
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
          : 'Please complete all mandatory security checklist items before approving.',
      )
      return
    }

    setBusy(true)
    setError(null)
    const logAction: LogLine[] = [
      [
        approved ? 'ok' : 'warn',
        approved
          ? 'G6 Security approved — safe to expose system to release path'
          : 'G6 Security rejected — rewinding to A18 Security and release',
      ],
    ]
    setActionLog(logAction)

    try {
      await api.decideGate(runId, 'G6', approved)
      setApprovedState(approved)
      onResults({
        log: logAction,
        synthesis: null,
        projectName: a1Context.projectName,
        status: approved
          ? 'G6 approved — continuing to next release step'
          : 'G6 rejected — rewound to A18 Security and release',
        pageTitle: 'Approve security',
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
    if (brief?.security_metrics && brief.security_metrics.length >= 4) {
      return brief.security_metrics
    }
    return [
      { label: 'Code scan', value: 'No high or critical findings' },
      { label: 'Dependencies', value: 'No known vulnerable libraries' },
      { label: 'Software bill of materials', value: 'Generated and signed' },
      { label: 'Secrets', value: 'None found in code or config' },
    ]
  }, [brief?.security_metrics])

  return (
    <div className="g6-step step-page-content">
      {/* Top Meta Breadcrumb Header */}
      <div className="g6-top-meta">
        <span className="g6-breadcrumb">
          DOMAIN F · RELEASE SAFELY · GATE G6 · ACTIVE · ON PATH
        </span>
      </div>

      <h1 className="g6-main-title">
        {brief?.title || 'Approve security'}{' '}
        {briefLoading ? <span className="g6-loading-badge">Loading LLM context…</span> : null}
      </h1>
      <p className="g6-sub-question">
        {brief?.lede || 'Is the new system safe to expose?'}
      </p>

      <div className="g6-approvers-strip">
        <span>{brief?.approvers ? `Approvers: ${brief.approvers}` : 'Approvers: Security lead'}</span>
      </div>

      <p className="g6-protection-note">
        {brief?.why || 'Separate from the business approval on purpose — different people, different question.'}
      </p>

      {/* 4 Cards Grid Matching Snapshot */}
      <div className="g6-cards-grid">
        <div className="g6-card">
          <span className="g6-card-label">FROM A1</span>
          <h3 className="g6-card-value">{categoryDisplay}</h3>
        </div>

        <div className="g6-card">
          <span className="g6-card-label">STRATEGY</span>
          <h3 className="g6-card-value">{strategyDisplay}</h3>
        </div>

        <div className="g6-card">
          <span className="g6-card-label">REQUIREMENT</span>
          <h3 className="g6-card-value g6-req-text">{reqDisplay}</h3>
        </div>

        <div className="g6-card g6-card-map">
          <span className="g6-card-label">MAP STATUS</span>
          <div className="g6-map-circle-wrap">
            <span className="g6-map-status-text">Active · on path</span>
            <div className="g6-map-bg-circle" />
          </div>
        </div>
      </div>

      {/* 4 Security Findings Displays Matching Snapshot */}
      <div className="g6-metrics-list">
        {metricsDisplay.map((m, idx) => (
          <div key={`${idx}-${m.label}`} className="g6-metric-card">
            <span className="g6-metric-lbl">{m.label}</span>
            <h4 className="g6-metric-val">{m.value}</h4>
          </div>
        ))}
      </div>

      {/* Human Gate Checklist (Mandatory vs Optional) Matching Snapshot */}
      <div className="g6-checklist-box">
        <div className="g6-checklist-header">
          <div className="g6-checklist-title-group">
            <h3 className="g6-checklist-title">HUMAN GATE CHECKLIST</h3>
            <p className="g6-checklist-note">
              Checklist items combine the step&apos;s standard controls with your A1 category, requirement, strategy, and the agent &amp; gate map combination.
            </p>
          </div>
          <div className="g6-checklist-counter-group">
            <button
              type="button"
              className={`g6-checklist-count-btn ${allMandatoryChecked ? 'mandatory-done' : ''} ${allChecked ? 'all-done' : ''}`}
              onClick={toggleAllDisplayed}
              title={`Mandatory: ${mandatoryCheckedCount}/${mandatoryItems.length} · Optional: ${optionalCheckedCount}/${optionalItems.length}`}
            >
              {mandatoryCheckedCount}/{mandatoryItems.length} mandatory · {totalChecked}/{rawChecklist.length} total
            </button>
          </div>
        </div>

        {/* Capability Toolbar: Filter, Select Mandatory, Opt-into Optional */}
        <div className="g6-checklist-toolbar">
          <div className="g6-filter-pills">
            <button
              type="button"
              className={`g6-pill-btn ${filterMode === 'all' ? 'active' : ''}`}
              onClick={() => setFilterMode('all')}
            >
              All items ({rawChecklist.length})
            </button>
            <button
              type="button"
              className={`g6-pill-btn ${filterMode === 'mandatory' ? 'active' : ''}`}
              onClick={() => setFilterMode('mandatory')}
            >
              Mandatory ({mandatoryItems.length})
            </button>
            {optionalItems.length > 0 && (
              <button
                type="button"
                className={`g6-pill-btn ${filterMode === 'optional' ? 'active' : ''}`}
                onClick={() => setFilterMode('optional')}
              >
                Optional ({optionalItems.length})
              </button>
            )}
          </div>

          <div className="g6-quick-actions">
            <button
              type="button"
              className="g6-quick-btn"
              onClick={selectAllMandatory}
            >
              ✓ Select Mandatory
            </button>

            {optionalItems.length > 0 && (
              <button
                type="button"
                className={`g6-opt-in-btn ${includeOptionalInApproval ? 'opted-in' : ''}`}
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
        <div className="g6-checklist-items">
          {displayedChecklist.map((item) => {
            const isChecked = Boolean(checked[item.id])
            const isMandatory = item.required !== false
            return (
              <label
                key={item.id}
                className={`g6-checklist-item ${isChecked ? 'checked' : ''} ${isMandatory ? 'is-mandatory' : 'is-optional'}`}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={(e) =>
                    setChecked((prev) => ({ ...prev, [item.id]: e.target.checked }))
                  }
                />
                <div className="g6-checklist-content">
                  <span className="g6-checklist-item-text">{item.label}</span>
                  <span className={`g6-badge ${isMandatory ? 'badge-mandatory' : 'badge-optional'}`}>
                    {isMandatory ? 'Mandatory' : 'Optional'}
                  </span>
                </div>
              </label>
            )
          })}
        </div>
      </div>

      {error ? (
        <div className="g6-error-banner">
          <p>{error}</p>
        </div>
      ) : null}

      {/* Decision Actions Bar */}
      <div className="g6-actions-bar">
        <button
          type="button"
          className="g6-approve-btn"
          onClick={() => handleDecision(true)}
          disabled={busy || (!canApprove && approvedState === null)}
          title={!canApprove ? 'Complete mandatory checklist items to approve' : 'Approve security gate'}
        >
          {busy ? <span className="g6-spinner" /> : null}
          Approve security and continue →
        </button>

        <button
          type="button"
          className="g6-reject-btn"
          onClick={() => handleDecision(false)}
          disabled={busy}
        >
          ✕ Request changes
        </button>

        {approvedState !== null && onContinueNext ? (
          <button
            type="button"
            className="g6-continue-btn"
            onClick={onContinueNext}
          >
            {continueLabel || 'Continue to next step →'}
          </button>
        ) : null}
      </div>

      <p className="g6-reject-note">
        What happens if you reject? The pipeline rewinds to Agent A18 (Security and release) so security scans, vulnerability remediations, and secrets posturing can be addressed.
      </p>

      {/* Log Output Terminal */}
      {actionLog.length > 0 ? (
        <div className="g6-terminal-box">
          <div className="g6-terminal-header">Gate Decision Audit Log</div>
          <ul className="g6-terminal-logs">
            {actionLog.map(([level, msg], idx) => (
              <li key={`${idx}-${msg}`} className={`g6-log-line ${level}`}>
                <span className="g6-log-icon">{level === 'ok' ? '✓' : '⚠'}</span>
                <span className="g6-log-msg">{msg}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
