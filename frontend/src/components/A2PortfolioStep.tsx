import { useEffect, useMemo, useState } from 'react'
import { api, ApiError, type A2Brief, type LogLine, type StepBrief } from '../api/client'
import type { PathMapIntakeSnapshot } from './AgentGateMapStep'
import type { ActivityPayload, GlossaryTerm } from './A1IntakeWizard'
import { ChecklistPanel, allRequiredChecked } from './ChecklistPanel'

interface Props {
  runId: string
  done: boolean
  formResetKey: number
  /** Locked A1 Factory Administrator context combination */
  intake?: PathMapIntakeSnapshot | null
  onComplete: () => Promise<void>
  onResults: (payload: ActivityPayload) => void
  onContinueNext?: () => void
  continueLabel?: string
}

const FALLBACK_CRIT: [string, string][] = [
  ['low', 'Low (nice to have)'],
  ['med', 'Medium (important)'],
  ['high', 'High (business runs on it)'],
  ['life', 'Life-safety critical'],
]

const FALLBACK_REGS: [string, string][] = [
  ['none', 'None / not sure'],
  ['sox', 'SOX / financial controls'],
  ['pci', 'PCI-DSS (payments)'],
  ['gdpr', 'GDPR / privacy'],
  ['hipaa', 'HIPAA / health'],
  ['other', 'Other regulated industry'],
]

function optLabel(opts: [string, string][], id: string): string {
  return opts.find(([v]) => v === id)?.[1] ?? id
}

function truncate(text: string, n = 140): string {
  const t = text.trim()
  if (t.length <= n) return t
  return `${t.slice(0, n - 1)}…`
}

