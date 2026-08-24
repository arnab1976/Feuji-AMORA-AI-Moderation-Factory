import { useEffect, useMemo, useState } from 'react'
import { api, ApiError, type GateNode, type StepBrief } from '../api/client'
import type { ActivityPayload } from './A1IntakeWizard'
import { ChecklistPanel, allRequiredChecked } from './ChecklistPanel'
import { StepChrome } from './StepChrome'

interface Props {
  runId: string
  gate: GateNode
  domainLabel: string
  embedded?: boolean
  onDecided: (rewoundTo: string | null) => void
  onEvidence: (ev: Awaited<ReturnType<typeof api.gate>> | null) => void
  onResults: (payload: ActivityPayload) => void
  onHome: () => void
  onBack: () => void
  onEdit: () => void
  onContinueNext?: () => void
  continueLabel?: string
}

export function HumanGateStep({
  runId,
  gate,
  domainLabel,
  embedded = false,
  onDecided,
  onEvidence,
  onResults,
  onHome,
  onBack,
  onEdit,
  onContinueNext,
  continueLabel,
}: Props) {
  const [evidence, setEvidence] = useState<Awaited<ReturnType<typeof api.gate>> | null>(null)
  const [brief, setBrief] = useState<StepBrief | null>(null)
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setChecked({})
    setError(null)
    onResults({
      log: [['info', `Loading gate ${gate.id} checklist from A1 + path map…`]],
      synthesis: null,
      projectName: '',
      status: `${gate.id} · awaiting review`,
      pageTitle: gate.name,
      evidenceItems: [],
    })

    Promise.all([api.gate(runId, gate.id), api.stepBrief(runId, gate.id)])
      .then(([ev, b]) => {
        if (cancelled) return
        setEvidence(ev)
        setBrief(b)
        onEvidence(ev)
        onResults({
          log: [
            ['ok', `${ev.name} · ${b.path_status_label}`],
            ['info', b.note],
          ],
          synthesis: null,
          projectName: b.context.project_name,
          status: ev.decided ? `${gate.id} decided` : `${gate.id} awaiting approval`,
          pageTitle: ev.name,
          pageContext: b.context.category_name,
          evidenceItems: ev.evidence.map((e) => ({ label: e.label, value: e.value })),
        })
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof ApiError ? e.message : String(e))
      })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId, gate.id])

  const checklistReady = useMemo(
    () => allRequiredChecked(brief?.checklist || [], checked),
    [brief, checked],
  )

  const skipped = brief?.path_status === 'vetoed' || brief?.path_status === 'eligible'

  async function decide(approved: boolean) {
    if (approved && !checklistReady && !skipped) {
      setError('Complete every checklist item before approving this gate.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const res = await api.decideGate(runId, gate.id, approved)
      onDecided(res.rewound_to)
      const ev = await api.gate(runId, gate.id)
      setEvidence(ev)
      onEvidence(ev)
      if (approved && !res.rewound_to) {
        /* Decision saved in-place — user clicks continueLabel when ready */
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const body = (
    <>

      {brief && (
        <div className="step-context" style={{ padding: '8px 12px', margin: '0 0 10px' }}>
          <div>
            <b>From A1</b>
            <span>{brief.context.category_name || '—'}</span>
          </div>
          <div>
            <b>Strategy</b>
            <span>{brief.context.strategy_short || '—'}</span>
          </div>
          <div>
            <b>Requirement</b>
            <span>{(brief.context.requirement || '—').slice(0, 90)}</span>
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
          This gate is not on the active path from your A1 selections and agent &amp; gate map. It
          should already be skipped — Continue moves to the next on-path step.
        </p>
      )}

      {evidence && (
        <div className="dash-evidence" style={{ margin: '0 0 10px' }}>
          {evidence.evidence.map((e) => (
            <div key={e.label} className="dash-evr">
              <b>{e.label}</b>
              <span>{e.value}</span>
            </div>
          ))}
        </div>
      )}

      {evidence?.blocker && <p className="err">{evidence.blocker}</p>}

      {brief && !skipped && (
        <ChecklistPanel
          title="Human gate checklist"
          items={brief.checklist}
          checked={checked}
          disabled={Boolean(evidence?.decided)}
          note={brief.note}
          gateId={gate.id}
          gateName={gate.name}
          onAutoApproveGate={() => void decide(true)}
          onToggle={(id, value) => setChecked((p) => ({ ...p, [id]: value }))}
        />
      )}

      {error && <p className="err">{error}</p>}

      {evidence?.decided || skipped ? (
        <div className="dash-run-row">
          <p className="dash-empty">
            {skipped ? 'Skipped on the path map.' : 'Gate approved. Proceed when ready.'}
          </p>
          <button className="landing-start" type="button" onClick={() => onContinueNext?.()}>
            {continueLabel || '▶ Move Forward to Next Agent →'}
          </button>
        </div>
      ) : (
        <div className="dash-run-row">
          <button
            className="landing-start"
            type="button"
            disabled={busy || !checklistReady}
            onClick={() => void decide(true)}
          >
            {busy ? 'Saving Approval…' : `✓ ${continueLabel ? continueLabel.replace('▶ Move Forward to', 'Approve — Move Forward to') : 'Approve — Move Forward to Next Agent'}`}
          </button>
          <button
            className="landing-ghost"
            type="button"
            disabled={busy}
            onClick={() => void decide(false)}
          >
            Send it back
          </button>
        </div>
      )}
    </>
  )

  if (!evidence && !error) {
    if (embedded) return <p className="dash-empty">Loading gate…</p>
    return (
      <div className="step-page">
        <StepChrome
          title="AMORA"
          subtitle={`${gate.id} · human gate`}
          onHome={onHome}
          onBack={onBack}
          onEdit={onEdit}
        />
        <div className="step-body">
          <p className="dash-empty">Loading gate…</p>
        </div>
      </div>
    )
  }

  if (embedded) {
    return <div className="step-embedded">{body}</div>
  }

  return (
    <div className="step-page">
      <StepChrome
        title="AMORA"
        subtitle={`${gate.id} · ${domainLabel} · human gate`}
        onHome={onHome}
        onBack={onBack}
        onEdit={onEdit}
      />
      <div className="step-body">{body}</div>
    </div>
  )
}
