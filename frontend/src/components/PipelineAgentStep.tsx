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
      <p className="dash-kicker">
        Domain {agent.domain} · {domainLabel} · Agent {agent.id}
        {brief ? ` · ${brief.path_status_label}` : ''}
      </p>
      <h2 className="dash-title">{brief?.title || agent.name}</h2>
      <p className="dash-lede">{brief?.lede || agent.plain}</p>

      {brief && (
        <div className="step-context">
          <div>
            <b>From A1</b>
            <span>{brief.context.category_name || brief.context.category_id || '—'}</span>
          </div>
          <div>
            <b>Strategy</b>
            <span>{brief.context.strategy_short || '—'}</span>
          </div>
          <div>
            <b>Project</b>
            <span>{brief.context.project_name || '—'}</span>
          </div>
          <div>
            <b>Map status</b>
            <span className={`step-status-pill ${brief.path_status}`}>
              {brief.path_status_label}
            </span>
          </div>
        </div>
      )}

      {skipped && (
        <p className="step-skip-banner">
          This agent is not on the active path from your A1 selections and agent &amp; gate map.
          Use Continue to move to the next on-path step.
        </p>
      )}

      {brief && (
        <>
          <ChecklistPanel
            items={brief.checklist}
            checked={checked}
            disabled={skipped}
            title="Operator checklist (optional)"
            note={
              brief.note +
              ' These do not block Run — confirm them when useful, or use Confirm all.'
            }
            onToggle={(id, value) => setChecked((p) => ({ ...p, [id]: value }))}
          />
          {!skipped && !checklistReady && brief.checklist.length > 0 && (
            <div className="dash-run-row">
              <button
                type="button"
                className="landing-ghost"
                onClick={() => {
                  const next: Record<string, boolean> = {}
                  for (const item of brief.checklist) next[item.id] = true
                  setChecked(next)
                }}
              >
                Confirm all checklist items
              </button>
            </div>
          )}
        </>
      )}

      {!skipped && agent.inputs.length > 0 && (
        <div className="dash-form">
          <h4>Set up this step — you decide</h4>
          <InputForm
            variant="dash"
            fields={agent.inputs}
            values={values}
            onChange={(k, v) => setValues((p) => ({ ...p, [k]: v }))}
          />
        </div>
      )}

      {error && <p className="err">{error}</p>}

      <div className="dash-run-row">
        {!skipped && (
          <button
            className="landing-start"
            type="button"
            onClick={() => void run()}
            disabled={busy}
          >
            {busy ? 'Running…' : done ? 'Run again' : '▶ Run this agent'}
          </button>
        )}
        {(done || skipped) && (
          <button className="landing-start" type="button" onClick={onContinueNext}>
            {continueLabel || 'Continue to next step →'}
          </button>
        )}
      </div>

      {log.length > 0 && (
        <div className="dash-log">
          <h4>What it did</h4>
          <Terminal lines={log} animate={animate} />
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
