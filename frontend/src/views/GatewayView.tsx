import type { McpServer } from '../api/client'

const GROUPS: [McpServer['access'], string, string][] = [
  ['read', 'Read only', 'These can look but never change anything'],
  ['sandbox', 'Sandbox only', 'These run things, but only in an isolated space'],
  ['write', 'Can write', "These write to the factory's own records, not your live systems"],
  ['approval', 'Needs approval', 'These can affect live systems and are locked behind a human approval'],
]

export function GatewayView({ servers, used }: { servers: McpServer[]; used: string[] }) {
  return (
    <>
      <div className="ph">
        <span className="badge m">Tool gateway</span>
        <h2>What the factory is allowed to touch</h2>
        <p className="lede">
          Every agent reaches your systems through this gateway and nothing else. Each connection
          is limited to specific tools at a specific access level. Most are read-only.
        </p>
      </div>
      <div className="pb">
        {GROUPS.map(([access, title, desc]) => {
          const items = servers.filter((s) => s.access === access)
          if (!items.length) return null
          return (
            <div className="sec" key={access}>
              <div className="lb">{title} · {desc}</div>
              <div className="mgrid">
                {items.map((s) => (
                  <div className={`mc${used.includes(s.id) ? ' act' : ''}`} key={s.id}>
                    <div className="mch"><b>{s.name}</b><span className="mid">{s.id}</span></div>
                    <p>{s.plain}</p>
                    <span className={`tag ${s.access}`}>
                      {used.includes(s.id) ? 'used in this run' : 'not used yet'}
                    </span>
                    <div className="mtools">{s.tools.join(' · ')}</div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
        <div className="sec">
          <p className="cal w">
            <b>The security story in one line. </b>
            The factory never holds credentials to your live systems. It asks the gateway, the
            gateway checks whether that agent declared that server, and every request is logged
            with which agent asked and why.
          </p>
        </div>
      </div>
    </>
  )
}
