import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  api,
  type AgentNode,
  type Domain,
  type GateNode,
  type PipelineNode,
  type RunNode,
} from '../api/client'
import { A1IntakeWizard, type ActivityPayload, type GlossaryTerm } from '../components/A1IntakeWizard'
import { A2PortfolioStep } from '../components/A2PortfolioStep'
import { A3GovernanceStep } from '../components/A3GovernanceStep'
import { A4RepositoryStep } from '../components/A4RepositoryStep'
import { A5LegacyAnalysisStep } from '../components/A5LegacyAnalysisStep'
import { A6BusinessRulesStep } from '../components/A6BusinessRulesStep'
import { A7DocumentationStep } from '../components/A7DocumentationStep'
import { A9DomainDecompositionStep } from '../components/A9DomainDecompositionStep'
import { A10TargetArchitectureStep } from '../components/A10TargetArchitectureStep'
import { A12CodeGenerationStep } from '../components/A12CodeGenerationStep'
import { A13IntegrationBridgesStep } from '../components/A13IntegrationBridgesStep'
import { A14TestGenerationStep } from '../components/A14TestGenerationStep'
import { A16SelfHealingStep } from '../components/A16SelfHealingStep'
import { A17EquivalenceCheckStep } from '../components/A17EquivalenceCheckStep'
import { A18SecurityReleaseStep } from '../components/A18SecurityReleaseStep'
import { AgentGateMapStep, type PathMapIntakeSnapshot } from '../components/AgentGateMapStep'
import { G0IntakeApprovalStep } from '../components/G0IntakeApprovalStep'
import { G1DiscoveryApprovalStep } from '../components/G1DiscoveryApprovalStep'
import { G2ArchitectureApprovalStep } from '../components/G2ArchitectureApprovalStep'
import { G3CodeApprovalStep } from '../components/G3CodeApprovalStep'
import { G4TestApprovalStep } from '../components/G4TestApprovalStep'
import { SemanticContinuityAuditHeader } from '../components/SemanticContinuityAuditHeader'
import { G5EquivalenceApprovalStep } from '../components/G5EquivalenceApprovalStep'
import { G6SecurityApprovalStep } from '../components/G6SecurityApprovalStep'
import { G7ReleaseApprovalStep } from '../components/G7ReleaseApprovalStep'
import { G8SwitchOffApprovalStep } from '../components/G8SwitchOffApprovalStep'
import { AgentHeaderBanner } from '../components/AgentHeaderBanner'
import { HumanGateStep } from '../components/HumanGateStep'
import { PipelineAgentStep } from '../components/PipelineAgentStep'
import { A11DataModernizationStep } from '../components/A11DataModernizationStep'
import { A15FailureTriageStep } from '../components/A15FailureTriageStep'
import { ExecutiveIterationHeader } from '../components/ExecutiveIterationHeader'
import { FinalShowcaseView } from './FinalShowcaseView'
import { AgentGateSynthesisView } from './AgentGateSynthesisView'

const DOMAIN_SHORT: Record<string, string> = {
  A: 'Factory setup',
  B: 'Discover the estate',
  C: 'Understand the old code',
  D: 'Design & build the new',
  E: 'Test & prove it works',
  F: 'Release safely',
}

const FALLBACK_GLOSSARY: GlossaryTerm[] = [
  { term: 'COBOL', def: 'A business language from the 1960s still running core banking and insurance systems.' },
  { term: 'Monolith', def: 'One large application where many features share the same codebase and deploy together.' },
  { term: 'Microservice', def: 'A smaller service with a clear boundary that can be built and released on its own.' },
  { term: 'Strangler pattern', def: 'Replace a legacy system piece by piece while the old system keeps running.' },
  { term: 'Human gate', def: 'A checkpoint where people must approve before the factory continues.' },
  { term: 'Equivalence', def: 'Proof the new system gives the same answers as the old one on real workloads.' },
]

interface Props {
  runId: string
  sequence: PipelineNode[]
  domains: Domain[]
  nodes: RunNode[]
  cursor: number
  runState: Record<string, unknown>
  onSelect: (index: number) => void
  onRefresh: () => Promise<void>
  onGateDecided: (rewoundTo: string | null) => void
  onHome: () => void
  counts: { agents: number; gates: number }
}

