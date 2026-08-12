import { useEffect, useMemo, useState } from 'react'
import { api, ApiError, type A9Brief, type LogLine } from '../api/client'
import type { PathMapIntakeSnapshot } from './AgentGateMapStep'
import type { ActivityPayload, GlossaryTerm } from './A1IntakeWizard'
import { ChecklistPanel, type ChecklistItem } from './ChecklistPanel'

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

interface Metric {
  id: string
  label: string
  value: number
  unit: string
}

interface ProposedContext {
  name: string
  description: string
  replaces?: string[]
  cohesion?: number
  coupling?: number
}

const FALLBACK_SHAPE: [string, string][] = [
  ['micro', 'Separate independent pieces — most flexible, more to run'],
  ['modular', 'One application with clear internal walls — simpler'],
  ['hybrid', 'Split only the busiest parts, leave the rest'],
]

const FALLBACK_ORDER: [string, string][] = [
  ['safe', 'The lowest-risk piece'],
  ['value', 'The piece the business cares about most'],
  ['small', 'The smallest piece, for a fast visible result'],
]

const FALLBACK_CHECKS: ChecklistItem[] = [
  { id: 'cuts_ok', label: 'Confirm decomposition cuts align with the modernization strategy', required: true },
  { id: 'scope_ok', label: 'Confirm bounded contexts cover the A1 requirement scope', required: true },
  { id: 'order_ok', label: 'Confirm strangler / slice order is safe for production', required: true },
]

function truncate(text: string, n = 160): string {
  const t = text.trim()
  if (t.length <= n) return t
  return `${t.slice(0, n - 1)}…`
}

function fmt(n: number): string {
  return n.toLocaleString()
}

function formatMetric(m: Metric): string {
  const unit = (m.unit || '').trim()
  if (!unit) return fmt(m.value)
  return `${fmt(m.value)} ${unit}`
}

