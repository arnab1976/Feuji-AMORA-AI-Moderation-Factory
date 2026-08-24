import { useEffect, useMemo, useRef, useState } from 'react'
import {
  api,
  ApiError,
  type IntakeCategory,
  type IntakeOption,
  type IntakeStrategyOption,
  type IntakeSynthesis,
  type LogLine,
} from '../api/client'

export interface GlossaryTerm {
  term: string
  def: string
}

export interface ActivityPayload {
  log: LogLine[]
  synthesis: IntakeSynthesis | null
  projectName: string
  status: string
  glossary?: GlossaryTerm[]
  glossaryStatus?: string
  evidenceItems?: { label: string; value: string }[]
  pageTitle?: string
  pageContext?: string
}

interface Props {
  runId: string
  done: boolean
  onComplete: () => Promise<void>
  onResults: (payload: ActivityPayload) => void
  onContinueNext?: () => void
  continueLabel?: string
  onPathMapIntake?: (intake: {
    category_id: string
    category_name?: string
    project_name: string
    requirement: string
    strategies: string[]
    strategy_short?: string
    why_modernize: string
    selections: { category_id: string; choice_id: string | null; custom_text: string | null }[]
  }) => void
}

type Mode = 'pick' | 'custom' | null

export function A1IntakeWizard({
  runId,
  done,
  onComplete,
  onResults,
  onContinueNext,
  continueLabel,
  onPathMapIntake,
}: Props) {
  const [categories, setCategories] = useState<IntakeCategory[]>([])
  const [selectedCatId, setSelectedCatId] = useState<string | null>(null)
  const [trends, setTrends] = useState<IntakeOption[]>([])
  const [trendsLoading, setTrendsLoading] = useState(false)
  const [mode, setMode] = useState<Mode>(null)
  const [choiceId, setChoiceId] = useState<string | null>(null)
  const [projectTitle, setProjectTitle] = useState('')
  const [strategies, setStrategies] = useState<IntakeStrategyOption[]>([])
  const [selectedStrategyIds, setSelectedStrategyIds] = useState<string[]>([])
  const [strategyNone, setStrategyNone] = useState(false)
  const [strategiesLoading, setStrategiesLoading] = useState(false)
  const [whyText, setWhyText] = useState('')
  const [whyLoading, setWhyLoading] = useState(false)
  const [synthesis, setSynthesis] = useState<IntakeSynthesis | null>(null)
  const [runComplete, setRunComplete] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [glossary, setGlossary] = useState<GlossaryTerm[]>([])
  const titleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const stratTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const glossTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const current = useMemo(
    () => categories.find((c) => c.id === selectedCatId) ?? null,
    [categories, selectedCatId],
  )

  const selectedTrendLabel = useMemo(() => {
    if (mode !== 'pick' || !choiceId) return ''
    return trends.find((t) => t.id === choiceId)?.label ?? ''
  }, [mode, choiceId, trends])

  const selectedStrategyLabels = useMemo(() => {
    if (strategyNone) {
      const custom = whyText.trim()
      return custom ? [custom] : []
    }
    return strategies.filter((s) => selectedStrategyIds.includes(s.id)).map((s) => s.label)
  }, [strategyNone, whyText, strategies, selectedStrategyIds])

  function pushResults(partial: ActivityPayload) {
    onResults({
      ...partial,
      glossary: partial.glossary ?? glossary,
      glossaryStatus: partial.glossaryStatus,
    })
  }

  function loadGlossary(opts: {
    categoryId: string
    focus?: string
    trendOptions?: string[]
    strategyLabels?: string[]
    projectName?: string
    log?: LogLine[]
    status?: string
  }) {
    if (glossTimer.current) clearTimeout(glossTimer.current)
    glossTimer.current = setTimeout(() => {
      onResults({
        log: opts.log ?? [['info', 'Refreshing plain-English glossary…']],
        synthesis: null,
        projectName: opts.projectName ?? '',
        status: opts.status ?? 'LLM drafting glossary…',
        glossary,
        glossaryStatus: 'Synthesizing…',
      })
      api.intakeGlossary(runId, {
        category_id: opts.categoryId,
        focus: opts.focus ?? '',
        trend_options: opts.trendOptions ?? [],
        strategies: opts.strategyLabels ?? [],
      })
        .then((r) => {
          setGlossary(r.terms)
          onResults({
            log: [['ok', `Glossary updated for ${opts.focus || 'this category'} · ${r.model}`]],
            synthesis: null,
            projectName: opts.projectName ?? '',
            status: opts.status ?? `Glossary ready · ${r.model}`,
            glossary: r.terms,
            glossaryStatus: opts.focus
              ? `Matched to: ${opts.focus.slice(0, 72)}`
              : 'Matched to selected category',
          })
        })
        .catch((e) => {
          setError(e instanceof ApiError ? e.message : String(e))
        })
    }, 280)
  }

  useEffect(() => {
    api.intakeCategories()
      .then((r) => {
        setCategories(r.categories)
        if (r.categories[0]) setSelectedCatId(r.categories[0].id)
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
  }, [])

  useEffect(() => {
    if (!selectedCatId) return
    let cancelled = false
    setTrendsLoading(true)
    setError(null)
    setMode(null)
    setChoiceId(null)
    setProjectTitle('')
    setStrategies([])
    setSelectedStrategyIds([])
    setStrategyNone(false)
    setWhyText('')
    setSynthesis(null)
    setRunComplete(false)
    setGlossary([])
    onResults({
      log: [],
      synthesis: null,
      projectName: '',
      status: 'Loading LLM trends…',
      glossary: [],
      glossaryStatus: 'Waiting for category trends…',
    })
    api.intakeTrends(runId, selectedCatId)
      .then((r) => {
        if (cancelled) return
        setTrends(r.options)
        const labels = r.options.map((o) => o.label)
        onResults({
          log: [
            ['ok', `Loaded ${r.options.length} trend requirements for ${r.name}`],
            ...(r.warning ? ([['warn', r.warning]] as [string, string][]) : []),
          ],
          synthesis: null,
          projectName: '',
          status: r.warning ? `Catalog trends · ${r.model}` : `Trends ready · ${r.model}`,
          glossary: [],
          glossaryStatus: 'Synthesizing glossary…',
        })
        return api.intakeGlossary(runId, {
          category_id: selectedCatId,
          focus: '',
          trend_options: labels,
        }).then((g) => {
          if (cancelled) return
          setGlossary(g.terms)
          onResults({
            log: [
              ['ok', `Loaded ${r.options.length} trend requirements for ${r.name}`],
              ...(r.warning ? ([['warn', r.warning]] as [string, string][]) : []),
              ['ok', `Glossary drafted for ${r.name}`],
              ...(g.warning ? ([['warn', g.warning]] as [string, string][]) : []),
            ],
            synthesis: null,
            projectName: '',
            status: `Trends + glossary ready · ${g.model}`,
            glossary: g.terms,
            glossaryStatus: `Matched to category · ${r.name}`,
          })
        })
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof ApiError ? e.message : String(e))
      })
      .finally(() => {
        if (!cancelled) setTrendsLoading(false)
      })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCatId, runId])

  function derivedTitleFromTrend(label: string): string {
    const cleaned = label.replace(/\s+/g, ' ').trim()
    if (cleaned.length <= 96) return cleaned
    return `${cleaned.slice(0, 93).replace(/\s+\S*$/, '')}…`
  }

  function loadStrategies(title: string, requirement = '') {
    if (!selectedCatId || title.trim().length < 3) return
    setStrategiesLoading(true)
    pushResults({
      log: [['info', `Synthesizing modernization strategies for «${title.trim()}»…`]],
      synthesis: null,
      projectName: title.trim(),
      status: 'LLM synthesizing strategies…',
    })
    api.intakeStrategies(runId, selectedCatId, title.trim(), requirement)
      .then((r) => {
        setStrategies(r.strategies)
        setSelectedStrategyIds([])
        setStrategyNone(false)
        setWhyText('')
        pushResults({
          log: [['ok', `Generated ${r.strategies.length} feasible strategies`]],
          synthesis: null,
          projectName: title.trim(),
          status: `Strategies ready · ${r.model}`,
        })
        loadGlossary({
          categoryId: selectedCatId,
          focus: requirement || title.trim(),
          trendOptions: trends.map((t) => t.label),
          projectName: title.trim(),
          status: `Strategies ready · ${r.model}`,
          log: [['ok', `Generated ${r.strategies.length} feasible strategies`]],
        })
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : String(e)))
      .finally(() => setStrategiesLoading(false))
  }

  function loadWhy(ids: string[], titleOverride?: string, requirementOverride?: string) {
    const title = (titleOverride ?? projectTitle).trim()
    if (!selectedCatId || !title || ids.length === 0) return
    const labels = strategies.filter((s) => ids.includes(s.id)).map((s) => s.label)
    const requirement = (
      requirementOverride
      || (mode === 'pick' ? selectedTrendLabel : '')
      || current?.summary
      || ''
    ).trim()
    setWhyLoading(true)
    pushResults({
      log: [['info', 'Drafting WHY MODERNIZE THIS SYSTEM?…']],
      synthesis: null,
      projectName: title,
      status: 'LLM drafting rationale…',
    })
    api.intakeWhy(runId, {
      category_id: selectedCatId,
      project_title: title,
      strategies: labels,
      requirement,
    })
      .then((r) => {
        setWhyText(r.why_modernize)
        pushResults({
          log: [['ok', 'Why-modernize narrative ready (editable)']],
          synthesis: null,
          projectName: title,
          status: `Rationale ready · ${r.model}`,
        })
        loadGlossary({
          categoryId: selectedCatId,
          focus: `${title} — ${r.why_modernize.slice(0, 120)}`,
          trendOptions: trends.map((t) => t.label),
          strategyLabels: labels,
          projectName: title,
          status: `Rationale ready · ${r.model}`,
          log: [['ok', 'Why-modernize narrative ready (editable)']],
        })
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : String(e)))
      .finally(() => setWhyLoading(false))
  }

  function onTitleChange(value: string) {
    setProjectTitle(value)
    setSynthesis(null)
    if (titleTimer.current) clearTimeout(titleTimer.current)
    const requirement = mode === 'pick' ? selectedTrendLabel : ''
    titleTimer.current = setTimeout(() => loadStrategies(value, requirement), 700)
  }

  function toggleStrategy(id: string) {
    setStrategyNone(false)
    setSelectedStrategyIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
      if (stratTimer.current) clearTimeout(stratTimer.current)
      if (next.length === 0) {
        setWhyText('')
        return next
      }
      stratTimer.current = setTimeout(() => loadWhy(next), 400)
      return next
    })
    setSynthesis(null)
  }

  function pickStrategyNone() {
    if (stratTimer.current) clearTimeout(stratTimer.current)
    setStrategyNone(true)
    setSelectedStrategyIds([])
    setWhyText('')
    setSynthesis(null)
    pushResults({
      log: [['info', 'None of these strategies — enter your own description manually']],
      synthesis: null,
      projectName: projectTitle.trim(),
      status: 'Awaiting custom strategy description',
    })
  }

  function pickTrend(id: string) {
    setMode('pick')
    setChoiceId(id)
    setStrategies([])
    setSelectedStrategyIds([])
    setStrategyNone(false)
    setWhyText('')
    setSynthesis(null)
    setRunComplete(false)
    const label = trends.find((t) => t.id === id)?.label ?? id
    const title = derivedTitleFromTrend(label)
    setProjectTitle(title)
    pushResults({
      log: [['ok', `Selected trend: ${label}`], ['info', 'Synthesizing project form fields…']],
      synthesis: null,
      projectName: title,
      status: 'Trend selected — synthesizing form…',
    })
    loadStrategies(title, label)
  }

  function pickNone() {
    setMode('custom')
    setChoiceId(null)
    setProjectTitle('')
    setStrategies([])
    setSelectedStrategyIds([])
    setStrategyNone(false)
    setWhyText('')
    setSynthesis(null)
    setRunComplete(false)
    pushResults({
      log: [['info', 'Custom path — enter project title']],
      synthesis: null,
      projectName: '',
      status: 'Awaiting project title',
    })
  }

  const showForm = mode === 'custom' || (mode === 'pick' && Boolean(choiceId))

  const canRun = useMemo(() => {
    if (!selectedCatId || !mode) return false
    if (mode === 'pick' && !choiceId) return false
    const hasStrategy = strategyNone || selectedStrategyIds.length > 0
    return (
      projectTitle.trim().length > 0
      && hasStrategy
      && whyText.trim().length > 0
    )
  }, [selectedCatId, mode, choiceId, projectTitle, strategyNone, selectedStrategyIds, whyText])

  async function runAgent() {
    if (!selectedCatId || !mode || !canRun) return
    setBusy(true)
    setError(null)
    setRunComplete(false)
    const name = projectTitle.trim()
    const description = whyText.trim()
    pushResults({
      log: [['info', 'Finalizing intake with LLM, then running Factory administrator…']],
      synthesis: null,
      projectName: name,
      status: 'Running agent…',
    })
    try {
      const selection =
        mode === 'custom'
          ? { category_id: selectedCatId, choice_id: null, custom_text: description }
          : {
              category_id: selectedCatId,
              choice_id: choiceId,
              custom_text: selectedTrendLabel || description,
            }

      const synth = await api.synthesizeIntake(runId, {
        project_name: name,
        description,
        why_modernize: description,
        strategies: selectedStrategyLabels,
        selections: [selection],
      })
      setSynthesis(synth)

      const strategyShort = strategyNone
        ? (description.length > 96 ? `${description.slice(0, 93)}…` : description)
        : synth.strategy_short

      const params = {
        app_id: 'polad',
        budget: '250',
        project_name: name,
        description,
        category_id: selectedCatId,
        selections: [selection],
        strategies: selectedStrategyLabels,
        strategy: strategyNone ? description : synth.strategy,
        strategy_short: strategyShort,
        business_reason: synth.business_reason,
        enriched_summary: synth.enriched_summary,
        enriched_categories: synth.enriched_categories,
        why_modernize: description,
        strategy_none: strategyNone,
      }
      const res = await api.runAgent(runId, 'A1', params)
      setRunComplete(true)
      onPathMapIntake?.({
        category_id: selectedCatId,
        category_name: current?.name,
        project_name: name,
        requirement: selection.custom_text || selectedTrendLabel || name,
        strategies: selectedStrategyLabels,
        strategy_short: strategyShort,
        why_modernize: description,
        selections: [selection],
      })
      onResults({
        log: res.result.log,
        synthesis: synth,
        projectName: name,
        status: 'Agent complete — results below and on the right',
        glossary,
        glossaryStatus: `Matched to: ${name.slice(0, 72)}`,
      })
      await onComplete()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e))
      setRunComplete(false)
      pushResults({
        log: [['error', e instanceof Error ? e.message : String(e)]],
        synthesis: null,
        projectName: projectTitle.trim() || selectedTrendLabel,
        status: 'Failed',
      })
    } finally {
      setBusy(false)
    }
  }

