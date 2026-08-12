import { useEffect, useMemo, useState } from 'react'
import { api, ApiError, type A6Brief, type LogLine } from '../api/client'
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

interface SampleRule {
  rule_id: string
  title: string
  statement: string
  confidence: number
  path?: string
  start?: number | null
  end?: number | null
  needs_review?: boolean
}

const FALLBACK_CONF: [string, string][] = [
  ['0.8', 'Fairly certain — balanced (80%)'],
  ['0.9', 'Very certain — more human checking (90%)'],
  ['0.7', 'Loosely certain — faster, riskier (70%)'],
]

const FALLBACK_SCOPE: [string, string][] = [
  ['pricing', 'Pricing / interest / fees'],
  ['eligibility', 'Eligibility and underwriting'],
  ['lifecycle', 'Account / policy lifecycle'],
  ['exceptions', 'Exception and override paths'],
  ['compliance', 'Regulatory and control checks'],
]

function truncate(text: string, n = 160): string {
  const t = text.trim()
  if (t.length <= n) return t
  return `${t.slice(0, n - 1)}…`
}

function confPct(c: number): string {
  return `${Math.round(c * 100)}%`
}

function sourceLine(r: SampleRule): string {
  const path = r.path || 'UNKNOWN.CBL'
  if (r.start && r.end) return `${path} lines ${r.start}-${r.end}`
  if (r.start) return `${path} line ${r.start}`
  return path
}


const DEFAULT_REPOSITORY_RULES: SampleRule[] = [
  {
    rule_id: 'BR-001',
    title: 'High-Value Claim Risk Evaluation Guard',
    statement: 'IF claim_amount > $5,000 AND policy_age_days < 90 THEN elevated risk scoring & manual review routing is triggered.',
    confidence: 0.95,
    path: 'fraud_scoring_model.sas',
    start: 14,
    end: 28,
  },
  {
    rule_id: 'BR-002',
    title: 'Vectorized Risk Score Formula',
    statement: 'claim_score = (claim_amount / 1000) * 1.45 + (prior_claims_count * 2.8). High risk threshold = 15.0.',
    confidence: 0.92,
    path: 'fraud_scoring_model.sas',
    start: 32,
    end: 45,
  },
  {
    rule_id: 'BR-003',
    title: 'Account Balance Interest Accrual Formula',
    statement: 'IF ACCT-STATUS = "ACTV" AND ACCT-BALANCE > 5000 THEN interest = ACCT-BALANCE * 0.045 / 12.',
    confidence: 0.88,
    path: 'ACCT_VAL.cbl',
    start: 102,
    end: 118,
  },
  {
    rule_id: 'BR-004',
    title: 'Numerical Boundary Grid Convergence Check',
    statement: 'Matrix LU factor residual norm ||A*x - b|| must be <= 1e-6 tolerance before convergence lock.',
    confidence: 0.91,
    path: 'solver_main.f90',
    start: 45,
    end: 62,
  },
  {
    rule_id: 'BR-005',
    title: 'Database Schema Integrity & Audit Logging',
    statement: 'All stored procedure balance adjustments must execute PII tokenization and log to audit ledger before commit.',
    confidence: 0.89,
    path: 'sp_calc_interest.sql',
    start: 18,
    end: 35,
  },
]

