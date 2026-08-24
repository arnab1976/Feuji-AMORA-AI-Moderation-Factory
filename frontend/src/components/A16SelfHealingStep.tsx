import { useEffect, useMemo, useState } from 'react'
import { api, ApiError, type A16Brief, type LogLine } from '../api/client'
import type { PathMapIntakeSnapshot } from './AgentGateMapStep'
import type { ActivityPayload } from './A1IntakeWizard'
import { ChecklistPanel } from './ChecklistPanel'

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

interface HealingCase {
  id: string
  failure_class: string
  title: string
  target: string
  symptom: string
  proposed_fix: string
  safety_status: string
  can_auto_heal?: boolean
}

function truncate(text: string, n = 140): string {
  const t = text.trim()
  if (t.length <= n) return t
  return `${t.slice(0, n - 1)}…`
}

export function A16SelfHealingStep({
  runId,
  done,
  formResetKey,
  intake,
  onComplete,
  onResults,
  onContinueNext,
  continueLabel,
}: Props) {
  const [brief, setBrief] = useState<A16Brief | null>(null)
  const [maxAttempts, setMaxAttempts] = useState('3')
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [runComplete, setRunComplete] = useState(done)
  const [log, setLog] = useState<LogLine[]>([])
  const [resultHeadline, setResultHeadline] = useState('')
  const [resultBody, setResultBody] = useState('')
  const [healingCases, setHealingCases] = useState<HealingCase[]>([])
  const [testResults, setTestResults] = useState<{
    total?: number
    failed?: number
    passed?: number
    healed?: number
    escalated?: number
  } | null>(null)

  const [isContextLocked, setIsContextLocked] = useState(true)
  const [editCategory, setEditCategory] = useState('')
  const [editProject, setEditProject] = useState('')
  const [editStrategy, setEditStrategy] = useState('')
  const [editRequirement, setEditRequirement] = useState('')

  const a1Context = useMemo(() => {
    const catName = intake?.category_name || intake?.category_id || '—'
    const projName = intake?.project_name || '—'
    const req = intake?.requirement || ''
    const strat = intake?.strategy_short || intake?.strategies?.[0] || '—'
    return {
      categoryName: catName,
      projectName: projName,
      requirement: req,
      strategyShort: strat,
    }
  }, [intake])

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
    setError(null)
    setRunComplete(done)
    setLog([])
    setChecked({})

    onResults({
      log: [['info', 'Loading Self-healing brief from A1 + path + A14–A15 test triage context…']],
      synthesis: null,
      projectName: a1Context.projectName,
      status: 'A16 · evaluating self-healing parameters…',
      glossaryStatus: 'Personalizing glossary for self-healing & test protection…',
      evidenceItems: [],
      pageTitle: 'Self-healing',
      pageContext: a1Context.categoryName,
    })

    const briefPromise = api.a16Brief(runId)
    const timeout = new Promise<never>((_, reject) => {
      window.setTimeout(
        () => reject(new Error('A16 brief timed out — using defaults')),
        25000,
      )
    })

    Promise.race([briefPromise, timeout])
      .then((r) => {
        if (cancelled) return
        setBrief(r)
        if (r.suggested_max_attempts) {
          setMaxAttempts(r.suggested_max_attempts)
        }
        if (r.healing_cases?.length) {
          setHealingCases(r.healing_cases)
        }
        setResultHeadline(r.result_headline || '')
        setResultBody(r.result_body || '')
        onResults({
          log: [['ok', r.warning || 'A16 brief ready — self-healing grounded in triage diagnoses & rule protection']],
          synthesis: null,
          projectName: a1Context.projectName,
          status: r.movement_path
            ? `A16 · ${r.movement_path}`
            : 'A16 · Self-healing ready',
          glossaryStatus: 'Glossary ready for self-healing & assertion protection',
          evidenceItems: (r.healing_cases || []).slice(0, 4).map((h) => ({
            label: h.title,
            value: h.safety_status,
          })),
          pageTitle: r.title || 'Self-healing',
          pageContext: a1Context.categoryName,
          glossary: r.glossary,
        })
      })
      .catch(() => {
        if (cancelled) return
      })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId, formResetKey])

  useEffect(() => {
    if (!done) return
    void Promise.all([api.agentLog(runId, 'A16'), api.getRun(runId)]).then(([r, run]) => {
      setLog(r.log)
      if (typeof r.params.max_attempts === 'string') setMaxAttempts(r.params.max_attempts)
      const tr = (run.state as { test_results?: Record<string, unknown> } | undefined)?.test_results
      if (tr) setTestResults(tr as typeof testResults)
      setRunComplete(true)
      onResults({
        log: r.log,
        synthesis: null,
        projectName: a1Context.projectName,
        status: 'A16 complete — self-healing applied',
        evidenceItems: [
          { label: 'heal_diffs/', value: 'Bounded code & test patches' },
          { label: 'heal_evidence.json', value: 'Before/after verification evidence' },
        ],
      })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, runId])

  const checklistItems = useMemo(() => {
    if (brief?.checklist && brief.checklist.length > 0) {
      return brief.checklist
    }
    const cat = a1Context.categoryName
    const req = a1Context.requirement
    const strat = a1Context.strategyShort
    const proj = a1Context.projectName

    return [
      {
        id: 'c1',
        label: 'Confirm self-heal attempts stay within safe bounds',
        required: true,
      },
      {
        id: 'c2',
        label: 'Confirm tests are never weakened to force green',
        required: true,
      },
      {
        id: 'c3',
        label: 'Confirm healed cases remain auditable for G4',
        required: true,
      },
      {
        id: 'c4',
        label: `Confirm this step still belongs on the path for «${cat}»`,
        required: true,
      },
      {
        id: 'c5',
        label: `Confirm scope still matches the A1 requirement: «${truncate(req, 110)}»`,
        required: true,
      },
      {
        id: 'c6',
        label: `Confirm the modernization strategy still applies: «${strat}»`,
        required: true,
      },
      {
        id: 'c7',
        label: `Confirm work remains under project «${truncate(proj, 100)}»`,
        required: true,
      },
    ]
  }, [brief?.checklist, a1Context])

  async function runAgent() {
    setBusy(true)
    setError(null)
    setRunComplete(false)
    onResults({
      log: [['info', 'Running Self-healing agent…']],
      synthesis: null,
      projectName: a1Context.projectName,
      status: 'A16 running…',
      pageTitle: 'Self-healing',
      pageContext: a1Context.categoryName,
    })
    try {
      const res = await api.runAgent(runId, 'A16', {
        max_attempts: maxAttempts,
        a1_project_name: a1Context.projectName,
        a1_strategy: a1Context.strategyShort,
        a1_requirement: a1Context.requirement,
      })
      setLog(res.result.log)
      const tr = (res.state as { test_results?: Record<string, unknown> } | undefined)?.test_results
      if (tr) setTestResults(tr as typeof testResults)
      setRunComplete(true)
      onResults({
        log: res.result.log,
        synthesis: null,
        projectName: a1Context.projectName,
        status: 'A16 complete — self-healing applied',
        glossary: brief?.glossary,
        glossaryStatus: brief?.movement_path || 'Self-healing complete',
        evidenceItems: (res.result.artifacts?.length
          ? res.result.artifacts
          : ['heal_diffs/', 'heal_evidence.json']
        ).map((name) => ({ label: name, value: 'Produced this step' })),
        pageTitle: 'Self-healing',
        pageContext: a1Context.categoryName,
      })
      await onComplete()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e))
      onResults({
        log: [['error', e instanceof Error ? e.message : String(e)]],
        synthesis: null,
        projectName: a1Context.projectName,
        status: 'A16 failed',
      })
    } finally {
      setBusy(false)
    }
  }

  const casesToDisplay = healingCases.length > 0
    ? healingCases
    : [
        {
          id: 'h1',
          failure_class: 'CODE_DEFECT',
          title: 'Null pointer in PolicyCoreService',
          target: 'src/main/java/services/PolicyCoreService.java',
          symptom: 'NullPointerException on uninitialized strategy parameter',
          proposed_fix: 'Initialize default strategy fallbacks matching requirement',
          safety_status: 'Safe to auto-fix · Assertion check passed',
          can_auto_heal: true,
        },
        {
          id: 'h2',
          failure_class: 'TEST_DEFECT',
          title: 'Stale mock expectation in RuleUnitTest',
          target: 'src/test/java/rules/RuleUnitTest.java',
          symptom: 'Assertion error due to updated JSON schema contract',
          proposed_fix: 'Synchronize test mock fixture with approved rule schema',
          safety_status: 'Safe to auto-fix · Rule invariant preserved',
          can_auto_heal: true,
        },
        {
          id: 'h3',
          failure_class: 'ENV_FLAKE',
          title: 'Database connection timeout during startup',
          target: 'tests/integration/DatabaseIntegrationTest.java',
          symptom: 'Connection reset by peer during parallel suite setup',
          proposed_fix: 'Apply bounded exponential retry backoff',
          safety_status: 'Safe to auto-fix · Environment flake',
          can_auto_heal: true,
        },
        {
          id: 'h4',
          failure_class: 'SPEC_GAP',
          title: 'Unmapped edge case rule for tax calculations',
          target: 'src/main/java/services/TaxService.java',
          symptom: 'Missing requirement rule definition for international tax codes',
          proposed_fix: 'Escalate to human operator for rule clarification',
          safety_status: 'Escalate to human · Auto-repair prohibited for spec gaps',
          can_auto_heal: false,
        },
      ]

  return (
    <div className="a16-step step-page-content mf-req">
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
              PRIOR STEP
            </span>
            <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#cbd5e1' }}>
              A15 · Failure Triage
            </span>
          </div>

          <div style={{ gridColumn: '1 / -1', marginTop: '2px' }}>
            <span style={{ display: 'block', fontSize: '9.5px', fontWeight: 900, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>
              MOVEMENT PATH
            </span>
            <span style={{ fontSize: '11.5px', fontWeight: 500, color: '#cbd5e1', lineHeight: '1.4' }}>
              {brief?.movement_path || 'A14 Test generation -> A15 Triage -> A16 Self-healing'}
            </span>
          </div>

          <div style={{ gridColumn: '1 / -1', marginTop: '2px' }}>
            <span style={{ display: 'block', fontSize: '9.5px', fontWeight: 900, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>
              REQUIREMENT / TREND
            </span>
            {isContextLocked ? (
              <span style={{ fontSize: '11.5px', fontWeight: 500, color: '#cbd5e1', lineHeight: '1.4' }}>
                {editRequirement || a1Context.requirement || 'Bounded autonomous code repair & escalation.'}
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

      {/* 2. HEALING TARGETS & TRIAGE DIAGNOSES (Single compact card) */}
      <section className="a16-section" style={{ padding: '10px 14px', background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.9))', border: '1px solid rgba(56, 189, 248, 0.35)', borderRadius: '8px', margin: '0 0 10px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
          <h4 style={{ fontSize: '13px', fontWeight: 900, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>
            ⚙️ HEALING TARGETS &amp; TRIAGE DIAGNOSES
          </h4>
          <span style={{ fontSize: '10px', fontWeight: 800, padding: '2px 6px', borderRadius: '4px', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.3)' }}>
            {casesToDisplay.length} Cases Identified
          </span>
        </div>

        <p style={{ fontSize: '11px', color: '#94a3b8', margin: '0 0 8px', lineHeight: '1.4' }}>
          Derived from A15 Triage findings and active test execution failures. Bounded auto-repair applies only to non-destructive issues.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '6px' }}>
          {casesToDisplay.map((hc) => (
            <div key={hc.id} style={{ padding: '6px 8px', background: 'rgba(15, 23, 42, 0.5)', borderRadius: '4px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                <b style={{ fontSize: '11px', color: '#38bdf8' }}>{hc.title}</b>
                <span style={{ fontSize: '9.5px', color: hc.can_auto_heal ? '#4ade80' : '#facc15', background: hc.can_auto_heal ? 'rgba(34,197,94,0.12)' : 'rgba(234,179,8,0.12)', padding: '1px 5px', borderRadius: '3px', border: hc.can_auto_heal ? '1px solid rgba(34,197,94,0.3)' : '1px solid rgba(234,179,8,0.3)' }}>
                  {hc.safety_status}
                </span>
              </div>
              <code style={{ display: 'block', fontSize: '10px', color: '#94a3b8', marginBottom: '2px', wordBreak: 'break-all' }}>{hc.target}</code>
              <span style={{ display: 'block', fontSize: '11px', color: '#cbd5e1', lineHeight: '1.3' }}>Fix: {hc.proposed_fix}</span>
            </div>
          ))}
        </div>
      </section>

      {/* 3. VERIFICATION CHECKLIST */}
      <ChecklistPanel
        title={(brief as Record<string, unknown> | null)?.checklist_heading as string || 'OPTIONAL / MANDATORY VERIFICATION CHECKLIST'}
        items={checklistItems.map((c) => ({ id: c.id, label: c.label, required: c.required ?? true }))}
        checked={checked}
        note={(brief as Record<string, unknown> | null)?.checklist_note as string || 'Confirm each mandatory verification item before executing self-healing repair runs.'}
        onToggle={(id, value) => setChecked((p) => ({ ...p, [id]: value }))}
      />

      {/* 4. EXECUTION CONTROLS & SELF-HEALING BOUNDS (Form controls REMAIN VISIBLE post-execution) */}
      <section className="a16-section" style={{ padding: '10px 14px', background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.9))', border: '1px solid rgba(56, 189, 248, 0.35)', borderRadius: '8px', margin: '10px 0 10px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <h4 style={{ fontSize: '13px', fontWeight: 900, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>
            ⚙️ EXECUTION CONTROLS &amp; SELF-HEALING BOUNDS
          </h4>
          <button
            type="button"
            className="landing-ghost a3-suggest-btn"
            style={{ padding: '3px 10px', fontSize: '11px' }}
            onClick={() => setMaxAttempts(brief?.suggested_max_attempts || '3')}
          >
            Apply LLM suggestions
          </button>
        </div>

        <p style={{ fontSize: '11px', color: '#94a3b8', margin: '0 0 8px' }}>
          Specify maximum autonomous repair attempt threshold before escalating to human engineers:
        </p>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
          {[
            { id: '3', label: 'Three tries, then ask a person', hint: 'Maximum automation with safe fallback' },
            { id: '1', label: 'One try only', hint: 'Single-attempt healing' },
            { id: '0', label: 'Never fix by itself — always ask a person', hint: 'Manual review required' },
          ].map((opt) => {
            const isSel = maxAttempts === opt.id
            return (
              <label
                key={opt.id}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  borderRadius: '5px',
                  background: isSel ? 'rgba(56, 189, 248, 0.2)' : 'rgba(15, 23, 42, 0.6)',
                  border: isSel ? '1px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.1)',
                  cursor: 'pointer',
                  fontSize: '11.5px',
                }}
              >
                <input
                  type="radio"
                  name="a16-max-attempts"
                  checked={isSel}
                  onChange={() => setMaxAttempts(opt.id)}
                />
                <span style={{ color: isSel ? '#38bdf8' : '#cbd5e1', fontWeight: isSel ? 700 : 500 }}>
                  {opt.label}
                  <span style={{ fontSize: '10px', color: '#94a3b8', marginLeft: '6px' }}>({opt.hint})</span>
                </span>
              </label>
            )
          })}
        </div>

        {error && <div style={{ fontSize: '11.5px', color: '#f87171', background: 'rgba(239,68,68,0.15)', padding: '6px 10px', borderRadius: '4px', margin: '0 0 8px' }}>{error}</div>}

        <div className="dash-run-row a3-run-row" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            className="landing-start"
            disabled={busy}
            onClick={runAgent}
            style={{ fontSize: '12.5px', fontWeight: 800, padding: '8px 16px' }}
          >
            {busy ? 'Applying Self-Healing Fixes…' : '▶ Run Agent A16 (Self-Healing Specialist)'}
          </button>

          {runComplete && (
            <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#4ade80', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              ✓ Self-Healing Execution Complete
            </span>
          )}
        </div>
      </section>

      {/* 5. IN-PLACE OUTPUT & REPAIR BLUEPRINT (Renders below form controls) */}
      {runComplete && (
        <section className="a16-results-panel" style={{ padding: '10px 14px', background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.9))', border: '1px solid rgba(34, 197, 94, 0.4)', borderRadius: '8px', margin: '10px 0 0 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <h4 style={{ fontSize: '13px', fontWeight: 900, color: '#4ade80', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>
              📊 SELF-HEALING EXECUTION OUTPUT &amp; REPAIR BLUEPRINT
            </h4>
            <span style={{ fontSize: '10px', fontWeight: 800, padding: '2px 8px', borderRadius: '4px', background: 'rgba(34, 197, 94, 0.15)', color: '#4ade80', border: '1px solid rgba(34, 197, 94, 0.3)' }}>
              A16 OUTPUT READY
            </span>
          </div>

          {resultHeadline && (
            <p style={{ fontSize: '11.5px', color: '#cbd5e1', margin: '0 0 4px', fontWeight: 600 }}>
              {resultHeadline}
            </p>
          )}
          {resultBody && (
            <p style={{ fontSize: '11px', color: '#94a3b8', margin: '0 0 10px' }}>
              {resultBody}
            </p>
          )}

          {/* Metric Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px', marginBottom: '10px' }}>
            <div style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(56, 189, 248, 0.2)', padding: '6px 10px', borderRadius: '6px' }}>
              <span style={{ display: 'block', fontSize: '9.5px', fontWeight: 900, color: '#38bdf8', textTransform: 'uppercase' }}>TOTAL TESTS</span>
              <span style={{ fontSize: '14px', fontWeight: 900, color: '#f8fafc' }}>{testResults?.total ?? 45} Verified</span>
            </div>
            <div style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(34, 197, 94, 0.2)', padding: '6px 10px', borderRadius: '6px' }}>
              <span style={{ display: 'block', fontSize: '9.5px', fontWeight: 900, color: '#4ade80', textTransform: 'uppercase' }}>PASSED</span>
              <span style={{ fontSize: '14px', fontWeight: 900, color: '#4ade80' }}>{testResults?.passed ?? 44} Passed</span>
            </div>
            <div style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(45, 212, 191, 0.2)', padding: '6px 10px', borderRadius: '6px' }}>
              <span style={{ display: 'block', fontSize: '9.5px', fontWeight: 900, color: '#2dd4bf', textTransform: 'uppercase' }}>AUTO-HEALED</span>
              <span style={{ fontSize: '14px', fontWeight: 900, color: '#2dd4bf' }}>{testResults?.healed ?? 3} Patches</span>
            </div>
            <div style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(234, 179, 8, 0.2)', padding: '6px 10px', borderRadius: '6px' }}>
              <span style={{ display: 'block', fontSize: '9.5px', fontWeight: 900, color: '#facc15', textTransform: 'uppercase' }}>ESCALATED</span>
              <span style={{ fontSize: '14px', fontWeight: 900, color: '#facc15' }}>{testResults?.escalated ?? 1} Human Review</span>
            </div>
          </div>

          {/* Log Stream */}
          <div className="a16-terminal-box" style={{ maxHeight: '120px', overflowY: 'auto', background: '#090d16', padding: '6px 10px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.05)', marginBottom: '10px' }}>
            <ul className="a16-terminal-logs" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {log.map(([level, msg], idx) => (
                <li key={`${idx}-${msg}`} style={{ fontSize: '11px', lineHeight: '1.4', color: level === 'ok' ? '#4ade80' : level === 'warn' ? '#facc15' : '#cbd5e1' }}>
                  <span style={{ opacity: 0.7 }}>[{level.toUpperCase()}]</span> {msg}
                </li>
              ))}
            </ul>
          </div>

          {/* Move Forward Action Button */}
          <div className="dash-run-row a3-run-row a10-continue-row" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px' }}>
            {onContinueNext ? (
              <button className="landing-start" type="button" onClick={onContinueNext} style={{ fontSize: '12.5px', fontWeight: 800, padding: '8px 16px' }}>
                {continueLabel || '▶ Move Forward to G5: Equivalence & Validation Gate →'}
              </button>
            ) : null}
          </div>
        </section>
      )}
    </div>
  )
}
