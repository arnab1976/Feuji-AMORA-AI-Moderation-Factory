import { useEffect, useMemo, useState } from 'react'
import { api, ApiError, type A10Brief, type LogLine } from '../api/client'
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

interface DesignChoice {
  label: string
  value: string
}

interface ContractMetric {
  id: string
  label: string
  value: number
  unit: string
}

interface PreviousArchitecture {
  headline?: string
  body?: string
  design_traits?: DesignChoice[]
  estate_metrics?: ContractMetric[]
}

interface ComparisonDelta {
  aspect: string
  from: string
  to: string
  change?: string
}

const FALLBACK_COMMS: [string, string][] = [
  ['sync', 'Direct calls — simpler to follow'],
  ['async', 'Messages — more resilient, harder to debug'],
  ['mixed', 'Direct for queries, messages for updates'],
]

const FALLBACK_DEPTH: [string, string][] = [
  ['standard', 'Standard — core APIs and events per bounded context'],
  ['deep', 'Deep — full surface area, ownership rules, ADR pack'],
]

function truncate(text: string, n = 160): string {
  const t = text.trim()
  if (t.length <= n) return t
  return `${t.slice(0, n - 1)}…`
}

function fmt(n: number): string {
  return n.toLocaleString()
}

function formatMetric(m: ContractMetric): string {
  const unit = (m.unit || '').trim()
  if (!unit) return fmt(m.value)
  return `${fmt(m.value)} ${unit}`
}