export function WorkspaceView({
  runId,
  sequence,
  domains,
  nodes,
  cursor,
  runState,
  onSelect,
  onRefresh,
  onGateDecided,
  onHome,
  counts,
}: Props) {
  const current = sequence[cursor]
  const doneCount = nodes.filter((n) => n.done).length
  const [formResetKey, setFormResetKey] = useState(0)
  const [expandedDomains, setExpandedDomains] = useState<Set<string>>(
    () => new Set(['A', 'B', 'C', 'D', 'E', 'F']),
  )

  const toggleDomainExpand = useCallback((domKey: string) => {
    setExpandedDomains((prev) => {
      const next = new Set(prev)
      if (next.has(domKey)) {
        next.delete(domKey)
      } else {
        next.add(domKey)
      }
      return next
    })
  }, [])
  const [showPathMap, setShowPathMap] = useState(false)
  const [showSynthesisView, setShowSynthesisView] = useState(false)
  const [showFinalShowcase, setShowFinalShowcase] = useState(false)
  const [pathMapIntake, setPathMapIntake] = useState<PathMapIntakeSnapshot | null>(null)
  const [vetoedIds, setVetoedIds] = useState<string[]>([])
  const [skippedIds, setSkippedIds] = useState<string[]>([])
  const [activity, setActivity] = useState<ActivityPayload>({
    log: [],
    synthesis: null,
    projectName: '',
    status: 'Waiting for the next agent…',
    glossary: FALLBACK_GLOSSARY,
    glossaryStatus: 'Select a category to personalize this glossary',
    evidenceItems: [],
    pageTitle: '',
    pageContext: '',
  })
  const [, setGateEvidence] = useState<
    Awaited<ReturnType<typeof api.gate>> | null
  >(null)
  const currentPipeRef = useRef<HTMLButtonElement>(null)
  const currentStepRef = useRef<HTMLLIElement>(null)

  const domainProgress = useMemo(() => {
    return domains.map((d) => {
      const idxs = sequence
        .map((s, i) => (s.domain === d.key ? i : -1))
        .filter((i) => i >= 0)
      const total = idxs.length
      const done = idxs.filter((i) => nodes[i]?.done).length
      const active = idxs.includes(cursor)
      const pct = total ? Math.round((done / total) * 100) : 0
      return { ...d, total, done, active, pct, short: DOMAIN_SHORT[d.key] ?? d.name }
    })
  }, [domains, sequence, nodes, cursor])

  const inventory = (runState.inventory as {
    intake?: Record<string, unknown>
    path_map?: {
      vetoed_ids?: string[]
      eligible_ids?: string[]
      active_ids?: string[]
      next_after_a1?: string
    }
  }) ?? {}
  const intake = inventory.intake
  const pathMapState = inventory.path_map

  // Rehydrate path-map skips after refresh / reload (stable string deps avoid loops).
  const pathSkipKey = [
    ...(pathMapState?.vetoed_ids || []),
    '|',
    ...(pathMapState?.eligible_ids || []),
    '|',
    ...(pathMapState?.active_ids || []),
  ].join(',')

  useEffect(() => {
    if (!pathMapState || !pathSkipKey) return
    const vetoed = pathMapState.vetoed_ids || []
    const eligible = pathMapState.eligible_ids || []
    const active = new Set(pathMapState.active_ids || [])
    const skipped = [...vetoed, ...eligible].filter((id) => !active.has(id))
    setVetoedIds((prev) => (prev.join(',') === vetoed.join(',') ? prev : vetoed))
    setSkippedIds((prev) => (prev.join(',') === skipped.join(',') ? prev : skipped))
  }, [pathSkipKey, pathMapState])

  const projectName =
    activity.projectName
    || (typeof intake?.project_name === 'string' ? intake.project_name : '')
    || (typeof runState.app_id === 'string' ? String(runState.app_id) : '')

  /** Ordered active path from Agent & gate map (A1 intake → path map). */
  const activePathIds = useMemo(() => {
    const fromMap = pathMapState?.active_ids
    if (fromMap?.length) {
      const order = new Map(sequence.map((s, i) => [s.id, i]))
      return [...fromMap].sort((a, b) => (order.get(a) ?? 999) - (order.get(b) ?? 999))
    }
    return []
  }, [pathMapState?.active_ids, sequence])

  const nextOnPath = useMemo(() => {
    const skip = new Set([...vetoedIds, ...skippedIds])
    for (let i = cursor + 1; i < sequence.length; i++) {
      const id = sequence[i].id
      if (skip.has(id)) continue
      if (activePathIds.length && !activePathIds.includes(id)) continue
      return sequence[i]
    }
    return null
  }, [cursor, sequence, vetoedIds, skippedIds, activePathIds])

  const continueLabel = useMemo(() => {
    if (current?.id === 'A1' && !activePathIds.length) {
      return '▶ Move Forward to Agent & Gate Map →'
    }
    if (nextOnPath) {
      return `▶ Move Forward to ${nextOnPath.id}: ${nextOnPath.name} →`
    }
    return '▶ Move Forward to Next Agent →'
  }, [current?.id, activePathIds.length, nextOnPath])

  const activeLegacyLang = useMemo(() => {
    const req = pathMapIntake?.requirement || intake?.requirement || ''
    const proj = pathMapIntake?.project_name || intake?.project_name || ''
    const strat = pathMapIntake?.strategy_short || intake?.strategy_short || ''
    const why = pathMapIntake?.why_modernize || intake?.why_modernize || ''
    const blob = `${proj} ${req} ${strat} ${why}`.toLowerCase()
    if (blob.includes('sas')) return 'SAS'
    if (blob.includes('fortran')) return 'Fortran'
    if (blob.includes('cobol')) return 'COBOL'
    if (blob.includes('pl/i') || blob.includes('pli')) return 'PL/I'
    if (blob.includes('java')) return 'Java'
    if (blob.includes('c#') || blob.includes('.net')) return '.NET'
    return 'Legacy'
  }, [pathMapIntake, intake])

  const doneOnPath = useMemo(() => {
    const set = new Set<string>()
    sequence.forEach((s, i) => {
      if (nodes[i]?.done) set.add(s.id)
    })
    return set
  }, [sequence, nodes])

  const pathTrail = (
    <div className="mf-path-bar" aria-label="Agent movement direction">
      <div className="dash-wrap mf-path-bar-inner">
        <span className="mf-path-bar-label">Agent path</span>
        {activePathIds.length ? (
          <>
            <nav className="mf-path-trail">
              {activePathIds.map((id, i) => {
                const here = current?.id === id
                const done = doneOnPath.has(id)
                const isGate = id.startsWith('G')
                return (
                  <span key={id} className="mf-path-seg">
                    {i > 0 ? (
                      <span className="mf-path-arrow" aria-hidden="true">
                        →
                      </span>
                    ) : null}
                    <span
                      className={`mf-path-node${here ? ' on' : ''}${done && !here ? ' done' : ''}${isGate ? ' gate' : ''}`}
                      title={sequence.find((s) => s.id === id)?.name || id}
                    >
                      {id}
                    </span>
                  </span>
                )
              })}
            </nav>
            {nextOnPath ? (
              <span className="mf-path-bar-next">
                Next · <b>{nextOnPath.id}</b>
              </span>
            ) : (
              <span className="mf-path-bar-next">Path complete</span>
            )}
          </>
        ) : (
          <span className="mf-path-bar-empty">
            Set after Factory Administrator + Agent &amp; gate map
            {current?.id ? (
              <>
                {' '}
                · now on{' '}
                <b className="mf-path-node on">{current.id}</b>
              </>
            ) : null}
          </span>
        )}
      </div>
    </div>
  )

  const onA1Results = useCallback((payload: ActivityPayload) => {
    setActivity((prev) => ({
      ...prev,
      ...payload,
      glossary: payload.glossary ?? prev.glossary,
      glossaryStatus: payload.glossaryStatus ?? prev.glossaryStatus,
      evidenceItems: payload.evidenceItems ?? prev.evidenceItems,
      pageTitle: payload.pageTitle ?? prev.pageTitle,
      pageContext: payload.pageContext ?? prev.pageContext,
      projectName: payload.projectName || prev.projectName,
    }))
  }, [])

  const resetWorkspaceForm = useCallback(() => {
    setFormResetKey((k) => k + 1)
    setGateEvidence(null)
    if (showPathMap) {
      setShowPathMap(false)
    }
    setActivity({
      log: [],
      synthesis: null,
      projectName: projectName || '',
      status: current?.id === 'A2'
        ? 'A2 form reset — reloading context from A1…'
        : 'Form reset — ready to continue on this step',
      glossary: FALLBACK_GLOSSARY,
      glossaryStatus: 'Select a category to personalize this glossary',
      evidenceItems: [],
      pageTitle: '',
      pageContext: '',
    })
  }, [current?.id, projectName, showPathMap])

  const advanceToNextOpen = useCallback(
    (fromIndex: number) => {
      const skip = new Set([...vetoedIds, ...skippedIds])
      for (let i = fromIndex + 1; i < sequence.length; i++) {
        if (skip.has(sequence[i].id)) continue
        if (nodes[i]?.unlocked || nodes[i]?.done || i === fromIndex + 1) {
          onSelect(i)
          return
        }
      }
      for (let i = fromIndex + 1; i < sequence.length; i++) {
        if (!skip.has(sequence[i].id)) {
          onSelect(i)
          return
        }
      }
      setShowFinalShowcase(false)
      setShowSynthesisView(true)
    },
    [vetoedIds, skippedIds, sequence, nodes, onSelect],
  )

  const goBackOneStep = useCallback(() => {
    const skip = new Set([...vetoedIds, ...skippedIds])
    for (let i = cursor - 1; i >= 0; i--) {
      if (skip.has(sequence[i].id)) continue
      onSelect(i)
      return
    }
    const a1 = sequence.findIndex((s) => s.id === 'A1')
    if (a1 >= 0) onSelect(a1)
  }, [cursor, vetoedIds, skippedIds, sequence, onSelect])

  const editIntake = useCallback(() => {
    setShowPathMap(false)
    const a1 = sequence.findIndex((s) => s.id === 'A1')
    if (a1 >= 0) onSelect(a1)
  }, [sequence, onSelect])

  const openPathMapAfterA1 = useCallback(() => {
    if (!pathMapIntake && intake) {
      const selections = (Array.isArray(intake.selections) ? intake.selections : []) as {
        category_id: string
        choice_id: string | null
        custom_text: string | null
      }[]
      const categoryId = String(
        intake.category_id
          || selections[0]?.category_id
          || '',
      )
      if (categoryId) {
        setPathMapIntake({
          category_id: categoryId,
          category_name: String(intake.category_name || ''),
          project_name: String(intake.project_name || projectName || ''),
          requirement: String(
            selections[0]?.custom_text
              || intake.requirement
              || '',
          ),
          strategies: Array.isArray(intake.strategies)
            ? (intake.strategies as string[]).map(String)
            : [],
          strategy_short: String(intake.strategy_short || ''),
          why_modernize: String(intake.why_modernize || intake.business_reason || ''),
          selections,
        })
      }
    }
    setShowPathMap(true)
    onA1Results({
      log: [['info', 'Opening agent & gate map from A1 intake…']],
      synthesis: null,
      projectName: projectName || '',
      status: 'Path map',
      pageTitle: 'Agent and gate map',
    })
  }, [onA1Results, projectName, pathMapIntake, intake])

  const continueFromPathMap = useCallback(
    (nextAgentId: string, vetoed: string[]) => {
      const eligible = pathMapState?.eligible_ids || []
      const active = new Set(pathMapState?.active_ids || [])
      const skipped = [...vetoed, ...eligible].filter((id) => !active.has(id))
      setVetoedIds(vetoed)
      setSkippedIds(skipped)
      setShowPathMap(false)
      void onRefresh().then(() => {
        const idx = sequence.findIndex((s) => s.id === nextAgentId)
        if (idx >= 0) {
          onSelect(idx)
          return
        }
        advanceToNextOpen(0)
      })
    },
    [sequence, onSelect, advanceToNextOpen, onRefresh, pathMapState],
  )

  const backToA1FromMap = useCallback(() => {
    setShowPathMap(false)
    const a1 = sequence.findIndex((s) => s.id === 'A1')
    if (a1 >= 0) onSelect(a1)
  }, [sequence, onSelect])

  useEffect(() => {
    const id = current?.kind === 'agent' ? current.id : null
    if (!id || !nodes[cursor]?.done || id === 'A1') return
    api.agentLog(runId, id).then((r) => {
      setActivity((prev) => ({
        ...prev,
        log: r.log,
        status: `${id} complete`,
      }))
    })
  }, [runId, current, cursor, nodes])

  useEffect(() => {
    if (current?.kind !== 'gate') {
      setGateEvidence(null)
      return
    }
    api.gate(runId, current.id).then(setGateEvidence).catch(() => setGateEvidence(null))
  }, [runId, current])

  useEffect(() => {
    if (current?.domain) {
      setExpandedDomains((prev) => {
        if (!prev.has(current.domain)) {
          const next = new Set(prev)
          next.add(current.domain)
          return next
        }
        return prev
      })
    }
    currentPipeRef.current?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' })
    currentStepRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [cursor, nodes, current?.domain])

  if (showPathMap) {
    return (
      <div className="mf-path-page-wrap">
        <AgentGateMapStep
          key={`path-map-${runId}-${formResetKey}-${pathMapIntake?.category_id || 'none'}`}
          runId={runId}
          intake={pathMapIntake}
          onContinue={continueFromPathMap}
          onResults={onA1Results}
          onHome={onHome}
          onBack={backToA1FromMap}
          onEdit={backToA1FromMap}
        />
      </div>
    )
  }

  return (
    <div className="dash mf-attractive">
      {/* Sticky Frozen Top Pane (Logo Header + Agent Movement Path) */}
      <div
        className="mf-sticky-top-freeze"
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 1000,
          background: 'rgba(6, 9, 17, 0.96)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderBottom: '1px solid rgba(56, 189, 248, 0.35)',
          boxShadow: '0 6px 24px rgba(0, 0, 0, 0.6)',
        }}
      >
        <header className="dash-top">
          <div className="dash-wrap dash-hr mf-top-hr">
            <div className="landing-logo">
              <span className="landing-mark amora-mark">A</span>
              <div>
                <strong>AMORA</strong>
                <p>AI Modernization Orchestration &amp; Rebuild Agents</p>
              </div>
            </div>

            <p className="mf-top-tagline">
              Live run · click through <b>{counts.agents}</b> AI agents ·{' '}
              <b>{counts.gates}</b> human approval gates · plain English throughout
            </p>

            <div className="dash-nav-btns">
              <button className="landing-ghost dash-top-btn" type="button" onClick={goBackOneStep}>
                ← Back
              </button>
              <button className="landing-ghost dash-top-btn" type="button" onClick={editIntake}>
                Edit intake
              </button>
              <button className="landing-ghost dash-top-btn" type="button" onClick={resetWorkspaceForm}>
                Reset
              </button>
              <button className="landing-start dash-top-btn" type="button" onClick={onHome}>
                Home
              </button>
            </div>
          </div>
        </header>
        {pathTrail}
        
        {/* Sticky Project Title Bar (Permanently Pinned Top Header) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 16px', background: 'rgba(15, 23, 42, 0.95)', borderTop: '1px solid rgba(56, 189, 248, 0.25)', fontSize: '11.5px' }}>
          <span style={{ fontWeight: 900, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>
            📁 PROJECT TITLE:
          </span>
          <span style={{ fontWeight: 700, color: '#f8fafc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {projectName || pathMapIntake?.project_name || (intake && typeof intake === 'object' && 'project_name' in intake ? String(intake.project_name) : '') || 'Implement GDPR-compliant data privacy protection controls in sensitive databases.'}
          </span>
          <span style={{ marginLeft: 'auto', fontSize: '10.5px', fontWeight: 800, color: '#10b981', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.35)', padding: '2px 8px', borderRadius: '4px', whiteSpace: 'nowrap' }}>
            {current?.id ? `${current.id} · ${current.name}` : 'AMORA Modernization'}
          </span>
        </div>
      </div>

      <div className="dash-wrap dash-shell" style={{ marginTop: '10px' }}>
        <div className="dash-grid mf-full-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 290px) 1fr', gap: '16px', alignItems: 'start' }}>
          
          {/* ---- LEFT PANEL SIDEBAR: SIX WORK DOMAINS ---- */}
          <aside className="dash-col dash-side mf-left-sidebar" style={{ display: 'flex', flexDirection: 'column', gap: '12px', position: 'sticky', top: '110px', maxHeight: 'calc(100vh - 125px)', overflowY: 'auto' }}>
            <div
              className="dash-card mf-domains-card-side"
              style={{
                padding: '14px',
                background: 'linear-gradient(165deg, rgba(17, 25, 37, 0.95), rgba(12, 18, 28, 0.95))',
                border: '1px solid rgba(234, 179, 8, 0.35)',
                borderRadius: '10px',
                boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h3 style={{ fontSize: '11px', fontWeight: 900, color: '#2dd4bf', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>
                  Six work domains
                </h3>
                <span style={{ fontSize: '10px', color: '#4ade80', fontWeight: 800, background: 'rgba(34, 197, 94, 0.15)', padding: '2px 6px', borderRadius: '4px' }}>
                  {doneCount}/{sequence.length} Steps
                </span>
              </div>

              <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {domainProgress.map((d) => {
                  const isExpanded = expandedDomains.has(d.key)
                  const domainSteps = sequence
                    .map((step, index) => ({ step, index }))
                    .filter(({ step }) => step.domain === d.key)

                  return (
                    <li key={d.key} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <button
                        type="button"
                        onClick={() => toggleDomainExpand(d.key)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          width: '100%',
                          padding: '8px 10px',
                          background: d.active ? 'rgba(234, 179, 8, 0.18)' : 'rgba(30, 41, 59, 0.6)',
                          border: d.active ? '1px solid #eab308' : '1px solid rgba(255,255,255,0.08)',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '11px', fontWeight: 900, color: '#eab308', background: 'rgba(234, 179, 8, 0.2)', width: '20px', height: '20px', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                            {d.key}
                          </span>
                          <span style={{ fontSize: '12px', fontWeight: 700, color: '#f8fafc' }}>{d.short}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '11px', color: d.done === d.total && d.total ? '#4ade80' : '#94a3b8', fontWeight: 800 }}>
                            {d.done}/{d.total} {d.done === d.total && d.total ? '✓' : ''}
                          </span>
                          <span style={{ fontSize: '10px', color: '#38bdf8' }}>
                            {isExpanded ? '▼' : '▶'}
                          </span>
                        </div>
                      </button>

                      {/* Cascaded List of Agents & Human Gates under this domain */}
                      {isExpanded && domainSteps.length > 0 && (
                        <ul style={{ listStyle: 'none', margin: '2px 0 6px 10px', padding: '0 0 0 8px', borderLeft: '2px solid rgba(56, 189, 248, 0.25)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {domainSteps.map(({ step, index }) => {
                            const isCurrentStep = index === cursor
                            const stepNode = nodes[index]
                            const isStepDone = Boolean(stepNode?.done)
                            const isGate = step.kind === 'gate'

                            return (
                              <li key={step.id} ref={isCurrentStep ? (currentStepRef as React.RefObject<HTMLLIElement>) : null}>
                                <button
                                  type="button"
                                  onClick={() => onSelect(index)}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    width: '100%',
                                    padding: '5px 8px',
                                    background: isCurrentStep
                                      ? 'rgba(56, 189, 248, 0.2)'
                                      : isStepDone
                                      ? 'rgba(34, 197, 94, 0.08)'
                                      : 'rgba(15, 23, 42, 0.45)',
                                    border: isCurrentStep
                                      ? '1px solid #38bdf8'
                                      : isStepDone
                                      ? '1px solid rgba(34, 197, 94, 0.3)'
                                      : '1px solid rgba(255, 255, 255, 0.05)',
                                    borderRadius: '5px',
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                    transition: 'all 0.15s ease',
                                    boxShadow: isCurrentStep ? '0 0 10px rgba(56, 189, 248, 0.25)' : 'none',
                                  }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden', minWidth: 0 }}>
                                    <span
                                      style={{
                                        fontSize: '10px',
                                        fontWeight: 900,
                                        color: isGate ? '#f472b6' : '#38bdf8',
                                        background: isGate ? 'rgba(244, 114, 182, 0.15)' : 'rgba(56, 189, 248, 0.15)',
                                        padding: '2px 5px',
                                        borderRadius: '3px',
                                        minWidth: '22px',
                                        textAlign: 'center',
                                      }}
                                    >
                                      {step.id}
                                    </span>
                                    <span
                                      style={{
                                        fontSize: '11px',
                                        fontWeight: isCurrentStep ? 700 : 500,
                                        color: isCurrentStep ? '#38bdf8' : isStepDone ? '#cbd5e1' : '#94a3b8',
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                      }}
                                      title={step.name}
                                    >
                                      {step.name}
                                    </span>
                                  </div>

                                  {isCurrentStep ? (
                                    <span style={{ fontSize: '9px', fontWeight: 900, color: '#38bdf8', background: 'rgba(56, 189, 248, 0.25)', padding: '1px 5px', borderRadius: '3px', flexShrink: 0 }}>
                                      ACTIVE
                                    </span>
                                  ) : isStepDone ? (
                                    <span style={{ fontSize: '10px', fontWeight: 800, color: '#4ade80', flexShrink: 0 }}>
                                      ✓
                                    </span>
                                  ) : isGate ? (
                                    <span style={{ fontSize: '9px', fontWeight: 700, color: '#f472b6', flexShrink: 0 }}>
                                      GATE
                                    </span>
                                  ) : null}
                                </button>
                              </li>
                            )
                          })}
                        </ul>
                      )}
                    </li>
                  )
                })}
              </ol>
            </div>
          </aside>

          {/* ---- MAIN WORKSPACE AREA ---- */}
          {showSynthesisView ? (
            <div style={{ width: '100%' }}>
              <AgentGateSynthesisView
                projectName={String(pathMapIntake?.project_name || (typeof intake?.project_name === 'string' ? intake.project_name : '') || projectName || 'Modernization Initiative')}
                requirement={String(pathMapIntake?.requirement || (typeof intake?.requirement === 'string' ? intake.requirement : '') || '')}
                strategyShort={String(pathMapIntake?.strategy_short || (typeof intake?.strategy_short === 'string' ? intake.strategy_short : '') || '')}
                activeLegacyLang={activeLegacyLang}
                intakeCategory={String(pathMapIntake?.category_id || (typeof intake?.category_id === 'string' ? intake.category_id : '') || '')}
                runState={runState}
                nodes={nodes}
                sequence={sequence}
                activePathIds={activePathIds}
                vetoedIds={vetoedIds}
                skippedIds={skippedIds}
                counts={counts}
                onBackToWorkspace={() => setShowSynthesisView(false)}
                onProceedToFinalShowcase={() => {
                  setShowSynthesisView(false)
                  setShowFinalShowcase(true)
                }}
                onResetIntake={resetWorkspaceForm}
              />
            </div>
          ) : showFinalShowcase ? (
            <div style={{ width: '100%' }}>
              <FinalShowcaseView
                projectName={String(pathMapIntake?.project_name || (typeof intake?.project_name === 'string' ? intake.project_name : '') || projectName || 'Modernization Initiative')}
                requirement={String(pathMapIntake?.requirement || (typeof intake?.requirement === 'string' ? intake.requirement : '') || '')}
                strategyShort={String(pathMapIntake?.strategy_short || (typeof intake?.strategy_short === 'string' ? intake.strategy_short : '') || '')}
                activeLegacyLang={activeLegacyLang}
                intakeCategory={String(pathMapIntake?.category_id || (typeof intake?.category_id === 'string' ? intake.category_id : '') || '')}
                runState={runState}
                nodes={nodes}
                sequence={sequence}
                activePathIds={activePathIds}
                vetoedIds={vetoedIds}
                skippedIds={skippedIds}
                counts={counts}
                onBackToWorkspace={() => setShowFinalShowcase(false)}
                onViewSynthesis={() => {
                  setShowFinalShowcase(false)
                  setShowSynthesisView(true)
                }}
                onResetIntake={resetWorkspaceForm}
              />
            </div>
          ) : (
            <main className="dash-col dash-main mf-full-width-main" style={{ width: '100%', minWidth: 0 }}>
              <AgentHeaderBanner
                agentId={current?.id || ''}
                customTitle={current?.name || ''}
                contextTag={DOMAIN_SHORT[current?.domain || ''] ?? current?.domain}
              />
              {current?.id !== 'A1' && (
                <SemanticContinuityAuditHeader
                  currentStepId={current?.id || ''}
                  currentStepName={current?.name || ''}
                  priorStepId={cursor > 0 ? sequence[cursor - 1]?.id : 'A1'}
                  priorStepName={cursor > 0 ? sequence[cursor - 1]?.name : 'Factory Administrator'}
                  activeLegacyLang={activeLegacyLang}
                  intakeRequirement={String(pathMapIntake?.requirement || (typeof intake?.requirement === 'string' ? intake.requirement : '') || '')}
                />
              )}
              
              {/* Executive Iteration Output & Strategy Benefit Banner for Every Step */}
              <ExecutiveIterationHeader
                stepId={current?.id || ''}
                stepName={current?.name || ''}
                activeLegacyLang={activeLegacyLang}
                projectName={projectName || pathMapIntake?.project_name}
                intakeRequirement={pathMapIntake?.requirement}
                isDone={Boolean(nodes[cursor]?.done)}
              />

              <section className="dash-card dash-step-card mf-main-card">
              {current?.kind === 'agent' ? (
                <AgentStep
                  key={`${current.id}-${formResetKey}`}
                  runId={runId}
                  agent={current as AgentNode}
                  domainLabel={DOMAIN_SHORT[current.domain] ?? current.domain}
                  done={Boolean(nodes[cursor]?.done)}
                  formResetKey={formResetKey}
                  pathMapIntake={pathMapIntake}
                  onPathMapIntake={setPathMapIntake}
                  onComplete={async () => {
                    await onRefresh()
                  }}
                  onA1Results={onA1Results}
                  continueLabel={continueLabel}
                  onContinueNext={() => {
                    if (current?.id === 'A1') {
                      openPathMapAfterA1()
                      return
                    }
                    void onRefresh().then(() => advanceToNextOpen(cursor))
                  }}
                  onHome={onHome}
                  onBack={goBackOneStep}
                  onEdit={editIntake}
                />
              ) : current?.kind === 'gate' && current.id === 'G0' ? (
                <G0IntakeApprovalStep
                  key={`g0-${current.id}-${formResetKey}`}
                  runId={runId}
                  gate={current as GateNode}
                  domainLabel={DOMAIN_SHORT[current.domain] ?? current.domain}
                  intake={pathMapIntake}
                  continueLabel={continueLabel}
                  onDecided={(rewound) => {
                    void onGateDecided(rewound)
                  }}
                  onEvidence={setGateEvidence}
                  onResults={onA1Results}
                  onContinueNext={() => {
                    void onRefresh().then(() => advanceToNextOpen(cursor))
                  }}
                />
              ) : current?.kind === 'gate' && current.id === 'G1' ? (
                <G1DiscoveryApprovalStep
                  key={`g1-${current.id}-${formResetKey}`}
                  runId={runId}
                  gate={current as GateNode}
                  domainLabel={DOMAIN_SHORT[current.domain] ?? current.domain}
                  intake={pathMapIntake}
                  continueLabel={continueLabel}
                  onDecided={(rewound) => {
                    void onGateDecided(rewound)
                  }}
                  onEvidence={setGateEvidence}
                  onResults={onA1Results}
                  onContinueNext={() => {
                    void onRefresh().then(() => advanceToNextOpen(cursor))
                  }}
                />
              ) : current?.kind === 'gate' && current.id === 'G2' ? (
                <G2ArchitectureApprovalStep
                  key={`g2-${current.id}-${formResetKey}`}
                  runId={runId}
                  gate={current as GateNode}
                  domainLabel={DOMAIN_SHORT[current.domain] ?? current.domain}
                  intake={pathMapIntake}
                  continueLabel={continueLabel}
                  onDecided={(rewound) => {
                    void onGateDecided(rewound)
                  }}
                  onEvidence={setGateEvidence}
                  onResults={onA1Results}
                  onContinueNext={() => {
                    void onRefresh().then(() => advanceToNextOpen(cursor))
                  }}
                />
              ) : current?.kind === 'gate' && current.id === 'G3' ? (
                <G3CodeApprovalStep
                  key={`g3-${current.id}-${formResetKey}`}
                  runId={runId}
                  gate={current as GateNode}
                  domainLabel={DOMAIN_SHORT[current.domain] ?? current.domain}
                  intake={pathMapIntake}
                  continueLabel={continueLabel}
                  onDecided={(rewound) => {
                    void onGateDecided(rewound)
                  }}
                  onEvidence={setGateEvidence}
                  onResults={onA1Results}
                  onContinueNext={() => {
                    void onRefresh().then(() => advanceToNextOpen(cursor))
                  }}
                />
              ) : current?.kind === 'gate' && current.id === 'G4' ? (
                <G4TestApprovalStep
                  key={`g4-${current.id}-${formResetKey}`}
                  runId={runId}
                  gate={current as GateNode}
                  domainLabel={DOMAIN_SHORT[current.domain] ?? current.domain}
                  intake={pathMapIntake}
                  continueLabel={continueLabel}
                  onDecided={(rewound) => {
                    void onGateDecided(rewound)
                  }}
                  onEvidence={setGateEvidence}
                  onResults={onA1Results}
                  onContinueNext={() => {
                    void onRefresh().then(() => advanceToNextOpen(cursor))
                  }}
                />
              ) : current?.kind === 'gate' && current.id === 'G5' ? (
                <G5EquivalenceApprovalStep
                  key={`g5-${current.id}-${formResetKey}`}
                  runId={runId}
                  gate={current as GateNode}
                  domainLabel={DOMAIN_SHORT[current.domain] ?? current.domain}
                  intake={pathMapIntake}
                  continueLabel={continueLabel}
                  onDecided={(rewound) => {
                    void onGateDecided(rewound)
                  }}
                  onEvidence={setGateEvidence}
                  onResults={onA1Results}
                  onContinueNext={() => {
                    void onRefresh().then(() => advanceToNextOpen(cursor))
                  }}
                />
              ) : current?.kind === 'gate' && current.id === 'G6' ? (
                <G6SecurityApprovalStep
                  key={`g6-${current.id}-${formResetKey}`}
                  runId={runId}
                  gate={current as GateNode}
                  domainLabel={DOMAIN_SHORT[current.domain] ?? current.domain}
                  intake={pathMapIntake}
                  continueLabel={continueLabel}
                  onDecided={(rewound) => {
                    void onGateDecided(rewound)
                  }}
                  onEvidence={setGateEvidence}
                  onResults={onA1Results}
                  onContinueNext={() => {
                    void onRefresh().then(() => advanceToNextOpen(cursor))
                  }}
                />
              ) : current?.kind === 'gate' && current.id === 'G7' ? (
                <G7ReleaseApprovalStep
                  key={`g7-${current.id}-${formResetKey}`}
                  runId={runId}
                  gate={current as GateNode}
                  domainLabel={DOMAIN_SHORT[current.domain] ?? current.domain}
                  intake={pathMapIntake}
                  continueLabel={continueLabel}
                  onDecided={(rewound) => {
                    void onGateDecided(rewound)
                  }}
                  onEvidence={setGateEvidence}
                  onResults={onA1Results}
                  onContinueNext={() => {
                    void onRefresh().then(() => advanceToNextOpen(cursor))
                  }}
                />
              ) : current?.kind === 'gate' && current.id === 'G8' ? (
                <G8SwitchOffApprovalStep
                  key={`g8-${current.id}-${formResetKey}`}
                  runId={runId}
                  gate={current as GateNode}
                  domainLabel={DOMAIN_SHORT[current.domain] ?? current.domain}
                  intake={pathMapIntake}
                  continueLabel={continueLabel}
                  onDecided={(rewound) => {
                    void onGateDecided(rewound)
                  }}
                  onEvidence={setGateEvidence}
                  onResults={onA1Results}
                  onContinueNext={() => {
                    void onRefresh().then(() => advanceToNextOpen(cursor))
                  }}
                />
              ) : current?.kind === 'gate' ? (
                <HumanGateStep
                  key={`gate-${current.id}-${formResetKey}`}
                  runId={runId}
                  gate={current as GateNode}
                  domainLabel={DOMAIN_SHORT[current.domain] ?? current.domain}
                  embedded
                  continueLabel={continueLabel}
                  onDecided={(rewound) => {
                    void onGateDecided(rewound)
                  }}
                  onEvidence={setGateEvidence}
                  onResults={onA1Results}
                  onHome={onHome}
                  onBack={goBackOneStep}
                  onEdit={editIntake}
                  onContinueNext={() => {
                    void onRefresh().then(() => advanceToNextOpen(cursor))
                  }}
                />
              ) : (
                <p className="dash-empty">Select an unlocked step to continue.</p>
              )}
            </section>
          </main>
          )}
        </div>
      </div>
    </div>
  )
}

