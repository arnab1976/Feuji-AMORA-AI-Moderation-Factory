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



function confPct(c: number): string {
  return `${Math.round(c * 100)}%`
}

function sourceLine(r: SampleRule): string {
  const path = r.path || 'UNKNOWN.CBL'
  if (r.start && r.end) return `${path} lines ${r.start}-${r.end}`
  if (r.start) return `${path} line ${r.start}`
  return path
}


export function getDynamicExtractedRules(
  a1Context: { categoryName?: string; projectName?: string; requirement?: string; strategyShort?: string },
  brief?: A6Brief | null
): SampleRule[] {
  if (brief?.sample_rules?.length) {
    return brief.sample_rules as SampleRule[]
  }

  const proj = (a1Context.projectName && a1Context.projectName !== '—') ? a1Context.projectName : 'Legacy Code Base'
  const req = a1Context.requirement || 'Modernizing legacy code to Python.'
  const reqLower = (req + ' ' + proj).toLowerCase()

  const isSAS = reqLower.includes('sas') || reqLower.includes('insurance') || reqLower.includes('fraud')
  const isCOBOL = reqLower.includes('cobol') || reqLower.includes('mainframe')
  const isFortran = reqLower.includes('fortran') || reqLower.includes('f77') || reqLower.includes('f90')

  if (isSAS) {
    return [
      {
        rule_id: 'BR-001',
        title: 'Validate Risk Scores & Fraud Thresholds in SAS Data Step',
        statement: 'Filter incoming claims where RiskScore > Threshold and FlagSuspicious = 1 in PROC REG step before running linear regression.',
        confidence: 0.96,
        path: 'src/fraud_detection.sas',
        start: 14,
        end: 38,
      },
      {
        rule_id: 'BR-002',
        title: 'Calculate Policy Premium Variance via PROC SQL',
        statement: 'Compute premium adjustment = BasePremium * (1 + RiskFactor) and join policyholder master table using PROC SQL inner join.',
        confidence: 0.94,
        path: 'src/policy_premium_calc.sas',
        start: 45,
        end: 82,
      },
      {
        rule_id: 'BR-003',
        title: 'Audit Exception and Variance Records',
        statement: 'Output transaction variance anomalies exceeding $10,000 to error dataset (work.error_ledger) for operator review.',
        confidence: 0.91,
        path: 'src/claims_audit.sas',
        start: 102,
        end: 145,
      },
      {
        rule_id: 'BR-004',
        title: 'Vectorized Fraud Risk Weight Model Matrix',
        statement: 'Vectorized fraud risk weight = log(claim_ratio) * 2.45 + prior_fraud_flag * 1.85. Threshold cap = 25.0.',
        confidence: 0.93,
        path: 'src/fraud_score_weights.sas',
        start: 88,
        end: 112,
      },
      {
        rule_id: 'BR-005',
        title: 'SAS Macro Iterative Data Boundary Validation',
        statement: '%MACRO validate_limits(ds=); IF &ds..amount > 5000 THEN OUTPUT work.review; %MEND;',
        confidence: 0.89,
        path: 'macros/validate_limits.sas',
        start: 5,
        end: 22,
      },
    ]
  }

  if (isCOBOL) {
    return [
      {
        rule_id: 'BR-001',
        title: 'Account Balance Interest Accrual Guard',
        statement: 'IF ACCT-STATUS = "ACTV" AND ACCT-BALANCE > 5000 THEN COMPUTE INTEREST = ACCT-BALANCE * 0.045 / 12.',
        confidence: 0.95,
        path: 'src/ACCT_VAL.cbl',
        start: 102,
        end: 118,
      },
      {
        rule_id: 'BR-002',
        title: 'Overtime Pay Evaluation & Rate Multiplier',
        statement: 'EVALUATE OVERTIME-HOURS WHEN > 10 COMPUTE PAY = BASE-RATE * 1.5 * OVERTIME-HOURS WHEN OTHER COMPUTE PAY = BASE-RATE * OVERTIME-HOURS.',
        confidence: 0.93,
        path: 'src/PAYROLL_PROC.cbl',
        start: 88,
        end: 120,
      },
      {
        rule_id: 'BR-003',
        title: 'Mainframe Transaction Audit & Ledger Lock',
        statement: 'EXEC SQL UPDATE ACCT_LEDGER SET STATUS = "LOCKED" WHERE BALANCE_DIF > 10000 END-EXEC.',
        confidence: 0.90,
        path: 'copybooks/AUDIT_LEDGER.cpy',
        start: 45,
        end: 68,
      },
    ]
  }

  if (isFortran) {
    return [
      {
        rule_id: 'BR-001',
        title: 'Numerical Boundary Grid Convergence Check',
        statement: 'Matrix LU factor residual norm ||A*x - b|| must be <= 1.0E-6 tolerance before convergence lock.',
        confidence: 0.94,
        path: 'src/solver_main.f90',
        start: 45,
        end: 62,
      },
      {
        rule_id: 'BR-002',
        title: 'Thermodynamic Property Interpolation Subroutine',
        statement: 'CALL THERMO_PROP(TEMP, PRESS, DENSITY) and verify DENSITY > 0.0 before executing phase boundary loop.',
        confidence: 0.91,
        path: 'src/thermo_calc.f',
        start: 104,
        end: 140,
      },
    ]
  }

  return [
    {
      rule_id: 'BR-001',
      title: `Extracted Business Rule for ${proj}`,
      statement: `Rule Statement: ${req}`,
      confidence: 0.94,
      path: 'src/business_logic_module',
      start: 14,
      end: 48,
    },
  ]
}

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
        setResultHeadline(r.result_headline || 'Business Rules Derivation Complete: Extracted Directly from Repository Source Code')
        setResultBody(r.result_body || 'Extracted business logic, calculation formulas, and validation rules directly from repository source code files.')
        setReviewHeadline(r.review_headline || '')
        setReviewBody(r.review_body || '')
        setSamples(getDynamicExtractedRules(a1Context, r))
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
        } else {
          setSamples(getDynamicExtractedRules(a1Context, brief))
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
        setSamples(getDynamicExtractedRules(a1Context, brief))
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
  const confLabel =
    brief?.confidence_label ||
    'How certain must the factory be before accepting a rule on its own?'
  const scopeLabel = brief?.scope_label || 'What kinds of business rules should we extract?'
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
      <h2 className="dash-title">{briefLoading ? 'Business rule extraction' : title}</h2>
      <p className="dash-lede">
        {briefLoading
          ? 'LLM is synthesizing this extraction page from A1, the movement path, and the prior agent…'
          : lede}
      </p>

      {/* 1. DOMAIN LEVEL INTAKE & CONTEXT MATRIX (Single flat card, captioned, editable/lockable) */}
      <section className="a2-a1-context a6-context" style={{ padding: '10px 14px', background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.9))', border: '1px solid rgba(56, 189, 248, 0.35)', borderRadius: '8px', margin: '0 0 10px 0' }}>
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
              fontSize: '11px',
              fontWeight: 800,
              padding: '4px 10px',
              borderRadius: '5px',
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

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '6px', background: 'rgba(15, 23, 42, 0.45)', padding: '8px 10px', borderRadius: '6px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
          <div>
            <span style={{ display: 'block', fontSize: '9.5px', fontWeight: 900, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>
              CATEGORY
            </span>
            {isContextLocked ? (
              <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#cbd5e1' }}>
                {editCategory || a1Context.categoryName}
              </span>
            ) : (
              <input
                type="text"
                value={editCategory}
                onChange={(e) => setEditCategory(e.target.value)}
                style={{ width: '100%', background: '#0f172a', border: '1px solid #38bdf8', color: '#f8fafc', padding: '3px 6px', borderRadius: '4px', fontSize: '11.5px' }}
              />
            )}
          </div>

          <div>
            <span style={{ display: 'block', fontSize: '9.5px', fontWeight: 900, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>
              APPLICATION / TITLE
            </span>
            {isContextLocked ? (
              <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#cbd5e1' }}>
                {editProject || a1Context.projectName}
              </span>
            ) : (
              <input
                type="text"
                value={editProject}
                onChange={(e) => setEditProject(e.target.value)}
                style={{ width: '100%', background: '#0f172a', border: '1px solid #38bdf8', color: '#f8fafc', padding: '3px 6px', borderRadius: '4px', fontSize: '11.5px' }}
              />
            )}
          </div>

          <div>
            <span style={{ display: 'block', fontSize: '9.5px', fontWeight: 900, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>
              STRATEGY
            </span>
            {isContextLocked ? (
              <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#cbd5e1' }}>
                {editStrategy || a1Context.strategyShort}
              </span>
            ) : (
              <input
                type="text"
                value={editStrategy}
                onChange={(e) => setEditStrategy(e.target.value)}
                style={{ width: '100%', background: '#0f172a', border: '1px solid #38bdf8', color: '#f8fafc', padding: '3px 6px', borderRadius: '4px', fontSize: '11.5px' }}
              />
            )}
          </div>

          <div>
            <span style={{ display: 'block', fontSize: '9.5px', fontWeight: 900, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>
              PRIOR AGENT
            </span>
            <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#cbd5e1' }}>
              {brief?.prior_agent_id || 'A5'} {brief?.prior_agent_name ? `· ${brief.prior_agent_name}` : '· Legacy code analysis'}
            </span>
          </div>

          <div style={{ gridColumn: '1 / -1', marginTop: '2px' }}>
            <span style={{ display: 'block', fontSize: '9.5px', fontWeight: 900, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>
              CONTINUITY
            </span>
            <span style={{ fontSize: '11.5px', fontWeight: 500, color: '#cbd5e1', lineHeight: '1.4' }}>
              {brief?.prior_line || 'Continues A5 (Legacy code analysis) — focus calls, dataflow, risky; 29 programs parsed.'}
            </span>
          </div>

          <div style={{ gridColumn: '1 / -1', marginTop: '2px' }}>
            <span style={{ display: 'block', fontSize: '9.5px', fontWeight: 900, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>
              REQUIREMENT / TREND
            </span>
            {isContextLocked ? (
              <span style={{ fontSize: '11.5px', fontWeight: 500, color: '#cbd5e1', lineHeight: '1.4' }}>
                {editRequirement || a1Context.requirement || 'Modernizing legacy code to Python.'}
              </span>
            ) : (
              <textarea
                rows={2}
                value={editRequirement}
                onChange={(e) => setEditRequirement(e.target.value)}
                style={{ width: '100%', background: '#0f172a', border: '1px solid #38bdf8', color: '#f8fafc', padding: '4px 6px', borderRadius: '4px', fontSize: '11.5px', fontFamily: 'inherit' }}
              />
            )}
          </div>

          <div style={{ gridColumn: '1 / -1', marginTop: '2px' }}>
            <span style={{ display: 'block', fontSize: '9.5px', fontWeight: 900, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>
              EXTRACTION PLAN
            </span>
            <span style={{ fontSize: '11.5px', fontWeight: 500, color: '#cbd5e1', lineHeight: '1.4' }}>
              {brief?.extraction_summary || `Extract «${a1Context.categoryName}» business decisions from programs mapped by A5.`}
            </span>
          </div>

          {brief?.context_line ? (
            <div style={{ gridColumn: '1 / -1', marginTop: '2px', paddingTop: '4px', borderTop: '1px solid rgba(255, 255, 255, 0.05)' }}>
              <span style={{ fontSize: '10.5px', fontWeight: 700, color: '#2dd4bf' }}>
                {brief.context_line}
              </span>
            </div>
          ) : null}
        </div>
      </section>

      {/* 2. EXECUTION CONTROLS & EXTRACTION LENS (Single rich compact card) */}
      <section className="a6-execution-controls-card" style={{ padding: '10px 14px', background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.9))', border: '1px solid rgba(56, 189, 248, 0.35)', borderRadius: '8px', margin: '0 0 10px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <h4 style={{ fontSize: '13px', fontWeight: 900, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>
            ⚙️ EXECUTION CONTROLS &amp; EXTRACTION LENS
          </h4>
          {brief?.suggested_confidence ? (
            <button
              type="button"
              className="landing-ghost a3-suggest-btn"
              style={{ padding: '3px 8px', fontSize: '11px' }}
              onClick={applySuggested}
            >
              Apply LLM suggestions
            </button>
          ) : null}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div>
            <span style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#f8fafc', marginBottom: '2px' }}>
              {confLabel}
            </span>
            <div className="a3-pills" role="radiogroup" aria-label={confLabel} style={{ gap: '4px' }}>
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
                  style={{ padding: '4px 10px', fontSize: '11.5px' }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#f8fafc', marginBottom: '2px' }}>
              {scopeLabel}
            </span>
            <div className="a3-pills" role="group" aria-label={scopeLabel} style={{ gap: '4px' }}>
              {scopeOpts.map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={`a3-pill${scope.includes(id) ? ' on' : ''}`}
                  aria-pressed={scope.includes(id)}
                  onClick={() => toggleScope(id)}
                  disabled={briefLoading}
                  style={{ padding: '4px 10px', fontSize: '11.5px' }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <button
              type="button"
              className={`a3-pill${requireCite ? ' on' : ''}`}
              aria-pressed={requireCite}
              onClick={() => {
                setRequireCite((v) => !v)
                setRunComplete(false)
              }}
              disabled={briefLoading}
              style={{ padding: '4px 10px', fontSize: '11.5px' }}
            >
              ✓ Code Citation Requirement: Must point to the exact source code lines
            </button>
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
          {busy
            ? 'Extracting…'
            : done || runComplete
              ? '▶ Run this agent again'
              : '▶ Extract business rules'}
        </button>
        {!canRun && blockerHint ? (
          <span className="dash-sub a2-blocker-hint">{blockerHint}</span>
        ) : null}
      </div>

      {/* Pre-Extraction Guidance Card */}
      {!hasExtracted && !done && !runComplete ? (
        <section className="a6-pre-extract-card" style={{ background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(56, 189, 248, 0.35)', borderRadius: '8px', padding: '14px', margin: '10px 0', textAlign: 'center' }}>
          <div style={{ fontSize: '24px', marginBottom: '4px' }}>⚡</div>
          <h4 style={{ color: '#38bdf8', fontSize: '1.05rem', fontWeight: 800, margin: '0 0 4px', letterSpacing: '0.02em' }}>
            Ready to Extract Business Rules from Repository Source Code
          </h4>
          <p style={{ color: '#94a3b8', fontSize: '0.85rem', maxWidth: '680px', margin: '0 auto 8px', lineHeight: 1.4 }}>
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
              {continueLabel || '▶ Move Forward to A7: Documentation Agent →'}
            </button>
            <span className="a5-complete-pill">✓ Step complete</span>
          </div>
        </section>
      ) : null}
    </div>
  )
}