export function A9DomainDecompositionStep({
  runId,
  done,
  formResetKey,
  intake,
  onComplete,
  onResults,
  onContinueNext,
  continueLabel,
}: Props) {
  const [brief, setBrief] = useState<A9Brief | null>(null)
  const [briefLoading, setBriefLoading] = useState(true)
  const [shape, setShape] = useState('modular')
  const [order, setOrder] = useState('safe')
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [runComplete, setRunComplete] = useState(false)
  const [log, setLog] = useState<LogLine[]>([])
  const [contexts, setContexts] = useState<ProposedContext[]>([])
  const [metrics, setMetrics] = useState<Metric[]>([])
  const [buildFirst, setBuildFirst] = useState('')
  const [resultHeadline, setResultHeadline] = useState('')
  const [resultBody, setResultBody] = useState('')

  const shapeOpts = brief?.shape_options?.length ? brief.shape_options : FALLBACK_SHAPE
  const orderOpts = brief?.order_options?.length ? brief.order_options : FALLBACK_ORDER

  const a1Context = useMemo(
    () => ({
      categoryName: intake?.category_name || intake?.category_id || '—',
      categoryId: intake?.category_id || '',
      projectName: intake?.project_name || '—',
      requirement: intake?.requirement || '',
      strategies: intake?.strategies || [],
      strategyShort: intake?.strategy_short || intake?.strategies?.[0] || '—',
      why: intake?.why_modernize || '',
    }),
    [intake],
  )

  const activeLang = useMemo(() => {
    const combined = `${a1Context.projectName} ${a1Context.requirement} ${a1Context.strategyShort} ${a1Context.why}`.toLowerCase()
    if (combined.includes('sas')) return 'SAS'
    if (combined.includes('fortran')) return 'Fortran'
    if (combined.includes('cobol')) return 'COBOL'
    if (combined.includes('pl/i') || combined.includes('pli')) return 'PL/I'
    if (combined.includes('java')) return 'Java'
    if (combined.includes('c#') || combined.includes('.net')) return '.NET'
    const src = (brief?.source_language || '').trim()
    if (src && src.toLowerCase() !== 'unknown' && src.toLowerCase() !== 'legacy' && src.toUpperCase() !== 'COBOL') {
      return src
    }
    return 'Legacy'
  }, [brief, a1Context])

  const sourceLangDisplay = useMemo(() => {
    const src = (brief?.source_language || '').trim()
    if (src && src.toLowerCase() !== 'unknown' && src.toLowerCase() !== 'legacy') {
      if (activeLang.toUpperCase() !== 'COBOL' && src.toUpperCase() === 'COBOL') return activeLang
      return src
    }
    return activeLang || '—'
  }, [brief, activeLang])

  const cleanedPriorLine = useMemo(() => {
    if (!brief?.prior_line) return ''
    let line = brief.prior_line
    if (activeLang && activeLang.toUpperCase() !== 'COBOL') {
      line = line
        .replace(/\bCOBOL monolith\b/gi, `${activeLang} monolith`)
        .replace(/\bCOBOL system\b/gi, `${activeLang} system`)
        .replace(/\bCOBOL codebase\b/gi, `${activeLang} codebase`)
        .replace(/\bCOBOL code\b/gi, `${activeLang} code`)
        .replace(/\bCOBOL\b/gi, activeLang)
    }
    return line
  }, [brief, activeLang])

  const cleanedDecompositionPlan = useMemo(() => {
    if (!brief?.decomposition_plan) return ''
    let plan = brief.decomposition_plan
    if (activeLang && activeLang.toUpperCase() !== 'COBOL') {
      plan = plan
        .replace(/\bCOBOL monolith\b/gi, `${activeLang} monolith`)
        .replace(/\bCOBOL system\b/gi, `${activeLang} system`)
        .replace(/\bCOBOL codebase\b/gi, `${activeLang} codebase`)
        .replace(/\bCOBOL code\b/gi, `${activeLang} code`)
        .replace(/\bCOBOL\b/gi, activeLang)
    }
    return plan
  }, [brief, activeLang])

  const [isEditingPage, setIsEditingPage] = useState(false)
  const [customLangPath, setCustomLangPath] = useState('')
  const [customDecompPlan, setCustomDecompPlan] = useState('')
  const [customContinuityLine, setCustomContinuityLine] = useState('')

  useEffect(() => {
    setCustomLangPath(`${sourceLangDisplay}${brief?.target_stack_hint ? ` → ${brief.target_stack_hint}` : ''}`)
  }, [sourceLangDisplay, brief?.target_stack_hint])

  useEffect(() => {
    if (cleanedDecompositionPlan) setCustomDecompPlan(cleanedDecompositionPlan)
  }, [cleanedDecompositionPlan])

  useEffect(() => {
    if (cleanedPriorLine) setCustomContinuityLine(cleanedPriorLine)
  }, [cleanedPriorLine])

  const checklist: ChecklistItem[] = useMemo(() => {
    const source = brief?.checklist?.length ? brief.checklist : FALLBACK_CHECKS
    // Progress counts these, but Run is never blocked (matches snapshot + PipelineAgentStep).
    return source.map((c) => ({
      id: c.id,
      label: c.label,
      required: true,
    }))
  }, [brief])

  useEffect(() => {
    let cancelled = false
    setBriefLoading(true)
    setError(null)
    setRunComplete(false)
    setLog([])
    setChecked({})
    setContexts([])
    setMetrics([])
    onResults({
      log: [['info', 'Loading A9 domain decomposition brief from A1 + path + prior discovery…']],
      synthesis: null,
      projectName: a1Context.projectName !== '—' ? a1Context.projectName : '',
      status: 'A9 · synthesizing domain decomposition…',
      glossaryStatus: 'Personalizing glossary for domain cuts…',
      evidenceItems: [],
      pageTitle: 'Domain decomposition',
      pageContext: a1Context.categoryName,
    })

    const briefPromise = api.a9Brief(runId)
    const timeout = new Promise<never>((_, reject) => {
      window.setTimeout(
        () => reject(new Error('A9 brief timed out — using catalog defaults')),
        50000,
      )
    })

    Promise.race([briefPromise, timeout])
      .then((r) => {
        if (cancelled) return
        setBrief(r)
        setShape(r.suggested_shape || 'modular')
        setOrder(r.suggested_order || 'safe')
        setContexts(r.proposed_contexts || [])
        setMetrics(r.metrics || [])
        setBuildFirst(r.build_first_label || '')
        setResultHeadline(r.result_headline || '')
        setResultBody(r.result_body || '')
        const glossary: GlossaryTerm[] = r.glossary ?? []
        onResults({
          log: [
            ['ok', `A9 brief ready · ${r.model}`],
            ['info', r.context_line],
            ...(r.prior_line ? ([['info', r.prior_line]] as [string, string][]) : []),
            ...(r.decomposition_plan ? ([['info', r.decomposition_plan]] as [string, string][]) : []),
            ...(r.warning ? ([['warn', r.warning]] as [string, string][]) : []),
          ],
          synthesis: null,
          projectName: a1Context.projectName !== '—' ? a1Context.projectName : '',
          status: r.activity_status || 'A9 ready — set shape and run',
          glossary,
          glossaryStatus: r.context_line,
          evidenceItems: (r.evidence_hints || []).map((name) => ({
            label: name,
            value: 'Awaiting decomposition',
          })),
          pageTitle: r.title,
          pageContext: r.context_line,
        })
      })
      .catch((e) => {
        if (cancelled) return
        setBrief(null)
        setShape('modular')
        setOrder('safe')
        setError(e instanceof ApiError ? e.message : String(e))
        onResults({
          log: [
            ['warn', e instanceof Error ? e.message : String(e)],
            ['info', 'Continuing with category-shaped decomposition defaults'],
          ],
          synthesis: null,
          projectName: a1Context.projectName !== '—' ? a1Context.projectName : '',
          status: 'A9 ready with defaults',
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
    void Promise.all([api.agentLog(runId, 'A9'), api.getRun(runId)]).then(([r, run]) => {
      setLog(r.log)
      if (typeof r.params.shape === 'string') setShape(r.params.shape)
      if (typeof r.params.order === 'string') setOrder(r.params.order)
      const inv = (run.state as { inventory?: Record<string, unknown>; service_map?: ProposedContext[] } | undefined)
      const deco = ((inv?.inventory as Record<string, unknown> | undefined)?.decomposition ||
        {}) as Record<string, unknown>
      if (Array.isArray(deco.proposed_contexts)) {
        setContexts(deco.proposed_contexts as ProposedContext[])
      } else if (Array.isArray(inv?.service_map)) {
        setContexts(inv.service_map)
      }
      if (Array.isArray(deco.metrics)) setMetrics(deco.metrics as Metric[])
      if (typeof deco.build_first === 'string') setBuildFirst(deco.build_first)
      if (typeof deco.result_headline === 'string') setResultHeadline(deco.result_headline)
      if (typeof deco.result_body === 'string') setResultBody(deco.result_body)
      setRunComplete(true)
      onResults({
        log: r.log,
        synthesis: null,
        projectName: a1Context.projectName !== '—' ? a1Context.projectName : '',
        status: 'A9 complete',
        evidenceItems: [
          { label: 'domain_model.md', value: 'Ready' },
          { label: 'service_catalogue.json', value: 'Ready' },
          { label: 'adr/0001-boundaries.md', value: 'Ready' },
        ],
      })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, runId])

  const canRun = Boolean(shape) && Boolean(order) && !briefLoading

  async function runAgent() {
    if (!canRun) return
    setBusy(true)
    setError(null)
    setRunComplete(false)
    onResults({
      log: [['info', 'Running Domain decomposition agent…']],
      synthesis: null,
      projectName: a1Context.projectName !== '—' ? a1Context.projectName : '',
      status: 'A9 running…',
      pageTitle: brief?.title,
      pageContext: brief?.context_line,
    })
    try {
      const res = await api.runAgent(runId, 'A9', {
        shape,
        order,
        category_id: brief?.category_id || a1Context.categoryId,
        prior_agent_id: brief?.prior_agent_id,
        prior_agent_name: brief?.prior_agent_name,
        build_first_label: brief?.build_first_label || buildFirst,
        proposed_contexts: brief?.proposed_contexts || contexts,
        metrics: brief?.metrics || metrics,
        result_headline: brief?.result_headline,
        result_body: brief?.result_body,
        a1_project_name: a1Context.projectName,
        a1_strategy: a1Context.strategyShort,
        a1_requirement: a1Context.requirement,
      })
      setLog(res.result.log)
      const inv = (res.state as { inventory?: Record<string, unknown>; service_map?: ProposedContext[] } | undefined)
      const deco = ((inv?.inventory as Record<string, unknown> | undefined)?.decomposition ||
        {}) as Record<string, unknown>
      if (Array.isArray(deco.proposed_contexts)) {
        setContexts(deco.proposed_contexts as ProposedContext[])
      } else if (Array.isArray(inv?.service_map)) {
        setContexts(inv.service_map)
      } else if (brief?.proposed_contexts?.length) {
        setContexts(brief.proposed_contexts)
      }
      if (Array.isArray(deco.metrics)) setMetrics(deco.metrics as Metric[])
      else if (brief?.metrics?.length) setMetrics(brief.metrics)
      if (typeof deco.build_first === 'string') setBuildFirst(deco.build_first)
      else setBuildFirst(brief?.build_first_label || '')
      if (typeof deco.result_headline === 'string') setResultHeadline(deco.result_headline)
      else setResultHeadline(brief?.result_headline || '')
      if (typeof deco.result_body === 'string') setResultBody(deco.result_body)
      else setResultBody(brief?.result_body || '')
      setRunComplete(true)
      onResults({
        log: res.result.log,
        synthesis: null,
        projectName: a1Context.projectName !== '—' ? a1Context.projectName : '',
        status: 'A9 complete — proposal ready for architecture',
        glossary: brief?.glossary,
        glossaryStatus: brief?.context_line,
        evidenceItems: (res.result.artifacts?.length
          ? res.result.artifacts
          : ['domain_model.md', 'service_catalogue.json', 'adr/0001-boundaries.md']
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
        status: 'A9 failed',
      })
    } finally {
      setBusy(false)
    }
  }

  const title = brief?.title || 'Domain decomposition'
  const lede =
    brief?.lede ||
    'Proposes service or module boundaries from measured dependencies and approved rules — foundational for strangler/slice strategies.'
  const formHeading = brief?.form_heading || 'Set the decomposition shape'
  const kicker = brief?.domain_kicker || 'Domain D · Design & build the new · Step A9'
  const shownContexts = contexts.length ? contexts : brief?.proposed_contexts || []
  const shownMetrics = metrics.length ? metrics : brief?.metrics || []
  const projectCard = a1Context.requirement
    ? truncate(a1Context.requirement, 140)
    : a1Context.projectName

  return (
    <div className="a9-step a10-step a7-step a1-wizard mf-req">
      <p className="dash-kicker">{kicker}</p>
      <h2 className="dash-title">{briefLoading ? 'Domain decomposition' : title}</h2>
      <p className="dash-lede">
        {briefLoading
          ? 'Personalizing this step from your Factory Administrator (A1) context, path map, and prior discovery…'
          : lede}
      </p>

      <section className="a2-a1-context" aria-label="A1 path and prior context">
        <div className="a2-a1-context-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h4>Domain Level Intake &amp; Context Matrix</h4>
            <span className="a2-a1-lock">Semantic continuity</span>
          </div>
          <button
            type="button"
            className="landing-ghost"
            style={{ fontSize: '11px', padding: '3px 10px', color: isEditingPage ? '#2dd4bf' : '#94a3b8', borderColor: isEditingPage ? '#2dd4bf' : 'rgba(255,255,255,0.2)' }}
            onClick={() => setIsEditingPage(!isEditingPage)}
          >
            {isEditingPage ? '✓ Lock Page Information' : '✏️ Edit Page Information'}
          </button>
        </div>
        <p className="dash-sub a2-a1-intro">
          Shape, checklist, and proposed pieces stay close to the locked A1 combination, the active
          movement path, and discovery outputs ahead of G2 approval. You can audit or edit any text below before running this agent.
        </p>
        <dl className="a2-a1-grid">
          <div>
            <dt>From A1</dt>
            <dd>{a1Context.categoryName}</dd>
          </div>
          <div>
            <dt>Strategy</dt>
            <dd>{a1Context.strategyShort}</dd>
          </div>
          <div>
            <dt>Project</dt>
            <dd>{projectCard}</dd>
          </div>
          <div>
            <dt>Map status</dt>
            <dd>
              {brief?.path_active_ids?.includes('A9')
                ? 'Active · on path'
                : brief?.path_active_ids?.length
                  ? 'Path loaded'
                  : '—'}
            </dd>
          </div>
          <div>
            <dt>Prior step</dt>
            <dd>
              {brief?.prior_agent_id
                ? `${brief.prior_agent_id} · ${brief.prior_agent_name || ''}`
                : 'G1 · Discovery Approval'}
              {brief?.g1_approved ? ' · approved' : ''}
            </dd>
          </div>
          <div>
            <dt>Language path</dt>
            <dd>
              {isEditingPage ? (
                <input
                  type="text"
                  value={customLangPath}
                  onChange={(e) => setCustomLangPath(e.target.value)}
                  style={{ background: 'rgba(15,23,42,0.95)', border: '1px solid #2dd4bf', color: '#2dd4bf', padding: '2px 8px', borderRadius: '4px', fontSize: '12px', width: '100%', fontWeight: 700 }}
                />
              ) : (
                customLangPath || `${sourceLangDisplay}${brief?.target_stack_hint ? ` → ${brief.target_stack_hint}` : ''}`
              )}
            </dd>
          </div>
          <div>
            <dt>Approved rules</dt>
            <dd>{fmt(brief?.approved_rule_count ?? 0)}</dd>
          </div>
          <div>
            <dt>Programs</dt>
            <dd>{fmt(brief?.programs ?? 0)}</dd>
          </div>
          <div className="a2-a1-span">
            <dt>Decomposition plan</dt>
            <dd>
              {isEditingPage ? (
                <textarea
                  rows={2}
                  value={customDecompPlan}
                  onChange={(e) => setCustomDecompPlan(e.target.value)}
                  style={{ background: 'rgba(15,23,42,0.95)', border: '1px solid #2dd4bf', color: '#e2e8f0', padding: '6px 10px', borderRadius: '4px', fontSize: '12px', width: '100%' }}
                />
              ) : (
                customDecompPlan || cleanedDecompositionPlan
              )}
            </dd>
          </div>
          <div className="a2-a1-span">
            <dt>Continuity</dt>
            <dd>
              {isEditingPage ? (
                <textarea
                  rows={2}
                  value={customContinuityLine}
                  onChange={(e) => setCustomContinuityLine(e.target.value)}
                  style={{ background: 'rgba(15,23,42,0.95)', border: '1px solid #2dd4bf', color: '#e2e8f0', padding: '6px 10px', borderRadius: '4px', fontSize: '12px', width: '100%' }}
                />
              ) : (
                customContinuityLine || cleanedPriorLine
              )}
            </dd>
          </div>
        </dl>
        {brief?.warning ? <p className="dash-sub a2-warn">{brief.warning}</p> : null}
      </section>

      {!runComplete ? (
        <>
          <ChecklistPanel
            items={checklist}
            checked={checked}
            disabled={briefLoading || busy}
            title={brief?.checklist_heading || 'Operator checklist (optional)'}
            note={
              (brief?.checklist_note ||
                'Checklist items combine the step’s standard controls with your A1 category, requirement, strategy, and the agent & gate map combination.') +
              ' These do not block Run — confirm them when useful, or use Confirm all.'
            }
            onToggle={(id, value) => setChecked((p) => ({ ...p, [id]: value }))}
          />
          {checklist.length > 0 && (
            <div className="dash-run-row">
              <button
                type="button"
                className="landing-ghost"
                disabled={briefLoading || busy}
                onClick={() => {
                  const next: Record<string, boolean> = {}
                  for (const item of checklist) next[item.id] = true
                  setChecked(next)
                }}
              >
                Confirm all checklist items
              </button>
            </div>
          )}

          <h3 className="a4-form-heading">{formHeading}</h3>
          {brief?.shape_hint ? <p className="dash-sub">{brief.shape_hint}</p> : null}

          <section className="a4-form-card a6-form-card">
            <h4>{brief?.shape_label || 'What shape should the new system be?'}</h4>
            <div className="a3-pills" role="radiogroup" aria-label="System shape">
              {shapeOpts.map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={`a3-pill${shape === id ? ' on' : ''}`}
                  aria-pressed={shape === id}
                  onClick={() => {
                    setShape(id)
                    setRunComplete(false)
                  }}
                  disabled={briefLoading}
                >
                  {label}
                </button>
              ))}
            </div>
          </section>

          <section className="a4-form-card a6-form-card">
            <h4>{brief?.order_label || 'Which piece should we build first?'}</h4>
            {brief?.order_hint ? <p className="dash-sub">{brief.order_hint}</p> : null}
            <div className="a3-pills" role="radiogroup" aria-label="Build order">
              {orderOpts.map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={`a3-pill${order === id ? ' on' : ''}`}
                  aria-pressed={order === id}
                  onClick={() => {
                    setOrder(id)
                    setRunComplete(false)
                  }}
                  disabled={briefLoading}
                >
                  {label}
                </button>
              ))}
            </div>
          </section>

          {shownContexts.length > 0 ? (
            <section className="a9-preview" aria-label="Proposed pieces preview">
              <h4>Proposed pieces (preview)</h4>
              <p className="dash-sub">
                LLM-shaped from A1 continuity — finalized when you run this agent.
                {buildFirst || brief?.build_first_label
                  ? ` First slice: ${buildFirst || brief?.build_first_label}.`
                  : ''}
              </p>
              <ul>
                {shownContexts.map((c) => (
                  <li key={c.name}>
                    <strong>{c.name}</strong>
                    <span>{c.description}</span>
                    {c.replaces?.length ? (
                      <em>replaces {c.replaces.join(', ')}</em>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {error ? <p className="err">{error}</p> : null}

          <div className="dash-run-row">
            <button
              className="landing-start"
              type="button"
              onClick={() => void runAgent()}
              disabled={!canRun || busy}
            >
              {busy ? 'Decomposing…' : done ? 'Run again' : '▶ Run this agent'}
            </button>
          </div>
        </>
      ) : (
        <section className="a5-results a9-results" aria-label="Domain decomposition results">
          <div className="a5-results-banner">
            <h3>
              {resultHeadline ||
                brief?.result_headline ||
                'This is a proposal. A person decides at the next gate.'}
            </h3>
            <p>{resultBody || brief?.result_body || ''}</p>
          </div>

          {shownMetrics.length > 0 ? (
            <div className="a5-metric-grid">
              {shownMetrics.map((m) => (
                <div key={m.id} className="a5-metric">
                  <span className="a5-metric-label">{m.label}</span>
                  <strong className="a5-metric-value">{formatMetric(m)}</strong>
                </div>
              ))}
            </div>
          ) : null}

          {shownContexts.length > 0 ? (
            <div className="a9-service-list">
              <h4>Bounded contexts</h4>
              <ul>
                {shownContexts.map((c) => (
                  <li key={c.name}>
                    <div>
                      <strong>{c.name}</strong>
                      <span>{c.description}</span>
                      {c.replaces?.length ? (
                        <em>replaces {c.replaces.join(', ')}</em>
                      ) : null}
                    </div>
                    <div className="a9-scores">
                      <span>cohesion {(c.cohesion ?? 0).toFixed(2)}</span>
                      <span>coupling {(c.coupling ?? 0).toFixed(2)}</span>
                    </div>
                  </li>
                ))}
              </ul>
              {(buildFirst || brief?.build_first_label) && (
                <p className="dash-sub">
                  First piece to build: <strong>{buildFirst || brief?.build_first_label}</strong>
                </p>
              )}
            </div>
          ) : null}

          {log.length > 0 ? (
            <div className="a5-log">
              <h4>Activity</h4>
              <ul>
                {log.map((line, i) => (
                  <li key={`${line[0]}-${i}`} className={`log-${line[0]}`}>
                    {line[1]}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="dash-run-row">
            <button
              className="landing-ghost"
              type="button"
              onClick={() => {
                setRunComplete(false)
              }}
            >
              Adjust &amp; run again
            </button>
            {onContinueNext ? (
              <button className="landing-start" type="button" onClick={onContinueNext}>
                {continueLabel || 'Continue to next step →'}
              </button>
            ) : null}
          </div>
        </section>
      )}
    </div>
  )
}
