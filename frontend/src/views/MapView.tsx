import type { Domain, PipelineNode, RunNode } from '../api/client'

interface Props {
  sequence: PipelineNode[]
  domains: Domain[]
  nodes: RunNode[]
}

export function MapView({ sequence, domains, nodes }: Props) {
  const doneMap = new Map(nodes.map((n) => [n.id, n.done]))
  return (
    <>
      <div className="ph">
        <span className="badge">Who does what</span>
        <h2>Eighteen agents, nine approvals, twelve tools</h2>
        <p className="lede">
          The full picture on one screen. Agents propose and produce. People decide. Tools are how
          agents reach anything outside themselves.
        </p>
      </div>
      <div className="pb">
        {domains.map((d) => {
          const items = sequence.filter((s) => s.domain === d.key)
          if (!items.length) return null
          return (
            <div className="sec" key={d.key}>
              <div className="lb">{d.name} · {d.purpose}</div>
              <table className="tb">
                <thead>
                  <tr><th>Step</th><th>What it does</th><th>Tools / approvers</th><th /></tr>
                </thead>
                <tbody>
                  {items.map((s) => (
                    <tr key={s.id}>
                      <td>
                        <b>{s.name}</b>
                        <br />
                        <span className="mid">{s.id}</span>
                      </td>
                      <td>{s.kind === 'agent' ? s.plain : s.question}</td>
                      <td className="mid">
                        {s.kind === 'agent' ? s.mcp.join(', ') || 'none' : s.approvers}
                      </td>
                      <td>
                        {doneMap.get(s.id) ? (
                          <span className={`tag ${s.kind === 'gate' ? 'sandbox' : 'read'}`}>
                            {s.kind === 'gate' ? 'approved' : 'run'}
                          </span>
                        ) : s.kind === 'gate' ? (
                          <span className="tag approval">needs a person</span>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        })}
      </div>
    </>
  )
}
