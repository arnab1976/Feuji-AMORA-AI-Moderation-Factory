import { useEffect, useState } from 'react'
import { api, ApiError, type AgentNode, type LogLine, type McpServer } from '../api/client'
import { InputForm } from '../components/InputForm'
import { Terminal } from '../components/Terminal'

interface Props {
  runId: string
  agent: AgentNode
  servers: McpServer[]
  done: boolean
  onComplete: () => void
}

export function AgentView({ runId, agent, servers, done, onComplete }: Props) {
  const [values, setValues] = useState<Record<string, unknown>>({})
  const [log, setLog] = useState<LogLine[]>([])
  const [animate, setAnimate] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setError(null)
    const defaults: Record<string, unknown> = {}
    for (const f of agent.inputs) {
      if (f.type === 'multi') defaults[f.key] = f.default ?? []
      else if (f.type === 'text') defaults[f.key] = f.default ?? ''
      else defaults[f.key] = (f.options as string[][])?.[0]?.[0] ?? ''
    }
    setValues(defaults)
    if (done) {
      api.agentLog(runId, agent.id).then((r) => {
        setLog(r.log)
        setAnimate(false)
        if (Object.keys(r.params).length) setValues(r.params)
      })
    } else {
      setLog([])
    }
  }, [agent.id, runId, done])

  async function run() {
    setBusy(true)
    setError(null)
    try {
      const res = await api.runAgent(runId, agent.id, values)
      setLog(res.result.log)
      setAnimate(true)
      onComplete()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const mine = servers.filter((s) => agent.mcp.includes(s.id))
  const accessLabel: Record<string, string> = {
    read: 'read only', sandbox: 'sandbox only', write: 'can write', approval: 'needs approval',
  }

  return (
    <>
      <div className="ph">
        <span className="badge">Agent {agent.id}</span>
        <h2>{agent.name}</h2>
        <p className="lede">{agent.plain}</p>
      </div>
      <div className="pb">
        <div className="io">
          <div className="iob"><b>What it needs</b><span>{agent.needs}</span></div>
          <div className="iob"><b>What it produces</b><span>{agent.produces}</span></div>
        </div>

        {mine.length > 0 && (
          <div className="sec">
            <div className="lb">Tools it is allowed to use</div>
            <div className="mgrid">
              {mine.map((s) => (
                <div className={`mc${done ? ' act' : ''}`} key={s.id}>
                  <div className="mch"><b>{s.name}</b><span className="mid">{s.id}</span></div>
                  <p>{s.plain}</p>
                  <span className={`tag ${s.access}`}>{accessLabel[s.access]}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {agent.inputs.length > 0 && (
          <div className="sec">
            <div className="lb">Your choices</div>
            <InputForm
              fields={agent.inputs}
              values={values}
              onChange={(k, v) => setValues((p) => ({ ...p, [k]: v }))}
            />
          </div>
        )}

        {error && <div className="sec"><p className="err">{error}</p></div>}

        <div className="sec">
          <div className="row">
            <button className="btn" onClick={run} disabled={busy}>
              {busy && <span className="spin" />}
              {busy ? 'Running...' : done ? 'Run again with new choices' : 'Run this agent'}
            </button>
            {done && !busy && (
              <span className="fm">Change anything above and run again to see the difference.</span>
            )}
          </div>
        </div>

        {log.length > 0 && (
          <div className="sec">
            <div className="lb">What it did</div>
            <Terminal lines={log} animate={animate} />
          </div>
        )}
      </div>
    </>
  )
}
