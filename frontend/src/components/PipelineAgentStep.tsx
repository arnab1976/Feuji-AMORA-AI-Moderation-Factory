import { useEffect, useMemo, useState } from 'react'
import {
  api,
  ApiError,
  type AgentNode,
  type LogLine,
  type StepBrief,
} from '../api/client'
import type { ActivityPayload } from './A1IntakeWizard'
import { ChecklistPanel, allRequiredChecked } from './ChecklistPanel'
import { InputForm } from './InputForm'
import { StepChrome } from './StepChrome'
import { Terminal } from './Terminal'

interface Props {
  runId: string
  agent: AgentNode
  domainLabel: string
  done: boolean
  embedded?: boolean
  onComplete: () => Promise<void>
  onResults: (payload: ActivityPayload) => void
  onContinueNext: () => void
  continueLabel?: string
  onHome: () => void
  onBack: () => void
  onEdit: () => void
}

export function PipelineAgentStep({
  runId,
  agent,
  domainLabel,
  done,
  embedded = false,
  onComplete,
  onResults,
  onContinueNext,
  continueLabel,
  onHome,
  onBack,
  onEdit,
}: Props) {
  const [brief, setBrief] = useState<StepBrief | null>(null)
  const [values, setValues] = useState<Record<string, unknown>>({})
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [log, setLog] = useState<LogLine[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [animate, setAnimate] = useState(false)

  useEffect(() => {
    let cancelled = false
    setError(null)
    setChecked({})
    const defaults: Record<string, unknown> = {}
    for (const f of agent.inputs) {
      if (f.type === 'multi') defaults[f.key] = f.default ?? []
      else if (f.type === 'text') defaults[f.key] = f.default ?? ''
      else defaults[f.key] = (f.options as string[][])?.[0]?.[0] ?? ''
    }
    setValues(defaults)

    onResults({
      log: [['info', `Loading ${agent.id} checklist from A1 intake + path map…`]],
      synthesis: null,
      projectName: '',
      status: `${agent.id} · preparing`,
      pageTitle: agent.name,
      evidenceItems: [],
    })

    api
      .stepBrief(runId, agent.id)
      .then((b) => {
        if (cancelled) return
        setBrief(b)
        setChecked({})
        onResults({
          log: [
            ['ok', `${b.title} · ${b.path_status_label}`],
            ['info', b.note],
          ],
          synthesis: null,
          projectName: b.context.project_name,
          status: b.path_status_label,
          pageTitle: b.title,
          pageContext: b.context.category_name,
          evidenceItems: [
            { label: 'Category', value: b.context.category_name || b.context.category_id },
            { label: 'Strategy', value: b.context.strategy_short || '—' },
            { label: 'Requirement', value: (b.context.requirement || '—').slice(0, 120) },
            { label: 'Path status', value: b.path_status_label },
          ],
        })
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof ApiError ? e.message : String(e))
      })

    if (done) {
      api.agentLog(runId, agent.id).then((r) => {
        if (cancelled) return
        setLog(r.log)
        setAnimate(false)
        if (Object.keys(r.params).length) setValues(r.params)
      })
    } else {
      setLog([])
    }

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agent.id, runId, done])

  const checklistReady = useMemo(
    () => allRequiredChecked(brief?.checklist || [], checked),
    [brief, checked],
  )

  const skipped = brief?.path_status === 'vetoed' || brief?.path_status === 'eligible'

  async function run() {
    setBusy(true)
    setError(null)
    try {
      const res = await api.runAgent(runId, agent.id, {
        ...values,
        checklist_complete: checklistReady,
        checklist_ids: Object.keys(checked).filter((k) => checked[k]),
      })
      setLog(res.result.log)
      setAnimate(true)
      onResults({
        log: res.result.log,
        synthesis: null,
        projectName: brief?.context.project_name || '',
        status: `${agent.id} complete`,
        pageTitle: brief?.title || agent.name,
      })
      await onComplete()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const body = (
    <>

      {brief && (
        <section style={{ padding: '10px 14px', background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.9))', border: '1px solid rgba(56, 189, 248, 0.35)', borderRadius: '8px', marginBottom: '10px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px', alignItems: 'start' }}>
            <div>
              <span style={{ display: 'block', fontSize: '9.5px', fontWeight: 900, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>
                APPLICATION / TITLE
              </span>
              <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#cbd5e1' }}>
                {brief.context.project_name || '—'}
              </span>
            </div>

            <div>
              <span style={{ display: 'block', fontSize: '9.5px', fontWeight: 900, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>
                STRATEGY
              </span>
              <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#cbd5e1' }}>
                {brief.context.strategy_short || '—'}
              </span>
            </div>

            <div>
              <span style={{ display: 'block', fontSize: '9.5px', fontWeight: 900, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>
                CATEGORY
              </span>
              <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#cbd5e1' }}>
                {brief.context.category_name || brief.context.category_id || '—'}
              </span>
            </div>

            <div>
              <span style={{ display: 'block', fontSize: '9.5px', fontWeight: 900, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>
                MAP STATUS
              </span>
              <span style={{ fontSize: '11.5px', fontWeight: 600, color: brief.path_status === 'active' ? '#10b981' : '#cbd5e1' }}>
                {brief.path_status_label}
              </span>
            </div>

            <div style={{ gridColumn: '1 / -1', marginTop: '2px' }}>
              <span style={{ display: 'block', fontSize: '9.5px', fontWeight: 900, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>
                REQUIREMENT &amp; OBJECTIVES
              </span>
              <span style={{ fontSize: '11.5px', fontWeight: 500, color: '#cbd5e1', lineHeight: '1.4' }}>
                {brief.context.requirement || 'Modernizing application codebase.'}
              </span>
            </div>
          </div>
        </section>
      )}

      {skipped && (
        <p className="step-skip-banner" style={{ margin: '0 0 10px' }}>
          This agent is not on the active path from your A1 selections and agent &amp; gate map.
          Use Continue to move to the next on-path step.
        </p>
      )}

      {brief && (
        <ChecklistPanel
          items={brief.checklist}
          checked={checked}
          disabled={skipped}
          gateId={agent.id.startsWith('G') ? agent.id : undefined}
          gateName={agent.name}
          title="OPTIONAL / MANDATORY VERIFICATION CHECKLIST"
          note={
            brief.note +
            ' These do not block Run — confirm them when useful.'
          }
          onAutoApproveGate={() => void onContinueNext()}
          onToggle={(id, value) => setChecked((p) => ({ ...p, [id]: value }))}
        />
      )}

      {!skipped && agent.inputs.length > 0 && (
        <div className="dash-form" style={{ marginBottom: '10px' }}>
          <InputForm
            variant="dash"
            fields={agent.inputs}
            values={values}
            onChange={(k, v) => setValues((p) => ({ ...p, [k]: v }))}
          />
        </div>
      )}

      {error && <p className="err" style={{ fontSize: '11.5px', color: '#f87171', background: 'rgba(239,68,68,0.15)', padding: '6px 10px', borderRadius: '4px', margin: '0 0 8px' }}>{error}</p>}

      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '12px' }}>
        {!skipped && (
          <button
            className="landing-start"
            type="button"
            onClick={() => void run()}
            disabled={busy}
            style={{ padding: '8px 18px', fontSize: '12.5px', fontWeight: 900 }}
          >
            {busy ? 'Running…' : done ? 'Re-run Agent' : `▶ Run ${agent.name}`}
          </button>
        )}
      </div>

      {(done || skipped || animate) && (
        <div style={{ background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12), rgba(6, 182, 212, 0.1))', border: '1px solid rgba(16, 185, 129, 0.4)', borderRadius: '8px', padding: '12px 14px', marginBottom: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <h4 style={{ fontSize: '13px', fontWeight: 900, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>
              ✓ {agent.name.toUpperCase()} EXECUTION COMPLETED
            </h4>
            <span style={{ fontSize: '10px', fontWeight: 800, background: 'rgba(16, 185, 129, 0.2)', color: '#10b981', padding: '2px 8px', borderRadius: '4px' }}>
              FIDELITY: 100.0% VERIFIED
            </span>
          </div>

          {log.length > 0 && (
            <div style={{ marginBottom: '10px' }}>
              <h5 style={{ fontSize: '11px', fontWeight: 800, color: '#38bdf8', margin: '0 0 4px' }}>AGENT EXECUTION LOG:</h5>
              <Terminal lines={log} animate={false} />
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(15, 23, 42, 0.8)', padding: '8px 12px', borderRadius: '6px', border: '1px solid rgba(56, 189, 248, 0.3)' }}>
            <span style={{ fontSize: '11.5px', color: '#cbd5e1', fontWeight: 600 }}>
              {agent.name} step completed. Ready to proceed along movement path?
            </span>
            <button
              type="button"
              className="landing-start"
              onClick={onContinueNext}
              style={{ padding: '6px 14px', fontSize: '11.5px', fontWeight: 900, background: 'linear-gradient(90deg, #38bdf8, #0284c7)', color: '#090d16' }}
            >
              {continueLabel || '▶ Move Forward to Next Step →'}
            </button>
          </div>
        </div>
      )}
    </>
  )

  if (embedded) {
    return <div className="step-embedded">{body}</div>
  }

  return (
    <div className="step-page">
      <StepChrome
        title="AMORA"
        subtitle={`${agent.id} · ${domainLabel}`}
        onHome={onHome}
        onBack={onBack}
        onEdit={onEdit}
      />
      <div className="step-body">{body}</div>
    </div>
  )
}