function AgentStep({
  runId,
  agent,
  domainLabel,
  done,
  onComplete,
  onA1Results,
  onPathMapIntake,
  pathMapIntake,
  formResetKey,
  continueLabel,
  onContinueNext,
  onHome,
  onBack,
  onEdit,
}: {
  runId: string
  agent: AgentNode
  domainLabel: string
  done: boolean
  onComplete: () => Promise<void>
  onA1Results: (payload: ActivityPayload) => void
  onPathMapIntake?: (intake: PathMapIntakeSnapshot) => void
  pathMapIntake?: PathMapIntakeSnapshot | null
  formResetKey: number
  continueLabel?: string
  onContinueNext?: () => void
  onHome: () => void
  onBack: () => void
  onEdit: () => void
}) {
  return (
    <>
      {agent.id === 'A1' ? (
        <A1IntakeWizard
          key={`a1-${runId}-${formResetKey}`}
          runId={runId}
          done={done}
          onComplete={onComplete}
          onResults={onA1Results}
          continueLabel={continueLabel}
          onContinueNext={onContinueNext}
          onPathMapIntake={onPathMapIntake}
        />
      ) : agent.id === 'A2' ? (
        <A2PortfolioStep
          key={`a2-${runId}-${formResetKey}`}
          runId={runId}
          done={done}
          formResetKey={formResetKey}
          intake={pathMapIntake}
          onComplete={onComplete}
          onResults={onA1Results}
          continueLabel={continueLabel}
          onContinueNext={onContinueNext}
        />
      ) : agent.id === 'A3' ? (
        <A3GovernanceStep
          key={`a3-${runId}-${formResetKey}`}
          runId={runId}
          done={done}
          formResetKey={formResetKey}
          intake={pathMapIntake}
          onComplete={onComplete}
          onResults={onA1Results}
          continueLabel={continueLabel}
          onContinueNext={onContinueNext}
        />
      ) : agent.id === 'A4' ? (
        <A4RepositoryStep
          key={`a4-${runId}-${formResetKey}`}
          runId={runId}
          done={done}
          formResetKey={formResetKey}
          intake={pathMapIntake}
          onComplete={onComplete}
          onResults={onA1Results}
          continueLabel={continueLabel}
          onContinueNext={onContinueNext}
        />
      ) : agent.id === 'A5' ? (
        <A5LegacyAnalysisStep
          key={`a5-${runId}-${formResetKey}`}
          runId={runId}
          done={done}
          formResetKey={formResetKey}
          intake={pathMapIntake}
          onComplete={onComplete}
          onResults={onA1Results}
          continueLabel={continueLabel}
          onContinueNext={onContinueNext}
        />
      ) : agent.id === 'A6' ? (
        <A6BusinessRulesStep
          key={`a6-${runId}-${formResetKey}`}
          runId={runId}
          done={done}
          formResetKey={formResetKey}
          intake={pathMapIntake}
          onComplete={onComplete}
          onResults={onA1Results}
          continueLabel={continueLabel}
          onContinueNext={onContinueNext}
        />
      ) : agent.id === 'A7' ? (
        <A7DocumentationStep
          key={`a7-${runId}-${formResetKey}`}
          runId={runId}
          done={done}
          formResetKey={formResetKey}
          intake={pathMapIntake}
          onComplete={onComplete}
          onResults={onA1Results}
          continueLabel={continueLabel}
          onContinueNext={onContinueNext}
        />
      ) : agent.id === 'A9' ? (
        <A9DomainDecompositionStep
          key={`a9-${runId}-${formResetKey}`}
          runId={runId}
          done={done}
          formResetKey={formResetKey}
          intake={pathMapIntake}
          onComplete={onComplete}
          onResults={onA1Results}
          continueLabel={continueLabel}
          onContinueNext={onContinueNext}
        />
      ) : agent.id === 'A10' ? (
        <A10TargetArchitectureStep
          key={`a10-${runId}-${formResetKey}`}
          runId={runId}
          done={done}
          formResetKey={formResetKey}
          intake={pathMapIntake}
          onComplete={onComplete}
          onResults={onA1Results}
          continueLabel={continueLabel}
          onContinueNext={onContinueNext}
        />
      ) : agent.id === 'A11' ? (
        <A11DataModernizationStep
          key={`a11-${runId}-${formResetKey}`}
          runId={runId}
          done={done}
          formResetKey={formResetKey}
          intake={pathMapIntake}
          onComplete={onComplete}
          onResults={onA1Results}
          continueLabel={continueLabel}
          onContinueNext={onContinueNext}
        />
      ) : agent.id === 'A12' ? (
        <A12CodeGenerationStep
          key={`a12-${runId}-${formResetKey}`}
          runId={runId}
          done={done}
          formResetKey={formResetKey}
          intake={pathMapIntake}
          onComplete={onComplete}
          onResults={onA1Results}
          continueLabel={continueLabel}
          onContinueNext={onContinueNext}
        />
      ) : agent.id === 'A13' ? (
        <A13IntegrationBridgesStep
          key={`a13-${runId}-${formResetKey}`}
          runId={runId}
          done={done}
          formResetKey={formResetKey}
          intake={pathMapIntake}
          onComplete={onComplete}
          onResults={onA1Results}
          continueLabel={continueLabel}
          onContinueNext={onContinueNext}
        />
      ) : agent.id === 'A14' ? (
        <A14TestGenerationStep
          key={`a14-${runId}-${formResetKey}`}
          runId={runId}
          done={done}
          formResetKey={formResetKey}
          intake={pathMapIntake}
          onComplete={onComplete}
          onResults={onA1Results}
          continueLabel={continueLabel}
          onContinueNext={onContinueNext}
        />
      ) : agent.id === 'A15' ? (
        <A15FailureTriageStep
          key={`a15-${runId}-${formResetKey}`}
          runId={runId}
          done={done}
          formResetKey={formResetKey}
          intake={pathMapIntake}
          onComplete={onComplete}
          onResults={onA1Results}
          continueLabel={continueLabel}
          onContinueNext={onContinueNext}
        />
      ) : agent.id === 'A16' ? (
        <A16SelfHealingStep
          key={`a16-${runId}-${formResetKey}`}
          runId={runId}
          done={done}
          formResetKey={formResetKey}
          intake={pathMapIntake}
          onComplete={onComplete}
          onResults={onA1Results}
          continueLabel={continueLabel}
          onContinueNext={onContinueNext}
        />
      ) : agent.id === 'A17' ? (
        <A17EquivalenceCheckStep
          key={`a17-${runId}-${formResetKey}`}
          runId={runId}
          done={done}
          formResetKey={formResetKey}
          intake={pathMapIntake}
          onComplete={onComplete}
          onResults={onA1Results}
          continueLabel={continueLabel}
          onContinueNext={onContinueNext}
        />
      ) : agent.id === 'A18' ? (
        <A18SecurityReleaseStep
          key={`a18-${runId}-${formResetKey}`}
          runId={runId}
          done={done}
          formResetKey={formResetKey}
          intake={pathMapIntake}
          onComplete={onComplete}
          onResults={onA1Results}
          continueLabel={continueLabel}
          onContinueNext={onContinueNext}
        />
      ) : (
        <PipelineAgentStep
          key={`agent-${agent.id}-${formResetKey}`}
          runId={runId}
          agent={agent}
          domainLabel={domainLabel}
          done={done}
          embedded
          onComplete={onComplete}
          onResults={onA1Results}
          continueLabel={continueLabel}
          onContinueNext={() => onContinueNext?.()}
          onHome={onHome}
          onBack={onBack}
          onEdit={onEdit}
        />
      )}
    </>
  )
}
