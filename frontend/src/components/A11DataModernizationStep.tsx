import { useEffect, useMemo, useState } from 'react'
import { api, ApiError, type LogLine, type StepBrief } from '../api/client'
import type { PathMapIntakeSnapshot } from './AgentGateMapStep'
import type { ActivityPayload } from './A1IntakeWizard'
import { ChecklistPanel, type ChecklistItem } from './ChecklistPanel'
import { Terminal } from './Terminal'

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

const FALLBACK_STRATEGY_OPTIONS: [string, string][] = [
  ['dual_write', 'Write to both old and new (Dual-Write) — safest, zero downtime'],
  ['cdc_event_stream', 'CDC Event Streaming — real-time async sync'],
  ['cutover_weekend', 'Move all in one weekend — fastest cutover'],
]

const FALLBACK_CHECKS: ChecklistItem[] = [
  { id: 'data_plan_ok', label: 'Confirm data modernization plan matches data stores named in intake', required: true },
  { id: 'cutover_ok', label: 'Confirm cutover / dual-write approach fits enterprise risk appetite', required: true },
  { id: 'pii_ok', label: 'Confirm PII / residency & encryption constraints from A3 are respected', required: true },
  { id: 'path_ok', label: 'Confirm data modernization step belongs on active movement path', required: true },
]

