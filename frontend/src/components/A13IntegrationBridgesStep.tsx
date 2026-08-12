import { useEffect, useMemo, useState } from 'react'
import { api, ApiError, type A13Brief, type LogLine } from '../api/client'
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

interface BridgeOption {
  id: string
  label: string
}

const BRIDGE_OPTIONS: BridgeOption[] = [
  { id: 'api', label: 'LIVE CALL BRIDGES' },
  { id: 'file', label: 'FILE EXCHANGE BRIDGES' },
  { id: 'mq', label: 'MESSAGE QUEUE BRIDGES' },
]

function truncate(text: string, n = 160): string {
  const t = text.trim()
  if (t.length <= n) return t
  return `${t.slice(0, n - 1)}…`
}

export function A13IntegrationBridgesStep({
  runId,
  done,
  formResetKey,
  intake,
  onComplete,
  onResults,
  onContinueNext,
  continueLabel,
}: Props) {
  const [brief, setBrief] = useState<A13Brief | null>(null)
  const [selectedBridges, setSelectedBridges] = useState<string[]>(['api', 'file'])
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [runComplete, setRunComplete] = useState(done)
  const [log, setLog] = useState<LogLine[]>([])
  const [resultHeadline, setResultHeadline] = useState('')
  const [artifacts, setArtifacts] = useState<string[]>([])

  const a1Context = useMemo(() => {
    const catName = intake?.category_name || intake?.category_id || '1. Legacy source-code data'
    const projName = intake?.project_name || 'Convert old Fortran code to new Java based code. The business context or the outcome should be similar'
    const req = intake?.requirement || 'Modernizing our legacy Fortran code to a Java-based system will improve maintainability, enhance performance, and enable cloud deployment.'
    const strat = intake?.strategy_short || intake?.strategies?.[0] || 'Incremental modernization approach'
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

    onResults({
      log: [['info', 'Loading Integration bridges brief from A1 + path + A12 context…']],
      synthesis: null,
      projectName: a1Context.projectName,
      status: 'A13 · designing integration bridges…',
      glossaryStatus: 'Personalizing glossary for integration bridges…',
      evidenceItems: [],
      pageTitle: 'Integration bridges',
      pageContext: a1Context.categoryName,
    })

    const briefPromise = api.a13Brief(runId)
    const timeout = new Promise<never>((_, reject) => {
      window.setTimeout(
        () => reject(new Error('A13 brief timed out — using defaults')),
        15000,
      )
    })

    Promise.race([briefPromise, timeout])
      .then((r) => {
        if (cancelled) return
        setBrief(r)
        if (r.suggested_bridges && r.suggested_bridges.length > 0) {
          setSelectedBridges(r.suggested_bridges)
        }
        setResultHeadline(r.result_headline || '')
      })
      .catch(() => {
        if (cancelled) return
      })

    return () => {
      cancelled = true
    }
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
      { id: 'c1', label: 'Confirm bridge types match interfaces in the A1 requirement', required: true },
      { id: 'c2', label: 'Confirm dual-run / facade plan fits the strangler strategy', required: true },
      { id: 'c3', label: 'Confirm partner versioning windows are acceptable', required: true },
      { id: 'c4', label: `Confirm this step still belongs on the path for «${cat}»`, required: true },
      { id: 'c5', label: `Confirm scope still matches the A1 requirement: «${truncate(req, 120)}»`, required: true },
      { id: 'c6', label: `Confirm the modernization strategy still applies: «${strat}»`, required: true },
      { id: 'c7', label: `Confirm work remains under project «${proj}»`, required: true },
    ]
  }, [brief, a1Context])

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

  const handleToggleBridge = (bridgeId: string) => {
    setSelectedBridges((prev) =>
      prev.includes(bridgeId)
        ? prev.filter((id) => id !== bridgeId)
        : [...prev, bridgeId]
    )
  }

  const handleRunAgent = async () => {
    setBusy(true)
    setError(null)
    try {
      const res = await api.runAgent(runId, 'A13', {
        bridges: selectedBridges,
        a1_project_name: a1Context.projectName,
        a1_strategy: a1Context.strategyShort,
        a1_requirement: a1Context.requirement,
      })

      const runLog = res.result.log || []
      const producedArtifacts = res.result.artifacts || ['adapters/', 'routing_rules.yaml', 'cutover_runbook.md']
      setLog(runLog)
      setArtifacts(producedArtifacts)
      setRunComplete(true)

      const hl = runLog.find((l) => l[0] === 'hl')?.[1] || 'Bridges built. Both systems can run side-by-side during gradual cutover.'
      setResultHeadline(hl)

      onResults({
        log: runLog,
        synthesis: null,
        projectName: a1Context.projectName,
        status: 'A13 · Integration bridges created successfully',
        glossaryStatus: 'Glossary updated for integration bridges & routing',
        evidenceItems: producedArtifacts.map((a) => ({ label: 'Artifact', value: a })),
        pageTitle: 'Integration bridges',
        pageContext: a1Context.categoryName,
        glossary: brief?.glossary || [
          { term: 'Integration Bridge', def: 'An adapter that connects legacy protocols to modern API endpoints.' },
          { term: 'Strangler Facade', def: 'An entry-point layer routing traffic dynamically between legacy and modern services.' },
          { term: 'Dual-run Sync', def: 'Replicating transactions to both legacy and modern data stores simultaneously.' },
          { term: 'Traffic Splitting', def: 'Gradually diverting a percentage of user traffic to newly generated microservices.' },
          { term: 'Cutover Runbook', def: 'Operational guide detailing step-by-step handover and emergency rollback triggers.' },
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

  return (
    <div className="a13-step-container">
      {/* Header Banner */}
      <header className="a13-header">
        <div className="a13-domain-tag">
          DOMAIN D · DESIGN & BUILD THE NEW · AGENT A13 · ACTIVE · ON PATH
        </div>
        <h2 className="a13-title">Integration bridges</h2>
        <p className="a13-description">
          Builds API, file, and messaging bridges so strangler/facade strategies can run side by side with the legacy estate.
        </p>
      </header>

      {/* Top Context Cards Grid */}
      <div className="a13-cards-grid">
        <div className="a13-card">
          <div className="a13-card-label">FROM A1</div>
          <div className="a13-card-value">
            {brief?.cards?.from_a1 || a1Context.categoryName}
          </div>
        </div>

        <div className="a13-card">
          <div className="a13-card-label">STRATEGY</div>
          <div className="a13-card-value">
            {brief?.cards?.strategy || a1Context.strategyShort}
          </div>
        </div>

        <div className="a13-card">
          <div className="a13-card-label">PROJECT</div>
          <div className="a13-card-value">
            {brief?.cards?.project || a1Context.projectName}
          </div>
        </div>

        <div className="a13-card">
          <div className="a13-card-label">MAP STATUS</div>
          <div className="a13-card-value a13-status-active">
            <span className="a13-status-dot" />
            {brief?.cards?.map_status || 'Active · on path'}
          </div>
        </div>
      </div>

      {/* Operator Checklist Panel */}
      <section className="a13-checklist-panel">
        <div className="a13-checklist-header">
          <div className="a13-checklist-title-group">
            <h3 className="a13-checklist-title">OPERATOR CHECKLIST (OPTIONAL)</h3>
            <span className="a13-checklist-badge">
              {completedChecklistCount}/{checklistItems.length} complete
            </span>
          </div>
          <p className="a13-checklist-subtext">
            Checklist items combine the step's standard controls with your A1 category, requirement, strategy, and the agent &amp; gate map combination. These do not block Run — confirm them when useful, or use Confirm all.
          </p>
        </div>

        <div className="a13-checklist-items">
          {checklistItems.map((item) => (
            <label key={item.id} className="a13-checkbox-row">
              <input
                type="checkbox"
                checked={Boolean(checked[item.id])}
                onChange={() => handleToggleChecklist(item.id)}
              />
              <span className="a13-checkbox-label">{item.label}</span>
            </label>
          ))}
        </div>

        <button
          type="button"
          className="a13-btn-confirm-all"
          onClick={handleConfirmAllChecklist}
        >
          Confirm all checklist items
        </button>
      </section>

      {/* Set Up This Step Form */}
      <section className="a13-setup-panel">
        <div className="a13-setup-header">
          <h3 className="a13-setup-title">SET UP THIS STEP — YOU DECIDE</h3>
          <h4 className="a13-setup-subtitle">WHICH BRIDGES ARE NEEDED?</h4>
        </div>

        <div className="a13-bridge-options">
          {BRIDGE_OPTIONS.map((opt) => (
            <label key={opt.id} className="a13-bridge-option-row">
              <input
                type="checkbox"
                checked={selectedBridges.includes(opt.id)}
                onChange={() => handleToggleBridge(opt.id)}
              />
              <span className="a13-bridge-option-label">{opt.label}</span>
            </label>
          ))}
        </div>

        {error && <div className="a13-error-banner">{error}</div>}

        <div className="a13-actions">
          <button
            type="button"
            className="a13-btn-run"
            disabled={busy || selectedBridges.length === 0}
            onClick={handleRunAgent}
          >
            {busy ? 'Running agent A13…' : '▶ Run this agent'}
          </button>
        </div>
      </section>

      {/* Results / Log Display */}
      {runComplete && (
        <section className="a13-results-panel">
          <div className="a13-results-header">
            <h3>Agent A13 Execution Output</h3>
            {resultHeadline && <p className="a13-headline">{resultHeadline}</p>}
          </div>

          <div className="a13-log-list">
            {log.map(([kind, msg], idx) => (
              <div key={idx} className={`a13-log-item a13-log-${kind}`}>
                <span className="a13-log-kind">[{kind.toUpperCase()}]</span>
                <span className="a13-log-msg">{msg}</span>
              </div>
            ))}
          </div>

          {artifacts.length > 0 && (
            <div className="a13-artifacts-group">
              <h4>Produced Artifacts &amp; Runbooks:</h4>
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
            <div className="a13-continue-group">
              <button
                type="button"
                className="a13-btn-continue"
                onClick={onContinueNext}
              >
                {continueLabel || 'Continue to next step →'}
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  )
}
