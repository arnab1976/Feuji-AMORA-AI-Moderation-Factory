import { useEffect, useMemo, useState } from 'react'
import { api, ApiError, type A14Brief, type LogLine } from '../api/client'
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

interface KindOption {
  id: string
  label: string
  hint?: string
}

const DEFAULT_KIND_OPTIONS: KindOption[] = [
  { id: 'unit', label: 'ONE TEST PER BUSINESS RULE', hint: 'The main safety net' },
  { id: 'integration', label: 'TESTS AGAINST A REAL DATABASE', hint: '' },
  { id: 'edge', label: 'AWKWARD EDGE CASES', hint: 'Boundaries, zeros, negatives' },
  { id: 'parity', label: 'CHARACTERIZATION / PARITY VS LEGACY', hint: 'Prove equivalence' },
]

function truncate(text: string, n = 160): string {
  const t = text.trim()
  if (t.length <= n) return t
  return `${t.slice(0, n - 1)}…`
}

export function A14TestGenerationStep({
  runId,
  done,
  formResetKey,
  intake,
  onComplete,
  onResults,
  onContinueNext,
  continueLabel,
}: Props) {
  const [brief, setBrief] = useState<A14Brief | null>(null)
  const [selectedKinds, setSelectedKinds] = useState<string[]>(['unit', 'integration', 'edge'])
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [runComplete, setRunComplete] = useState(done)
  const [log, setLog] = useState<LogLine[]>([])
  const [resultHeadline, setResultHeadline] = useState('')
  const [artifacts, setArtifacts] = useState<string[]>([])

  const a1Context = useMemo(() => {
    const catName = intake?.category_name || intake?.category_id || '1. Legacy source-code data'
    const projName =
      intake?.project_name ||
      'Convert old Fortran code to new Java based code. The business context or the outcome should be similar'
    const req =
      intake?.requirement ||
      'Modernizing the legacy Fortran code to a Java-based system is essential for enhancing maintainability, scalability, and cloud readiness.'
    const strat = intake?.strategy_short || intake?.strategies?.[0] || 'Code Migration to Java'
    return {
      categoryName: catName,
      projectName: projName,
      requirement: req,
      strategyShort: strat,
    }
  }, [intake])

  useEffect(() => {
    let cancelled = false
    setError(null)
    setRunComplete(done)
    setLog([])
    setChecked({})

    onResults({
      log: [['info', 'Loading Test generation brief from A1 + path + A12–A13 / G3 context…']],
      synthesis: null,
      projectName: a1Context.projectName,
      status: 'A14 · designing rule-derived tests…',
      glossaryStatus: 'Personalizing glossary for test generation…',
      evidenceItems: [],
      pageTitle: 'Test generation',
      pageContext: a1Context.categoryName,
    })

    const briefPromise = api.a14Brief(runId)
    const timeout = new Promise<never>((_, reject) => {
      window.setTimeout(
        () => reject(new Error('A14 brief timed out — using defaults')),
        20000,
      )
    })

    Promise.race([briefPromise, timeout])
      .then((r) => {
        if (cancelled) return
        setBrief(r)
        if (r.suggested_kinds && r.suggested_kinds.length > 0) {
          setSelectedKinds(r.suggested_kinds)
        }
        setResultHeadline(r.result_headline || '')
        onResults({
          log: [['ok', r.warning || 'A14 brief ready — what to test grounded in prior agents']],
          synthesis: null,
          projectName: a1Context.projectName,
          status: r.movement_path
            ? `A14 · ${r.movement_path}`
            : 'A14 · Test generation ready',
          glossaryStatus: 'Glossary ready for characterization & parity',
          evidenceItems: (r.what_to_test || []).slice(0, 6).map((w) => ({
            label: w.label,
            value: w.detail,
          })),
          pageTitle: r.title || 'Test generation',
          pageContext: a1Context.categoryName,
          glossary: r.glossary,
        })
      })
      .catch(() => {
        if (cancelled) return
      })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId, formResetKey])

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
        id: 'rules_ok',
        label: 'Confirm tests are derived from approved rules, not new code alone',
        required: true,
      },
      {
        id: 'coverage_ok',
        label: 'Confirm coverage targets match gate G4 expectations',
        required: true,
      },
      {
        id: 'journeys_ok',
        label: 'Confirm characterization / parity tests cover critical journeys',
        required: true,
      },
      {
        id: 'path_ok',
        label: `Confirm this step still belongs on the path for «${cat}»`,
        required: true,
      },
      {
        id: 'req_ok',
        label: `Confirm scope still matches the A1 requirement: «${truncate(req, 120)}»`,
        required: true,
      },
      {
        id: 'strategy_ok',
        label: `Confirm the modernization strategy still applies: «${strat}»`,
        required: true,
      },
      {
        id: 'project_ok',
        label: `Confirm work remains under project «${proj}»`,
        required: true,
      },
    ]
  }, [brief, a1Context])

  const whatToTest = useMemo(() => {
    if (brief?.what_to_test && brief.what_to_test.length > 0) {
      return brief.what_to_test
    }
    return [
      {
        id: 'w1',
        label: 'Approved business rules',
        detail: 'One unit test per approved rule — never from generated source alone',
        source: 'rules',
      },
      {
        id: 'w2',
        label: 'Critical customer journeys',
        detail: 'Characterization / parity coverage for gate G4 equivalence',
        source: 'journeys',
      },
      {
        id: 'w3',
        label: 'Generated services & rule methods',
        detail: 'Services from A12 under the approved stack',
        source: 'A12',
      },
      {
        id: 'w4',
        label: 'Integration bridges / dual-run',
        detail: 'Parity checks across bridges produced by A13',
        source: 'A13',
      },
      {
        id: 'w5',
        label: 'Golden legacy expectations',
        detail: 'Capture expected answers from the old system before running new suites',
        source: 'legacy',
      },
    ]
  }, [brief])

  const kindOptions = useMemo(() => {
    const opts = brief?.kinds_options
    if (opts && opts.length > 0) {
      return opts.map((row) => {
        if (Array.isArray(row)) {
          return {
            id: String(row[0]),
            label: String(row[1] || row[0]).toUpperCase(),
            hint: String(row[2] || ''),
          }
        }
        return { id: String(row), label: String(row).toUpperCase(), hint: '' }
      })
    }
    return DEFAULT_KIND_OPTIONS
  }, [brief])

  const completedChecklistCount = useMemo(() => {
    return checklistItems.filter((item) => checked[item.id]).length
  }, [checklistItems, checked])

  const handleToggleChecklist = (id: string) => {
    setChecked((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const handleConfirmAllChecklist = () => {
    const next: Record<string, boolean> = {}
    checklistItems.forEach((item) => {
      next[item.id] = true
    })
    setChecked(next)
  }

  const handleToggleKind = (kindId: string) => {
    setSelectedKinds((prev) =>
      prev.includes(kindId) ? prev.filter((id) => id !== kindId) : [...prev, kindId],
    )
  }

  const handleRunAgent = async () => {
    setBusy(true)
    setError(null)
    try {
      const checklistPayload: Record<string, boolean> = {}
      checklistItems.forEach((item) => {
        checklistPayload[`checklist_${item.id}`] = Boolean(checked[item.id])
      })

      const res = await api.runAgent(runId, 'A14', {
        kinds: selectedKinds,
        what_to_test: whatToTest,
        a1_project_name: a1Context.projectName,
        a1_strategy: a1Context.strategyShort,
        a1_requirement: a1Context.requirement,
        ...checklistPayload,
      })

      const runLog = res.result.log || []
      const producedArtifacts = res.result.artifacts || [
        'tests/unit/',
        'tests/integration/',
        'coverage_matrix.json',
      ]
      setLog(runLog)
      setArtifacts(producedArtifacts)
      setRunComplete(true)

      const hl =
        runLog.find((l) => l[0] === 'hl')?.[1] ||
        brief?.result_headline ||
        'Test suites written from approved rules — equivalence vs intent.'
      setResultHeadline(hl)

      onResults({
        log: runLog,
        synthesis: null,
        projectName: a1Context.projectName,
        status: 'A14 · Test generation complete',
        glossaryStatus: 'Glossary updated for characterization & parity',
        evidenceItems: whatToTest.slice(0, 6).map((w) => ({
          label: w.label,
          value: w.detail,
        })),
        pageTitle: 'Test generation',
        pageContext: a1Context.categoryName,
        glossary: brief?.glossary || [
          {
            term: 'Characterization test',
            def: 'A test that locks current legacy behaviour so the new system must match it.',
          },
          {
            term: 'Rule-derived test',
            def: 'A unit test written from an approved business rule, never from generated source alone.',
          },
          {
            term: 'Parity / equivalence',
            def: 'Proving the new path returns the same answers as the old path for the same inputs.',
          },
          {
            term: 'Coverage matrix',
            def: 'A map from each approved rule to the tests that prove it.',
          },
          {
            term: 'Golden expectations',
            def: 'Answers captured from the legacy system used as the ground truth for new tests.',
          },
        ],
      })

      await onComplete()
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : String(err)
      setError(msg)
    } finally {
      setBusy(false)
    }
  }

  const title = brief?.title || 'Test generation'
  const lede =
    brief?.lede ||
    'Writes test suites from approved rules and journeys so equivalence is proven against intent, not against generated code.'

  return (
    <div className="a14-step-container">
      <header className="a14-header">
        <div className="a14-domain-tag">
          DOMAIN E · TEST &amp; PROVE IT WORKS · AGENT A14 · ACTIVE · ON PATH
        </div>
        <h2 className="a14-title">{title}</h2>
        <p className="a14-description">{lede}</p>
        {brief?.movement_path && (
          <p className="a14-path-line">Movement path · {brief.movement_path}</p>
        )}
      </header>

      <div className="a14-cards-grid">
        <div className="a14-card">
          <div className="a14-card-label">FROM A1</div>
          <div className="a14-card-value">{brief?.cards?.from_a1 || a1Context.categoryName}</div>
        </div>
        <div className="a14-card">
          <div className="a14-card-label">STRATEGY</div>
          <div className="a14-card-value">
            {brief?.cards?.strategy || a1Context.strategyShort}
          </div>
        </div>
        <div className="a14-card">
          <div className="a14-card-label">PROJECT</div>
          <div className="a14-card-value">
            {brief?.cards?.project || a1Context.projectName}
          </div>
        </div>
        <div className="a14-card">
          <div className="a14-card-label">MAP STATUS</div>
          <div className="a14-card-value a14-status-active">
            <span className="a14-status-dot" />
            {brief?.path_status_label || brief?.cards?.map_status || 'Active · on path'}
          </div>
        </div>
      </div>

      <section className="a14-what-panel">
        <div className="a14-what-header">
          <h3 className="a14-what-title">
            {brief?.what_to_test_heading || 'WHAT NEEDS TO BE TESTED'}
          </h3>
          <p className="a14-what-intro">
            {brief?.what_to_test_intro ||
              'Derived from approved rules, customer journeys, generated services, and bridges on the active path — not from the generated code itself.'}
          </p>
        </div>
        <ul className="a14-what-list">
          {whatToTest.map((item) => (
            <li key={item.id} className="a14-what-item">
              <div className="a14-what-item-top">
                <span className="a14-what-label">{item.label}</span>
                {item.source && <span className="a14-what-source">{item.source}</span>}
              </div>
              <p className="a14-what-detail">{item.detail}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="a14-checklist-panel">
        <div className="a14-checklist-header">
          <div className="a14-checklist-title-group">
            <h3 className="a14-checklist-title">
              {brief?.checklist_heading || 'OPERATOR CHECKLIST (OPTIONAL)'}
            </h3>
            <span className="a14-checklist-badge">
              {completedChecklistCount}/{checklistItems.length} complete
            </span>
          </div>
          <p className="a14-checklist-subtext">
            {brief?.checklist_note ||
              'Checklist items combine the step\'s standard controls with your A1 category, requirement, strategy, and the agent & gate map combination. These do not block Run — confirm them when useful, or use Confirm all.'}
          </p>
        </div>

        <div className="a14-checklist-items">
          {checklistItems.map((item) => (
            <label key={item.id} className="a14-checkbox-row">
              <input
                type="checkbox"
                checked={Boolean(checked[item.id])}
                onChange={() => handleToggleChecklist(item.id)}
              />
              <span className="a14-checkbox-label">{item.label}</span>
            </label>
          ))}
        </div>

        <button
          type="button"
          className="a14-btn-confirm-all"
          onClick={handleConfirmAllChecklist}
        >
          Confirm all checklist items
        </button>
      </section>

      <section className="a14-setup-panel">
        <div className="a14-setup-header">
          <h3 className="a14-setup-title">
            {brief?.form_heading || 'SET UP THIS STEP — YOU DECIDE'}
          </h3>
          <h4 className="a14-setup-subtitle">
            {brief?.kinds_label || 'WHAT KINDS OF TESTS?'}
          </h4>
        </div>

        <div className="a14-kind-options">
          {kindOptions.map((opt) => (
            <label key={opt.id} className="a14-kind-option-row">
              <input
                type="checkbox"
                checked={selectedKinds.includes(opt.id)}
                onChange={() => handleToggleKind(opt.id)}
              />
              <span className="a14-kind-option-text">
                <span className="a14-kind-option-label">{opt.label}</span>
                {opt.hint ? <span className="a14-kind-option-hint">{opt.hint}</span> : null}
              </span>
            </label>
          ))}
        </div>

        {error && <div className="a14-error-banner">{error}</div>}
        {brief?.warning && <div className="a14-warn-banner">{brief.warning}</div>}

        <div className="a14-actions">
          <button
            type="button"
            className="a14-btn-run"
            disabled={busy || selectedKinds.length === 0}
            onClick={handleRunAgent}
          >
            {busy ? 'Running agent A14…' : '▶ Run this agent'}
          </button>
        </div>
      </section>

      {runComplete && (
        <section className="a14-results-panel">
          <div className="a14-results-header">
            <h3>Agent A14 Execution Output</h3>
            {resultHeadline && <p className="a14-headline">{resultHeadline}</p>}
          </div>

          <div className="a14-log-list">
            {log.map(([kind, msg], idx) => (
              <div key={idx} className={`a14-log-item a14-log-${kind}`}>
                <span className="a14-log-kind">[{kind.toUpperCase()}]</span>
                <span className="a14-log-msg">{msg}</span>
              </div>
            ))}
          </div>

          {artifacts.length > 0 && (
            <div className="a14-artifacts-group">
              <h4>Produced Artifacts:</h4>
              <ul>
                {artifacts.map((art, i) => (
                  <li key={i}>
                    <code>{art}</code>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {onContinueNext && (
            <div className="a14-continue-group">
              <button type="button" className="a14-btn-continue" onClick={onContinueNext}>
                {continueLabel || 'Continue to next step →'}
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  )
}
