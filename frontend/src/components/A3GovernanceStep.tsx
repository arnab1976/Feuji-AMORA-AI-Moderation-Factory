import { useEffect, useMemo, useState } from 'react'
import { api, ApiError, type A3Brief, type LogLine } from '../api/client'
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

const FALLBACK_SENSITIVE: [string, string][] = [
  ['src_ip', 'Proprietary source / algorithms'],
  ['secrets', 'Embedded secrets / credentials in code'],
  ['comments_pii', 'PII or customer data in comments'],
  ['conn', 'Connection strings / endpoints'],
  ['licenses', 'License / IP-restricted modules'],
  ['none', 'None / not sure'],
]

/** Every list needs an explicit opt-out so the operator can always proceed. */
function withNoneOption(opts: [string, string][]): [string, string][] {
  return opts.some(([id]) => id === 'none')
    ? opts
    : [...opts, ['none', 'None / not sure'] as [string, string]]
}

const FALLBACK_MODELS: [string, string][] = [
  ['public', 'Public models only (cheap)'],
  ['balanced', 'Private + public (balanced)'],
  ['private', 'Private/on-premises only (strict)'],
]

const FALLBACK_GATES: [string, string][] = [
  ['full', 'Yes — full 9 gates'],
  ['auto_low', 'Auto-approve low-risk gates'],
]

const MODEL_TO_SENS: Record<string, string> = {
  public: 'low',
  balanced: 'med',
  private: 'high',
}

function optLabel(opts: [string, string][], id: string): string {
  return opts.find(([v]) => v === id)?.[1] ?? id
}

function truncate(text: string, n = 160): string {
  const t = text.trim()
  if (t.length <= n) return t
  return `${t.slice(0, n - 1)}…`
}

