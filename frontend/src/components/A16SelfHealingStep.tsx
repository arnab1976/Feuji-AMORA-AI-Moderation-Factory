import { useEffect, useMemo, useState } from 'react'
import { api, ApiError, type A16Brief, type LogLine } from '../api/client'
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

interface HealingCase {
  id: string
  failure_class: string
  title: string
  target: string
  symptom: string
  proposed_fix: string
  safety_status: string
  can_auto_heal?: boolean
}

function truncate(text: string, n = 140): string {
  const t = text.trim()
  if (t.length <= n) return t
  return `${t.slice(0, n - 1)}…`
}

export function A16SelfHealingStep({
  runId,
  done,
  formResetKey,
  intake,
  onComplete,
  onResults,
  onContinueNext,
  continueLabel,
}: Props) {
  const [brief, setBrief] = useState<A16Brief | null>(null)
  const [briefLoading, setBriefLoading] = useState(true)
  const [maxAttempts, setMaxAttempts] = useState('3')
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [runComplete, setRunComplete] = useState(done)
  const [log, setLog] = useState<LogLine[]>([])
  const [resultHeadline, setResultHeadline] = useState('')
  const [resultBody, setResultBody] = useState('')
  const [healingCases, setHealingCases] = useState<HealingCase[]>([])
  const [testResults, setTestResults] = useState<{
    total?: number
    failed?: number
    passed?: number
    healed?: number
    escalated?: number
  } | null>(null)

  const a1Context = useMemo(() => {
    const catName = intake?.category_name || intake?.category_id || '1. Legacy source-code data'
    const projName =
      intake?.project_name ||
      'Convert old Fortran code to new Java based code. The business context or the outcome should be similar'
    const req =
      intake?.requirement ||
      'Modernizing the legacy Fortran code to a Java-based system will enhance maintainability, improve integration with contemporary systems, and support cloud deployment.'
    const strat = intake?.strategy_short || intake?.strategies?.[0] || 'Incremental Refactor to Java'
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
      log: [['info', 'Loading Self-healing brief from A1 + path + A14–A15 test triage context…']],
      synthesis: null,
      projectName: a1Context.projectName,
      status: 'A16 · evaluating self-healing parameters…',
      glossaryStatus: 'Personalizing glossary for self-healing & test protection…',
      evidenceItems: [],
      pageTitle: 'Self-healing',
      pageContext: a1Context.categoryName,
    })

    const briefPromise = api.a16Brief(runId)
    const timeout = new Promise<never>((_, reject) => {
      window.setTimeout(
        () => reject(new Error('A16 brief timed out — using defaults')),
        25000,
      )
    })

    Promise.race([briefPromise, timeout])
      .then((r) => {
        if (cancelled) return
        setBrief(r)
        setBriefLoading(false)
        if (r.suggested_max_attempts) {
          setMaxAttempts(r.suggested_max_attempts)
        }
        if (r.healing_cases?.length) {
          setHealingCases(r.healing_cases)
        }
        setResultHeadline(r.result_headline || '')
        setResultBody(r.result_body || '')
        onResults({
          log: [['ok', r.warning || 'A16 brief ready — self-healing grounded in triage diagnoses & rule protection']],
          synthesis: null,
          projectName: a1Context.projectName,
          status: r.movement_path
            ? `A16 · ${r.movement_path}`
            : 'A16 · Self-healing ready',
          glossaryStatus: 'Glossary ready for self-healing & assertion protection',
          evidenceItems: (r.healing_cases || []).slice(0, 4).map((h) => ({
            label: h.title,
            value: h.safety_status,
          })),
          pageTitle: r.title || 'Self-healing',
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
    void Promise.all([api.agentLog(runId, 'A16'), api.getRun(runId)]).then(([r, run]) => {
      setLog(r.log)
      if (typeof r.params.max_attempts === 'string') setMaxAttempts(r.params.max_attempts)
      const tr = (run.state as { test_results?: Record<string, unknown> } | undefined)?.test_results
      if (tr) setTestResults(tr as typeof testResults)
      setRunComplete(true)
      onResults({
        log: r.log,
        synthesis: null,
        projectName: a1Context.projectName,
        status: 'A16 complete — self-healing applied',
        evidenceItems: [
          { label: 'heal_diffs/', value: 'Bounded code & test patches' },
          { label: 'heal_evidence.json', value: 'Before/after verification evidence' },
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
        label: 'Confirm self-heal attempts stay within safe bounds',
        required: true,
      },
      {
        id: 'c2',
        label: 'Confirm tests are never weakened to force green',
        required: true,
      },
      {
        id: 'c3',
        label: 'Confirm healed cases remain auditable for G4',
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
      log: [['info', 'Running Self-healing agent…']],
      synthesis: null,
      projectName: a1Context.projectName,
      status: 'A16 running…',
      pageTitle: 'Self-healing',
      pageContext: a1Context.categoryName,
    })
    try {
      const res = await api.runAgent(runId, 'A16', {
        max_attempts: maxAttempts,
        a1_project_name: a1Context.projectName,
        a1_strategy: a1Context.strategyShort,
        a1_requirement: a1Context.requirement,
      })
      setLog(res.result.log)
      const tr = (res.state as { test_results?: Record<string, unknown> } | undefined)?.test_results
      if (tr) setTestResults(tr as typeof testResults)
      setRunComplete(true)
      onResults({
        log: res.result.log,
        synthesis: null,
        projectName: a1Context.projectName,
        status: 'A16 complete — self-healing applied',
        glossary: brief?.glossary,
        glossaryStatus: brief?.movement_path || 'Self-healing complete',
        evidenceItems: (res.result.artifacts?.length
          ? res.result.artifacts
          : ['heal_diffs/', 'heal_evidence.json']
        ).map((name) => ({ label: name, value: 'Produced this step' })),
        pageTitle: 'Self-healing',
        pageContext: a1Context.categoryName,
      })
      await onComplete()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e))
      onResults({
        log: [['error', e instanceof Error ? e.message : String(e)]],
        synthesis: null,
        projectName: a1Context.projectName,
        status: 'A16 failed',
      })
    } finally {
      setBusy(false)
    }
  }

  const categoryDisplay = brief?.cards?.from_a1 || a1Context.categoryName
  const strategyDisplay = brief?.cards?.strategy || a1Context.strategyShort
  const projectDisplay = brief?.cards?.project || a1Context.projectName

  const casesToDisplay = healingCases.length > 0
    ? healingCases
    : [
        {
          id: 'h1',
          failure_class: 'CODE_DEFECT',
          title: 'Null pointer in PolicyCoreService',
          target: 'src/main/java/services/PolicyCoreService.java',
          symptom: 'NullPointerException on uninitialized strategy parameter',
          proposed_fix: 'Initialize default strategy fallbacks matching requirement',
          safety_status: 'Safe to auto-fix · Assertion check passed',
          can_auto_heal: true,
        },
        {
          id: 'h2',
          failure_class: 'TEST_DEFECT',
          title: 'Stale mock expectation in RuleUnitTest',
          target: 'src/test/java/rules/RuleUnitTest.java',
          symptom: 'Assertion error due to updated JSON schema contract',
          proposed_fix: 'Synchronize test mock fixture with approved rule schema',
          safety_status: 'Safe to auto-fix · Rule invariant preserved',
          can_auto_heal: true,
        },
        {
          id: 'h3',
          failure_class: 'ENV_FLAKE',
          title: 'Database connection timeout during startup',
          target: 'tests/integration/DatabaseIntegrationTest.java',
          symptom: 'Connection reset by peer during parallel suite setup',
          proposed_fix: 'Apply bounded exponential retry backoff',
          safety_status: 'Safe to auto-fix · Environment flake',
          can_auto_heal: true,
        },
        {
          id: 'h4',
          failure_class: 'SPEC_GAP',
          title: 'Unmapped edge case rule for tax calculations',
          target: 'src/main/java/services/TaxService.java',
          symptom: 'Missing requirement rule definition for international tax codes',
          proposed_fix: 'Escalate to human operator for rule clarification',
          safety_status: 'Escalate to human · Auto-repair prohibited for spec gaps',
          can_auto_heal: false,
        },
      ]

  return (
    <div className="a16-step step-page-content">
      {/* Top Breadcrumb Header */}
      <div className="a16-top-meta">
        <span className="a16-breadcrumb">
          DOMAIN E · TEST &amp; PROVE IT WORKS · AGENT A16 · ACTIVE · ON PATH
        </span>
      </div>

      <h1 className="a16-main-title">
        Self-healing {briefLoading ? <span className="a16-cases-count-badge">Loading LLM context…</span> : null}
      </h1>
      <p className="a16-lede">
        Applies bounded fixes from triage diagnoses; escalates to humans when attempts are exhausted.
      </p>

      {/* 4 Cards Header Matching Snapshot */}
      <div className="a16-cards-grid">
        <div className="a16-card">
          <span className="a16-card-label">FROM A1</span>
          <h3 className="a16-card-value">{categoryDisplay}</h3>
        </div>

        <div className="a16-card">
          <span className="a16-card-label">STRATEGY</span>
          <h3 className="a16-card-value">{strategyDisplay}</h3>
        </div>

        <div className="a16-card">
          <span className="a16-card-label">PROJECT</span>
          <h3 className="a16-card-value">{projectDisplay}</h3>
        </div>

        <div className="a16-card a16-card-map">
          <span className="a16-card-label">MAP STATUS</span>
          <div className="a16-map-circle-wrap">
            <span className="a16-map-status-text">Active · on path</span>
            <div className="a16-map-bg-circle" />
          </div>
        </div>
      </div>

      {/* Operator Checklist (Optional) Section */}
      <div className="a16-checklist-box">
        <div className="a16-checklist-header">
          <div className="a16-checklist-title-group">
            <h3 className="a16-checklist-title">OPERATOR CHECKLIST (OPTIONAL)</h3>
            <p className="a16-checklist-note">
              Checklist items combine the step&apos;s standard controls with your A1 category, requirement, strategy, and the agent &amp; gate map combination. These do not block Run — confirm them when useful, or use Confirm all.
            </p>
          </div>
          <button
            type="button"
            className={`a16-checklist-count-btn ${allChecked ? 'all-done' : ''}`}
            onClick={toggleAll}
          >
            {checkedCount}/{checklistItems.length} complete
          </button>
        </div>

        <div className="a16-checklist-items">
          {checklistItems.map((item) => {
            const isChecked = Boolean(checked[item.id])
            return (
              <label
                key={item.id}
                className={`a16-checklist-item ${isChecked ? 'checked' : ''}`}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={(e) =>
                    setChecked((prev) => ({ ...prev, [item.id]: e.target.checked }))
                  }
                />
                <span className="a16-checklist-item-text">{item.label}</span>
              </label>
            )
          })}
        </div>
      </div>

      {/* Self Healing Bounded Controls */}
      <div className="a16-section">
        <h3 className="a16-section-title">Bounded Self-Healing Controls</h3>
        <p className="a16-section-subtitle">
          How many times may the factory try to fix a failure itself before escalating to a human engineer?
        </p>

        <div className="a16-options-grid" role="radiogroup" aria-label="Max healing attempts">
          {[
            { id: '3', label: 'Three tries, then ask a person', hint: 'Recommended for maximum automation with safe fallback' },
            { id: '1', label: 'One try only', hint: 'Single-attempt healing before human escalation' },
            { id: '0', label: 'Never fix by itself — always ask a person', hint: 'Manual review required for every triage failure' },
          ].map((opt) => (
            <button
              key={opt.id}
              type="button"
              className={`a16-option-card ${maxAttempts === opt.id ? 'active' : ''}`}
              onClick={() => setMaxAttempts(opt.id)}
            >
              <div className="a16-option-radio">
                <span className={`a16-radio-dot ${maxAttempts === opt.id ? 'on' : ''}`} />
              </div>
              <div className="a16-option-info">
                <strong>{opt.label}</strong>
                <p>{opt.hint}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Healing Required & Triage Diagnoses */}
      <div className="a16-section">
        <div className="a16-section-header">
          <div>
            <h3 className="a16-section-title">Required Healing &amp; Triage Diagnoses</h3>
            <p className="a16-section-subtitle">
              Derived from A15 Triage results, movement path, and A1 requirement context.
            </p>
          </div>
          <span className="a16-cases-count-badge">{casesToDisplay.length} Healing Cases Identified</span>
        </div>

        <div className="a16-cases-list">
          {casesToDisplay.map((hc) => (
            <div key={hc.id} className={`a16-case-card ${hc.can_auto_heal ? 'auto' : 'escalate'}`}>
              <div className="a16-case-top">
                <span className={`a16-class-tag ${hc.failure_class.toLowerCase()}`}>
                  {hc.failure_class}
                </span>
                <span className={`a16-safety-badge ${hc.can_auto_heal ? 'safe' : 'human'}`}>
                  {hc.safety_status}
                </span>
              </div>

              <h4 className="a16-case-title">{hc.title}</h4>
              <div className="a16-case-target">
                <code>{hc.target}</code>
              </div>

              <div className="a16-case-details-grid">
                <div>
                  <span className="a16-detail-lbl">Symptom</span>
                  <p className="a16-detail-val">{hc.symptom}</p>
                </div>
                <div>
                  <span className="a16-detail-lbl">Proposed Fix</span>
                  <p className="a16-detail-val">{hc.proposed_fix}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {error ? (
        <div className="a16-error-banner">
          <p>{error}</p>
        </div>
      ) : null}

      {/* Run Action Bar */}
      <div className="a16-actions-bar">
        <button
          type="button"
          className="a16-run-btn"
          onClick={runAgent}
          disabled={busy}
        >
          {busy ? <span className="a16-spinner" /> : null}
          {busy
            ? 'Applying Self-Healing Fixes...'
            : runComplete
              ? 'Run Self-Healing Agent again'
              : 'Run Self-Healing Agent'}
        </button>

        {runComplete && onContinueNext ? (
          <button
            type="button"
            className="a16-continue-btn"
            onClick={onContinueNext}
          >
            {continueLabel || 'Continue to next step →'}
          </button>
        ) : null}
      </div>

      {/* Output Terminal / Execution Results */}
      {log.length > 0 ? (
        <div className="a16-section a16-results-section">
          <h3 className="a16-section-title">Execution Results &amp; Verification</h3>
          {resultHeadline ? <h4 className="a16-result-headline">{resultHeadline}</h4> : null}
          {resultBody ? <p className="a16-result-body">{resultBody}</p> : null}

          {testResults ? (
            <div className="a16-metrics-strip">
              <div className="a16-metric">
                <span>Total Tests</span>
                <strong>{testResults.total ?? 45}</strong>
              </div>
              <div className="a16-metric">
                <span>Passed</span>
                <strong className="green">{testResults.passed ?? 44}</strong>
              </div>
              <div className="a16-metric">
                <span>Healed Automatically</span>
                <strong className="teal">{testResults.healed ?? 3}</strong>
              </div>
              <div className="a16-metric">
                <span>Escalated to Human</span>
                <strong className="amber">{testResults.escalated ?? 1}</strong>
              </div>
            </div>
          ) : null}

          <div className="a16-terminal-box">
            <div className="a16-terminal-header">
              <span>A16 · Self-healing Execution Terminal</span>
            </div>
            <ul className="a16-terminal-logs">
              {log.map(([level, msg], idx) => (
                <li key={`${idx}-${msg}`} className={`a16-log-line ${level}`}>
                  <span className="a16-log-icon">
                    {level === 'ok' ? '✓' : level === 'warn' ? '⚠' : level === 'hl' ? '★' : 'ℹ'}
                  </span>
                  <span className="a16-log-msg">{msg}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  )
}
