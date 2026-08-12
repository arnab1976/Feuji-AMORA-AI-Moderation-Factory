import { useEffect, useState } from 'react'
import { api, type GateEvidence } from '../api/client'

interface Props {
  runId: string
  gateId: string
  onDecided: (rewoundTo: string | null) => void
}

export function GateView({ runId, gateId, onDecided }: Props) {
  const [gate, setGate] = useState<GateEvidence | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api.gate(runId, gateId).then(setGate)
  }, [runId, gateId])

  async function decide(approved: boolean) {
    setBusy(true)
    try {
      const res = await api.decideGate(runId, gateId, approved)
      onDecided(res.rewound_to)
      setGate(await api.gate(runId, gateId))
    } finally {
      setBusy(false)
    }
  }

  if (!gate) return <div className="pb">Loading…</div>

  return (
    <>
      <div className="ph">
        <span className="badge g">Approval {gate.id} · a person must decide</span>
        <h2>{gate.name}</h2>
        <p className="lede">{gate.question}</p>
      </div>
      <div className="pb">
        <div className="gbox">
          <h3>Who signs this off</h3>
          <p>{gate.approvers}</p>
        </div>

        <div className="sec">
          <div className="lb">What you are being shown</div>
          {gate.evidence.map((e) => (
            <div className="evr" key={e.label}>
              <b>{e.label}</b>
              <span>{e.value}</span>
            </div>
          ))}
        </div>

        <div className="sec">
          <p className={`cal${gate.blocker ? ' d' : ''}`}>
            <b>{gate.blocker ? 'Warning. ' : 'Why this gate exists. '}</b>
            {gate.blocker ?? gate.why}
          </p>
        </div>

        {gate.decided ? (
          <div className="sec">
            <p className="cal w"><b>Approved. </b>The next step is unlocked.</p>
          </div>
        ) : (
          <div className="sec">
            <div className="row">
              <button className="btn g" onClick={() => decide(true)} disabled={busy}>
                Approve and continue
              </button>
              <button className="btn r" onClick={() => decide(false)} disabled={busy}>
                Send it back
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
