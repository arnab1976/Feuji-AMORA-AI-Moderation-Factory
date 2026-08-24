import { useEffect, useMemo, useState } from 'react'
import { api, ApiError, type A10Brief, type LogLine } from '../api/client'
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

const FALLBACK_CHECKS: ChecklistItem[] = [
  { id: 'comms_ok', label: 'Confirm service communication style matches resilience requirements', required: true },
  { id: 'contracts_ok', label: 'Confirm API & event contract depth covers all bounded contexts', required: true },
  { id: 'infra_ok', label: 'Confirm target architecture aligns with enterprise cloud standards', required: true },
]

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
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [isEditingPage, setIsEditingPage] = useState(false)
  const [customArchPlan, setCustomArchPlan] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [runComplete, setRunComplete] = useState(false)
  const [log, setLog] = useState<LogLine[]>([])
  const [designChoices, setDesignChoices] = useState<DesignChoice[]>([])
  const [contractsGenerated, setContractsGenerated] = useState<ContractMetric[]>([])
  const [previousArch, setPreviousArch] = useState<PreviousArchitecture | null>(null)
  const [deltas, setDeltas] = useState<ComparisonDelta[]>([])

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

  const checklist: ChecklistItem[] = useMemo(() => {
    const briefChecklist = (brief as { checklist?: ChecklistItem[] } | null)?.checklist
    const source = briefChecklist?.length ? briefChecklist : FALLBACK_CHECKS
    return source.map((c: ChecklistItem) => ({
      id: c.id,
      label: c.label,
      required: true,
    }))
  }, [brief])

  const canRun = Boolean(comms) && Boolean(depth)

  function applySuggested() {
    const targetComms = brief?.suggested_comms || 'mixed'
    const targetDepth = brief?.suggested_depth || 'standard'
    setComms(targetComms)
    setDepth(targetDepth)
  }

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

  const shownChoices = designChoices.length ? designChoices : brief?.design_choices || []
  const shownContracts = contractsGenerated.length
    ? contractsGenerated
    : brief?.contracts_generated || []
  const shownPrevious = previousArch || brief?.previous_architecture || null
  const services = brief?.service_names || []

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
              {brief?.prior_agent_id ? `${brief.prior_agent_id} · ${brief.prior_agent_name || ''}` : 'A9 · Domain decomposition'}
            </span>
          </div>

          <div>
            <span style={{ display: 'block', fontSize: '9.5px', fontWeight: 900, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>
              A9 SERVICES
            </span>
            <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#38bdf8' }}>
              {services.length ? services.join(' · ') : brief?.shape || 'Awaiting A9'}
            </span>
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
              ARCHITECTURE PLAN
            </span>
            {isEditingPage ? (
              <textarea
                rows={2}
                value={customArchPlan}
                onChange={(e) => setCustomArchPlan(e.target.value)}
                style={{ width: '100%', background: '#0f172a', border: '1px solid #38bdf8', color: '#f8fafc', padding: '4px 6px', borderRadius: '4px', fontSize: '11.5px', fontFamily: 'inherit' }}
              />
            ) : (
              <span style={{ fontSize: '11.5px', fontWeight: 500, color: '#cbd5e1', lineHeight: '1.4' }}>
                {customArchPlan || brief?.architecture_plan || 'Designs the target microservices, containerization blueprints, and API contracts.'}
              </span>
            )}
          </div>
        </div>
      </section>

      {/* 2. VERIFICATION CHECKLIST */}
      <ChecklistPanel
        items={checklist}
        checked={checked}
        disabled={briefLoading || busy}
        title="OPTIONAL / MANDATORY VERIFICATION CHECKLIST"
        note="Checklist items combine standard controls with your A1 category, requirement, and strategy. Confirm each mandatory item before running target architecture."
        onToggle={(id, value) => setChecked((p) => ({ ...p, [id]: value }))}
      />

      {/* 3. EXECUTION CONTROLS & ARCHITECTURE LENS (Single rich compact card) */}
      <section className="a10-execution-card" style={{ padding: '10px 14px', background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.9))', border: '1px solid rgba(56, 189, 248, 0.35)', borderRadius: '8px', margin: '0 0 10px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <h4 style={{ fontSize: '13px', fontWeight: 900, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>
            ⚙️ EXECUTION CONTROLS &amp; ARCHITECTURE LENS
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
              {brief?.comms_label || 'How should the pieces talk to each other?'}
            </span>
            <div className="a3-pills" role="radiogroup" aria-label="Communication style" style={{ gap: '4px' }}>
              {commsOpts.map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={`a3-pill${comms === id ? ' on' : ''}`}
                  aria-pressed={comms === id}
                  onClick={() => {
                    setComms(id)
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
              {brief?.depth_label || 'How deep should contracts go?'}
            </span>
            <div className="a3-pills" role="radiogroup" aria-label="Contract depth" style={{ gap: '4px' }}>
              {depthOpts.map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={`a3-pill${depth === id ? ' on' : ''}`}
                  aria-pressed={depth === id}
                  onClick={() => {
                    setDepth(id)
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

      {error && <p className="err">{error}</p>}

      <div className="dash-run-row a3-run-row" style={{ marginBottom: '10px' }}>
        <button
          className="landing-start"
          type="button"
          disabled={!canRun || busy}
          onClick={() => void runAgent()}
          style={{ fontSize: '12.5px', fontWeight: 800, padding: '8px 16px' }}
        >
          {busy ? 'Designing…' : runComplete || done ? '▶ Run this agent again' : '▶ Design target architecture'}
        </button>
        {!canRun && blockerHint ? <span className="dash-sub a2-blocker-hint">{blockerHint}</span> : null}
      </div>

      {/* 4. RESULTS SECTION (Renders cleanly in-place below form controls once complete) */}
      {(runComplete || done) && (shownChoices.length > 0 || shownContracts.length > 0) ? (
        <section
          className="a5-results a10-results"
          aria-label="Target architecture results"
          style={{
            padding: '12px 14px',
            background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.9))',
            border: '1px solid rgba(56, 189, 248, 0.35)',
            borderRadius: '8px',
            marginTop: '10px',
          }}
        >
          {/* Output Card Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', paddingBottom: '6px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
            <h4 style={{ fontSize: '12.5px', fontWeight: 900, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>
              📊 TARGET ARCHITECTURE OUTPUT &amp; BLUEPRINT MATRIX
            </h4>
            <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', background: 'rgba(34, 197, 94, 0.15)', color: '#4ade80', border: '1px solid rgba(34, 197, 94, 0.3)' }}>
              ✓ Target Design Ready
            </span>
          </div>

          {/* Compact Contracts Summary Pills */}
          {shownContracts.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
              {shownContracts.map((m) => (
                <div key={m.id || m.label} style={{ fontSize: '10.5px', fontWeight: 700, padding: '3px 8px', background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(56, 189, 248, 0.25)', borderRadius: '4px', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ color: '#38bdf8', textTransform: 'uppercase', fontSize: '9px', fontWeight: 900 }}>{m.label}:</span>
                  <span>{formatMetric(m)}</span>
                </div>
              ))}
            </div>
          )}

          {/* Sleek Side-by-Side Architectural Matrix (Zero Clutter) */}
          <div style={{ background: 'rgba(15, 23, 42, 0.5)', borderRadius: '6px', border: '1px solid rgba(255, 255, 255, 0.08)', overflow: 'hidden', marginBottom: '10px' }}>
            {/* Header Row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.4fr 1.4fr', background: 'rgba(30, 41, 59, 0.8)', borderBottom: '1px solid rgba(56, 189, 248, 0.25)', padding: '6px 10px' }}>
              <span style={{ fontSize: '10px', fontWeight: 900, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>ARCHITECTURAL ASPECT</span>
              <span style={{ fontSize: '10px', fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>PREVIOUS MONOLITH (AS-IS)</span>
              <span style={{ fontSize: '10px', fontWeight: 900, color: '#4ade80', textTransform: 'uppercase', letterSpacing: '0.06em' }}>TARGET MICROSERVICES (TO-BE)</span>
            </div>

            {/* Comparison Rows */}
            {cleanedDeltas.length > 0 ? (
              cleanedDeltas.map((d, idx) => (
                <div
                  key={`${d.aspect}-${idx}`}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1.2fr 1.4fr 1.4fr',
                    padding: '6px 10px',
                    borderBottom: idx === cleanedDeltas.length - 1 ? 'none' : '1px solid rgba(255, 255, 255, 0.04)',
                    background: idx % 2 === 0 ? 'transparent' : 'rgba(255, 255, 255, 0.015)',
                    alignItems: 'center',
                    fontSize: '11px',
                  }}
                >
                  <strong style={{ color: '#cbd5e1', fontWeight: 700 }}>{d.aspect}</strong>
                  <span style={{ color: '#94a3b8' }}>{d.from}</span>
                  <span style={{ color: '#f8fafc', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ color: '#4ade80', fontSize: '9.5px' }}>→</span> {d.to}
                    {d.change ? <span style={{ fontSize: '9px', padding: '1px 5px', borderRadius: '3px', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8' }}>{d.change}</span> : null}
                  </span>
                </div>
              ))
            ) : (
              /* Fallback direct choices comparison */
              shownChoices.map((c, idx) => {
                const prevVal = cleanedPrevTraits[idx]?.value || 'Legacy monolith / tightly coupled'
                return (
                  <div
                    key={`${c.label}-${idx}`}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1.2fr 1.4fr 1.4fr',
                      padding: '6px 10px',
                      borderBottom: idx === shownChoices.length - 1 ? 'none' : '1px solid rgba(255, 255, 255, 0.04)',
                      background: idx % 2 === 0 ? 'transparent' : 'rgba(255, 255, 255, 0.015)',
                      alignItems: 'center',
                      fontSize: '11px',
                    }}
                  >
                    <strong style={{ color: '#cbd5e1', fontWeight: 700 }}>{c.label}</strong>
                    <span style={{ color: '#94a3b8' }}>{prevVal}</span>
                    <span style={{ color: '#f8fafc', fontWeight: 600 }}>
                      <span style={{ color: '#4ade80', fontSize: '9.5px', marginRight: '4px' }}>→</span> {c.value}
                    </span>
                  </div>
                )
              })
            )}
          </div>

          {/* Activity Log */}
          {log.length ? (
            <div style={{ background: 'rgba(15, 23, 42, 0.4)', padding: '6px 8px', borderRadius: '4px', border: '1px solid rgba(255, 255, 255, 0.04)', marginBottom: '10px' }}>
              <span style={{ display: 'block', fontSize: '9.5px', fontWeight: 900, color: '#38bdf8', textTransform: 'uppercase', marginBottom: '2px' }}>ACTIVITY LOG</span>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '1px' }}>
                {log.map((line, i) => (
                  <li key={`${line[0]}-${i}`} style={{ fontSize: '10px', fontFamily: 'monospace', color: line[0] === 'error' ? '#f87171' : line[0] === 'warn' ? '#facc15' : line[0] === 'ok' ? '#4ade80' : '#94a3b8' }}>
                    {line[1]}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {/* Explicit Next Agent Move Forward Button */}
          <div className="dash-run-row a3-run-row a10-continue-row" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {onContinueNext ? (
              <button type="button" className="landing-start" onClick={onContinueNext} style={{ fontSize: '12.5px', fontWeight: 800, padding: '8px 16px' }}>
                {continueLabel || '▶ Move Forward to G2: Architecture Approval Gate →'}
              </button>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  )
}