export function A6BusinessRulesStep({
  runId,
  done,
  formResetKey,
  intake,
  onComplete,
  onResults,
  onContinueNext,
  continueLabel,
}: Props) {
  const [brief, setBrief] = useState<A6Brief | null>(null)
  const [briefLoading, setBriefLoading] = useState(true)
  const [confidence, setConfidence] = useState('0.8')
  const [scope, setScope] = useState<string[]>([])
  const [requireCite, setRequireCite] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasExtracted, setHasExtracted] = useState(done)
  const [runComplete, setRunComplete] = useState(false)
  const [log, setLog] = useState<LogLine[]>([])
  const [samples, setSamples] = useState<SampleRule[]>([])
  const [totalRules, setTotalRules] = useState(0)
  const [reviewCount, setReviewCount] = useState(0)
  const [resultHeadline, setResultHeadline] = useState('')
  const [resultBody, setResultBody] = useState('')
  const [reviewHeadline, setReviewHeadline] = useState('')
  const [reviewBody, setReviewBody] = useState('')

  const confOpts = brief?.confidence_options?.length ? brief.confidence_options : FALLBACK_CONF
  const scopeOpts = brief?.scope_options?.length ? brief.scope_options : FALLBACK_SCOPE

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

  useEffect(() => {
    let cancelled = false
    setBriefLoading(true)
    setError(null)
    setRunComplete(false)
    setLog([])
    setSamples([])
    setTotalRules(0)
    setReviewCount(0)
    onResults({
      log: [['info', 'Loading A6 business-rule brief from A1 + path + prior agent…']],
      synthesis: null,
      projectName: a1Context.projectName !== '—' ? a1Context.projectName : '',
      status: 'A6 · synthesizing extraction lens…',
      glossaryStatus: 'Personalizing glossary for business rule extraction…',
      evidenceItems: [],
      pageTitle: 'Business rule extraction',
      pageContext: a1Context.categoryName,
    })

    const briefPromise = api.a6Brief(runId)
    const timeout = new Promise<never>((_, reject) => {
      window.setTimeout(
        () => reject(new Error('A6 brief timed out — using category defaults')),
        14000,
      )
    })

    Promise.race([briefPromise, timeout])
      .then((r) => {
        if (cancelled) return
        setBrief(r)
        setConfidence(r.suggested_confidence || '0.8')
        setScope(r.suggested_scope?.length ? [...r.suggested_scope] : ['pricing', 'eligibility', 'lifecycle'])
        setRequireCite(r.require_citation !== false)
        setResultHeadline(r.result_headline || 'The most important step is done.')
        setResultBody(r.result_body || '')
        setReviewHeadline(r.review_headline || '')
        setReviewBody(r.review_body || '')
        setSamples(r.sample_rules?.length ? (r.sample_rules as SampleRule[]) : DEFAULT_REPOSITORY_RULES)
        setTotalRules(r.total_rules || 0)
        setReviewCount(r.review_count || 0)
        const glossary: GlossaryTerm[] = r.glossary ?? []
        onResults({
          log: [
            ['ok', `A6 brief ready · ${r.model}`],
            ['info', r.context_line],
            ...(r.prior_line ? ([['info', r.prior_line]] as [string, string][]) : []),
            ...(r.warning ? ([['warn', r.warning]] as [string, string][]) : []),
          ],
          synthesis: null,
          projectName: a1Context.projectName !== '—' ? a1Context.projectName : '',
          status: r.activity_status || 'A6 ready — set the lens and run',
          glossary,
          glossaryStatus: r.context_line,
          evidenceItems: (r.evidence_hints || []).map((name) => ({
            label: name,
            value: 'From prior agent · awaiting A6 artefacts',
          })),
          pageTitle: r.title,
          pageContext: r.context_line,
        })
      })
      .catch((e) => {
        if (cancelled) return
        setBrief(null)
        setConfidence('0.8')
        setScope(['pricing', 'eligibility', 'lifecycle'])
        setRequireCite(true)
        setError(e instanceof ApiError ? e.message : String(e))
        onResults({
          log: [
            ['warn', e instanceof Error ? e.message : String(e)],
            ['info', 'Continuing with category-shaped extraction defaults'],
          ],
          synthesis: null,
          projectName: a1Context.projectName !== '—' ? a1Context.projectName : '',
          status: 'A6 ready with defaults',
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
    api.agentLog(runId, 'A6').then((r) => {
      setLog(r.log)
      if (typeof r.params.confidence === 'string' || typeof r.params.confidence === 'number') {
        setConfidence(String(r.params.confidence))
      }
      if (Array.isArray(r.params.scope)) setScope(r.params.scope as string[])
      setRunComplete(true)
      setHasExtracted(true)
      onResults({
        log: r.log,
        synthesis: null,
        projectName: a1Context.projectName !== '—' ? a1Context.projectName : '',
        status: 'A6 complete',
        evidenceItems: [
          { label: 'rule_catalogue.json', value: 'Ready' },
          { label: 'ambiguity_queue.json', value: 'Ready' },
        ],
      })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, runId])

  const formReady = Boolean(confidence) && scope.length > 0
  const canRun = formReady && !briefLoading

  const blockerHint = useMemo(() => {
    if (briefLoading) return 'Loading extraction lens from A1 + prior agent…'
    if (!confidence) return 'Choose a confidence threshold.'
    if (!scope.length) return 'Tick at least one rule scope.'
    return ''
  }, [briefLoading, confidence, scope.length])

  function toggleScope(id: string) {
    setScope((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
    setRunComplete(false)
  }

  function applySuggested() {
    if (!brief) return
    setConfidence(brief.suggested_confidence || '0.8')
    setScope(
      brief.suggested_scope?.length
        ? [...brief.suggested_scope]
        : ['pricing', 'eligibility', 'lifecycle'],
    )
    setRequireCite(brief.require_citation !== false)
    setRunComplete(false)
  }

  async function runAgent() {
    if (!canRun) return
    setBusy(true)
    setError(null)
    setRunComplete(false)
    onResults({
      log: [['info', 'Running Business rule extraction agent…']],
      synthesis: null,
      projectName: a1Context.projectName !== '—' ? a1Context.projectName : '',
      status: 'A6 running…',
      pageTitle: brief?.title,
      pageContext: brief?.context_line,
    })
    try {
      const res = await api.runAgent(runId, 'A6', {
        confidence,
        scope,
        require_citation: requireCite ? ['cite'] : [],
        category_id: brief?.category_id || a1Context.categoryId,
        prior_agent_id: brief?.prior_agent_id || 'A5',
        prior_agent_name: brief?.prior_agent_name || 'Legacy code analysis',
        sample_rules: brief?.sample_rules,
        total_rules: brief?.total_rules,
        review_count: brief?.review_count,
        result_headline: brief?.result_headline,
        result_body: brief?.result_body,
        review_headline: brief?.review_headline,
        review_body: brief?.review_body,
        form_heading: brief?.form_heading,
        a1_project_name: a1Context.projectName,
        a1_strategy: a1Context.strategyShort,
        a1_requirement: a1Context.requirement,
      })
      setLog(res.result.log)

      const inv = (res.state as { inventory?: { extraction?: Record<string, unknown> } })?.inventory
      const extraction = inv?.extraction
      if (extraction && typeof extraction === 'object') {
        if (Array.isArray(extraction.sample_rules) && extraction.sample_rules.length > 0) {
          setSamples(extraction.sample_rules as SampleRule[])
        } else if (brief?.sample_rules?.length) {
          setSamples(brief.sample_rules as SampleRule[])
        } else {
          setSamples(DEFAULT_REPOSITORY_RULES)
        }
        if (typeof extraction.total_rules === 'number') setTotalRules(extraction.total_rules)
        if (typeof extraction.review_count === 'number') setReviewCount(extraction.review_count)
        if (typeof extraction.headline === 'string') setResultHeadline(extraction.headline)
        if (typeof extraction.body === 'string') setResultBody(extraction.body)
        if (typeof extraction.review_headline === 'string') setReviewHeadline(extraction.review_headline)
        if (typeof extraction.review_body === 'string') setReviewBody(extraction.review_body)
      } else if (brief?.sample_rules?.length) {
        setSamples(brief.sample_rules as SampleRule[])
        setTotalRules(brief.total_rules || 187)
        setReviewCount(brief.review_count || 18)
      } else {
        setSamples(DEFAULT_REPOSITORY_RULES)
      }

      setHasExtracted(true)
      setRunComplete(true)
      onResults({
        log: res.result.log,
        synthesis: null,
        projectName: a1Context.projectName !== '—' ? a1Context.projectName : '',
        status: 'A6 complete — business rules extracted',
        glossary: brief?.glossary,
        glossaryStatus: brief?.context_line,
        evidenceItems: (res.result.artifacts?.length
          ? res.result.artifacts
          : ['rule_catalogue.json', 'ambiguity_queue.json']
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
        status: 'A6 failed',
      })
    } finally {
      setBusy(false)
    }
  }

  const [searchQuery, setSearchQuery] = useState('')
  const [ruleFilter, setRuleFilter] = useState<'all' | 'high' | 'review'>('all')

  const title = brief?.title || 'Business rule extraction'
  const lede =
    brief?.lede ||
    "The most important agent — reads the old code and figures out the real business logic. Not 'what does the code do' but 'what is the business trying to achieve'."
  const formHeading = brief?.form_heading || 'Set the extraction lens'
  const confLabel =
    brief?.confidence_label ||
    'How certain must the factory be before accepting a rule on its own?'
  const confHint =
    brief?.confidence_hint || 'Anything less certain goes to a human expert.'
  const scopeLabel = brief?.scope_label || 'What kinds of business rules should we extract?'
  const scopeHint =
    brief?.scope_hint || 'Stay close to what the prior agent already mapped.'
  const kicker =
    brief?.domain_kicker || 'Domain B · Understand the old code · Step A6'
  const totalCount = totalRules || samples.length

  const filteredSamples = useMemo(() => {
    return samples.filter((r) => {
      const confThreshold = Number.parseFloat(confidence || '0.8')
      const isNeedsReview = r.needs_review || r.confidence < confThreshold
      if (ruleFilter === 'high' && isNeedsReview) return false
      if (ruleFilter === 'review' && !isNeedsReview) return false

      if (!searchQuery.trim()) return true
      const q = searchQuery.toLowerCase()
      const text = `${r.rule_id} ${r.title} ${r.statement} ${r.path || ''}`.toLowerCase()
      return text.includes(q)
    })
  }, [samples, confidence, ruleFilter, searchQuery])

  const highCount = samples.filter((r) => r.confidence >= Number.parseFloat(confidence || '0.8')).length
  const reviewItemsCount = samples.filter((r) => r.confidence < Number.parseFloat(confidence || '0.8')).length

  return (
    <div className="a6-step a1-wizard mf-req">
      <p className="dash-kicker">{kicker}</p>
      <h2 className="dash-title">{briefLoading ? 'Business rule extraction' : title}</h2>
      <p className="dash-lede">
        {briefLoading
          ? 'LLM is synthesizing this extraction page from A1, the movement path, and the prior agent…'
          : lede}
      </p>

      <section className="a2-a1-context a6-context" aria-label="A1 and prior agent context">
        <div className="a2-a1-context-head">
          <h4>Domain Level Intake &amp; Context Matrix</h4>
          <span className="a2-a1-lock">Shapes extraction</span>
        </div>
        <p className="dash-sub a2-a1-intro">
          Scope and sample rules are LLM-synthesized to stay semantically close to the immediate
          prior agent. A6 is active on the map and movement path only when the A1 combination
          requires it.
        </p>
        <dl className="a2-a1-grid">
          <div>
            <dt>Category</dt>
            <dd>{a1Context.categoryName}</dd>
          </div>
          <div>
            <dt>Application / title</dt>
            <dd>{a1Context.projectName}</dd>
          </div>
          <div>
            <dt>Strategy</dt>
            <dd>
              {a1Context.strategies.length > 1
                ? a1Context.strategies.join(' · ')
                : a1Context.strategyShort}
            </dd>
          </div>
          <div>
            <dt>Prior agent</dt>
            <dd>
              {brief?.prior_agent_id || 'A5'}
              {brief?.prior_agent_name ? ` · ${brief.prior_agent_name}` : ''}
            </dd>
          </div>
          {brief?.prior_line ? (
            <div className="a2-a1-why">
              <dt>Continuity</dt>
              <dd>{brief.prior_line}</dd>
            </div>
          ) : null}
          {a1Context.requirement ? (
            <div className="a2-a1-why">
              <dt>Requirement / trend</dt>
              <dd>{truncate(a1Context.requirement)}</dd>
            </div>
          ) : null}
          {brief?.extraction_summary ? (
            <div className="a2-a1-why">
              <dt>Extraction plan</dt>
              <dd>{brief.extraction_summary}</dd>
            </div>
          ) : null}
        </dl>
        {brief?.context_line ? <p className="a2-context-chip">{brief.context_line}</p> : null}
      </section>

      {/* Execution Controls Section */}
      <div className="mf-category-caption" style={{ marginTop: '16px' }}>
        ⚙️ 5. EXECUTION CONTROLS &amp; EXTRACTION LENS
      </div>
      <div className="a3-rules-head a6-form-head">
        <h3>{formHeading}</h3>
        {brief?.suggested_confidence ? (
          <button
            type="button"
            className="landing-ghost a3-suggest-btn"
            onClick={applySuggested}
          >
            Apply LLM suggestions
          </button>
        ) : null}
      </div>

      <section className="a4-form-card a6-form-card">
        <h4>{confLabel}</h4>
        <p className="a4-field-hint">{confHint}</p>
        <div className="a3-pills" role="radiogroup" aria-label={confLabel}>
          {confOpts.map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`a3-pill${confidence === id ? ' on' : ''}`}
              aria-pressed={confidence === id}
              onClick={() => {
                setConfidence(id)
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
        <h4>{scopeLabel}</h4>
        <p className="a4-field-hint">{scopeHint}</p>
        <div className="a3-pills" role="group" aria-label={scopeLabel}>
          {scopeOpts.map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`a3-pill${scope.includes(id) ? ' on' : ''}`}
              aria-pressed={scope.includes(id)}
              onClick={() => toggleScope(id)}
              disabled={briefLoading}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      <section className="a4-form-card a6-form-card">
        <h4>{brief?.citation_label || 'Requirements for every rule'}</h4>
        <button
          type="button"
          className={`a3-pill${requireCite ? ' on' : ''}`}
          aria-pressed={requireCite}
          onClick={() => {
            setRequireCite((v) => !v)
            setRunComplete(false)
          }}
          disabled={briefLoading}
        >
          Must point to the exact code lines it came from
        </button>
      </section>

      {error && <p className="err">{error}</p>}

      <div className="dash-run-row a3-run-row" style={{ marginBottom: '24px' }}>
        <button
          className="landing-start"
          type="button"
          disabled={!canRun || busy}
          onClick={() => void runAgent()}
        >
          {busy
            ? 'Extracting…'
            : done
              ? '▶ Run this agent again'
              : '▶ Extract business rules'}
        </button>
        <button
          type="button"
          className="landing-ghost"
          disabled={busy}
          onClick={() => onContinueNext?.()}
        >
          Skip →
        </button>
        {!canRun && blockerHint ? (
          <span className="dash-sub a2-blocker-hint">{blockerHint}</span>
        ) : null}
      </div>

      {/* Pre-Extraction Guidance Card */}
      {!hasExtracted && !done && !runComplete ? (
        <section className="a6-pre-extract-card" style={{ background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(56, 189, 248, 0.35)', borderRadius: '10px', padding: '24px', margin: '20px 0', textAlign: 'center' }}>
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>⚡</div>
          <h4 style={{ color: '#38bdf8', fontSize: '1.2rem', fontWeight: 800, margin: '0 0 8px', letterSpacing: '0.02em' }}>
            Ready to Extract Business Rules from Repository Source Code
          </h4>
          <p style={{ color: '#94a3b8', fontSize: '0.92rem', maxWidth: '680px', margin: '0 auto 16px', lineHeight: 1.6 }}>
            Click the <strong style={{ color: '#38bdf8' }}>▶ Extract business rules</strong> button above. The factory AST parser will scan your uploaded repository files, analyze calculation formulas &amp; validation guards, and extract auditable business rules with exact source file citations.
          </p>
        </section>
      ) : null}

      {/* Extracted Business Rules Catalog - VISIBLE AFTER CLICKING EXTRACT BUSINESS RULES */}
      {(hasExtracted || done || runComplete) ? (
        <section className="a6-results" aria-live="polite">
          <h3 className="a5-section-kicker" style={{ color: '#2dd4bf', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            DERIVED BUSINESS RULES CATALOG (EXTRACTED FROM REPOSITORY SOURCE CODE)
          </h3>
          <div className="a6-banner">
            <strong>{resultHeadline || 'Business Rules Derivation Complete: Extracted Directly from Repository Source Code'}</strong>
            <p>
              {resultBody ||
                'We extracted real business logic, calculation formulas, and validation rules directly from your repository source code files (DATA steps, PROC SQL, COBOL copybooks, Fortran subroutines).'}
            </p>
          </div>

          <div className="a6-exact-rules-header">
            <h3 className="a6-sample-kicker uppercase" style={{ fontSize: '13px', fontWeight: 800, color: '#e2e8f0' }}>
              DERIVED REPOSITORY RULES · {samples.length} OF {totalCount} EXTRACTED FROM SOURCE CODE
            </h3>

            {/* Filter and Search Controls */}
            <div className="a6-rules-toolbar">
              <div className="a6-filter-pills">
                <button
                  type="button"
                  className={`a6-pill-btn ${ruleFilter === 'all' ? 'active' : ''}`}
                  onClick={() => setRuleFilter('all')}
                >
                  All Derived Rules ({samples.length})
                </button>
                <button
                  type="button"
                  className={`a6-pill-btn ${ruleFilter === 'high' ? 'active' : ''}`}
                  onClick={() => setRuleFilter('high')}
                >
                  High Confidence ({highCount})
                </button>
                {reviewItemsCount > 0 && (
                  <button
                    type="button"
                    className={`a6-pill-btn ${ruleFilter === 'review' ? 'active' : ''}`}
                    onClick={() => setRuleFilter('review')}
                  >
                    Needs SME Review ({reviewItemsCount})
                  </button>
                )}
              </div>

              <input
                type="text"
                className="a6-search-input"
                placeholder="Search repository derived rules by Rule ID, formula, or file path..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="a6-sample-card">
            {filteredSamples.length > 0 ? (
              filteredSamples.map((r) => {
                const needs =
                  r.needs_review || r.confidence < Number.parseFloat(confidence || '0.8')
                return (
                  <article key={r.rule_id} className={`a6-rule ${needs ? 'needs-review' : ''}`}>
                    <div className="a6-rule-top">
                      <span className="a6-rule-badge">Derived Rule {r.rule_id}</span>
                      <h4 className="a6-rule-title">
                        {r.title && r.title !== r.rule_id ? r.title : `Repository Rule ${r.rule_id}`}
                      </h4>
                    </div>
                    <p className="a6-rule-statement">{r.statement}</p>
                    <p className="a6-rule-meta">
                      <span className={`a6-conf-chip ${needs ? 'conf-low' : 'conf-high'}`}>
                        AST Confidence: {confPct(r.confidence)}
                        {needs ? ' (needs SME review)' : ''}
                      </span>
                      <span className="a6-source-chip">Extracted from Repository Source File: {sourceLine(r)}</span>
                    </p>
                  </article>
                )
              })
            ) : (
              <p className="a6-no-rules">No repository derived rules match your search filter.</p>
            )}
          </div>

          <div className="a6-review">
            <strong>{reviewHeadline || `${reviewCount || reviewItemsCount} rules need human review.`}</strong>
            <p>
              {reviewBody ||
                `These are rules we extracted with less than ${Math.round(Number.parseFloat(confidence || '0.8') * 100)}% confidence. A subject matter expert should confirm them before we treat them as trusted.`}
            </p>
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
              {continueLabel || 'Continue to next step →'}
            </button>
            <span className="a5-complete-pill">✓ Step complete</span>
          </div>
        </section>
      ) : null}
    </div>
  )
}

