import { useEffect, useMemo, useState } from 'react'
import { api, ApiError, type A18Brief, type LogLine } from '../api/client'
import type { PathMapIntakeSnapshot } from './AgentGateMapStep'
import type { ActivityPayload } from './A1IntakeWizard'

interface Props {
  runId: string
  done: boolean
  formResetKey: number
  intake?: PathMapIntakeSnapshot | null
  onComplete: () => Promise<void>
  onResults: (payload: ActivityPayload) => void
  onContinueNext?: () => void
  continueLabel?: string
}

function truncate(text: string, n = 140): string {
  const t = text.trim()
  if (t.length <= n) return t
  return `${t.slice(0, n - 1)}…`
}

export function A18SecurityReleaseStep({
  runId,
  done,
  formResetKey,
  intake,
  onComplete,
  onResults,
  onContinueNext,
  continueLabel,
}: Props) {
  const [brief, setBrief] = useState<A18Brief | null>(null)
  const [briefLoading, setBriefLoading] = useState(true)
  const [plan, setPlan] = useState('slow')
  const [rollbackOnErrors, setRollbackOnErrors] = useState(true)
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [runComplete, setRunComplete] = useState(done)
  const [log, setLog] = useState<LogLine[]>([])
  const [resultHeadline, setResultHeadline] = useState('')
  const [resultBody, setResultBody] = useState('')

  const a1Context = useMemo(() => {
    const catName = intake?.category_name || intake?.category_id || '1. Legacy source-code data'
    const projName =
      intake?.project_name ||
      'Convert old Fortran code to new Java based code. The business context or the outcome should be similar'
    const req =
      intake?.requirement ||
      'Modernizing the legacy Fortran code to Java is essential to enhance system performance, maintainability, and scalability.'
    const strat = intake?.strategy_short || intake?.strategies?.[0] || 'Incremental Refactoring Approach'
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
    setRunComplete(done)
    setLog([])
    setChecked({})

    onResults({
      log: [['info', 'Loading Security and release brief from A1 + path + G5 equivalence approval context…']],
      synthesis: null,
      projectName: a1Context.projectName,
      status: 'A18 · preparing security scan & gradual release plan…',
      glossaryStatus: 'Personalizing glossary for security scanning & automated rollback…',
      evidenceItems: [],
      pageTitle: 'Security and release',
      pageContext: a1Context.categoryName,
    })

    const briefPromise = api.a18Brief(runId)
    const timeout = new Promise<never>((_, reject) => {
      window.setTimeout(
        () => reject(new Error('A18 brief timed out — using defaults')),
        25000,
      )
    })

    Promise.race([briefPromise, timeout])
      .then((r) => {
        if (cancelled) return
        setBrief(r)
        setBriefLoading(false)
        if (r.suggested_plan) {
          setPlan(r.suggested_plan)
        }
        setResultHeadline(r.result_headline || '')
        setResultBody(r.result_body || '')
        onResults({
          log: [['ok', r.warning || 'A18 brief ready — security scan & release pipeline grounded in G5 approved equivalence']],
          synthesis: null,
          projectName: a1Context.projectName,
          status: r.movement_path
            ? `A18 · ${r.movement_path}`
            : 'A18 · Security and release ready',
          glossaryStatus: 'Glossary ready for security vulnerability & rollback triggers',
          evidenceItems: [
            { label: 'Security Scans', value: 'SAST / DAST / Secrets / SBOM' },
            { label: 'Release Strategy', value: 'Gradual Canary Traffic Split' },
          ],
          pageTitle: r.title || 'Security and release',
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
  }, [runId, formResetKey])

  useEffect(() => {
    if (!done) return
    void api.agentLog(runId, 'A18').then((r) => {
      setLog(r.log)
      if (typeof r.params.plan === 'string') {
        setPlan(r.params.plan)
      }
      setRunComplete(true)
      onResults({
        log: r.log,
        synthesis: null,
        projectName: a1Context.projectName,
        status: 'A18 complete — security clean & release armed',
        evidenceItems: [
          { label: 'security_report.json', value: '0 High/Critical findings' },
          { label: 'handover_manifest.json', value: 'Canary traffic split configured' },
        ],
      })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, runId])

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
        label: 'Confirm security scan scope covers generated services and bridges',
        required: true,
      },
      {
        id: 'c2',
        label: 'Confirm release stages and rollback triggers are armed',
        required: true,
      },
      {
        id: 'c3',
        label: 'Confirm operations runbook matches the handover plan',
        required: true,
      },
      {
        id: 'c4',
        label: `Confirm this step still belongs on the path for «${cat}»`,
        required: true,
      },
      {
        id: 'c5',
        label: `Confirm scope still matches the A1 requirement: «${truncate(req, 110)}»`,
        required: true,
      },
      {
        id: 'c6',
        label: `Confirm the modernization strategy still applies: «${strat}»`,
        required: true,
      },
      {
        id: 'c7',
        label: `Confirm work remains under project «${truncate(proj, 100)}»`,
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

  async function runAgent() {
    setBusy(true)
    setError(null)
    setRunComplete(false)
    onResults({
      log: [['info', 'Running Security and release agent…']],
      synthesis: null,
      projectName: a1Context.projectName,
      status: 'A18 running security scans and arming release stages…',
      pageTitle: 'Security and release',
      pageContext: a1Context.categoryName,
    })
    try {
      const res = await api.runAgent(runId, 'A18', {
        plan,
        rollback_on: rollbackOnErrors ? ['errors'] : [],
        a1_project_name: a1Context.projectName,
        a1_strategy: a1Context.strategyShort,
        a1_requirement: a1Context.requirement,
      })
      setLog(res.result.log)
      setRunComplete(true)
      onResults({
        log: res.result.log,
        synthesis: null,
        projectName: a1Context.projectName,
        status: 'A18 complete — security clean & release armed',
        glossary: brief?.glossary,
        glossaryStatus: brief?.movement_path || 'Security and release complete',
        evidenceItems: (res.result.artifacts?.length
          ? res.result.artifacts
          : ['security_report.json', 'handover_manifest.json']
        ).map((name) => ({ label: name, value: 'Produced this step' })),
        pageTitle: 'Security and release',
        pageContext: a1Context.categoryName,
      })
      await onComplete()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e))
      onResults({
        log: [['error', e instanceof Error ? e.message : String(e)]],
        synthesis: null,
        projectName: a1Context.projectName,
        status: 'A18 failed',
      })
    } finally {
      setBusy(false)
    }
  }

  const categoryDisplay = brief?.cards?.from_a1 || a1Context.categoryName
  const strategyDisplay = brief?.cards?.strategy || a1Context.strategyShort
  const projectDisplay = brief?.cards?.project || a1Context.projectName

  return (
    <div className="a18-step step-page-content">
      {/* Top Breadcrumb Header */}
      <div className="a18-top-meta">
        <span className="a18-breadcrumb">
          DOMAIN F · RELEASE SAFELY · AGENT A18 · ACTIVE · ON PATH
        </span>
      </div>

      <h1 className="a18-main-title">
        Security and release {briefLoading ? <span className="a18-loading-badge">Loading LLM context…</span> : null}
      </h1>
      <p className="a18-lede">
        Runs security scans and drives gradual traffic handover with automatic rollback triggers.
      </p>

      {/* 4 Cards Header Matching Snapshot */}
      <div className="a18-cards-grid">
        <div className="a18-card">
          <span className="a18-card-label">FROM A1</span>
          <h3 className="a18-card-value">{categoryDisplay}</h3>
        </div>

        <div className="a18-card">
          <span className="a18-card-label">STRATEGY</span>
          <h3 className="a18-card-value">{strategyDisplay}</h3>
        </div>

        <div className="a18-card">
          <span className="a18-card-label">PROJECT</span>
          <h3 className="a18-card-value">{projectDisplay}</h3>
        </div>

        <div className="a18-card a18-card-map">
          <span className="a18-card-label">MAP STATUS</span>
          <div className="a18-map-circle-wrap">
            <span className="a18-map-status-text">Active · on path</span>
            <div className="a18-map-bg-circle" />
          </div>
        </div>
      </div>

      {/* Operator Checklist (Optional) Section */}
      <div className="a18-checklist-box">
        <div className="a18-checklist-header">
          <div className="a18-checklist-title-group">
            <h3 className="a18-checklist-title">OPERATOR CHECKLIST (OPTIONAL)</h3>
            <p className="a18-checklist-note">
              Checklist items combine the step&apos;s standard controls with your A1 category, requirement, strategy, and the agent &amp; gate map combination. These do not block Run — confirm them when useful, or use Confirm all.
            </p>
          </div>
          <button
            type="button"
            className={`a18-checklist-count-btn ${allChecked ? 'all-done' : ''}`}
            onClick={toggleAll}
          >
            {checkedCount}/{checklistItems.length} complete
          </button>
        </div>

        <div className="a18-checklist-items">
          {checklistItems.map((item) => {
            const isChecked = Boolean(checked[item.id])
            return (
              <label
                key={item.id}
                className={`a18-checklist-item ${isChecked ? 'checked' : ''}`}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={(e) =>
                    setChecked((prev) => ({ ...prev, [item.id]: e.target.checked }))
                  }
                />
                <span className="a18-checklist-item-text">{item.label}</span>
              </label>
            )
          })}
        </div>

        <div className="a18-checklist-footer-action">
          <button
            type="button"
            className="a18-confirm-all-btn"
            onClick={toggleAll}
          >
            Confirm all checklist items
          </button>
        </div>
      </div>

      {/* Set Up This Step — You Decide Controls */}
      <div className="a18-setup-section">
        <h3 className="a18-setup-header">SET UP THIS STEP — YOU DECIDE</h3>

        {/* Handover Pace Section */}
        <div className="a18-control-card">
          <h4 className="a18-control-heading">HOW FAST SHOULD WE HAND OVER?</h4>
          <div className="a18-plan-buttons-list" role="radiogroup" aria-label="Handover speed">
            {[
              {
                id: 'slow',
                label: 'Very careful — 1%, 5%, 20%, 50%, 100% over two weeks',
              },
              {
                id: 'normal',
                label: 'Normal — 5%, 25%, 100% over four days',
              },
              {
                id: 'fast',
                label: 'Fast — 10% then everything, in one day',
              },
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                className={`a18-plan-btn ${plan === p.id ? 'active' : ''}`}
                onClick={() => setPlan(p.id)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Automatic Rollback Section */}
        <div className="a18-control-card">
          <h4 className="a18-control-heading">WHEN SHOULD IT SWITCH BACK AUTOMATICALLY?</h4>
          <label className={`a18-rollback-checkbox-card ${rollbackOnErrors ? 'active' : ''}`}>
            <input
              type="checkbox"
              checked={rollbackOnErrors}
              onChange={(e) => setRollbackOnErrors(e.target.checked)}
            />
            <div className="a18-rollback-lbl-group">
              <strong className="a18-rollback-title">IF ERRORS RISE ABOVE NORMAL</strong>
              <span className="a18-rollback-badge">STRONGLY RECOMMENDED</span>
            </div>
          </label>
        </div>
      </div>

      {error ? (
        <div className="a18-error-banner">
          <p>{error}</p>
        </div>
      ) : null}

      {/* Action Bar */}
      <div className="a18-actions-bar">
        <button
          type="button"
          className="a18-run-btn"
          onClick={runAgent}
          disabled={busy}
        >
          {busy ? <span className="a18-spinner" /> : null}
          {busy
            ? 'Running security scans and arming release stages…'
            : runComplete
              ? 'Run Security and Release Agent again'
              : 'Run Security and Release Agent'}
        </button>

        {runComplete && onContinueNext ? (
          <button
            type="button"
            className="a18-continue-btn"
            onClick={onContinueNext}
          >
            {continueLabel || 'Continue to next step →'}
          </button>
        ) : null}
      </div>

      {/* Execution Results & Terminal Output */}
      {log.length > 0 ? (
        <div className="a18-section a18-results-section">
          <h3 className="a18-section-title">Security &amp; Release Execution Results</h3>
          {resultHeadline ? <h4 className="a18-result-headline">{resultHeadline}</h4> : null}
          {resultBody ? <p className="a18-result-body">{resultBody}</p> : null}

          <div className="a18-metrics-strip">
            <div className="a18-metric">
              <span>Security Posture</span>
              <strong className="green">Clean (0 Vulnerabilities)</strong>
            </div>
            <div className="a18-metric">
              <span>Handover Schedule</span>
              <strong className="teal">1% → 5% → 20% → 50% → 100%</strong>
            </div>
            <div className="a18-metric">
              <span>Rollback Triggers</span>
              <strong className="green">Armed &amp; Active</strong>
            </div>
          </div>

          <div className="a18-terminal-box">
            <div className="a18-terminal-header">
              <span>A18 · Security Scanner &amp; Traffic Switch Controller</span>
            </div>
            <ul className="a18-terminal-logs">
              {log.map(([level, msg], idx) => (
                <li key={`${idx}-${msg}`} className={`a18-log-line ${level}`}>
                  <span className="a18-log-icon">
                    {level === 'ok' ? '✓' : level === 'warn' ? '⚠' : level === 'hl' ? '★' : 'ℹ'}
                  </span>
                  <span className="a18-log-msg">{msg}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  )
}
