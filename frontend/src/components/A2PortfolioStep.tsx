import { useEffect, useMemo, useState } from 'react'
import { api, ApiError, type A2Brief, type LogLine, type StepBrief } from '../api/client'
import { validateRepoLocation } from '../utils/repositoryValidator'
import type { PathMapIntakeSnapshot } from './AgentGateMapStep'
import type { ActivityPayload, GlossaryTerm } from './A1IntakeWizard'
import { ChecklistPanel } from './ChecklistPanel'

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
  const [isContextLocked, setIsContextLocked] = useState(true)
  const [editCategory, setEditCategory] = useState('')
  const [editProject, setEditProject] = useState('')
  const [editStrategy, setEditStrategy] = useState('')
  const [editRequirement, setEditRequirement] = useState('')
  const [customRegulatoryText, setCustomRegulatoryText] = useState('')
  const [validationNotice, setValidationNotice] = useState<{ type: 'ok' | 'err'; message: string } | null>(null)

  async function validateRepository() {
    const loc = codeLocation.trim()
    const clientRes = validateRepoLocation(loc)
    if (!clientRes.isValid) {
      setValidationNotice({
        type: 'err',
        message: clientRes.message,
      })
      return
    }

    try {
      const serverRes = await api.validateRepo(loc, undefined, a1Context.categoryId)
      setValidationNotice({
        type: serverRes.is_valid ? 'ok' : 'err',
        message: serverRes.message,
      })
    } catch {
      setValidationNotice({
        type: clientRes.isValid ? 'ok' : 'err',
        message: clientRes.message,
      })
    }
  }

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

  const primaryLabel = brief?.primary_label || 'Where does the old code live?'
  const primaryPlaceholder =
    brief?.primary_placeholder || 'https://git.example.com/legacy/core-system.git'
  const critLabel = brief?.criticality_label || 'How critical is this system?'
  const consLabel = brief?.constraints_label || 'Any regulatory obligations?'

  return (
    <div className="a2-step a1-wizard mf-req">
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
              A1 · Factory administrator
            </span>
          </div>

          <div style={{ gridColumn: '1 / -1', marginTop: '2px' }}>
            <span style={{ display: 'block', fontSize: '9.5px', fontWeight: 900, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>
              CONTINUITY
            </span>
            <span style={{ fontSize: '11.5px', fontWeight: 500, color: '#cbd5e1', lineHeight: '1.4' }}>
              Portfolio fields below are shaped by this locked intake context. A2 ranks the estate for downstream agents.
            </span>
          </div>

          <div style={{ gridColumn: '1 / -1', marginTop: '2px' }}>
            <span style={{ display: 'block', fontSize: '9.5px', fontWeight: 900, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>
              REQUIREMENT / TREND
            </span>
            {isContextLocked ? (
              <span style={{ fontSize: '11.5px', fontWeight: 500, color: '#cbd5e1', lineHeight: '1.4' }}>
                {editRequirement || a1Context.requirement || 'Modernizing legacy application estate.'}
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
        </div>
      </section>

      {stepBrief && (
        <>
          <ChecklistPanel
            items={checklistItems}
            checked={checked}
            title={brief?.checklist_heading || 'OPTIONAL VERIFICATION CHECKLIST'}
            note={
              (brief?.checklist_note || stepBrief?.note || 'These items are optional and tailored from A1 to ensure proper handling.') +
              ' These do not block Run — confirm them when useful, or use Click All Mandatory Checklist Items.'
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
        </>
      )}

      {/* 2. EXECUTION CONTROLS & ESTATE FORM (Single rich compact card) */}
      <section className="dash-cat-panel a2-form-panel" style={{ padding: '10px 14px', background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.9))', border: '1px solid rgba(56, 189, 248, 0.35)', borderRadius: '8px', margin: '0 0 10px 0' }}>
        <h4 style={{ fontSize: '13px', fontWeight: 900, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 4px' }}>
          ⚙️ EXECUTION CONTROLS &amp; ESTATE DISCOVERY
        </h4>
        <p className="dash-sub" style={{ fontSize: '11px', margin: '0 0 8px', color: '#94a3b8' }}>
          Intake pattern personalized for <strong>{a1Context.categoryName}</strong>.
        </p>

        <div className="a1-custom-fields" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div className="fld dash-fld">
            <label htmlFor="a2-code-location" style={{ fontSize: '11.5px', fontWeight: 700, color: '#f8fafc', marginBottom: '2px', display: 'block' }}>{primaryLabel}</label>
            <div style={{ background: 'rgba(56, 189, 248, 0.08)', border: '1px solid rgba(56, 189, 248, 0.25)', borderRadius: '6px', padding: '6px 10px', marginBottom: '6px' }}>
              <span style={{ fontSize: '11px', color: '#38bdf8', fontWeight: 700 }}>
                💡 Acceptable Inputs: Git Repository URL (e.g. https://github.com/org/repo.git), Web Crawler URL, Local File Path / Directory, Raw Code Snippet (Copy-Paste), or IDE Extension Workspace.
              </span>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                id="a2-code-location"
                type="text"
                value={codeLocation}
                onChange={(e) => {
                  setCodeLocation(e.target.value)
                  setValidationNotice(null)
                  setRunComplete(false)
                }}
                placeholder={primaryPlaceholder}
                style={{ flex: 1, background: '#0f172a', border: '1px solid #38bdf8', color: '#f8fafc', padding: '6px 10px', borderRadius: '4px', fontSize: '12px' }}
              />
              <button
                type="button"
                className="landing-start"
                onClick={validateRepository}
                style={{
                  padding: '6px 14px',
                  fontSize: '11.5px',
                  fontWeight: 800,
                  whiteSpace: 'nowrap',
                  background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.25), rgba(14, 165, 233, 0.35))',
                  border: '1px solid #38bdf8',
                  color: '#38bdf8',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  boxShadow: '0 2px 8px rgba(56, 189, 248, 0.25)',
                }}
              >
                🔍 Validate the Repository
              </button>
            </div>

            {validationNotice && (
              <div
                style={{
                  marginTop: '6px',
                  padding: '6px 10px',
                  borderRadius: '4px',
                  fontSize: '11.5px',
                  fontWeight: 700,
                  background: validationNotice.type === 'ok' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                  border: validationNotice.type === 'ok' ? '1px solid rgba(34, 197, 94, 0.4)' : '1px solid rgba(239, 68, 68, 0.4)',
                  color: validationNotice.type === 'ok' ? '#4ade80' : '#f87171',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <span>{validationNotice.message}</span>
              </div>
            )}
          </div>

          <div className="mf-strategy-block" style={{ marginBottom: '6px' }}>
            <h4 style={{ fontSize: '11.5px', fontWeight: 700, color: '#f8fafc', margin: '0 0 2px' }}>{critLabel}</h4>
            <p className="dash-sub" style={{ fontSize: '10.5px', margin: '0 0 6px', color: '#94a3b8' }}>Select one level — this drives portfolio ranking order.</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {critOpts.map(([v, l]) => (
                <label key={v} className={`a1-opt${criticality === v ? ' on' : ''}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '4px', background: criticality === v ? 'rgba(56, 189, 248, 0.2)' : 'rgba(15, 23, 42, 0.6)', border: criticality === v ? '1px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.1)', cursor: 'pointer', fontSize: '11.5px' }}>
                  <input
                    type="radio"
                    name="a2-criticality"
                    checked={criticality === v}
                    onChange={() => {
                      setCriticality(v)
                      setRunComplete(false)
                    }}
                  />
                  <span style={{ color: criticality === v ? '#38bdf8' : '#cbd5e1', fontWeight: criticality === v ? 700 : 400 }}>{l}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="mf-strategy-block" style={{ marginBottom: '6px' }}>
            <h4 style={{ fontSize: '11.5px', fontWeight: 700, color: '#f8fafc', margin: '0 0 2px' }}>{consLabel}</h4>
            <p className="dash-sub" style={{ fontSize: '10.5px', margin: '0 0 6px', color: '#94a3b8' }}>
              Select all that apply, or None / not sure — shaped by your A1 category.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: regulations.includes('other') ? '6px' : '0' }}>
              {regOpts.map(([v, l]) => (
                <label key={v} className={`a1-opt${regulations.includes(v) ? ' on' : ''}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '4px', background: regulations.includes(v) ? 'rgba(56, 189, 248, 0.2)' : 'rgba(15, 23, 42, 0.6)', border: regulations.includes(v) ? '1px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.1)', cursor: 'pointer', fontSize: '11.5px' }}>
                  <input
                    type="checkbox"
                    checked={regulations.includes(v)}
                    onChange={() => toggleReg(v)}
                  />
                  <span style={{ color: regulations.includes(v) ? '#38bdf8' : '#cbd5e1', fontWeight: regulations.includes(v) ? 700 : 400 }}>{l}</span>
                </label>
              ))}
            </div>
            {regulations.includes('other') && (
              <div style={{ marginTop: '6px' }}>
                <input
                  type="text"
                  value={customRegulatoryText}
                  onChange={(e) => setCustomRegulatoryText(e.target.value)}
                  placeholder="Specify country / domain regulatory obligation (e.g., HIPAA - USA, APRA - Australia, BaFin - Germany, RBI - India)"
                  style={{ width: '100%', background: '#0f172a', border: '1px solid #38bdf8', color: '#f8fafc', padding: '4px 8px', borderRadius: '4px', fontSize: '11.5px' }}
                />
              </div>
            )}
          </div>

          <div className="fld dash-fld">
            <label htmlFor="a2-notes" style={{ fontSize: '11.5px', fontWeight: 700, color: '#f8fafc', marginBottom: '2px', display: 'block' }}>Portfolio notes (optional)</label>
            <textarea
              id="a2-notes"
              className="a1-custom"
              rows={2}
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value)
                setRunComplete(false)
              }}
              placeholder="Anything else the portfolio ranking should weigh — owners, freeze windows, known hotspots…"
              style={{ width: '100%', background: '#0f172a', border: '1px solid rgba(255, 255, 255, 0.15)', color: '#f8fafc', padding: '4px 8px', borderRadius: '4px', fontSize: '11.5px', fontFamily: 'inherit' }}
            />
          </div>
        </div>
      </section>

      {error && <p className="err">{error}</p>}

      <div className="dash-run-row" style={{ marginBottom: '10px' }}>
        <button
          className="landing-start"
          type="button"
          disabled={!canRun || busy}
          onClick={() => void runAgent()}
          style={{ fontSize: '12.5px', fontWeight: 800, padding: '8px 16px' }}
        >
          {busy ? 'Running…' : done || runComplete ? '▶ Run the agent again' : '▶ Run estate discovery agent'}
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
                <dd>{regulations.map((r) => optLabel(regOpts, r)).join(', ')}{customRegulatoryText.trim() ? ` (${customRegulatoryText.trim()})` : ''}</dd>
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
          <div className="a1-just-did-actions" style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button className="landing-start" type="button" onClick={() => onContinueNext?.()} style={{ fontSize: '12.5px', fontWeight: 800, padding: '8px 16px' }}>
              {continueLabel || '▶ Move Forward to A3: Technical Standards Agent →'}
            </button>
            <span className="a1-step-badge">✓ Step complete</span>
          </div>
        </section>
      )}
    </div>
  )
}