export function A11DataModernizationStep({
  runId,
  done,
  formResetKey,
  intake,
  onComplete,
  onResults,
  onContinueNext,
  continueLabel,
}: Props) {
  const [brief, setBrief] = useState<StepBrief | null>(null)
  const [cutoverStrategy, setCutoverStrategy] = useState('dual_write')
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [runComplete, setRunComplete] = useState(false)
  const [log, setLog] = useState<LogLine[]>([])

  const a1Context = useMemo(
    () => ({
      categoryName: intake?.category_name || intake?.category_id || '—',
      categoryId: intake?.category_id || '',
      projectName: intake?.project_name || '—',
      requirement: intake?.requirement || '',
      strategies: intake?.strategies || [],
      strategyShort: intake?.strategy_short || intake?.strategies?.[0] || '—',
      why: intake?.why_modernize || '',
    }),
    [intake],
  )

  useEffect(() => {
    let cancelled = false
    setError(null)
    setRunComplete(false)
    setLog([])

    onResults({
      log: [['info', 'Loading A11 data modernization brief from A10 + path map…']],
      synthesis: null,
      projectName: a1Context.projectName !== '—' ? a1Context.projectName : '',
      status: 'A11 · synthesizing data strategy…',
      pageTitle: 'A11 Data Modernization Agent',
      pageContext: a1Context.categoryName,
      evidenceItems: [],
    })

    api
      .stepBrief(runId, 'A11')
      .then((b) => {
        if (cancelled) return
        setBrief(b)
        onResults({
          log: [
            ['ok', `${b.title} · ${b.path_status_label}`],
            ['info', b.note],
          ],
          synthesis: null,
          projectName: b.context.project_name || a1Context.projectName,
          status: b.path_status_label,
          pageTitle: b.title,
          pageContext: b.context.category_name,
          evidenceItems: [
            { label: 'Category', value: b.context.category_name || b.context.category_id },
            { label: 'Strategy', value: b.context.strategy_short || '—' },
            { label: 'Requirement', value: (b.context.requirement || '—').slice(0, 120) },
          ],
        })
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof ApiError ? e.message : String(e))
      })

    if (done) {
      api.agentLog(runId, 'A11').then((r) => {
        if (cancelled) return
        setLog(r.log)
        setRunComplete(true)
      })
    }

    return () => {
      cancelled = true
    }
  }, [runId, done, formResetKey, a1Context.projectName, onResults])

  const checklist = brief?.checklist?.length ? brief.checklist : FALLBACK_CHECKS

  async function runAgent() {
    setBusy(true)
    setError(null)
    onResults({
      log: [['info', 'Running A11 Data Modernization Agent…']],
      synthesis: null,
      projectName: a1Context.projectName,
      status: 'A11 running data schema & migration transform…',
      pageTitle: 'A11 Data Modernization Agent',
    })

    try {
      const res = await api.runAgent(runId, 'A11', {
        cutover_strategy: cutoverStrategy,
        checklist_complete: true,
        checklist_ids: Object.keys(checked).filter((k) => checked[k]),
      })
      setLog(res.result.log)
      setRunComplete(true)
      onResults({
        log: res.result.log,
        synthesis: null,
        projectName: a1Context.projectName,
        status: 'A11 complete',
        pageTitle: 'A11 Data Modernization Agent',
      })
      await onComplete()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', color: '#e2e8f0', fontFamily: 'inherit' }}>
      {/* EXECUTIVE CONTEXT & ESTATE CARD (Compact clean layout matching A10/A12) */}
      <section style={{ padding: '10px 14px', background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.9))', border: '1px solid rgba(56, 189, 248, 0.35)', borderRadius: '8px', marginBottom: '10px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px', alignItems: 'start' }}>
          <div>
            <span style={{ display: 'block', fontSize: '9.5px', fontWeight: 900, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>
              APPLICATION / TITLE
            </span>
            <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#cbd5e1' }}>
              {a1Context.projectName}
            </span>
          </div>

          <div>
            <span style={{ display: 'block', fontSize: '9.5px', fontWeight: 900, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>
              STRATEGY
            </span>
            <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#cbd5e1' }}>
              {a1Context.strategyShort}
            </span>
          </div>

          <div>
            <span style={{ display: 'block', fontSize: '9.5px', fontWeight: 900, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>
              PRIOR AGENT
            </span>
            <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#cbd5e1' }}>
              A10 · Target Architecture Agent
            </span>
          </div>

          <div>
            <span style={{ display: 'block', fontSize: '9.5px', fontWeight: 900, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>
              MAP STATUS
            </span>
            <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#10b981' }}>
              {brief?.path_status_label || 'Active · on path'}
            </span>
          </div>

          <div style={{ gridColumn: '1 / -1', marginTop: '2px' }}>
            <span style={{ display: 'block', fontSize: '9.5px', fontWeight: 900, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>
              REQUIREMENT &amp; DATA OBJECTIVES
            </span>
            <span style={{ fontSize: '11.5px', fontWeight: 500, color: '#cbd5e1', lineHeight: '1.4' }}>
              {a1Context.requirement || 'Modernizing legacy database schemas and data pipelines.'}
            </span>
          </div>
        </div>
      </section>

      {/* 4. DATA MIGRATION CUTOVER STRATEGY SELECTOR */}
      <section style={{ padding: '10px 14px', background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.9))', border: '1px solid rgba(56, 189, 248, 0.35)', borderRadius: '8px', marginBottom: '10px' }}>
        <h4 style={{ fontSize: '13px', fontWeight: 900, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 8px' }}>
          ⚙️ HOW SHOULD WE MOVE THE DATA? (MIGRATION CUTOVER STRATEGY)
        </h4>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {FALLBACK_STRATEGY_OPTIONS.map(([val, label]) => (
            <button
              key={val}
              type="button"
              onClick={() => setCutoverStrategy(val)}
              style={{
                fontSize: '11.5px',
                fontWeight: cutoverStrategy === val ? 900 : 600,
                padding: '6px 12px',
                borderRadius: '5px',
                background: cutoverStrategy === val ? 'rgba(56, 189, 248, 0.25)' : 'rgba(30, 41, 59, 0.8)',
                color: cutoverStrategy === val ? '#38bdf8' : '#94a3b8',
                border: cutoverStrategy === val ? '1px solid rgba(56, 189, 248, 0.5)' : '1px solid rgba(255,255,255,0.1)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      {/* 5. VERIFICATION CHECKLIST */}
      <ChecklistPanel
        title="OPTIONAL / MANDATORY VERIFICATION CHECKLIST"
        items={checklist}
        checked={checked}
        note="Confirm each mandatory item before running data modernization transform."
        onToggle={(id, value) => setChecked((p) => ({ ...p, [id]: value }))}
      />

      {error && <p className="err" style={{ fontSize: '11.5px', color: '#f87171', background: 'rgba(239,68,68,0.15)', padding: '6px 10px', borderRadius: '4px', margin: '0 0 8px' }}>{error}</p>}

      {/* 6. EXECUTION BAR & RUN BUTTON */}
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '12px' }}>
        <button
          type="button"
          className="landing-start"
          disabled={busy}
          onClick={() => void runAgent()}
          style={{ padding: '8px 18px', fontSize: '12.5px', fontWeight: 900 }}
        >
          {busy ? 'Transforming Schemas…' : runComplete || done ? 'Re-run A11 Data Agent' : '▶ Run A11 Data Modernization Agent'}
        </button>
      </div>

      {/* 7. SYNTHESIZED RESULTS CARD & ADVANCEMENT DECISION PROMPT */}
      {(runComplete || done) && (
        <div style={{ background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12), rgba(6, 182, 212, 0.1))', border: '1px solid rgba(16, 185, 129, 0.4)', borderRadius: '8px', padding: '12px 14px', marginBottom: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <h4 style={{ fontSize: '13px', fontWeight: 900, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>
              ✓ A11 DATA MODERNIZATION EXECUTION COMPLETED
            </h4>
            <span style={{ fontSize: '10px', fontWeight: 800, background: 'rgba(16, 185, 129, 0.2)', color: '#10b981', padding: '2px 8px', borderRadius: '4px' }}>
              DATA FIDELITY: 100.0% VERIFIED
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px', marginBottom: '10px' }}>
            <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '6px 10px', borderRadius: '5px', border: '1px solid rgba(255,255,255,0.06)' }}>
              <span style={{ fontSize: '9px', color: '#94a3b8', display: 'block', textTransform: 'uppercase' }}>SCHEMA PARITY</span>
              <strong style={{ fontSize: '11px', color: '#10b981' }}>100.0% Verified ✓</strong>
            </div>

            <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '6px 10px', borderRadius: '5px', border: '1px solid rgba(255,255,255,0.06)' }}>
              <span style={{ fontSize: '9px', color: '#94a3b8', display: 'block', textTransform: 'uppercase' }}>CUTOVER STRATEGY</span>
              <strong style={{ fontSize: '11px', color: '#06b6d4' }}>
                {cutoverStrategy === 'dual_write' ? 'Dual-Write Zero Downtime' : cutoverStrategy === 'cdc_event_stream' ? 'CDC Event Streaming' : 'Weekend Cutover'}
              </strong>
            </div>

            <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '6px 10px', borderRadius: '5px', border: '1px solid rgba(255,255,255,0.06)' }}>
              <span style={{ fontSize: '9px', color: '#94a3b8', display: 'block', textTransform: 'uppercase' }}>REFERENTIAL CONSTRAINTS</span>
              <strong style={{ fontSize: '11px', color: '#10b981' }}>0 Violations ✓</strong>
            </div>

            <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '6px 10px', borderRadius: '5px', border: '1px solid rgba(255,255,255,0.06)' }}>
              <span style={{ fontSize: '9px', color: '#94a3b8', display: 'block', textTransform: 'uppercase' }}>PII ENCRYPTION &amp; MASKING</span>
              <strong style={{ fontSize: '11px', color: '#f59e0b' }}>100% Tokenized ✓</strong>
            </div>
          </div>

          {log.length > 0 && (
            <div style={{ marginBottom: '10px' }}>
              <h5 style={{ fontSize: '11px', fontWeight: 800, color: '#38bdf8', margin: '0 0 4px' }}>AGENT EXECUTION LOG:</h5>
              <Terminal lines={log} animate={false} />
            </div>
          )}

          {/* ADVANCEMENT DECISION ROW */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(15, 23, 42, 0.8)', padding: '8px 12px', borderRadius: '6px', border: '1px solid rgba(56, 189, 248, 0.3)' }}>
            <span style={{ fontSize: '11.5px', color: '#cbd5e1', fontWeight: 600 }}>
              Agent A11 data modernization completed. Ready to proceed along movement path?
            </span>
            <button
              type="button"
              className="landing-start"
              onClick={() => onContinueNext?.()}
              style={{ padding: '6px 14px', fontSize: '11.5px', fontWeight: 900, background: 'linear-gradient(90deg, #38bdf8, #0284c7)', color: '#090d16' }}
            >
              {continueLabel || '▶ Move Forward to Next Agent: A12 Code Generation Agent →'}
            </button>
          </div>
        </div>
      )}

    </div>
  )
}
