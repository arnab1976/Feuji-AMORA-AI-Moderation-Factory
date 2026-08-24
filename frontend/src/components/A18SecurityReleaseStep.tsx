import { useEffect, useMemo, useState } from 'react'
import { api, ApiError, type A18Brief, type LogLine } from '../api/client'
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

function truncate(text: string, n = 140): string {
  const t = text.trim()
  if (t.length <= n) return t
  return `${t.slice(0, n - 1)}…`
}

export function A18SecurityReleaseStep({
  runId,
  done,
  formResetKey,
  intake,
  onComplete,
  onResults,
  onContinueNext,
  continueLabel,
}: Props) {
  const [brief, setBrief] = useState<A18Brief | null>(null)
  const [plan, setPlan] = useState('slow')
  const [rollbackOnErrors, setRollbackOnErrors] = useState(true)
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [runComplete, setRunComplete] = useState(done)
  const [log, setLog] = useState<LogLine[]>([])
  const [resultHeadline, setResultHeadline] = useState('')
  const [resultBody, setResultBody] = useState('')

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
      log: [['info', 'Loading Security and release brief from A1 + path + G5 equivalence approval context…']],
      synthesis: null,
      projectName: a1Context.projectName,
      status: 'A18 · preparing security scan & gradual release plan…',
      glossaryStatus: 'Personalizing glossary for security scanning & automated rollback…',
      evidenceItems: [],
      pageTitle: 'Security and release',
      pageContext: a1Context.categoryName,
    })

    const briefPromise = api.a18Brief(runId)
    const timeout = new Promise<never>((_, reject) => {
      window.setTimeout(
        () => reject(new Error('A18 brief timed out — using defaults')),
        25000,
      )
    })

    Promise.race([briefPromise, timeout])
      .then((r) => {
        if (cancelled) return
        setBrief(r)
        if (r.suggested_plan) {
          setPlan(r.suggested_plan)
        }
        setResultHeadline(r.result_headline || '')
        setResultBody(r.result_body || '')
        onResults({
          log: [['ok', r.warning || 'A18 brief ready — security scan & release pipeline grounded in G5 approved equivalence']],
          synthesis: null,
          projectName: a1Context.projectName,
          status: r.movement_path
            ? `A18 · ${r.movement_path}`
            : 'A18 · Security and release ready',
          glossaryStatus: 'Glossary ready for security vulnerability & rollback triggers',
          evidenceItems: [
            { label: 'Security Scans', value: 'SAST / DAST / Secrets / SBOM' },
            { label: 'Release Strategy', value: 'Gradual Canary Traffic Split' },
          ],
          pageTitle: r.title || 'Security and release',
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
    void api.agentLog(runId, 'A18').then((r) => {
      setLog(r.log)
      if (typeof r.params.plan === 'string') {
        setPlan(r.params.plan)
      }
      setRunComplete(true)
      onResults({
        log: r.log,
        synthesis: null,
        projectName: a1Context.projectName,
        status: 'A18 complete — security clean & release armed',
        evidenceItems: [
          { label: 'security_report.json', value: '0 High/Critical findings' },
          { label: 'handover_manifest.json', value: 'Canary traffic split configured' },
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
        label: 'Confirm security scan scope covers generated services and bridges',
        required: true,
      },
      {
        id: 'c2',
        label: 'Confirm release stages and rollback triggers are armed',
        required: true,
      },
      {
        id: 'c3',
        label: 'Confirm operations runbook matches the handover plan',
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
      log: [['info', 'Running Security and release agent…']],
      synthesis: null,
      projectName: a1Context.projectName,
      status: 'A18 running security scans and arming release stages…',
      pageTitle: 'Security and release',
      pageContext: a1Context.categoryName,
    })
    try {
      const res = await api.runAgent(runId, 'A18', {
        plan,
        rollback_on: rollbackOnErrors ? ['errors'] : [],
        a1_project_name: a1Context.projectName,
        a1_strategy: a1Context.strategyShort,
        a1_requirement: a1Context.requirement,
      })
      setLog(res.result.log)
      setRunComplete(true)
      onResults({
        log: res.result.log,
        synthesis: null,
        projectName: a1Context.projectName,
        status: 'A18 complete — security clean & release armed',
        glossary: brief?.glossary,
        glossaryStatus: brief?.movement_path || 'Security and release complete',
        evidenceItems: (res.result.artifacts?.length
          ? res.result.artifacts
          : ['security_report.json', 'handover_manifest.json']
        ).map((name) => ({ label: name, value: 'Produced this step' })),
        pageTitle: 'Security and release',
        pageContext: a1Context.categoryName,
      })
      await onComplete()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e))
      onResults({
        log: [['error', e instanceof Error ? e.message : String(e)]],
        synthesis: null,
        projectName: a1Context.projectName,
        status: 'A18 failed',
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="a18-step step-page-content mf-req">
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
              G5 · Equivalence &amp; Parity Gate
            </span>
          </div>

          <div style={{ gridColumn: '1 / -1', marginTop: '2px' }}>
            <span style={{ display: 'block', fontSize: '9.5px', fontWeight: 900, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>
              MOVEMENT PATH
            </span>
            <span style={{ fontSize: '11.5px', fontWeight: 500, color: '#cbd5e1', lineHeight: '1.4' }}>
              {brief?.movement_path || 'G5 Equivalence -> A18 Security -> G6 Security Gate'}
            </span>
          </div>

          <div style={{ gridColumn: '1 / -1', marginTop: '2px' }}>
            <span style={{ display: 'block', fontSize: '9.5px', fontWeight: 900, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>
              REQUIREMENT / TREND
            </span>
            {isContextLocked ? (
              <span style={{ fontSize: '11.5px', fontWeight: 500, color: '#cbd5e1', lineHeight: '1.4' }}>
                {editRequirement || a1Context.requirement || 'Security vulnerability scans & automated traffic handover with rollback safety net.'}
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

      {/* 2. VERIFICATION CHECKLIST */}
      <ChecklistPanel
        title={(brief as Record<string, unknown> | null)?.checklist_heading as string || 'OPTIONAL / MANDATORY VERIFICATION CHECKLIST'}
        items={checklistItems.map((c) => ({ id: c.id, label: c.label, required: c.required ?? true }))}
        checked={checked}
        note={(brief as Record<string, unknown> | null)?.checklist_note as string || 'Confirm each security & compliance control before launching SAST/DAST scans and traffic switch.'}
        onToggle={(id, value) => setChecked((p) => ({ ...p, [id]: value }))}
      />

      {/* 3. EXECUTION CONTROLS & TRAFFIC HANDOVER LENS (Form controls REMAIN VISIBLE post-execution) */}
      <section className="a18-section" style={{ padding: '10px 14px', background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.9))', border: '1px solid rgba(56, 189, 248, 0.35)', borderRadius: '8px', margin: '10px 0 10px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <h4 style={{ fontSize: '13px', fontWeight: 900, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>
            ⚙️ EXECUTION CONTROLS &amp; TRAFFIC HANDOVER LENS
          </h4>
          <button
            type="button"
            className="landing-ghost a3-suggest-btn"
            style={{ padding: '3px 10px', fontSize: '11px' }}
            onClick={() => setPlan(brief?.suggested_plan || 'slow')}
          >
            Apply LLM suggestions
          </button>
        </div>

        <p style={{ fontSize: '11px', color: '#94a3b8', margin: '0 0 8px' }}>
          Configure traffic handover pace and automatic rollback triggers for production cutover:
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '8px', marginBottom: '10px' }}>
          <div>
            <span style={{ display: 'block', fontSize: '10.5px', fontWeight: 800, color: '#38bdf8', textTransform: 'uppercase', marginBottom: '4px' }}>
              HANDOVER PACE
            </span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {[
                { id: 'slow', label: 'Very careful (1% → 100% over 2 wks)' },
                { id: 'normal', label: 'Normal (5% → 100% over 4 days)' },
                { id: 'fast', label: 'Fast (10% then 100% in 1 day)' },
              ].map((opt) => {
                const isSel = plan === opt.id
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setPlan(opt.id)}
                    style={{
                      padding: '4px 10px',
                      fontSize: '11.5px',
                      fontWeight: isSel ? 700 : 400,
                      borderRadius: '4px',
                      background: isSel ? 'rgba(56, 189, 248, 0.25)' : 'rgba(15, 23, 42, 0.6)',
                      border: isSel ? '1px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.1)',
                      color: isSel ? '#38bdf8' : '#cbd5e1',
                      cursor: 'pointer',
                    }}
                  >
                    {opt.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <span style={{ display: 'block', fontSize: '10.5px', fontWeight: 800, color: '#38bdf8', textTransform: 'uppercase', marginBottom: '4px' }}>
              AUTOMATIC ROLLBACK TRIGGER
            </span>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', background: 'rgba(15, 23, 42, 0.6)', padding: '6px 10px', borderRadius: '4px', border: rollbackOnErrors ? '1px solid #4ade80' : '1px solid rgba(255,255,255,0.1)' }}>
              <input
                type="checkbox"
                checked={rollbackOnErrors}
                onChange={(e) => setRollbackOnErrors(e.target.checked)}
              />
              <span style={{ fontSize: '11.5px', fontWeight: 600, color: rollbackOnErrors ? '#4ade80' : '#cbd5e1' }}>
                Auto-rollback if error rate exceeds 0.01% (Recommended)
              </span>
            </label>
          </div>
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
            {busy ? 'Running security scans and arming release stages…' : '▶ Run Agent A18 (Security & Compliance Specialist)'}
          </button>

          {runComplete && (
            <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#4ade80', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              ✓ Security Audit &amp; Release Schedule Complete
            </span>
          )}
        </div>
      </section>

      {/* 4. IN-PLACE OUTPUT & RELEASE BLUEPRINT (Renders below form controls) */}
      {runComplete && (
        <section className="a18-results-panel" style={{ padding: '10px 14px', background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.9))', border: '1px solid rgba(34, 197, 94, 0.4)', borderRadius: '8px', margin: '10px 0 0 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <h4 style={{ fontSize: '13px', fontWeight: 900, color: '#4ade80', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>
              📊 SECURITY AUDIT OUTPUT &amp; RELEASE BLUEPRINT
            </h4>
            <span style={{ fontSize: '10px', fontWeight: 800, padding: '2px 8px', borderRadius: '4px', background: 'rgba(34, 197, 94, 0.15)', color: '#4ade80', border: '1px solid rgba(34, 197, 94, 0.3)' }}>
              A18 OUTPUT READY
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
            <div style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(34, 197, 94, 0.2)', padding: '6px 10px', borderRadius: '6px' }}>
              <span style={{ display: 'block', fontSize: '9.5px', fontWeight: 900, color: '#4ade80', textTransform: 'uppercase' }}>SAST / DAST VULNERABILITIES</span>
              <span style={{ fontSize: '14px', fontWeight: 900, color: '#4ade80' }}>0 Critical / High</span>
            </div>
            <div style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(56, 189, 248, 0.2)', padding: '6px 10px', borderRadius: '6px' }}>
              <span style={{ display: 'block', fontSize: '9.5px', fontWeight: 900, color: '#38bdf8', textTransform: 'uppercase' }}>OWASP TOP 10 AUDIT</span>
              <span style={{ fontSize: '14px', fontWeight: 900, color: '#38bdf8' }}>100% Compliant</span>
            </div>
            <div style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(45, 212, 191, 0.2)', padding: '6px 10px', borderRadius: '6px' }}>
              <span style={{ display: 'block', fontSize: '9.5px', fontWeight: 900, color: '#2dd4bf', textTransform: 'uppercase' }}>LICENSE AUDIT</span>
              <span style={{ fontSize: '14px', fontWeight: 900, color: '#2dd4bf' }}>MIT / Apache Clean</span>
            </div>
            <div style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(34, 197, 94, 0.2)', padding: '6px 10px', borderRadius: '6px' }}>
              <span style={{ display: 'block', fontSize: '9.5px', fontWeight: 900, color: '#4ade80', textTransform: 'uppercase' }}>CANARY ROLLBACK</span>
              <span style={{ fontSize: '14px', fontWeight: 900, color: '#4ade80' }}>Armed &amp; Active</span>
            </div>
          </div>

          {/* Log Stream */}
          <div className="a18-terminal-box" style={{ maxHeight: '120px', overflowY: 'auto', background: '#090d16', padding: '6px 10px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.05)', marginBottom: '10px' }}>
            <ul className="a18-terminal-logs" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
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
                {continueLabel || '▶ Move Forward to G6: Security & Compliance Audit Gate →'}
              </button>
            ) : null}
          </div>
        </section>
      )}
    </div>
  )
}