export function A10TargetArchitectureStep({
  runId,
  done,
  formResetKey,
  intake,
  onComplete,
  onResults,
  onContinueNext,
  continueLabel,
}: Props) {
  const [brief, setBrief] = useState<A10Brief | null>(null)
  const [briefLoading, setBriefLoading] = useState(true)
  const [comms, setComms] = useState('mixed')
  const [depth, setDepth] = useState('standard')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [runComplete, setRunComplete] = useState(false)
  const [log, setLog] = useState<LogLine[]>([])
  const [designChoices, setDesignChoices] = useState<DesignChoice[]>([])
  const [contractsGenerated, setContractsGenerated] = useState<ContractMetric[]>([])
  const [previousArch, setPreviousArch] = useState<PreviousArchitecture | null>(null)
  const [deltas, setDeltas] = useState<ComparisonDelta[]>([])
  const [resultHeadline, setResultHeadline] = useState('')
  const [resultBody, setResultBody] = useState('')

  const commsOpts = brief?.comms_options?.length ? brief.comms_options : FALLBACK_COMMS
  const depthOpts = brief?.depth_options?.length ? brief.depth_options : FALLBACK_DEPTH

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

  useEffect(() => {
    let cancelled = false
    setBriefLoading(true)
    setError(null)
    setRunComplete(false)
    setLog([])
    setDesignChoices([])
    setContractsGenerated([])
    setPreviousArch(null)
    setDeltas([])
    onResults({
      log: [['info', 'Loading A10 target architecture brief from A1 + path + A9…']],
      synthesis: null,
      projectName: a1Context.projectName !== '—' ? a1Context.projectName : '',
      status: 'A10 · synthesizing target architecture…',
      glossaryStatus: 'Personalizing glossary for target architecture…',
      evidenceItems: [],
      pageTitle: 'Target Architecture',
      pageContext: a1Context.categoryName,
    })

    const briefPromise = api.a10Brief(runId)
    const timeout = new Promise<never>((_, reject) => {
      window.setTimeout(
        () => reject(new Error('A10 brief timed out — using catalog defaults')),
        50000,
      )
    })

    Promise.race([briefPromise, timeout])
      .then((r) => {
        if (cancelled) return
        setBrief(r)
        setComms(r.suggested_comms || 'mixed')
        setDepth(r.suggested_depth || 'standard')
        setDesignChoices(r.design_choices || [])
        setContractsGenerated(r.contracts_generated || [])
        setPreviousArch(r.previous_architecture || null)
        setDeltas(r.comparison_deltas || [])
        setResultHeadline(r.result_headline || '')
        setResultBody(r.result_body || '')
        const glossary: GlossaryTerm[] = r.glossary ?? []
        onResults({
          log: [
            ['ok', `A10 brief ready · ${r.model}`],
            ['info', r.context_line],
            ...(r.prior_line ? ([['info', r.prior_line]] as [string, string][]) : []),
            ...(r.previous_architecture?.headline
              ? ([['info', `Previous · ${r.previous_architecture.headline}`]] as [string, string][])
              : []),
            ...(r.warning ? ([['warn', r.warning]] as [string, string][]) : []),
          ],
          synthesis: null,
          projectName: a1Context.projectName !== '—' ? a1Context.projectName : '',
          status: r.activity_status || 'A10 ready — set communication style and run',
          glossary,
          glossaryStatus: r.context_line,
          evidenceItems: (r.evidence_hints || []).map((name) => ({
            label: name,
            value: 'From A9 · awaiting A10 contracts',
          })),
          pageTitle: r.title,
          pageContext: r.context_line,
        })
      })
      .catch((e) => {
        if (cancelled) return
        setBrief(null)
        setComms('mixed')
        setDepth('standard')
        setError(e instanceof ApiError ? e.message : String(e))
        onResults({
          log: [
            ['warn', e instanceof Error ? e.message : String(e)],
            ['info', 'Continuing with category-shaped architecture defaults'],
          ],
          synthesis: null,
          projectName: a1Context.projectName !== '—' ? a1Context.projectName : '',
          status: 'A10 ready with defaults',
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
    void Promise.all([api.agentLog(runId, 'A10'), api.getRun(runId)]).then(([r, run]) => {
      setLog(r.log)
      if (typeof r.params.comms === 'string') setComms(r.params.comms)
      if (typeof r.params.depth === 'string') setDepth(r.params.depth)
      const inv = (run.state as { inventory?: Record<string, unknown> } | undefined)?.inventory
      const architecture = (inv?.architecture || {}) as Record<string, unknown>
      if (Array.isArray(architecture.design_choices)) {
        setDesignChoices(architecture.design_choices as DesignChoice[])
      }
      if (Array.isArray(architecture.contracts_generated)) {
        setContractsGenerated(architecture.contracts_generated as ContractMetric[])
      }
      if (architecture.previous_architecture && typeof architecture.previous_architecture === 'object') {
        setPreviousArch(architecture.previous_architecture as PreviousArchitecture)
      }
      if (Array.isArray(architecture.comparison_deltas)) {
        setDeltas(architecture.comparison_deltas as ComparisonDelta[])
      }
      if (typeof architecture.result_headline === 'string') setResultHeadline(architecture.result_headline)
      if (typeof architecture.result_body === 'string') setResultBody(architecture.result_body)
      setRunComplete(true)
      onResults({
        log: r.log,
        synthesis: null,
        projectName: a1Context.projectName !== '—' ? a1Context.projectName : '',
        status: 'A10 complete',
        evidenceItems: [
          { label: 'contracts/openapi.yaml', value: 'Ready' },
          { label: 'contracts/asyncapi.yaml', value: 'Ready' },
          { label: 'adr/0002-comms.md', value: 'Ready' },
        ],
      })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, runId])

  const canRun = Boolean(comms) && Boolean(depth)

  const blockerHint = useMemo(() => {
    if (briefLoading) return 'Loading architecture fields from A1 + A9…'
    if (!comms) return 'Select how services should communicate.'
    if (!depth) return 'Select contract depth.'
    return ''
  }, [briefLoading, comms, depth])

  async function runAgent() {
    if (!canRun) return
    setBusy(true)
    setError(null)
    setRunComplete(false)
    onResults({
      log: [['info', 'Running Target Architecture agent…']],
      synthesis: null,
      projectName: a1Context.projectName !== '—' ? a1Context.projectName : '',
      status: 'A10 running…',
      pageTitle: brief?.title,
      pageContext: brief?.context_line,
    })
    try {
      const res = await api.runAgent(runId, 'A10', {
        comms,
        depth,
        category_id: brief?.category_id || a1Context.categoryId,
        prior_agent_id: brief?.prior_agent_id,
        prior_agent_name: brief?.prior_agent_name,
        result_headline: brief?.result_headline,
        result_body: brief?.result_body,
        design_choices: brief?.design_choices || designChoices,
        contracts_generated: brief?.contracts_generated || contractsGenerated,
        previous_architecture: brief?.previous_architecture || previousArch || undefined,
        comparison_deltas: brief?.comparison_deltas || deltas,
        a1_project_name: a1Context.projectName,
        a1_strategy: a1Context.strategyShort,
        a1_requirement: a1Context.requirement,
      })
      setLog(res.result.log)
      const inv = (res.state as { inventory?: Record<string, unknown> } | undefined)?.inventory
      const architecture = (inv?.architecture || {}) as Record<string, unknown>
      if (Array.isArray(architecture.design_choices)) {
        setDesignChoices(architecture.design_choices as DesignChoice[])
      } else if (brief?.design_choices?.length) {
        setDesignChoices(brief.design_choices)
      }
      if (Array.isArray(architecture.contracts_generated)) {
        setContractsGenerated(architecture.contracts_generated as ContractMetric[])
      } else if (brief?.contracts_generated?.length) {
        setContractsGenerated(brief.contracts_generated)
      }
      if (architecture.previous_architecture && typeof architecture.previous_architecture === 'object') {
        setPreviousArch(architecture.previous_architecture as PreviousArchitecture)
      } else if (brief?.previous_architecture) {
        setPreviousArch(brief.previous_architecture)
      }
      if (Array.isArray(architecture.comparison_deltas)) {
        setDeltas(architecture.comparison_deltas as ComparisonDelta[])
      } else if (brief?.comparison_deltas?.length) {
        setDeltas(brief.comparison_deltas)
      }
      if (typeof architecture.result_headline === 'string') setResultHeadline(architecture.result_headline)
      else setResultHeadline(brief?.result_headline || '')
      if (typeof architecture.result_body === 'string') setResultBody(architecture.result_body)
      else setResultBody(brief?.result_body || '')
      setRunComplete(true)
      onResults({
        log: res.result.log,
        synthesis: null,
        projectName: a1Context.projectName !== '—' ? a1Context.projectName : '',
        status: 'A10 complete — target design ready',
        glossary: brief?.glossary,
        glossaryStatus: brief?.context_line,
        evidenceItems: (res.result.artifacts?.length
          ? res.result.artifacts
          : ['contracts/openapi.yaml', 'contracts/asyncapi.yaml', 'adr/0002-comms.md']
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
        status: 'A10 failed',
      })
    } finally {
      setBusy(false)
    }
  }

  const title = brief?.title || 'Target Architecture'
  const lede =
    brief?.lede || 'Designs the new architecture — how the small services will talk to each other.'
  const formHeading = brief?.form_heading || 'Set the communication style'
  const kicker = brief?.domain_kicker || 'Domain D · Design & build the new · Step A10'
  const shownChoices = designChoices.length ? designChoices : brief?.design_choices || []
  const shownContracts = contractsGenerated.length
    ? contractsGenerated
    : brief?.contracts_generated || []
  const shownPrevious = previousArch || brief?.previous_architecture || null
  const services = brief?.service_names || []
  const prevMetrics = shownPrevious?.estate_metrics || []

  const cleanedPrevBody = useMemo(() => {
    const raw = shownPrevious?.body || ''
    if (!raw) {
      return `Derived from discovery — the ${a1Context.categoryName} estate still runs as a tightly coupled legacy system without explicit service contracts.`
    }
    const reqLower = (a1Context.requirement || '').toLowerCase()
    const projLower = (a1Context.projectName || '').toLowerCase()
    const catLower = (a1Context.categoryName || '').toLowerCase()
    const isCobolMentioned = reqLower.includes('cobol') || projLower.includes('cobol') || catLower.includes('cobol')
    if (!isCobolMentioned && raw.toLowerCase().includes('cobol')) {
      const targetLang = reqLower.includes('fortran') || projLower.includes('fortran')
        ? 'Fortran'
        : reqLower.includes('java') || projLower.includes('java')
        ? 'Java'
        : 'legacy'
      return raw.replace(/\bCOBOL\b/gi, targetLang)
    }
    return raw
  }, [shownPrevious?.body, a1Context])

  const cleanedPrevTraits = useMemo(() => {
    const rawTraits = shownPrevious?.design_traits || []
    const reqLower = (a1Context.requirement || '').toLowerCase()
    const projLower = (a1Context.projectName || '').toLowerCase()
    const catLower = (a1Context.categoryName || '').toLowerCase()
    const isCobolMentioned = reqLower.includes('cobol') || projLower.includes('cobol') || catLower.includes('cobol')
    const activeLang = reqLower.includes('fortran') || projLower.includes('fortran') || catLower.includes('fortran')
      ? 'Fortran'
      : reqLower.includes('java') || projLower.includes('java') || catLower.includes('java')
      ? 'Java'
      : 'Legacy'

    return rawTraits.map((t) => {
      let val = t.value || ''
      if (!isCobolMentioned && val.toLowerCase().includes('cobol')) {
        val = val.replace(/\bCOBOL\b/gi, activeLang)
      }
      if (!isCobolMentioned && val.toLowerCase().includes('copybook')) {
        val = val.replace(/\bcopybooks\b/gi, 'schemas').replace(/\bcopybook\b/gi, 'schema')
      }
      return { ...t, value: val }
    })
  }, [shownPrevious?.design_traits, a1Context])

  const cleanedDeltas = useMemo(() => {
    const rawDeltas = deltas.length ? deltas : brief?.comparison_deltas || []
    const reqLower = (a1Context.requirement || '').toLowerCase()
    const projLower = (a1Context.projectName || '').toLowerCase()
    const catLower = (a1Context.categoryName || '').toLowerCase()
    const isCobolMentioned = reqLower.includes('cobol') || projLower.includes('cobol') || catLower.includes('cobol')
    const activeLang = reqLower.includes('fortran') || projLower.includes('fortran') || catLower.includes('fortran')
      ? 'Fortran'
      : reqLower.includes('java') || projLower.includes('java') || catLower.includes('java')
      ? 'Java'
      : 'Legacy'

    return rawDeltas.map((d) => {
      let frm = d.from || ''
      let to = d.to || ''
      if (!isCobolMentioned && frm.toLowerCase().includes('cobol')) {
        frm = frm.replace(/\bCOBOL\b/gi, activeLang)
      }
      if (!isCobolMentioned && frm.toLowerCase().includes('copybook')) {
        frm = frm.replace(/\bcopybooks\b/gi, 'schemas').replace(/\bcopybook\b/gi, 'schema')
      }
      return { ...d, from: frm, to }
    })
  }, [deltas, brief?.comparison_deltas, a1Context])

  return (
    <div className="a10-step a7-step a1-wizard mf-req">
      <p className="dash-kicker">{kicker}</p>
      <h2 className="dash-title">{briefLoading ? 'Target Architecture' : title}</h2>
      <p className="dash-lede">
        {briefLoading
          ? 'Personalizing this step from your Factory Administrator (A1) context, path map, and A9 decomposition…'
          : lede}
      </p>

      <section className="a2-a1-context" aria-label="A1 path and A9 context">
        <div className="a2-a1-context-head">
          <h4>Domain Level Intake &amp; Context Matrix</h4>
          <span className="a2-a1-lock">Semantic continuity</span>
        </div>
        <p className="dash-sub a2-a1-intro">
          Design choices below stay close to the locked A1 combination, the active movement path, and
          the bounded contexts A9 proposed.
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
            <dd>
              {a1Context.requirement
                ? truncate(a1Context.requirement, 140)
                : a1Context.projectName}
            </dd>
          </div>
          <div>
            <dt>Map status</dt>
            <dd>
              {brief?.path_active_ids?.includes('A10')
                ? 'Active · on path'
                : brief?.path_active_ids?.length
                  ? 'Path loaded'
                  : '—'}
            </dd>
          </div>
          <div>
            <dt>Prior agent</dt>
            <dd>
              {brief?.prior_agent_id
                ? `${brief.prior_agent_id} · ${brief.prior_agent_name || ''}`
                : 'A9 · Domain decomposition'}
            </dd>
          </div>
          <div>
            <dt>A9 services</dt>
            <dd>{services.length ? services.join(' · ') : brief?.shape || 'Awaiting A9'}</dd>
          </div>
          {brief?.architecture_plan ? (
            <div className="a2-a1-span">
              <dt>Architecture plan</dt>
              <dd>{brief.architecture_plan}</dd>
            </div>
          ) : null}
          {brief?.prior_line ? (
            <div className="a2-a1-span">
              <dt>Continuity</dt>
              <dd>{brief.prior_line}</dd>
            </div>
          ) : null}
        </dl>
        {brief?.warning ? <p className="dash-sub a2-warn">{brief.warning}</p> : null}
      </section>

      {!runComplete ? (
        <>
          <h3 className="a4-form-heading">{formHeading}</h3>
          {brief?.comms_hint ? <p className="dash-sub">{brief.comms_hint}</p> : null}

          <section className="a4-form-card a6-form-card">
            <h4>{brief?.comms_label || 'How should the pieces talk to each other?'}</h4>
            <div className="a3-pills" role="radiogroup" aria-label="Communication style">
              {commsOpts.map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={`a3-pill${comms === id ? ' on' : ''}`}
                  aria-pressed={comms === id}
                  onClick={() => {
                    setComms(id)
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
            <h4>{brief?.depth_label || 'How deep should contracts go?'}</h4>
            <div className="a3-pills" role="radiogroup" aria-label="Contract depth">
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
                >
                  {label}
                </button>
              ))}
            </div>
          </section>

          {error && <p className="err">{error}</p>}

          <div className="dash-run-row a3-run-row">
            <button
              className="landing-start"
              type="button"
              disabled={!canRun || busy}
              onClick={() => void runAgent()}
            >
              {busy ? 'Designing…' : done ? '▶ Run this agent again' : '▶ Design target architecture'}
            </button>
            <button type="button" className="landing-ghost" disabled={busy} onClick={() => onContinueNext?.()}>
              Skip →
            </button>
            {!canRun && blockerHint ? <span className="dash-sub a2-blocker-hint">{blockerHint}</span> : null}
          </div>
        </>
      ) : null}

      {runComplete && (shownChoices.length > 0 || shownContracts.length > 0) ? (
        <section className="a10-results a5-results" aria-live="polite">
          <p className="a10-section-label">Architecture comparison</p>

          <div className="a10-compare-grid">
            <article className="a10-compare-col a10-compare-prev">
              <header className="a10-compare-head">
                <span className="a10-compare-badge prev">Previous</span>
                <h3>Previous architecture</h3>
              </header>
              <div className="a6-banner a7-banner a10-banner a10-banner-prev">
                <strong>{shownPrevious?.headline || 'As-is architecture captured.'}</strong>
                <p>{cleanedPrevBody}</p>
              </div>
              <div className="a5-panels a10-panels a10-panels-stack">
                <section className="a5-panel">
                  <h4>Design traits</h4>
                  <dl className="a5-metrics">
                    {cleanedPrevTraits.length ? (
                      cleanedPrevTraits.map((c) => (
                        <div key={`prev-${c.label}-${c.value}`}>
                          <dt>{c.label}</dt>
                          <dd>{c.value}</dd>
                        </div>
                      ))
                    ) : (
                      <div>
                        <dt>System shape</dt>
                        <dd>Legacy monolith (from prior agents)</dd>
                      </div>
                    )}
                  </dl>
                </section>
                <section className="a5-panel">
                  <h4>Estate metrics</h4>
                  <dl className="a5-metrics">
                    {prevMetrics.length ? (
                      prevMetrics.map((m) => (
                        <div key={`prev-m-${m.id || m.label}`}>
                          <dt>{m.label}</dt>
                          <dd>{formatMetric(m)}</dd>
                        </div>
                      ))
                    ) : (
                      <div>
                        <dt>Programs / modules</dt>
                        <dd>—</dd>
                      </div>
                    )}
                  </dl>
                </section>
              </div>
            </article>

            <article className="a10-compare-col a10-compare-target">
              <header className="a10-compare-head">
                <span className="a10-compare-badge target">Target</span>
                <h3>Target architecture</h3>
              </header>
              <div className="a6-banner a7-banner a10-banner">
                <strong>{resultHeadline || 'Target design ready.'}</strong>
                <p>
                  {resultBody ||
                    'Every new service now has a specification — how it talks to others, what data it owns, how it authenticates.'}
                </p>
              </div>
              <div className="a5-panels a10-panels a10-panels-stack">
                <section className="a5-panel">
                  <h4>Design choices</h4>
                  <dl className="a5-metrics">
                    {shownChoices.map((c) => (
                      <div key={`${c.label}-${c.value}`}>
                        <dt>{c.label}</dt>
                        <dd>{c.value}</dd>
                      </div>
                    ))}
                  </dl>
                </section>
                <section className="a5-panel">
                  <h4>Contracts generated</h4>
                  <dl className="a5-metrics">
                    {shownContracts.map((m) => (
                      <div key={m.id || m.label}>
                        <dt>{m.label}</dt>
                        <dd>{formatMetric(m)}</dd>
                      </div>
                    ))}
                  </dl>
                </section>
              </div>
            </article>
          </div>

          {cleanedDeltas.length ? (
            <section className="a10-deltas" aria-label="What changed">
              <h4>What changed</h4>
              <ul className="a10-delta-list">
                {cleanedDeltas.map((d) => (
                  <li key={`${d.aspect}-${d.from}-${d.to}`}>
                    <span className="a10-delta-aspect">{d.aspect}</span>
                    <span className="a10-delta-from">{d.from}</span>
                    <span className="a10-delta-arrow" aria-hidden>
                      →
                    </span>
                    <span className="a10-delta-to">{d.to}</span>
                    {d.change ? <span className="a10-delta-tag">{d.change}</span> : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <div className="dash-run-row a3-run-row a10-continue-row">
            <button type="button" className="landing-start" onClick={() => onContinueNext?.()}>
              {continueLabel || 'Continue to next step →'}
            </button>
            <span className="a10-complete-badge" aria-label="Step complete">
              ✓ Step complete
            </span>
            <button
              type="button"
              className="landing-ghost"
              disabled={busy}
              onClick={() => {
                setRunComplete(false)
              }}
            >
              Adjust & re-run
            </button>
          </div>

          {log.length ? (
            <ul className="dash-activity a2-result-log" aria-label="Agent activity log">
              {log.map((line, i) => (
                <li key={`${line[0]}-${i}`} data-level={line[0]}>
                  {line[1]}
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}
    </div>
  )
}
