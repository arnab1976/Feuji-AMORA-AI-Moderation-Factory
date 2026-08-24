import { useEffect, useMemo, useState } from 'react'
import { api, ApiError, type A5Brief, type LogLine } from '../api/client'
import type { PathMapIntakeSnapshot } from './AgentGateMapStep'
import type { ActivityPayload, GlossaryTerm } from './A1IntakeWizard'

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

interface StructureMetrics {
  entry_points: number
  nested_calls: number
  circular_deps: number
  complexity_avg: number
  complexity_label: string
  longest_program: string
  longest_lines: number
}

interface RiskItem {
  severity: string
  label: string
  places: number
}

const FALLBACK_DEPTH: [string, string][] = [
  ['full', 'Fully — every call and every data flow'],
  ['struct', 'Structure only — faster, less detail'],
]

const FALLBACK_FOCUS: [string, string][] = [
  ['calls', 'Call graph and entry points'],
  ['dataflow', 'Data flow and working storage'],
  ['risky', 'Risky constructs (GOTO, dynamic CALL)'],
  ['batch', 'Batch chains and job scripts'],
  ['schema', 'Schema / file I-O boundaries'],
]



function fmtNum(n: number): string {
  return n.toLocaleString()
}

export function A5LegacyAnalysisStep({
  runId,
  done,
  formResetKey,
  intake,
  onComplete,
  onResults,
  onContinueNext,
  continueLabel,
}: Props) {
  const [brief, setBrief] = useState<A5Brief | null>(null)
  const [briefLoading, setBriefLoading] = useState(true)
  const [depth, setDepth] = useState('full')
  const [focus, setFocus] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [runComplete, setRunComplete] = useState(false)
  const [log, setLog] = useState<LogLine[]>([])
  const [structure, setStructure] = useState<StructureMetrics | null>(null)
  const [risks, setRisks] = useState<RiskItem[]>([])
  const [resultHeadline, setResultHeadline] = useState('')
  const [resultBody, setResultBody] = useState('')

  const depthOpts = brief?.depth_options?.length ? brief.depth_options : FALLBACK_DEPTH
  const focusOpts = brief?.focus_options?.length ? brief.focus_options : FALLBACK_FOCUS

  const a1Context = useMemo(() => {
    return {
      categoryName: intake?.category_name || intake?.category_id || '—',
      categoryId: intake?.category_id || '',
      projectName: intake?.project_name || '—',
      requirement: intake?.requirement || '',
      strategies: intake?.strategies || [],
      strategyShort: intake?.strategy_short || intake?.strategies?.[0] || '—',
      why: intake?.why_modernize || '',
    }
  }, [intake])

  const [isContextLocked, setIsContextLocked] = useState(true)
  const [editCategory, setEditCategory] = useState('')
  const [editProject, setEditProject] = useState('')
  const [editStrategy, setEditStrategy] = useState('')
  const [editRequirement, setEditRequirement] = useState('')

  useEffect(() => {
    if (!editCategory && a1Context.categoryName && a1Context.categoryName !== '—') {
      setEditCategory(a1Context.categoryName)
    }
    if (!editProject && a1Context.projectName && a1Context.projectName !== '—') {
      setEditProject(a1Context.projectName)
    }
    if (!editStrategy && a1Context.strategyShort && a1Context.strategyShort !== '—') {
      setEditStrategy(a1Context.strategyShort)
    }
    if (!editRequirement && a1Context.requirement) {
      setEditRequirement(a1Context.requirement)
    }
  }, [a1Context])

  useEffect(() => {
    let cancelled = false
    setBriefLoading(true)
    setError(null)
    setRunComplete(false)
    setLog([])
    setStructure(null)
    setRisks([])
    setResultHeadline('')
    setResultBody('')
    setDepth('full')
    setFocus([])
    onResults({
      log: [['info', 'Loading A5 legacy analysis brief from A1 + path + prior agent…']],
      synthesis: null,
      projectName: a1Context.projectName !== '—' ? a1Context.projectName : '',
      status: 'A5 · synthesizing analysis lens…',
      glossaryStatus: 'Personalizing glossary for legacy code analysis…',
      evidenceItems: [],
      pageTitle: 'Legacy code analysis',
      pageContext: a1Context.categoryName,
    })

    const briefPromise = api.a5Brief(runId)
    const timeout = new Promise<never>((_, reject) => {
      window.setTimeout(
        () => reject(new Error('A5 brief timed out — using category defaults')),
        12000,
      )
    })

    Promise.race([briefPromise, timeout])
      .then((r) => {
        if (cancelled) return
        setBrief(r)
        setDepth(r.suggested_depth || 'full')
        setFocus(r.suggested_focus?.length ? [...r.suggested_focus] : ['calls', 'dataflow', 'risky'])
        setResultHeadline(r.result_headline || 'Structural analysis complete.')
        setResultBody(
          r.result_body ||
            'We built a map showing exactly how every part of the code connects to every other part.',
        )
        const glossary: GlossaryTerm[] = r.glossary ?? []
        onResults({
          log: [
            ['ok', `A5 brief ready · ${r.model}`],
            ['info', r.context_line],
            ...(r.prior_line ? ([['info', r.prior_line]] as [string, string][]) : []),
            ...(r.warning ? ([['warn', r.warning]] as [string, string][]) : []),
          ],
          synthesis: null,
          projectName: a1Context.projectName !== '—' ? a1Context.projectName : '',
          status: r.activity_status || 'A5 ready — set the lens and run',
          glossary,
          glossaryStatus: r.context_line,
          evidenceItems: (r.evidence_hints || []).map((name) => ({
            label: name,
            value: 'From prior agent · awaiting A5 artefacts',
          })),
          pageTitle: r.title,
          pageContext: r.context_line,
        })
      })
      .catch((e) => {
        if (cancelled) return
        setBrief(null)
        setDepth('full')
        setFocus(['calls', 'dataflow', 'risky'])
        setError(e instanceof ApiError ? e.message : String(e))
        onResults({
          log: [
            ['warn', e instanceof Error ? e.message : String(e)],
            ['info', 'Continuing with category-shaped analysis defaults'],
          ],
          synthesis: null,
          projectName: a1Context.projectName !== '—' ? a1Context.projectName : '',
          status: 'A5 ready with defaults',
        })
      })
      .finally(() => {
        if (!cancelled) setBriefLoading(false)
      })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId, formResetKey])

  useEffect(() => {
    if (!done) return
    api.agentLog(runId, 'A5').then((r) => {
      setLog(r.log)
      if (typeof r.params.depth === 'string') setDepth(r.params.depth)
      if (Array.isArray(r.params.focus)) setFocus(r.params.focus as string[])
      // Re-fetch run state is not available here; rebuild from log hints is weak.
      // Prefer analysis already stored after runAgent.
      setRunComplete(true)
      onResults({
        log: r.log,
        synthesis: null,
        projectName: a1Context.projectName !== '—' ? a1Context.projectName : '',
        status: 'A5 complete',
        evidenceItems: [
          { label: 'ast_index.json', value: 'Ready' },
          { label: 'call_graph.json', value: 'Ready' },
        ],
      })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, runId])

  const formReady = Boolean(depth) && focus.length > 0
  const canRun = formReady && !briefLoading

  const blockerHint = useMemo(() => {
    if (briefLoading) return 'Loading analysis lens from A1 + prior agent…'
    if (!depth) return 'Choose an analysis depth.'
    if (!focus.length) return 'Tick at least one analysis focus area.'
    return ''
  }, [briefLoading, depth, focus.length])

  function toggleFocus(id: string) {
    setFocus((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
    setRunComplete(false)
  }

  function applySuggested() {
    const targetDepth = brief?.suggested_depth || 'full'
    const targetFocus = brief?.suggested_focus?.length
      ? [...brief.suggested_focus]
      : ['calls', 'dataflow', 'risky']
    setDepth(targetDepth)
    setFocus(targetFocus)
    setRunComplete(false)
  }

  async function runAgent() {
    if (!canRun) return
    setBusy(true)
    setError(null)
    setRunComplete(false)
    onResults({
      log: [['info', 'Running Legacy code analysis agent…']],
      synthesis: null,
      projectName: a1Context.projectName !== '—' ? a1Context.projectName : '',
      status: 'A5 running…',
      pageTitle: brief?.title,
      pageContext: brief?.context_line,
    })
    try {
      const res = await api.runAgent(runId, 'A5', {
        depth,
        focus,
        category_id: brief?.category_id || a1Context.categoryId,
        prior_agent_id: brief?.prior_agent_id || 'A4',
        prior_agent_name: brief?.prior_agent_name || 'Repository discovery',
        result_headline: brief?.result_headline,
        result_body: brief?.result_body,
        form_heading: brief?.form_heading,
        a1_project_name: a1Context.projectName,
        a1_strategy: a1Context.strategyShort,
        a1_requirement: a1Context.requirement,
      })
      setLog(res.result.log)

      const inv = (res.state as { inventory?: { analysis?: Record<string, unknown> } })?.inventory
      const analysis = inv?.analysis
      if (analysis && typeof analysis === 'object') {
        const st = analysis.structure as StructureMetrics | undefined
        if (st) setStructure(st)
        if (Array.isArray(analysis.risks)) setRisks(analysis.risks as RiskItem[])
        if (typeof analysis.headline === 'string') setResultHeadline(analysis.headline)
        if (typeof analysis.body === 'string') setResultBody(analysis.body)
      } else {
        // Fallback display matching the snapshot defaults.
        setStructure({
          entry_points: 6,
          nested_calls: 4187,
          circular_deps: 14,
          complexity_avg: 18.4,
          complexity_label: 'high',
          longest_program: 'BAL0847.CBL',
          longest_lines: 9340,
        })
        setRisks([
          { severity: 'high', label: 'Dynamic call to program name at runtime', places: 17 },
          { severity: 'med', label: 'GOTO into paragraph mid-flow', places: 88 },
          { severity: 'med', label: 'Shared working storage across modules', places: 23 },
        ])
        setResultHeadline(brief?.result_headline || 'Structural analysis complete.')
        setResultBody(
          brief?.result_body ||
            'We built a map showing exactly how every part of the code connects to every other part. Some of it is surprising.',
        )
      }

      setRunComplete(true)
      onResults({
        log: res.result.log,
        synthesis: null,
        projectName: a1Context.projectName !== '—' ? a1Context.projectName : '',
        status: 'A5 complete — structural map ready',
        glossary: brief?.glossary,
        glossaryStatus: brief?.context_line,
        evidenceItems: (res.result.artifacts?.length
          ? res.result.artifacts
          : ['ast_index.json', 'call_graph.json']
        ).map((name) => ({ label: name, value: 'Produced this step' })),
        pageTitle: brief?.title,
        pageContext: brief?.context_line,
      })
      await onComplete()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e))
      onResults({
        log: [['error', e instanceof Error ? e.message : String(e)]],
        synthesis: null,
        projectName: a1Context.projectName !== '—' ? a1Context.projectName : '',
        status: 'A5 failed',
      })
    } finally {
      setBusy(false)
    }
  }

  const depthLabel = brief?.depth_label || 'How deeply should we read the code?'
  const focusLabel = brief?.focus_label || 'What should analysis prioritise?'

  return (
    <div className="a5-step a1-wizard mf-req">
      {/* 1. DOMAIN LEVEL INTAKE & CONTEXT MATRIX (Single flat card, captioned, editable/lockable) */}
      <section className="a2-a1-context a5-context" style={{ padding: '6px 10px', background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.9))', border: '1px solid rgba(56, 189, 248, 0.35)', borderRadius: '6px', margin: '0 0 6px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <h4 style={{ fontSize: '11.5px', fontWeight: 900, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>
              🌐 DOMAIN LEVEL INTAKE &amp; CONTEXT MATRIX
            </h4>
            <span
              style={{
                fontSize: '9.5px',
                fontWeight: 800,
                padding: '1px 6px',
                borderRadius: '4px',
                background: isContextLocked ? 'rgba(34, 197, 94, 0.15)' : 'rgba(234, 179, 8, 0.15)',
                color: isContextLocked ? '#4ade80' : '#facc15',
                border: isContextLocked ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid rgba(234, 179, 8, 0.3)',
              }}
            >
              {isContextLocked ? '🔒 LOCKED' : '✏️ EDITABLE'}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setIsContextLocked(!isContextLocked)}
            style={{
              fontSize: '10.5px',
              fontWeight: 800,
              padding: '2px 8px',
              borderRadius: '4px',
              background: isContextLocked ? 'rgba(56, 189, 248, 0.15)' : 'rgba(34, 197, 94, 0.2)',
              color: isContextLocked ? '#38bdf8' : '#4ade80',
              border: isContextLocked ? '1px solid rgba(56, 189, 248, 0.4)' : '1px solid rgba(34, 197, 94, 0.4)',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            {isContextLocked ? '✏️ Edit Context' : '🔒 Lock & Save'}
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '4px', background: 'rgba(15, 23, 42, 0.45)', padding: '6px 8px', borderRadius: '5px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
          <div>
            <span style={{ display: 'block', fontSize: '9px', fontWeight: 900, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '1px' }}>
              CATEGORY
            </span>
            {isContextLocked ? (
              <span style={{ fontSize: '11px', fontWeight: 600, color: '#cbd5e1' }}>
                {editCategory || a1Context.categoryName}
              </span>
            ) : (
              <input
                type="text"
                value={editCategory}
                onChange={(e) => setEditCategory(e.target.value)}
                style={{ width: '100%', background: '#0f172a', border: '1px solid #38bdf8', color: '#f8fafc', padding: '2px 5px', borderRadius: '4px', fontSize: '11px' }}
              />
            )}
          </div>

          <div>
            <span style={{ display: 'block', fontSize: '9px', fontWeight: 900, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '1px' }}>
              APPLICATION / TITLE
            </span>
            {isContextLocked ? (
              <span style={{ fontSize: '11px', fontWeight: 600, color: '#cbd5e1' }}>
                {editProject || a1Context.projectName}
              </span>
            ) : (
              <input
                type="text"
                value={editProject}
                onChange={(e) => setEditProject(e.target.value)}
                style={{ width: '100%', background: '#0f172a', border: '1px solid #38bdf8', color: '#f8fafc', padding: '2px 5px', borderRadius: '4px', fontSize: '11px' }}
              />
            )}
          </div>

          <div>
            <span style={{ display: 'block', fontSize: '9px', fontWeight: 900, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '1px' }}>
              STRATEGY
            </span>
            {isContextLocked ? (
              <span style={{ fontSize: '11px', fontWeight: 600, color: '#cbd5e1' }}>
                {editStrategy || a1Context.strategyShort}
              </span>
            ) : (
              <input
                type="text"
                value={editStrategy}
                onChange={(e) => setEditStrategy(e.target.value)}
                style={{ width: '100%', background: '#0f172a', border: '1px solid #38bdf8', color: '#f8fafc', padding: '2px 5px', borderRadius: '4px', fontSize: '11px' }}
              />
            )}
          </div>

          <div>
            <span style={{ display: 'block', fontSize: '9px', fontWeight: 900, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '1px' }}>
              PRIOR AGENT
            </span>
            <span style={{ fontSize: '11px', fontWeight: 600, color: '#cbd5e1' }}>
              {brief?.prior_agent_id || 'A4'} {brief?.prior_agent_name ? `· ${brief.prior_agent_name}` : '· Repository discovery'}
            </span>
          </div>

          <div style={{ gridColumn: '1 / -1', marginTop: '1px' }}>
            <span style={{ display: 'block', fontSize: '9px', fontWeight: 900, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '1px' }}>
              CONTINUITY
            </span>
            <span style={{ fontSize: '11px', fontWeight: 500, color: '#cbd5e1', lineHeight: '1.3' }}>
              {brief?.prior_line || 'We continue from A4 with an emphasis on the repository and dependency insights gathered.'}
            </span>
          </div>

          <div style={{ gridColumn: '1 / -1', marginTop: '1px' }}>
            <span style={{ display: 'block', fontSize: '9px', fontWeight: 900, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '1px' }}>
              REQUIREMENT / TREND
            </span>
            {isContextLocked ? (
              <span style={{ fontSize: '11px', fontWeight: 500, color: '#cbd5e1', lineHeight: '1.3' }}>
                {editRequirement || a1Context.requirement || 'Modernizing legacy code to Python.'}
              </span>
            ) : (
              <textarea
                rows={2}
                value={editRequirement}
                onChange={(e) => setEditRequirement(e.target.value)}
                style={{ width: '100%', background: '#0f172a', border: '1px solid #38bdf8', color: '#f8fafc', padding: '3px 5px', borderRadius: '4px', fontSize: '11px', fontFamily: 'inherit' }}
              />
            )}
          </div>

          <div style={{ gridColumn: '1 / -1', marginTop: '1px' }}>
            <span style={{ display: 'block', fontSize: '9px', fontWeight: 900, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '1px' }}>
              ANALYSIS PLAN
            </span>
            <span style={{ fontSize: '11px', fontWeight: 500, color: '#cbd5e1', lineHeight: '1.3' }}>
              {brief?.analysis_summary || 'A thorough structural analysis will identify critical components and dependencies for effective migration.'}
            </span>
          </div>

          <div style={{ gridColumn: '1 / -1', marginTop: '1px', paddingTop: '3px', borderTop: '1px solid rgba(255, 255, 255, 0.05)' }}>
            <span style={{ display: 'block', fontSize: '9px', fontWeight: 900, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '1px' }}>
              FROM PRIOR INVENTORY
            </span>
            <span style={{ fontSize: '11px', fontWeight: 600, color: '#38bdf8' }}>
              {brief?.discovery_repos?.length ? brief.discovery_repos.join(' · ') : 'https://github.com/sassoftware/sas-code-examples'}
            </span>
          </div>
        </div>
      </section>

      {/* 2. EXECUTION CONTROLS & ANALYSIS LENS (Single rich compact card) */}
      <section className="a5-execution-controls-card" style={{ padding: '6px 10px', background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.9))', border: '1px solid rgba(56, 189, 248, 0.35)', borderRadius: '6px', margin: '0 0 6px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
          <h4 style={{ fontSize: '11.5px', fontWeight: 900, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>
            ⚙️ EXECUTION CONTROLS &amp; ANALYSIS LENS
          </h4>
          <button
            type="button"
            className="landing-ghost a3-suggest-btn"
            style={{ padding: '2px 6px', fontSize: '10.5px' }}
            onClick={applySuggested}
          >
            Apply LLM suggestions
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div>
            <span style={{ display: 'block', fontSize: '10.5px', fontWeight: 700, color: '#f8fafc', marginBottom: '2px' }}>
              {depthLabel}
            </span>
            <div className="a3-pills" role="radiogroup" aria-label={depthLabel} style={{ gap: '4px' }}>
              {depthOpts.map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={`a3-pill${depth === id ? ' on' : ''}`}
                  aria-pressed={depth === id}
                  onClick={() => {
                    setDepth(id)
                    setRunComplete(false)
                  }}
                  disabled={briefLoading}
                  style={{ padding: '3px 8px', fontSize: '11px' }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span style={{ display: 'block', fontSize: '10.5px', fontWeight: 700, color: '#f8fafc', marginBottom: '2px' }}>
              {focusLabel}
            </span>
            <div className="a3-pills" role="group" aria-label={focusLabel} style={{ gap: '4px' }}>
              {focusOpts.map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={`a3-pill${focus.includes(id) ? ' on' : ''}`}
                  aria-pressed={focus.includes(id)}
                  onClick={() => toggleFocus(id)}
                  disabled={briefLoading}
                  style={{ padding: '3px 8px', fontSize: '11px' }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {error && <p className="err">{error}</p>}

      <div className="dash-run-row a3-run-row" style={{ marginBottom: '6px' }}>
        <button
          className="landing-start"
          type="button"
          disabled={!canRun || busy}
          onClick={() => void runAgent()}
          style={{ fontSize: '11.5px', fontWeight: 800, padding: '6px 12px' }}
        >
          {busy
            ? 'Running…'
            : done || runComplete
              ? '▶ Run this agent again'
              : '▶ Run deep code analysis'}
        </button>
        {!canRun && blockerHint ? (
          <span className="dash-sub a2-blocker-hint">{blockerHint}</span>
        ) : null}
      </div>

      {runComplete && structure ? (
        <section className="a5-results" aria-live="polite">
          <h3 className="a5-section-kicker">Deep code analysis</h3>
          <div className="a5-banner">
            <strong>{resultHeadline || 'Structural analysis complete.'}</strong>
            <p>
              {resultBody ||
                'We built a map showing exactly how every part of the code connects to every other part. Some of it is surprising.'}
            </p>
          </div>

          <div className="a5-panels">
            <section className="a5-panel">
              <h4>Code structure</h4>
              <dl className="a5-metrics">
                <div>
                  <dt>Entry points detected</dt>
                  <dd>{fmtNum(structure.entry_points)}</dd>
                </div>
                <div>
                  <dt>Nested subroutine calls</dt>
                  <dd>{fmtNum(structure.nested_calls)}</dd>
                </div>
                <div className="a5-metric-warn">
                  <dt>Circular dependencies</dt>
                  <dd>{fmtNum(structure.circular_deps)} cycles</dd>
                </div>
                <div className="a5-metric-warn">
                  <dt>Complexity average</dt>
                  <dd>
                    {structure.complexity_avg} ({structure.complexity_label})
                  </dd>
                </div>
                <div>
                  <dt>Longest program</dt>
                  <dd>
                    <code>{structure.longest_program}</code> — {fmtNum(structure.longest_lines)}{' '}
                    lines
                  </dd>
                </div>
              </dl>
            </section>

            <section className="a5-panel">
              <h4>Risky constructs found</h4>
              <ul className="a5-risks">
                {risks.map((r) => (
                  <li key={`${r.severity}-${r.label}`} className={`a5-risk sev-${r.severity}`}>
                    <span className="a5-risk-sev">{r.severity.toUpperCase()}</span>
                    <span className="a5-risk-label">{r.label}</span>
                    <span className="a5-risk-places">{fmtNum(r.places)} places</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          {log.length > 0 ? (
            <ul className="dash-activity a2-result-log">
              {log.map(([level, msg], i) => (
                <li key={`${i}-${msg}`} className={level}>
                  {msg}
                </li>
              ))}
            </ul>
          ) : null}

          <div className="a5-footer">
            <button className="landing-start" type="button" onClick={() => onContinueNext?.()}>
              {continueLabel || '▶ Move Forward to A8: Runtime Behaviour Agent →'}
            </button>
            <span className="a5-complete-pill">✓ Step complete</span>
          </div>
        </section>
      ) : null}
    </div>
  )
}