export function A3GovernanceStep({
  runId,
  done,
  formResetKey,
  intake,
  onComplete,
  onResults,
  onContinueNext,
  continueLabel,
}: Props) {
  const [brief, setBrief] = useState<A3Brief | null>(null)
  const [briefLoading, setBriefLoading] = useState(true)
  const [sensitive, setSensitive] = useState<string[]>([])
  const [modelPolicy, setModelPolicy] = useState('')
  const [gatePolicy, setGatePolicy] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [runComplete, setRunComplete] = useState(false)
  const [log, setLog] = useState<LogLine[]>([])
  const [headline, setHeadline] = useState('')
  const [portfolio, setPortfolio] = useState<{
    criticality?: string
    regulations?: string
    location?: string
  }>({})

  const sensOpts = withNoneOption(
    brief?.sensitive_options?.length ? brief.sensitive_options : FALLBACK_SENSITIVE,
  )
  const modelOpts = brief?.model_options?.length ? brief.model_options : FALLBACK_MODELS
  const gateOpts = brief?.gate_options?.length ? brief.gate_options : FALLBACK_GATES

  const a1Context = useMemo(() => {
    const fromBrief = {
      categoryName: brief?.category_name || '',
      categoryId: brief?.category_id || '',
      projectName: brief?.project_name || '',
      requirement: brief?.requirement || '',
      strategies: brief?.strategies || [],
      strategyShort: brief?.strategy_short || '',
      why: brief?.why_modernize || '',
    }
    return {
      categoryName:
        intake?.category_name || intake?.category_id || fromBrief.categoryName || '—',
      categoryId: intake?.category_id || fromBrief.categoryId || '',
      projectName: intake?.project_name || fromBrief.projectName || '—',
      requirement: intake?.requirement || fromBrief.requirement || '',
      strategies:
        intake?.strategies?.length ? intake.strategies : fromBrief.strategies || [],
      strategyShort:
        intake?.strategy_short
        || intake?.strategies?.[0]
        || fromBrief.strategyShort
        || fromBrief.strategies?.[0]
        || '—',
      why: intake?.why_modernize || fromBrief.why || '',
    }
  }, [intake, brief])

  useEffect(() => {
    let cancelled = false
    setBriefLoading(true)
    setError(null)
    setNotice(null)
    setRunComplete(false)
    setLog([])
    setHeadline('')
    setSensitive([])
    setModelPolicy('')
    setGatePolicy('')
    onResults({
      log: [['info', 'Loading A3 governance brief from A1 + A2 path movement…']],
      synthesis: null,
      projectName: a1Context.projectName !== '—' ? a1Context.projectName : '',
      status: 'A3 · synthesizing policy options…',
      pageTitle: 'Governance & Risk',
      pageContext: a1Context.categoryName,
      evidenceItems: [],
    })

    api
      .getRun(runId)
      .then((r) => {
        if (cancelled) return
        const inv = (r.state?.inventory || {}) as Record<string, unknown>
        const port = (inv.portfolio || {}) as Record<string, unknown>
        const regs = port.regulation_labels || port.regulations
        setPortfolio({
          criticality: String(port.criticality_label || port.criticality || ''),
          regulations: Array.isArray(regs)
            ? regs.map(String).join(', ')
            : String(regs || ''),
          location: String(port.code_location || ''),
        })
      })
      .catch(() => {
        /* non-fatal */
      })

    const briefPromise = api.a3Brief(runId)
    const timeout = new Promise<never>((_, reject) => {
      window.setTimeout(
        () => reject(new Error('A3 brief timed out — using catalog defaults')),
        12000,
      )
    })

    Promise.race([briefPromise, timeout])
      .then((r) => {
        if (cancelled) return
        setBrief(r)
        if (r.a2_criticality) {
          setPortfolio((prev) => ({
            ...prev,
            criticality: r.a2_criticality || prev.criticality,
            regulations: r.a2_regulations?.length
              ? r.a2_regulations.join(', ')
              : prev.regulations,
            location: r.a2_code_location || prev.location,
          }))
        }
        const glossary: GlossaryTerm[] = r.glossary ?? []
        onResults({
          log: [
            ['ok', `A3 brief ready · ${r.model}`],
            ['info', r.context_line],
            ...(r.prior_line ? ([['info', r.prior_line]] as [string, string][]) : []),
            ...(r.warning ? ([['warn', r.warning]] as [string, string][]) : []),
            ...(r.risk_summary ? ([['info', r.risk_summary]] as [string, string][]) : []),
          ],
          synthesis: null,
          projectName:
            r.project_name
            || (a1Context.projectName !== '—' ? a1Context.projectName : ''),
          status: r.activity_status || 'A3 ready — set the rules and run',
          glossary,
          glossaryStatus: r.context_line,
          evidenceItems: (r.evidence_hints || []).map((name) => ({
            label: name,
            value: 'From A1/A2 · awaiting A3 policy',
          })),
          pageTitle: r.title,
          pageContext: r.context_line,
        })
      })
      .catch((e) => {
        if (cancelled) return
        setBrief(null)
        setModelPolicy('balanced')
        setGatePolicy('full')
        setNotice(
          'Could not synthesize policy options from the LLM — showing standard governance defaults shaped by A1 category. You can still set the rules and run.',
        )
        onResults({
          log: [
            ['warn', e instanceof Error ? e.message : String(e)],
            ['info', 'Continuing with default governance fields from A1 path'],
          ],
          synthesis: null,
          projectName: a1Context.projectName !== '—' ? a1Context.projectName : '',
          status: 'A3 ready with defaults',
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
    api.agentLog(runId, 'A3').then((r) => {
      setLog(r.log)
      if (Object.keys(r.params).length) {
        if (Array.isArray(r.params.sensitive_fields)) {
          setSensitive(r.params.sensitive_fields as string[])
        }
        if (typeof r.params.model_policy === 'string') setModelPolicy(r.params.model_policy)
        if (typeof r.params.gate_policy === 'string') setGatePolicy(r.params.gate_policy)
      }
      const hl = r.log.find(([lvl]) => lvl === 'hl')
      if (hl) setHeadline(hl[1])
      setRunComplete(true)
      onResults({
        log: r.log,
        synthesis: null,
        projectName: a1Context.projectName !== '—' ? a1Context.projectName : '',
        status: 'A3 complete',
        evidenceItems: [{ label: 'execution_policy.yaml', value: 'Ready' }],
      })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, runId])

  const canRun = useMemo(
    () => sensitive.length > 0 && Boolean(modelPolicy) && Boolean(gatePolicy),
    [sensitive, modelPolicy, gatePolicy],
  )

  const blockerHint = useMemo(() => {
    if (briefLoading) return 'Loading governance options from A1/A2…'
    if (!sensitive.length)
      return 'Select at least one sensitive data class — pick “None / not sure” if none apply.'
    if (!modelPolicy) return 'Choose which AI models are allowed.'
    if (!gatePolicy) return 'Choose the gate approval policy.'
    return ''
  }, [briefLoading, sensitive, modelPolicy, gatePolicy])

  function toggleSensitive(id: string) {
    setSensitive((prev) => {
      if (id === 'none') return prev.includes('none') ? [] : ['none']
      const withoutNone = prev.filter((x) => x !== 'none')
      return withoutNone.includes(id)
        ? withoutNone.filter((x) => x !== id)
        : [...withoutNone, id]
    })
    setRunComplete(false)
  }

  function applySuggested() {
    if (!brief) return
    setSensitive(brief.suggested_sensitive?.length ? [...brief.suggested_sensitive] : [])
    setModelPolicy(brief.suggested_model || '')
    setGatePolicy(brief.suggested_gates || '')
    setRunComplete(false)
  }

  async function runAgent() {
    if (!canRun) return
    setBusy(true)
    setError(null)
    setRunComplete(false)
    onResults({
      log: [['info', 'Running Governance & Risk agent…']],
      synthesis: null,
      projectName: a1Context.projectName !== '—' ? a1Context.projectName : '',
      status: 'A3 running…',
      pageTitle: brief?.title,
      pageContext: brief?.context_line,
    })
    try {
      const labels = sensitive.map((id) => optLabel(sensOpts, id))
      const res = await api.runAgent(runId, 'A3', {
        sensitive_fields: sensitive,
        sensitive_labels: labels,
        model_policy: modelPolicy,
        gate_policy: gatePolicy,
        sensitivity: MODEL_TO_SENS[modelPolicy] || 'high',
        category_id: brief?.category_id || a1Context.categoryId,
      })
      setLog(res.result.log)
      const hl = res.result.log.find(([lvl]) => lvl === 'hl')
      setHeadline(hl?.[1] ?? '')
      setRunComplete(true)
      onResults({
        log: res.result.log,
        synthesis: null,
        projectName: a1Context.projectName !== '—' ? a1Context.projectName : '',
        status: 'A3 complete — policy locked',
        glossary: brief?.glossary,
        glossaryStatus: brief?.context_line,
        evidenceItems: (res.result.artifacts?.length
          ? res.result.artifacts
          : ['execution_policy.yaml']
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
        status: 'A3 failed',
      })
    } finally {
      setBusy(false)
    }
  }

  const formHeading = brief?.form_heading || 'Set the rules'
  const sensLabel = brief?.sensitive_label || 'What data is sensitive?'
  const sensHint =
    brief?.sensitive_hint ||
    'Tick everything that applies. The agents will not send this data to public AI models.'
  const modelsLabel = brief?.models_label || 'Which AI models are allowed?'
  const gatesLabel = brief?.gates_label || 'Require manual approval at every gate?'

  return (
    <div className="a3-step a1-wizard mf-req">
      <div className="mf-category-caption">
        📊 2. STRATEGIC INTAKE &amp; CONTEXT MATRIX
      </div>
      <section className="a2-a1-context a3-context" aria-label="Prior context from A1 and A2">
        <div className="a2-a1-context-head">
          <h4>Domain Level Intake &amp; Context Matrix</h4>
          <span className="a2-a1-lock">Shapes this policy</span>
        </div>
        <p className="dash-sub a2-a1-intro">
          Sensitive-data options and risk posture are synthesized from the locked Factory
          Administrator intake, agent movement path, and A2 portfolio ranking — not a fixed template.
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
            <dt>A2 criticality</dt>
            <dd>
              {portfolio.criticality
                || brief?.a2_criticality
                || '— (run A2 first for ranking)'}
            </dd>
          </div>
          <div>
            <dt>Prior agent</dt>
            <dd>
              {brief?.prior_agent_id
                ? `${brief.prior_agent_id} · ${brief.prior_agent_name || 'Portfolio ranking'}`
                : 'A2 · Portfolio ranking'}
            </dd>
          </div>
          {a1Context.requirement ? (
            <div className="a2-a1-why">
              <dt>Requirement / trend</dt>
              <dd>{truncate(a1Context.requirement)}</dd>
            </div>
          ) : null}
          {brief?.risk_summary ? (
            <div className="a2-a1-why">
              <dt>Risk posture</dt>
              <dd>{brief.risk_summary}</dd>
            </div>
          ) : null}
        </dl>
        {brief?.context_line ? <p className="a2-context-chip">{brief.context_line}</p> : null}
        {brief?.prior_line ? <p className="dash-sub">{brief.prior_line}</p> : null}
      </section>

      <div className="mf-category-caption" style={{ marginTop: '16px' }}>
        ⚙️ 4. EXECUTION CONTROLS &amp; RISK POSTURE
      </div>
      <div className="a3-rules-head">
        <h3>{formHeading}</h3>
        {brief && (brief.suggested_model || brief.suggested_gates) ? (
          <button type="button" className="landing-ghost a3-suggest-btn" onClick={applySuggested}>
            Apply LLM suggestions
          </button>
        ) : null}
      </div>

      <section className="a3-rule-card">
        <h4>{sensLabel}</h4>
        <p className="a3-rule-hint">{sensHint}</p>
        {briefLoading ? (
          <p className="dash-empty">Synthesizing sensitive-data classes…</p>
        ) : (
          <div className="a3-pills" role="group" aria-label={sensLabel}>
            {sensOpts.map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={`a3-pill${sensitive.includes(id) ? ' on' : ''}`}
                aria-pressed={sensitive.includes(id)}
                onClick={() => toggleSensitive(id)}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="a3-rule-card">
        <h4>{modelsLabel}</h4>
        <p className="a3-rule-hint">Choose one — derived sensitivity follows this choice.</p>
        <div className="a3-pills" role="radiogroup" aria-label={modelsLabel}>
          {modelOpts.map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`a3-pill${modelPolicy === id ? ' on' : ''}`}
              aria-pressed={modelPolicy === id}
              onClick={() => {
                setModelPolicy(id)
                setRunComplete(false)
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      <section className="a3-rule-card">
        <h4>{gatesLabel}</h4>
        <p className="a3-rule-hint">Human checkpoints the factory must stop at.</p>
        <div className="a3-pills" role="radiogroup" aria-label={gatesLabel}>
          {gateOpts.map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`a3-pill${gatePolicy === id ? ' on' : ''}`}
              aria-pressed={gatePolicy === id}
              onClick={() => {
                setGatePolicy(id)
                setRunComplete(false)
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      {notice && <p className="a3-notice">{notice}</p>}
      {error && <p className="err">{error}</p>}

      <div className="dash-run-row a3-run-row">
        <button
          className="landing-start"
          type="button"
          disabled={!canRun || busy}
          onClick={() => void runAgent()}
        >
          {busy ? 'Running…' : done || runComplete ? '▶ Run this agent again' : '▶ Run this agent'}
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

      {runComplete && (
        <section className="a1-just-did a3-results" aria-live="polite">
          <h4 className="a1-just-did-title">What we just did</h4>
          <div className="a1-success-banner">
            <strong>Governance &amp; Risk policy locked.</strong>
            <p>
              Sensitive fields, model policy, and gate requirements are recorded for{' '}
              <em>{a1Context.projectName}</em>. Downstream agents must obey this allow-list.
            </p>
          </div>
          <div className="a1-run-details">
            <h5>Policy details</h5>
            <dl>
              <div>
                <dt>Sensitive data</dt>
                <dd>{sensitive.map((id) => optLabel(sensOpts, id)).join(', ')}</dd>
              </div>
              <div>
                <dt>Model policy</dt>
                <dd>{optLabel(modelOpts, modelPolicy)}</dd>
              </div>
              <div>
                <dt>Gate policy</dt>
                <dd>{optLabel(gateOpts, gatePolicy)}</dd>
              </div>
              {headline ? (
                <div>
                  <dt>Note</dt>
                  <dd className="a2-assess">{headline}</dd>
                </div>
              ) : null}
            </dl>
          </div>
          {log.length > 0 && (
            <ul className="dash-activity a2-result-log">
              {log.map(([level, msg], i) => (
                <li key={`${i}-${msg}`} className={level}>
                  {msg}
                </li>
              ))}
            </ul>
          )}
          <div className="a1-just-did-actions">
            <button className="landing-start" type="button" onClick={() => onContinueNext?.()}>
              {continueLabel || 'Continue to next step →'}
            </button>
            <span className="a1-step-badge">✓ Step complete</span>
          </div>
        </section>
      )}
    </div>
  )
}
