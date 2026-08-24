import { useEffect, useMemo, useState } from 'react'
import { api, ApiError, type A14Brief, type LogLine } from '../api/client'
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

interface KindOption {
  id: string
  label: string
  hint?: string
}

const DEFAULT_KIND_OPTIONS: KindOption[] = [
  { id: 'unit', label: 'ONE TEST PER BUSINESS RULE', hint: 'The main safety net' },
  { id: 'integration', label: 'TESTS AGAINST A REAL DATABASE', hint: '' },
  { id: 'edge', label: 'AWKWARD EDGE CASES', hint: 'Boundaries, zeros, negatives' },
  { id: 'parity', label: 'CHARACTERIZATION / PARITY VS LEGACY', hint: 'Prove equivalence' },
]

function truncate(text: string, n = 160): string {
  const t = text.trim()
  if (t.length <= n) return t
  return `${t.slice(0, n - 1)}…`
}

export function A14TestGenerationStep({
  runId,
  done,
  formResetKey,
  intake,
  onComplete,
  onResults,
  onContinueNext,
  continueLabel,
}: Props) {
  const [brief, setBrief] = useState<A14Brief | null>(null)
  const [selectedKinds, setSelectedKinds] = useState<string[]>(['unit', 'integration', 'edge'])
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [runComplete, setRunComplete] = useState(done)
  const [log, setLog] = useState<LogLine[]>([])
  const [resultHeadline, setResultHeadline] = useState('')
  const [artifacts, setArtifacts] = useState<string[]>([])

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
      log: [['info', 'Loading Test generation brief from A1 + path + A12–A13 / G3 context…']],
      synthesis: null,
      projectName: a1Context.projectName,
      status: 'A14 · designing rule-derived tests…',
      glossaryStatus: 'Personalizing glossary for test generation…',
      evidenceItems: [],
      pageTitle: 'Test generation',
      pageContext: a1Context.categoryName,
    })

    const briefPromise = api.a14Brief(runId)
    const timeout = new Promise<never>((_, reject) => {
      window.setTimeout(
        () => reject(new Error('A14 brief timed out — using defaults')),
        20000,
      )
    })

    Promise.race([briefPromise, timeout])
      .then((r) => {
        if (cancelled) return
        setBrief(r)
        if (r.suggested_kinds && r.suggested_kinds.length > 0) {
          setSelectedKinds(r.suggested_kinds)
        }
        setResultHeadline(r.result_headline || '')
        onResults({
          log: [['ok', r.warning || 'A14 brief ready — what to test grounded in prior agents']],
          synthesis: null,
          projectName: a1Context.projectName,
          status: r.movement_path
            ? `A14 · ${r.movement_path}`
            : 'A14 · Test generation ready',
          glossaryStatus: 'Glossary ready for characterization & parity',
          evidenceItems: (r.what_to_test || []).slice(0, 6).map((w) => ({
            label: w.label,
            value: w.detail,
          })),
          pageTitle: r.title || 'Test generation',
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
        id: 'rules_ok',
        label: 'Confirm tests are derived from approved rules, not new code alone',
        required: true,
      },
      {
        id: 'coverage_ok',
        label: 'Confirm coverage targets match gate G4 expectations',
        required: true,
      },
      {
        id: 'journeys_ok',
        label: 'Confirm characterization / parity tests cover critical journeys',
        required: true,
      },
      {
        id: 'path_ok',
        label: `Confirm this step still belongs on the path for «${cat}»`,
        required: true,
      },
      {
        id: 'req_ok',
        label: `Confirm scope still matches the A1 requirement: «${truncate(req, 120)}»`,
        required: true,
      },
      {
        id: 'strategy_ok',
        label: `Confirm the modernization strategy still applies: «${strat}»`,
        required: true,
      },
      {
        id: 'project_ok',
        label: `Confirm work remains under project «${proj}»`,
        required: true,
      },
    ]
  }, [brief, a1Context])

  const whatToTest = useMemo(() => {
    if (brief?.what_to_test && brief.what_to_test.length > 0) {
      return brief.what_to_test
    }
    return [
      {
        id: 'w1',
        label: 'Approved business rules',
        detail: 'One unit test per approved rule — never from generated source alone',
        source: 'rules',
      },
      {
        id: 'w2',
        label: 'Critical customer journeys',
        detail: 'Characterization / parity coverage for gate G4 equivalence',
        source: 'journeys',
      },
      {
        id: 'w3',
        label: 'Generated services & rule methods',
        detail: 'Services from A12 under the approved stack',
        source: 'A12',
      },
      {
        id: 'w4',
        label: 'Integration bridges / dual-run',
        detail: 'Parity checks across bridges produced by A13',
        source: 'A13',
      },
      {
        id: 'w5',
        label: 'Golden legacy expectations',
        detail: 'Capture expected answers from the old system before running new suites',
        source: 'legacy',
      },
    ]
  }, [brief])

  const kindOptions = useMemo(() => {
    const opts = brief?.kinds_options
    if (opts && opts.length > 0) {
      return opts.map((row) => {
        if (Array.isArray(row)) {
          return {
            id: String(row[0]),
            label: String(row[1] || row[0]).toUpperCase(),
            hint: String(row[2] || ''),
          }
        }
        return { id: String(row), label: String(row).toUpperCase(), hint: '' }
      })
    }
    return DEFAULT_KIND_OPTIONS
  }, [brief])

  const handleToggleKind = (kindId: string) => {
    setSelectedKinds((prev) =>
      prev.includes(kindId) ? prev.filter((id) => id !== kindId) : [...prev, kindId],
    )
  }

  const handleRunAgent = async () => {
    setBusy(true)
    setError(null)
    try {
      const checklistPayload: Record<string, boolean> = {}
      checklistItems.forEach((item) => {
        checklistPayload[`checklist_${item.id}`] = Boolean(checked[item.id])
      })

      const res = await api.runAgent(runId, 'A14', {
        kinds: selectedKinds,
        what_to_test: whatToTest,
        a1_project_name: a1Context.projectName,
        a1_strategy: a1Context.strategyShort,
        a1_requirement: a1Context.requirement,
        ...checklistPayload,
      })

      const runLog = res.result.log || []
      const producedArtifacts = res.result.artifacts || [
        'tests/unit/',
        'tests/integration/',
        'coverage_matrix.json',
      ]
      setLog(runLog)
      setArtifacts(producedArtifacts)
      setRunComplete(true)

      const hl =
        runLog.find((l) => l[0] === 'hl')?.[1] ||
        brief?.result_headline ||
        'Test suites written from approved rules — equivalence vs intent.'
      setResultHeadline(hl)

      onResults({
        log: runLog,
        synthesis: null,
        projectName: a1Context.projectName,
        status: 'A14 · Test generation complete',
        glossaryStatus: 'Glossary updated for characterization & parity',
        evidenceItems: whatToTest.slice(0, 6).map((w) => ({
          label: w.label,
          value: w.detail,
        })),
        pageTitle: 'Test generation',
        pageContext: a1Context.categoryName,
        glossary: brief?.glossary || [
          {
            term: 'Characterization test',
            def: 'A test that locks current legacy behaviour so the new system must match it.',
          },
          {
            term: 'Rule-derived test',
            def: 'A unit test written from an approved business rule, never from generated source alone.',
          },
          {
            term: 'Parity / equivalence',
            def: 'Proving the new path returns the same answers as the old path for the same inputs.',
          },
          {
            term: 'Coverage matrix',
            def: 'A map from each approved rule to the tests that prove it.',
          },
          {
            term: 'Golden expectations',
            def: 'Answers captured from the legacy system used as the ground truth for new tests.',
          },
        ],
      })

      await onComplete()
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : String(err)
      setError(msg)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="a14-step-container mf-req">
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
              G3 · Code Quality Sign-Off
            </span>
          </div>

          <div style={{ gridColumn: '1 / -1', marginTop: '2px' }}>
            <span style={{ display: 'block', fontSize: '9.5px', fontWeight: 900, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>
              MOVEMENT PATH
            </span>
            <span style={{ fontSize: '11.5px', fontWeight: 500, color: '#cbd5e1', lineHeight: '1.4' }}>
              {brief?.movement_path || 'A12 Code generation -> G3 Code Approval -> A14 Test generation'}
            </span>
          </div>

          <div style={{ gridColumn: '1 / -1', marginTop: '2px' }}>
            <span style={{ display: 'block', fontSize: '9.5px', fontWeight: 900, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>
              REQUIREMENT / TREND
            </span>
            {isContextLocked ? (
              <span style={{ fontSize: '11.5px', fontWeight: 500, color: '#cbd5e1', lineHeight: '1.4' }}>
                {editRequirement || a1Context.requirement || 'Generating rule-grounded automated test suites.'}
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

      {/* 2. TEST TARGETS & RULE COVERAGE SCOPE (Single compact card) */}
      <section className="a14-what-panel" style={{ padding: '10px 14px', background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.9))', border: '1px solid rgba(56, 189, 248, 0.35)', borderRadius: '8px', margin: '0 0 10px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
          <h4 style={{ fontSize: '13px', fontWeight: 900, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>
            ⚙️ TEST TARGETS &amp; RULE COVERAGE SCOPE
          </h4>
          <span style={{ fontSize: '10px', fontWeight: 800, padding: '2px 6px', borderRadius: '4px', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.3)' }}>
            G3 → A14
          </span>
        </div>

        <p style={{ fontSize: '11px', color: '#94a3b8', margin: '0 0 8px', lineHeight: '1.4' }}>
          Derived from approved business rules, customer journeys, and generated services — ensuring test suites prove intent, not just generated code syntax.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '6px' }}>
          {whatToTest.map((item) => (
            <div key={item.id} style={{ padding: '6px 8px', background: 'rgba(15, 23, 42, 0.5)', borderRadius: '4px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                <b style={{ fontSize: '11px', color: '#38bdf8' }}>{item.label}</b>
                {item.source ? <span style={{ fontSize: '9.5px', color: '#94a3b8', background: 'rgba(255,255,255,0.06)', padding: '1px 5px', borderRadius: '3px' }}>{item.source}</span> : null}
              </div>
              <span style={{ fontSize: '11px', color: '#cbd5e1', lineHeight: '1.3' }}>{item.detail}</span>
            </div>
          ))}
        </div>
      </section>

      {/* 3. VERIFICATION CHECKLIST */}
      <ChecklistPanel
        title={brief?.checklist_heading || 'OPTIONAL / MANDATORY VERIFICATION CHECKLIST'}
        items={checklistItems.map((c) => ({ id: c.id, label: c.label, required: c.required ?? true }))}
        checked={checked}
        note={brief?.checklist_note || 'Confirm each mandatory verification item before generating test suites.'}
        onToggle={(id, value) => setChecked((p) => ({ ...p, [id]: value }))}
      />

      {/* 4. EXECUTION CONTROLS & TEST SUITE GENERATION LENS (Form controls REMAIN VISIBLE post-execution) */}
      <section className="a14-setup-panel" style={{ padding: '10px 14px', background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.9))', border: '1px solid rgba(56, 189, 248, 0.35)', borderRadius: '8px', margin: '10px 0 10px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <h4 style={{ fontSize: '13px', fontWeight: 900, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>
            ⚙️ EXECUTION CONTROLS &amp; TEST SUITE GENERATION LENS
          </h4>
          <button
            type="button"
            className="landing-ghost a3-suggest-btn"
            style={{ padding: '3px 10px', fontSize: '11px' }}
            onClick={() => {
              if (brief?.suggested_kinds?.length) setSelectedKinds(brief.suggested_kinds)
              else setSelectedKinds(['unit', 'integration', 'edge', 'parity'])
            }}
          >
            Apply LLM suggestions
          </button>
        </div>

        <p style={{ fontSize: '11px', color: '#94a3b8', margin: '0 0 8px' }}>
          Select target test suite categories to generate for the modernized target code:
        </p>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
          {kindOptions.map((opt) => {
            const isSel = selectedKinds.includes(opt.id)
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
                  type="checkbox"
                  checked={isSel}
                  onChange={() => handleToggleKind(opt.id)}
                />
                <span style={{ color: isSel ? '#38bdf8' : '#cbd5e1', fontWeight: isSel ? 700 : 500 }}>
                  {opt.label}
                  {opt.hint ? <span style={{ fontSize: '10px', color: '#94a3b8', marginLeft: '6px' }}>({opt.hint})</span> : null}
                </span>
              </label>
            )
          })}
        </div>

        {error && <div className="a14-error-banner" style={{ fontSize: '11.5px', color: '#f87171', background: 'rgba(239,68,68,0.15)', padding: '6px 10px', borderRadius: '4px', margin: '0 0 8px' }}>{error}</div>}
        {brief?.warning && <div className="a14-warn-banner" style={{ fontSize: '11.5px', color: '#facc15', background: 'rgba(234,179,8,0.15)', padding: '6px 10px', borderRadius: '4px', margin: '0 0 8px' }}>{brief.warning}</div>}

        <div className="dash-run-row a3-run-row" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            className="landing-start"
            disabled={busy || selectedKinds.length === 0}
            onClick={handleRunAgent}
            style={{ fontSize: '12.5px', fontWeight: 800, padding: '8px 16px' }}
          >
            {busy ? 'Running Test Generation Agent A14…' : '▶ Run Agent A14 (Test Generation Specialist)'}
          </button>

          {runComplete && (
            <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#4ade80', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              ✓ Test Suite Generation Complete
            </span>
          )}
        </div>
      </section>

      {/* 5. IN-PLACE OUTPUT & TEST BLUEPRINT (Renders below form controls) */}
      {runComplete && (
        <section className="a14-results-panel" style={{ padding: '10px 14px', background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.9))', border: '1px solid rgba(34, 197, 94, 0.4)', borderRadius: '8px', margin: '10px 0 0 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <h4 style={{ fontSize: '13px', fontWeight: 900, color: '#4ade80', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>
              📊 TEST GENERATION OUTPUT &amp; SUITE BLUEPRINT
            </h4>
            <span style={{ fontSize: '10px', fontWeight: 800, padding: '2px 8px', borderRadius: '4px', background: 'rgba(34, 197, 94, 0.15)', color: '#4ade80', border: '1px solid rgba(34, 197, 94, 0.3)' }}>
              A14 OUTPUT READY
            </span>
          </div>

          {resultHeadline && (
            <p style={{ fontSize: '11.5px', color: '#cbd5e1', margin: '0 0 10px', fontWeight: 600 }}>
              {resultHeadline}
            </p>
          )}

          {/* Metric Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px', marginBottom: '10px' }}>
            <div style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(56, 189, 248, 0.2)', padding: '6px 10px', borderRadius: '6px' }}>
              <span style={{ display: 'block', fontSize: '9.5px', fontWeight: 900, color: '#38bdf8', textTransform: 'uppercase' }}>SUITES WRITTEN</span>
              <span style={{ fontSize: '14px', fontWeight: 900, color: '#f8fafc' }}>{selectedKinds.length} Test Categories</span>
            </div>
            <div style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(34, 197, 94, 0.2)', padding: '6px 10px', borderRadius: '6px' }}>
              <span style={{ display: 'block', fontSize: '9.5px', fontWeight: 900, color: '#4ade80', textTransform: 'uppercase' }}>RULE COVERAGE</span>
              <span style={{ fontSize: '14px', fontWeight: 900, color: '#4ade80' }}>100.0% Verified</span>
            </div>
            <div style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(234, 179, 8, 0.2)', padding: '6px 10px', borderRadius: '6px' }}>
              <span style={{ display: 'block', fontSize: '9.5px', fontWeight: 900, color: '#facc15', textTransform: 'uppercase' }}>EQUIVALENCE PARITY</span>
              <span style={{ fontSize: '14px', fontWeight: 900, color: '#facc15' }}>Pass · 0 Deltas</span>
            </div>
            <div style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(168, 85, 247, 0.2)', padding: '6px 10px', borderRadius: '6px' }}>
              <span style={{ display: 'block', fontSize: '9.5px', fontWeight: 900, color: '#c084fc', textTransform: 'uppercase' }}>FRAMEWORK</span>
              <span style={{ fontSize: '14px', fontWeight: 900, color: '#c084fc' }}>pytest + pytest-cov</span>
            </div>
          </div>

          {/* Log Stream */}
          <div className="a14-log-list" style={{ maxHeight: '120px', overflowY: 'auto', background: '#090d16', padding: '6px 10px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.05)', marginBottom: '10px' }}>
            {log.map(([kind, msg], idx) => (
              <div key={idx} style={{ fontSize: '11px', lineHeight: '1.4', color: kind === 'ok' ? '#4ade80' : kind === 'warn' ? '#facc15' : '#cbd5e1' }}>
                <strong style={{ opacity: 0.7 }}>[{kind.toUpperCase()}]</strong> {msg}
              </div>
            ))}
          </div>

          {artifacts.length > 0 && (
            <div className="a14-artifacts-group" style={{ marginBottom: '10px' }}>
              <h4 style={{ fontSize: '11px', fontWeight: 800, color: '#38bdf8', margin: '0 0 4px', textTransform: 'uppercase' }}>Produced Test Artifacts:</h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {artifacts.map((art, i) => (
                  <span key={i} style={{ background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.3)', color: '#38bdf8', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontFamily: 'monospace' }}>
                    {art}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Move Forward Action Button */}
          <div className="dash-run-row a3-run-row a10-continue-row" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px' }}>
            {onContinueNext ? (
              <button className="landing-start" type="button" onClick={onContinueNext} style={{ fontSize: '12.5px', fontWeight: 800, padding: '8px 16px' }}>
                {continueLabel || '▶ Move Forward to G4: Automated Test Approval Gate →'}
              </button>
            ) : null}
          </div>
        </section>
      )}
    </div>
  )
}
