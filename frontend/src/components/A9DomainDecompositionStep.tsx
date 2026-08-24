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

  useEffect(() => {
    setCustomLangPath(`${sourceLangDisplay}${brief?.target_stack_hint ? ` → ${brief.target_stack_hint}` : ''}`)
  }, [sourceLangDisplay, brief?.target_stack_hint])

  useEffect(() => {
    if (cleanedDecompositionPlan) setCustomDecompPlan(cleanedDecompositionPlan)
  }, [cleanedDecompositionPlan])

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

  function applySuggested() {
    const targetShape = brief?.suggested_shape || 'modular'
    const targetOrder = brief?.suggested_order || 'safe'
    setShape(targetShape)
    setOrder(targetOrder)
    setRunComplete(false)
  }

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

  const shownContexts = contexts.length ? contexts : brief?.proposed_contexts || []
  const shownMetrics = metrics.length ? metrics : brief?.metrics || []

  return (
    <div className="a9-step a10-step a7-step a1-wizard mf-req">
      {/* 1. DOMAIN LEVEL INTAKE & CONTEXT MATRIX (Single flat card, captioned, editable/lockable) */}
      <section className="a2-a1-context" style={{ padding: '10px 14px', background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.9))', border: '1px solid rgba(56, 189, 248, 0.35)', borderRadius: '8px', margin: '0 0 10px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h4 style={{ fontSize: '13px', fontWeight: 900, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>
              🌐 DOMAIN LEVEL INTAKE &amp; CONTEXT MATRIX
            </h4>
            <span
              style={{
                fontSize: '10px',
                fontWeight: 800,
                padding: '2px 8px',
                borderRadius: '4px',
                background: isEditingPage ? 'rgba(234, 179, 8, 0.15)' : 'rgba(34, 197, 94, 0.15)',
                color: isEditingPage ? '#facc15' : '#4ade80',
                border: isEditingPage ? '1px solid rgba(234, 179, 8, 0.3)' : '1px solid rgba(34, 197, 94, 0.3)',
              }}
            >
              {!isEditingPage ? '🔒 LOCKED' : '✏️ EDITABLE'}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setIsEditingPage(!isEditingPage)}
            style={{
              fontSize: '11px',
              fontWeight: 800,
              padding: '4px 10px',
              borderRadius: '5px',
              background: !isEditingPage ? 'rgba(56, 189, 248, 0.15)' : 'rgba(34, 197, 94, 0.2)',
              color: !isEditingPage ? '#38bdf8' : '#4ade80',
              border: !isEditingPage ? '1px solid rgba(56, 189, 248, 0.4)' : '1px solid rgba(34, 197, 94, 0.4)',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            {!isEditingPage ? '✏️ Edit Context' : '🔒 Lock & Save'}
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '6px', background: 'rgba(15, 23, 42, 0.45)', padding: '8px 10px', borderRadius: '6px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
          <div>
            <span style={{ display: 'block', fontSize: '9.5px', fontWeight: 900, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>
              CATEGORY
            </span>
            <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#cbd5e1' }}>
              {a1Context.categoryName}
            </span>
          </div>

          <div>
            <span style={{ display: 'block', fontSize: '9.5px', fontWeight: 900, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>
              APPLICATION / TITLE
            </span>
            <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#cbd5e1' }}>
              {a1Context.projectName}
            </span>
          </div>

          <div>
            <span style={{ display: 'block', fontSize: '9.5px', fontWeight: 900, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>
              STRATEGY
            </span>
            <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#cbd5e1' }}>
              {a1Context.strategyShort}
            </span>
          </div>

          <div>
            <span style={{ display: 'block', fontSize: '9.5px', fontWeight: 900, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>
              PRIOR AGENT
            </span>
            <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#cbd5e1' }}>
              {brief?.prior_agent_id ? `${brief.prior_agent_id} · ${brief.prior_agent_name || ''}` : 'G1 · Discovery Approval'}
            </span>
          </div>

          <div>
            <span style={{ display: 'block', fontSize: '9.5px', fontWeight: 900, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>
              LANGUAGE PATH
            </span>
            {isEditingPage ? (
              <input
                type="text"
                value={customLangPath}
                onChange={(e) => setCustomLangPath(e.target.value)}
                style={{ width: '100%', background: '#0f172a', border: '1px solid #38bdf8', color: '#f8fafc', padding: '3px 6px', borderRadius: '4px', fontSize: '11.5px' }}
              />
            ) : (
              <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#38bdf8' }}>
                {customLangPath || `${sourceLangDisplay}${brief?.target_stack_hint ? ` → ${brief.target_stack_hint}` : ''}`}
              </span>
            )}
          </div>

          <div style={{ gridColumn: '1 / -1', marginTop: '2px' }}>
            <span style={{ display: 'block', fontSize: '9.5px', fontWeight: 900, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>
              REQUIREMENT / TREND
            </span>
            <span style={{ fontSize: '11.5px', fontWeight: 500, color: '#cbd5e1', lineHeight: '1.4' }}>
              {a1Context.requirement || 'Modernizing legacy application estate.'}
            </span>
          </div>

          <div style={{ gridColumn: '1 / -1', marginTop: '2px' }}>
            <span style={{ display: 'block', fontSize: '9.5px', fontWeight: 900, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>
              DECOMPOSITION PLAN
            </span>
            {isEditingPage ? (
              <textarea
                rows={2}
                value={customDecompPlan}
                onChange={(e) => setCustomDecompPlan(e.target.value)}
                style={{ width: '100%', background: '#0f172a', border: '1px solid #38bdf8', color: '#f8fafc', padding: '4px 6px', borderRadius: '4px', fontSize: '11.5px', fontFamily: 'inherit' }}
              />
            ) : (
              <span style={{ fontSize: '11.5px', fontWeight: 500, color: '#cbd5e1', lineHeight: '1.4' }}>
                {customDecompPlan || cleanedDecompositionPlan || 'Proposes service or module boundaries from measured dependencies.'}
              </span>
            )}
          </div>
        </div>
      </section>

      {!runComplete ? (
        <>
          <ChecklistPanel
            items={checklist}
            checked={checked}
            disabled={briefLoading || busy}
            title={brief?.checklist_heading || 'OPTIONAL / MANDATORY VERIFICATION CHECKLIST'}
            note={
              (brief?.checklist_note ||
                'Checklist items combine standard controls with your A1 category, requirement, and strategy.') +
              ' Confirm each mandatory item before running decomposition.'
            }
            onToggle={(id, value) => setChecked((p) => ({ ...p, [id]: value }))}
          />

          {/* 2. EXECUTION CONTROLS & DECOMPOSITION LENS (Single rich compact card) */}
          <section className="a9-execution-card" style={{ padding: '10px 14px', background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.9))', border: '1px solid rgba(56, 189, 248, 0.35)', borderRadius: '8px', margin: '0 0 10px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <h4 style={{ fontSize: '13px', fontWeight: 900, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>
                ⚙️ EXECUTION CONTROLS &amp; DECOMPOSITION LENS
              </h4>
              <button
                type="button"
                className="landing-ghost a3-suggest-btn"
                style={{ padding: '3px 8px', fontSize: '11px' }}
                onClick={applySuggested}
              >
                Apply LLM suggestions
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div>
                <span style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#f8fafc', marginBottom: '2px' }}>
                  {brief?.shape_label || 'What shape should the new system be?'}
                </span>
                <div className="a3-pills" role="radiogroup" aria-label="System shape" style={{ gap: '4px' }}>
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
                      style={{ padding: '4px 10px', fontSize: '11.5px' }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <span style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#f8fafc', marginBottom: '2px' }}>
                  {brief?.order_label || 'Which piece should we build first?'}
                </span>
                <div className="a3-pills" role="radiogroup" aria-label="Build order" style={{ gap: '4px' }}>
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
                      style={{ padding: '4px 10px', fontSize: '11.5px' }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {shownContexts.length > 0 ? (
            <section className="a9-preview" aria-label="Proposed pieces preview" style={{ padding: '10px 14px', background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '8px', margin: '0 0 10px 0' }}>
              <h4 style={{ fontSize: '12px', fontWeight: 800, color: '#38bdf8', margin: '0 0 4px' }}>Proposed pieces (preview)</h4>
              <p className="dash-sub" style={{ fontSize: '11px', color: '#94a3b8', margin: '0 0 6px' }}>
                LLM-shaped from A1 continuity — finalized when you run this agent.
                {buildFirst || brief?.build_first_label
                  ? ` First slice: ${buildFirst || brief?.build_first_label}.`
                  : ''}
              </p>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {shownContexts.map((c) => (
                  <li key={c.name} style={{ background: 'rgba(15, 23, 42, 0.5)', padding: '6px 10px', borderRadius: '4px', border: '1px solid rgba(255, 255, 255, 0.05)', fontSize: '11.5px' }}>
                    <strong style={{ color: '#38bdf8', marginRight: '6px' }}>{c.name}</strong>
                    <span style={{ color: '#cbd5e1' }}>{c.description}</span>
                    {c.replaces?.length ? (
                      <em style={{ color: '#94a3b8', marginLeft: '6px', fontSize: '10.5px' }}>replaces {c.replaces.join(', ')}</em>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {error ? <p className="err">{error}</p> : null}

          <div className="dash-run-row" style={{ marginBottom: '10px' }}>
            <button
              className="landing-start"
              type="button"
              onClick={() => void runAgent()}
              disabled={!canRun || busy}
              style={{ fontSize: '12.5px', fontWeight: 800, padding: '8px 16px' }}
            >
              {busy ? 'Decomposing…' : done ? '▶ Run this agent again' : '▶ Run domain decomposition'}
            </button>
          </div>
        </>
      ) : (
        <section
          className="a5-results a9-results"
          aria-label="Domain decomposition results"
          style={{
            padding: '12px 16px',
            background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.9))',
            border: '1px solid rgba(56, 189, 248, 0.35)',
            borderRadius: '8px',
            marginTop: '12px',
          }}
        >
          {/* Header Banner */}
          <div style={{ marginBottom: '12px', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', paddingBottom: '8px' }}>
            <h3 style={{ fontSize: '13px', fontWeight: 900, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 4px' }}>
              📊 DOMAIN DECOMPOSITION &amp; BOUNDED CONTEXT PROPOSAL
            </h3>
            <p style={{ fontSize: '11.5px', color: '#cbd5e1', margin: 0, lineHeight: '1.4' }}>
              {resultHeadline || brief?.result_headline || 'Domain decomposition complete — proposed boundaries ready for target architecture.'}
            </p>
            {resultBody || brief?.result_body ? (
              <p style={{ fontSize: '11px', color: '#94a3b8', margin: '4px 0 0', lineHeight: '1.3' }}>
                {resultBody || brief?.result_body}
              </p>
            ) : null}
          </div>

          {/* 4-Metric Grid (Clean Cards) */}
          {shownMetrics.length > 0 ? (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                gap: '8px',
                marginBottom: '12px',
              }}
            >
              {shownMetrics.map((m) => (
                <div
                  key={m.id}
                  style={{
                    background: 'rgba(15, 23, 42, 0.6)',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    border: '1px solid rgba(56, 189, 248, 0.25)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                  }}
                >
                  <span style={{ fontSize: '9.5px', fontWeight: 900, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
                    {m.label}
                  </span>
                  <strong style={{ fontSize: '15px', fontWeight: 800, color: '#f8fafc' }}>
                    {formatMetric(m)}
                  </strong>
                </div>
              ))}
            </div>
          ) : null}

          {/* Bounded Contexts List */}
          {shownContexts.length > 0 ? (
            <div style={{ marginBottom: '12px' }}>
              <h4 style={{ fontSize: '11.5px', fontWeight: 900, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 6px' }}>
                BOUNDED CONTEXTS
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {shownContexts.map((c) => (
                  <div
                    key={c.name}
                    style={{
                      background: 'rgba(15, 23, 42, 0.5)',
                      padding: '8px 10px',
                      borderRadius: '5px',
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                        <strong style={{ fontSize: '12px', fontWeight: 800, color: '#f8fafc' }}>{c.name}</strong>
                        {c.replaces?.length ? (
                          <span style={{ fontSize: '10px', color: '#94a3b8', background: 'rgba(255,255,255,0.06)', padding: '1px 6px', borderRadius: '3px' }}>
                            replaces {c.replaces.join(', ')}
                          </span>
                        ) : null}
                      </div>
                      <span style={{ fontSize: '11px', color: '#cbd5e1', display: 'block' }}>{c.description}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                      <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.3)' }}>
                        cohesion {(c.cohesion ?? 0).toFixed(2)}
                      </span>
                      <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', background: 'rgba(168, 85, 247, 0.15)', color: '#c084fc', border: '1px solid rgba(168, 85, 247, 0.3)' }}>
                        coupling {(c.coupling ?? 0).toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              {(buildFirst || brief?.build_first_label) && (
                <p style={{ fontSize: '11px', color: '#94a3b8', margin: '6px 0 0' }}>
                  First piece to build: <strong style={{ color: '#38bdf8' }}>{buildFirst || brief?.build_first_label}</strong>
                </p>
              )}
            </div>
          ) : null}

          {/* Activity log */}
          {log.length > 0 ? (
            <div style={{ background: 'rgba(15, 23, 42, 0.4)', padding: '8px 10px', borderRadius: '5px', border: '1px solid rgba(255, 255, 255, 0.05)', marginBottom: '12px' }}>
              <h4 style={{ fontSize: '10.5px', fontWeight: 900, color: '#38bdf8', textTransform: 'uppercase', margin: '0 0 4px' }}>AGENT ACTIVITY LOG</h4>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {log.map((line, i) => (
                  <li key={`${line[0]}-${i}`} style={{ fontSize: '10.5px', fontFamily: 'monospace', color: line[0] === 'error' ? '#f87171' : line[0] === 'warn' ? '#facc15' : line[0] === 'ok' ? '#4ade80' : '#94a3b8' }}>
                    {line[1]}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {/* Controls & Next Agent Move Forward Button */}
          <div className="dash-run-row" style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              className="landing-ghost"
              type="button"
              onClick={() => {
                setRunComplete(false)
              }}
              style={{ fontSize: '11.5px', padding: '6px 12px' }}
            >
              Adjust &amp; run again
            </button>
            {onContinueNext ? (
              <button className="landing-start" type="button" onClick={onContinueNext} style={{ fontSize: '12.5px', fontWeight: 800, padding: '8px 16px' }}>
                {continueLabel || '▶ Move Forward to A10: Data Lineage & Migration Agent →'}
              </button>
            ) : null}
          </div>
        </section>
      )}
    </div>
  )
}