export function A2PortfolioStep({
  runId,
  done,
  formResetKey,
  intake,
  onComplete,
  onResults,
  onContinueNext,
  continueLabel,
}: Props) {
  const [brief, setBrief] = useState<A2Brief | null>(null)
  const [stepBrief, setStepBrief] = useState<StepBrief | null>(null)
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [briefLoading, setBriefLoading] = useState(true)
  const [codeLocation, setCodeLocation] = useState('')
  const [criticality, setCriticality] = useState('high')
  const [regulations, setRegulations] = useState<string[]>(['none'])
  const [checklistManualNote, setChecklistManualNote] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [runComplete, setRunComplete] = useState(false)
  const [log, setLog] = useState<LogLine[]>([])
  const [assessment, setAssessment] = useState('')

  const critOpts = brief?.criticality_options?.length ? brief.criticality_options : FALLBACK_CRIT
  const regOpts =
    brief?.constraints_options?.length
      ? brief.constraints_options
      : brief?.regulation_options?.length
        ? brief.regulation_options
        : FALLBACK_REGS

  const a1Context = useMemo(() => {
    const fromBrief = stepBrief?.context
    const categoryName =
      intake?.category_name || fromBrief?.category_name || fromBrief?.category_id || '—'
    const categoryId = intake?.category_id || fromBrief?.category_id || ''
    const projectName = intake?.project_name || fromBrief?.project_name || '—'
    const requirement = intake?.requirement || fromBrief?.requirement || ''
    const strategies =
      intake?.strategies?.length
        ? intake.strategies
        : fromBrief?.strategies?.length
          ? fromBrief.strategies
          : []
    const strategyShort =
      intake?.strategy_short || fromBrief?.strategy_short || strategies[0] || '—'
    const why =
      intake?.why_modernize || fromBrief?.why_modernize || ''
    return {
      categoryId,
      categoryName,
      projectName,
      requirement,
      strategies,
      strategyShort,
      why,
    }
  }, [intake, stepBrief])

  useEffect(() => {
    let cancelled = false
    setBriefLoading(true)
    setError(null)
    setRunComplete(false)
    setLog([])
    setAssessment('')
    setChecked({})
    setChecklistManualNote('')
    setNotes('')
    onResults({
      log: [['info', 'Loading A2 portfolio brief from A1 context combination…']],
      synthesis: null,
      projectName: a1Context.projectName !== '—' ? a1Context.projectName : '',
      status: 'A2 · synthesizing page context…',
      glossaryStatus: 'Personalizing glossary for portfolio intake…',
      evidenceItems: [],
      pageTitle: 'Portfolio intake',
      pageContext: a1Context.categoryName,
    })

    api
      .stepBrief(runId, 'A2')
      .then((sb) => {
        if (cancelled) return
        setStepBrief(sb)
        setChecked({})
        onResults({
          log: [
            ['ok', `A2 checklist ready · ${sb.path_status_label}`],
            ['info', sb.note],
            ['info', 'Loading personalized form from A1 context…'],
          ],
          synthesis: null,
          projectName: sb.context.project_name || a1Context.projectName || '',
          status: 'A2 · loading form',
          pageTitle: sb.title || 'Portfolio intake',
          pageContext: sb.context.category_name || a1Context.categoryName,
          evidenceItems: [
            { label: 'Category', value: sb.context.category_name || sb.context.category_id },
            { label: 'Strategy', value: sb.context.strategy_short || '—' },
            { label: 'Requirement', value: truncate(sb.context.requirement || '—', 120) },
          ],
        })
      })
      .catch(() => {
        /* step brief failure is non-fatal */
      })

    const briefPromise = api.a2Brief(runId)
    const timeout = new Promise<never>((_, reject) => {
      window.setTimeout(
        () => reject(new Error('A2 brief timed out — using catalog defaults')),
        12000,
      )
    })

    Promise.race([briefPromise, timeout])
      .then((r) => {
        if (cancelled) return
        setBrief(r)
        setCodeLocation(r.suggested_repo)
        setCriticality(r.suggested_criticality || 'high')
        setRegulations(r.suggested_regulations?.length ? r.suggested_regulations : ['none'])
        const glossary: GlossaryTerm[] = r.glossary ?? []
        onResults({
          log: [
            ['ok', `A2 brief ready · ${r.model}`],
            ['info', r.context_line],
            ...(r.warning ? ([['warn', r.warning]] as [string, string][]) : []),
          ],
          synthesis: null,
          projectName: a1Context.projectName !== '—' ? a1Context.projectName : '',
          status: r.activity_status || 'A2 ready — fill the form and run the agent',
          glossary,
          glossaryStatus: r.context_line,
          evidenceItems: (r.evidence_hints || []).map((name) => ({
            label: name,
            value: 'From A1 · awaiting A2 artefacts',
          })),
          pageTitle: r.title,
          pageContext: r.context_line,
        })
      })
      .catch((e) => {
        if (cancelled) return
        setBrief(null)
        setCodeLocation((prev) => prev || 'https://git.example.com/legacy/core-system.git')
        setError(e instanceof ApiError ? e.message : String(e))
        onResults({
          log: [
            ['warn', e instanceof Error ? e.message : String(e)],
            ['info', 'Continuing with checklist + default portfolio fields'],
          ],
          synthesis: null,
          projectName: a1Context.projectName !== '—' ? a1Context.projectName : '',
          status: 'A2 ready with defaults',
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
    api.agentLog(runId, 'A2').then((r) => {
      setLog(r.log)
      if (Object.keys(r.params).length) {
        if (typeof r.params.code_location === 'string') setCodeLocation(r.params.code_location)
        if (typeof r.params.criticality === 'string') setCriticality(r.params.criticality)
        if (Array.isArray(r.params.regulations)) setRegulations(r.params.regulations as string[])
        if (typeof r.params.portfolio_notes === 'string') setNotes(r.params.portfolio_notes)
      }
      const hl = r.log.find(([lvl]) => lvl === 'hl')
      if (hl) setAssessment(hl[1])
      setRunComplete(true)
      onResults({
        log: r.log,
        synthesis: null,
        projectName: a1Context.projectName !== '—' ? a1Context.projectName : '',
        status: 'A2 complete',
        evidenceItems: [
          { label: 'portfolio_assessment.md', value: 'Ready' },
          { label: 'criticality_score.json', value: 'Ready' },
          { label: 'regulatory_map.md', value: 'Ready' },
        ],
      })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, runId])

  const formReady = useMemo(
    () => codeLocation.trim().length > 3 && Boolean(criticality) && regulations.length > 0,
    [codeLocation, criticality, regulations],
  )

  const checklistItems = brief?.checklist?.length ? brief.checklist : (stepBrief?.checklist || [])
  const noneOfTheseChecked = Boolean(checked.none_of_these)
  const checklistReady = useMemo(
    () => allRequiredChecked(checklistItems, checked),
    [checklistItems, checked],
  )

  const canRun = formReady

  const blockerHint = useMemo(() => {
    if (briefLoading) return 'Loading portfolio fields from A1…'
    if (!codeLocation.trim() || codeLocation.trim().length <= 3) {
      return 'Enter the primary location / channel pointer above.'
    }
    if (!criticality) return 'Select a criticality level.'
    if (!regulations.length) return 'Select at least one control obligation.'
    return ''
  }, [briefLoading, codeLocation, criticality, regulations])

  function checkAllChecklist() {
    if (!checklistItems.length) return
    const next: Record<string, boolean> = {}
    for (const item of checklistItems) {
      if (item.id !== 'none_of_these') next[item.id] = true
    }
    setChecked(next)
    setChecklistManualNote('')
  }

  function toggleChecklist(id: string, value: boolean) {
    setChecked((prev) => {
      if (id === 'none_of_these') {
        if (!value) return { ...prev, none_of_these: false }
        return { none_of_these: true }
      }
      const next = { ...prev, [id]: value }
      if (value && next.none_of_these) next.none_of_these = false
      return next
    })
    if (id !== 'none_of_these' && value) setChecklistManualNote('')
    setRunComplete(false)
  }

  function toggleReg(id: string) {
    setRegulations((prev) => {
      if (id === 'none') return ['none']
      const withoutNone = prev.filter((x) => x !== 'none')
      if (withoutNone.includes(id)) {
        const next = withoutNone.filter((x) => x !== id)
        return next.length ? next : ['none']
      }
      return [...withoutNone, id]
    })
    setRunComplete(false)
  }

  async function runAgent() {
    if (!canRun) return
    setBusy(true)
    setError(null)
    setRunComplete(false)
    onResults({
      log: [['info', 'Running Portfolio intake agent…']],
      synthesis: null,
      projectName: a1Context.projectName !== '—' ? a1Context.projectName : '',
      status: 'A2 running…',
      pageTitle: brief?.title,
      pageContext: brief?.context_line,
    })
    try {
      const operatorChecklistSelections = checklistItems
        .filter((item) => checked[item.id] && item.id !== 'none_of_these')
        .map((item) => item.label)
      const res = await api.runAgent(runId, 'A2', {
        code_location: codeLocation.trim(),
        criticality,
        regulations,
        portfolio_notes: notes.trim(),
        operator_checklist_note: noneOfTheseChecked ? checklistManualNote.trim() : '',
        operator_checklist_ids: Object.keys(checked).filter((id) => checked[id]),
        operator_checklist_labels: operatorChecklistSelections,
        primary_label: brief?.primary_label,
        criticality_label: brief?.criticality_label,
        constraints_label: brief?.constraints_label,
        category_id: brief?.category_id || a1Context.categoryId,
        form_heading: brief?.form_heading,
        a1_project_name: a1Context.projectName,
        a1_strategy: a1Context.strategyShort,
        a1_requirement: a1Context.requirement,
      })
      setLog(res.result.log)
      const hl = res.result.log.find(([lvl]) => lvl === 'hl')
      setAssessment(hl?.[1] ?? '')
      setRunComplete(true)
      onResults({
        log: res.result.log,
        synthesis: null,
        projectName: a1Context.projectName !== '—' ? a1Context.projectName : '',
        status: 'A2 complete — results below',
        glossary: brief?.glossary,
        glossaryStatus: brief?.context_line,
        evidenceItems: (res.result.artifacts?.length
          ? res.result.artifacts
          : ['portfolio_assessment.md', 'criticality_score.json', 'regulatory_map.md']
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
        status: 'A2 failed',
      })
    } finally {
      setBusy(false)
    }
  }

  const title = brief?.title || 'Portfolio intake'
  const lede =
    brief?.lede ||
    'Looks at your portfolio of old systems and helps decide which ones to modernize first — shaped by the Factory Administrator selections you locked in A1.'
  const formHeading = brief?.form_heading || 'Tell us about your application estate'
  const primaryLabel = brief?.primary_label || 'Where does the old code live?'
  const primaryPlaceholder =
    brief?.primary_placeholder || 'https://git.example.com/legacy/core-system.git'
  const critLabel = brief?.criticality_label || 'How critical is this system?'
  const consLabel = brief?.constraints_label || 'Any regulatory obligations?'

  return (
    <div className="a2-step a1-wizard mf-req">
      <p className="dash-kicker">Domain A · Factory setup · Step A2</p>
      <h2 className="dash-title">{briefLoading ? 'Portfolio intake' : title}</h2>
      <p className="dash-lede">
        {briefLoading
          ? 'Personalizing this step from your Factory Administrator (A1) context combination…'
          : lede}
      </p>

      <section className="a2-a1-context" aria-label="Factory Administrator context">
        <div className="a2-a1-context-head">
          <h4>Domain Level Intake &amp; Context Matrix</h4>
          <span className="a2-a1-lock">Locked from intake</span>
        </div>
        <p className="dash-sub a2-a1-intro">
          Portfolio fields below are shaped by this combination. Category, strategy, title, and
          why-modernize stay fixed — A2 only ranks the estate.
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
            <dt>Requirement / trend</dt>
            <dd>{a1Context.requirement ? truncate(a1Context.requirement, 160) : '—'}</dd>
          </div>
          <div>
            <dt>Strategy</dt>
            <dd>
              {a1Context.strategies.length > 1
                ? a1Context.strategies.join(' · ')
                : a1Context.strategyShort}
            </dd>
          </div>
          {a1Context.why ? (
            <div className="a2-a1-why">
              <dt>Why modernize</dt>
              <dd>{truncate(a1Context.why, 220)}</dd>
            </div>
          ) : null}
        </dl>
        {brief?.context_line ? (
          <p className="a2-context-chip">{brief.context_line}</p>
        ) : null}
      </section>

      {stepBrief && (
        <>
          <ChecklistPanel
            items={checklistItems}
            checked={checked}
            title={brief?.checklist_heading || 'Operator checklist (optional)'}
            note={
              (brief?.checklist_note || stepBrief?.note || 'Optional checks tailored from A1 context.') +
              ' These do not block Run — confirm them when useful, or use Confirm all.'
            }
            onToggle={toggleChecklist}
          />
          {noneOfTheseChecked && (
            <div className="fld dash-fld a2-checklist-note">
              <label htmlFor="a2-checklist-manual-note">Why none of these apply?</label>
              <textarea
                id="a2-checklist-manual-note"
                className="a1-custom"
                rows={3}
                value={checklistManualNote}
                onChange={(e) => {
                  setChecklistManualNote(e.target.value)
                  setRunComplete(false)
                }}
                placeholder="Describe the correct A1-related operator check for this portfolio slice."
              />
            </div>
          )}
          {!checklistReady && checklistItems.length > 0 && (
            <div className="dash-run-row a2-check-all-row">
              <button type="button" className="landing-ghost" onClick={checkAllChecklist}>
                Confirm all checklist items
              </button>
            </div>
          )}
        </>
      )}

      <section className="dash-cat-panel a2-form-panel">
        <h5 className="dash-cat-heading">{formHeading}</h5>
        <p className="dash-sub">
          Same intake pattern as Factory Administrator — location, criticality, and controls —
          personalized for <strong>{a1Context.categoryName}</strong>.
        </p>
        {briefLoading && (
          <p className="dash-empty">Personalizing labels from A1… you can fill the fields now.</p>
        )}

        <div className="a1-custom-fields">
          <div className="fld dash-fld">
            <label htmlFor="a2-code-location">{primaryLabel}</label>
            {brief?.primary_hint && (
              <p className="dash-sub a2-field-hint">{brief.primary_hint}</p>
            )}
            <input
              id="a2-code-location"
              type="text"
              value={codeLocation}
              onChange={(e) => {
                setCodeLocation(e.target.value)
                setRunComplete(false)
              }}
              placeholder={primaryPlaceholder}
            />
          </div>

          <div className="mf-strategy-block">
            <h4>{critLabel}</h4>
            <p className="dash-sub">Select one level — this drives portfolio ranking order.</p>
            <div className="a1-options a2-crit-opts">
              {critOpts.map(([v, l]) => (
                <label key={v} className={`a1-opt${criticality === v ? ' on' : ''}`}>
                  <input
                    type="radio"
                    name="a2-criticality"
                    checked={criticality === v}
                    onChange={() => {
                      setCriticality(v)
                      setRunComplete(false)
                    }}
                  />
                  <span>{l}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="mf-strategy-block">
            <h4>{consLabel}</h4>
            <p className="dash-sub">
              Select all that apply, or None / not sure — shaped by your A1 category.
            </p>
            <div className="a1-options a2-reg-opts">
              {regOpts.map(([v, l]) => (
                <label key={v} className={`a1-opt${regulations.includes(v) ? ' on' : ''}`}>
                  <input
                    type="checkbox"
                    checked={regulations.includes(v)}
                    onChange={() => toggleReg(v)}
                  />
                  <span>{l}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="fld dash-fld">
            <label htmlFor="a2-notes">Portfolio notes (optional)</label>
            <textarea
              id="a2-notes"
              className="a1-custom"
              rows={3}
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value)
                setRunComplete(false)
              }}
              placeholder="Anything else the portfolio ranking should weigh — owners, freeze windows, known hotspots…"
            />
          </div>
        </div>
      </section>

      {error && <p className="err">{error}</p>}

      <div className="dash-run-row">
        <button
          className="landing-start"
          type="button"
          disabled={!canRun || busy}
          onClick={() => void runAgent()}
        >
          {busy ? 'Running…' : done || runComplete ? '▶ Run the agent again' : '▶ Run the agent'}
        </button>
        {!canRun && blockerHint && (
          <span className="dash-sub a2-blocker-hint">{blockerHint}</span>
        )}
      </div>

      {runComplete && (
        <section className="a1-just-did a2-results" aria-live="polite">
          <h4 className="a1-just-did-title">What we just did</h4>
          <div className="a1-success-banner">
            <strong>Portfolio intake complete.</strong>
            <p>
              Location, criticality, and control scope are recorded against the locked A1 context
              for <em>{a1Context.projectName}</em>. Downstream agents will use this ranking when
              they read the estate.
            </p>
          </div>
          <div className="a1-run-details">
            <h5>Portfolio details</h5>
            <dl>
              <div>
                <dt>A1 category</dt>
                <dd>{a1Context.categoryName}</dd>
              </div>
              <div>
                <dt>A1 strategy</dt>
                <dd>{a1Context.strategyShort}</dd>
              </div>
              <div>
                <dt>{primaryLabel}</dt>
                <dd>{codeLocation}</dd>
              </div>
              <div>
                <dt>{critLabel}</dt>
                <dd>{optLabel(critOpts, criticality)}</dd>
              </div>
              <div>
                <dt>{consLabel}</dt>
                <dd>{regulations.map((r) => optLabel(regOpts, r)).join(', ')}</dd>
              </div>
              {notes.trim() ? (
                <div>
                  <dt>Notes</dt>
                  <dd className="a2-assess">{notes.trim()}</dd>
                </div>
              ) : null}
              {assessment ? (
                <div>
                  <dt>Assessment</dt>
                  <dd className="a2-assess">{assessment}</dd>
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