const STRATEGIC_IMPORTANCE_MAP: Record<string, string> = {
  legacy_source: "Primary Baseline: COBOL, Fortran, SAS, Assembler, PL/I, Java EE source files containing the foundational legacy logic.",
  target_state: "Strategic Destination: Cloud-native microservices, target frameworks, event-driven core specs, and architectural objectives.",
  database: "Data Architecture: DB2, Oracle, VSAM, SAS datasets, relational schemas, and data migration models.",
  business_docs: "Domain Rules: Business Requirement Documents (BRD), policy manuals, SOP runbooks, and DMN decision tables.",
  interfaces: "System Integration: IBM MQ, SOAP/REST APIs, CICS copybooks, batch files, and middleware contracts.",
  security: "Governance & Safeguards: OWASP, NIST, SOX, PCI-DSS, GDPR, PII tokenization, and RACF/IAM access policies.",
  transactions: "Equivalence Verification: Live transaction feeds, execution workloads, and production replay datasets.",
  tests: "Validation Safety Net: Test suites, characterization cases, regression scripts, and golden master harnesses.",
  build_deploy: "Delivery Pipeline: CI/CD pipelines, Docker/Kubernetes containers, Terraform IaC, and batch schedulers.",
  configuration: "Runtime Knobs: Config-as-code overlays, PARMLIB parameters, environment settings, and feature flags.",
  observability: "Telemetry & Signals: Splunk/ELK logs, OpenTelemetry traces, SMF/RMF metrics, and APM operational logs.",
  defects: "Historical Analytics: ServiceNow/JIRA defect logs, P1 incident bridges, change-fail history, and maintenance tickets.",
}

  return (
    <div className="a1-wizard mf-req">
      <h4 style={{ fontSize: '13px', fontWeight: 900, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 4px 0' }}>12-category intake · choose one category</h4>
      <p className="dash-sub">
        Select a category and a trend example (or None of these). Hover over any category to view its Strategic Modernization Importance tooltip.
      </p>

      <div className="dash-cat-nav" role="tablist">
        {categories.map((c) => {
          const importanceText = c.strategic_importance || STRATEGIC_IMPORTANCE_MAP[c.id] || c.summary
          return (
            <button
              key={c.id}
              type="button"
              className={`dash-cat-tab${c.id === selectedCatId ? ' on' : ''}`}
              title={`${c.name}\n\n💡 Strategic Modernization Importance:\n${importanceText}`}
              onClick={() => setSelectedCatId(c.id)}
            >
              {c.name}
            </button>
          )
        })}
      </div>

      {current && (
        <section className="dash-cat-panel">
          <h5 className="dash-cat-heading">{current.name}</h5>
          <div
            className="mf-strategic-importance-banner"
            style={{
              margin: '8px 0 12px 0',
              padding: '10px 14px',
              background: 'rgba(234, 179, 8, 0.12)',
              borderLeft: '4px solid #eab308',
              borderRadius: '6px',
              fontSize: '0.88rem',
              color: '#fef08a',
              lineHeight: '1.45',
            }}
          >
            <strong>💡 Strategic Modernization Importance:</strong>{' '}
            {current.strategic_importance || STRATEGIC_IMPORTANCE_MAP[current.id] || current.summary}
          </div>
          <p className="dash-sub">{current.summary}</p>
          <p className="dash-sub mf-example-hint">
            Top 5 include precise examples for this category (languages, databases, documents,
            platforms) so you can recognize your estate.
          </p>

          {trendsLoading ? (
            <p className="dash-empty">Synthesizing top 5 trend requirements with LLM…</p>
          ) : (
            <div className="a1-options">
              {trends.map((o) => (
                <label key={o.id} className={`a1-opt${mode === 'pick' && choiceId === o.id ? ' on' : ''}`}>
                  <input
                    type="radio"
                    name={`trend-${current.id}`}
                    checked={mode === 'pick' && choiceId === o.id}
                    onChange={() => pickTrend(o.id)}
                  />
                  <span>{o.label}</span>
                </label>
              ))}
              <label className={`a1-opt custom${mode === 'custom' ? ' on' : ''}`}>
                <input
                  type="radio"
                  name={`trend-${current.id}`}
                  checked={mode === 'custom'}
                  onChange={pickNone}
                />
                <span>None of these</span>
              </label>
            </div>
          )}

          {showForm && (
            <div className="a1-custom-fields">
              <div className="mf-category-caption" style={{ marginTop: '16px' }}>
                ⚙️ 4. EXECUTION CONTROLS &amp; STRATEGY SYNTHESIS
              </div>
              <div className="fld dash-fld">
                <label htmlFor="project-title">Project title</label>
                <input
                  id="project-title"
                  type="text"
                  placeholder="Enter project title"
                  value={projectTitle}
                  onChange={(e) => onTitleChange(e.target.value)}
                />
              </div>

              {projectTitle.trim().length >= 3 && (
                <div className="mf-strategy-block">
                  <h4>Modernization strategy</h4>
                  <p className="dash-sub">
                    LLM-generated, business-feasible options — select all that apply, or choose
                    None of these to write your own.
                  </p>
                  {strategiesLoading ? (
                    <p className="dash-empty">Synthesizing strategies…</p>
                  ) : (
                    <div className="a1-options">
                      {strategies.map((s) => (
                        <label
                          key={s.id}
                          className={`a1-opt${selectedStrategyIds.includes(s.id) ? ' on' : ''}`}
                        >
                          <input
                            type="checkbox"
                            checked={selectedStrategyIds.includes(s.id)}
                            onChange={() => toggleStrategy(s.id)}
                          />
                          <span>
                            {s.label}
                            {s.why && <small>{s.why}</small>}
                          </span>
                        </label>
                      ))}
                      <label className={`a1-opt custom${strategyNone ? ' on' : ''}`}>
                        <input
                          type="checkbox"
                          checked={strategyNone}
                          onChange={() => {
                            if (strategyNone) {
                              setStrategyNone(false)
                              setWhyText('')
                              setSynthesis(null)
                            } else {
                              pickStrategyNone()
                            }
                          }}
                        />
                        <span>
                          None of these
                          <small>Clear the description and write your own strategy manually.</small>
                        </span>
                      </label>
                    </div>
                  )}
                </div>
              )}

              {(strategyNone || selectedStrategyIds.length > 0) && (
                <div className="fld dash-fld">
                  <label htmlFor="why-modernize">Why modernize this system? / Description</label>
                  {whyLoading && !strategyNone ? (
                    <p className="dash-empty">Synthesizing rationale…</p>
                  ) : (
                    <textarea
                      id="why-modernize"
                      className="a1-custom"
                      rows={5}
                      value={whyText}
                      onChange={(e) => {
                        setWhyText(e.target.value)
                        setSynthesis(null)
                      }}
                      placeholder={
                        strategyNone
                          ? 'Describe your modernization strategy and why this system should modernize…'
                          : 'LLM draft appears here — you may edit before running the agent.'
                      }
                    />
                  )}
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {error && <p className="err">{error}</p>}

      <div className="dash-run-row">
        <button
          className="landing-start"
          type="button"
          disabled={!canRun || busy || trendsLoading || strategiesLoading || whyLoading}
          onClick={() => void runAgent()}
        >
          {busy ? 'Running…' : done || runComplete ? '▶ Run the agent again' : '▶ Run the agent'}
        </button>
        {!canRun && (
          <span className="dash-sub">
            {showForm
              ? strategyNone
                ? 'Write your own strategy description, then Run the agent.'
                : 'Enter title, select strategies (or None of these), and confirm the description.'
              : 'Select a trend example or None of these to continue.'}
          </span>
        )}
      </div>

      {runComplete && synthesis && (
        <section className="a1-just-did" aria-live="polite">
          <h4 className="a1-just-did-title">What we just did</h4>

          <div className="a1-success-banner">
            <strong>Run started successfully.</strong>
            <p>
              A unique ID has been assigned to this modernization job. All future evidence,
              decisions, and artefacts will be tied to it.
            </p>
          </div>

          <div className="a1-run-details">
            <h5>Run details</h5>
            <dl>
              <div>
                <dt>Run ID</dt>
                <dd>{runId}</dd>
              </div>
              <div>
                <dt>Application</dt>
                <dd>{projectTitle.trim() || synthesis.project_name || 'Modernization initiative'}</dd>
              </div>
              <div>
                <dt>Strategy chosen</dt>
                <dd>
                  {strategyNone
                    ? 'Custom strategy (user-written)'
                    : (synthesis.strategy_short
                      || selectedStrategyLabels[0]
                      || synthesis.strategy.slice(0, 72))}
                </dd>
              </div>
              <div>
                <dt>Estimated timeline</dt>
                <dd>{synthesis.estimated_timeline_weeks ?? 14} weeks</dd>
              </div>
              <div>
                <dt>Estimated cost</dt>
                <dd>
                  <span className="a1-cost-hi">
                    ${synthesis.estimated_cost_factory_k ?? 487}K
                  </span>
                  {' '}
                  <span className="a1-cost-vs">
                    (vs ${synthesis.estimated_cost_manual_m ?? 6.2}M manual)
                  </span>
                </dd>
              </div>
            </dl>
          </div>

          <div className="a1-just-did-actions">
            <button
              className="landing-start"
              type="button"
              onClick={() => onContinueNext?.()}
            >
              {continueLabel || 'Continue to next step →'}
            </button>
            <span className="a1-step-badge">✓ Step complete</span>
          </div>
        </section>
      )}
    </div>
  )
}
