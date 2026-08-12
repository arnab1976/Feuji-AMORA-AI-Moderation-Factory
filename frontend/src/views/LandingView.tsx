interface Counts {
  agents: number
  gates: number
  domains: number
  mcp: number
}

interface Props {
  counts: Counts
  onStart: () => void
  busy?: boolean
}

const ACRONYM = [
  { letter: 'A', word: 'AI' },
  { letter: 'M', word: 'Modernization' },
  { letter: 'O', word: 'Orchestration' },
  { letter: 'R', word: 'Rebuild' },
  { letter: 'A', word: 'Agents' },
]

const POWERED_BY = [
  'GPT-4o',
  'LangGraph',
  'FastAPI',
  'React',
  'PostgreSQL',
  'MCP',
]

function journeyCards(counts: Counts) {
  return [
    {
      step: '01',
      title: 'What AMORA is',
      blurb: 'Industrialised modernization of incomplete legacy estates — with humans in charge.',
    },
    {
      step: '02',
      title: 'How work enters',
      blurb: 'A1 intake captures category, strategy, and why — then scores the factory path.',
    },
    {
      step: '03',
      title: 'How the path is chosen',
      blurb: 'The agent & gate map marks each step active, inactive, or vetoed for your estate.',
    },
    {
      step: '04',
      title: 'Six work domains',
      blurb: `Setup → discover → understand → design & build → prove → release (${counts.domains} domains).`,
    },
    {
      step: '05',
      title: 'Agents & gates',
      blurb: `${counts.agents} specialised agents execute; ${counts.gates} formal gates hold executive authority.`,
    },
    {
      step: '06',
      title: 'Evidence & equivalence',
      blurb: 'Artefacts and checklists prove the new system matches the old before go-live.',
    },
    {
      step: '07',
      title: 'Platform',
      blurb: 'React, FastAPI, LangGraph, GPT-4o, PostgreSQL, and MCP tool bridges.',
    },
  ]
}

export function LandingView({ counts, onStart, busy = false }: Props) {
  const cards = journeyCards(counts)

  return (
    <div className="landing amora-home amora-fit amora-air">
      <div className="amora-sky" aria-hidden="true" />

      <header className="amora-air-top">
        <div className="landing-wrap amora-air-hr">
          <div className="landing-logo">
            <span className="landing-mark amora-mark">A</span>
            <strong>AMORA</strong>
          </div>
          <div className="amora-powered amora-powered-top">
            <span className="amora-powered-label">Powered by…</span>
            <ul className="amora-powered-list">
              {POWERED_BY.map((tech) => (
                <li key={tech}>{tech}</li>
              ))}
            </ul>
          </div>
        </div>
      </header>

      <main className="amora-stage landing-wrap">
        <div className="amora-stage-grid">
          <section className="amora-hero">
            <p className="amora-brand">Behold <span className="amora-hl-accent">AMORA</span></p>
            <h1 className="amora-headline">
              <span className="amora-hl-accent">Turn 50-year-old systems</span>
              {' '}
              into modern services — with humans in charge.
            </h1>
            <p className="amora-hero-lede">
              Critical systems in COBOL, old Java or old .NET still take years to rebuild by
              hand. This factory uses {counts.agents} specialised AI agents to read the estate,
              redesign it, generate new code and prove identical behaviour — with humans
              approving at {counts.gates} checkpoints. Incomplete estates get their own method,
              not a degraded version of reading source.
            </p>
            <button
              className="landing-start amora-cta-main"
              type="button"
              onClick={onStart}
              disabled={busy}
            >
              {busy ? 'Starting…' : '▶ Start modernization'}
            </button>
          </section>

          <figure className="amora-visual">
            <img
              src="/amora-hero.png"
              alt="Legacy mainframe systems transforming into modern AI agent architecture"
            />
            <figcaption>
              Legacy estates → agent orchestration → governed rebuild
            </figcaption>
          </figure>
        </div>

        <section className="amora-journey" aria-label="Application journey">
          <div className="amora-journey-head">
            <div className="amora-journey-titles">
              <h2>Application journey</h2>
              <p>End-to-end architecture — how AMORA takes you from intake to release</p>
            </div>
            <p className="amora-soft-meta">
              {counts.agents} agents · {counts.gates} human gates · {counts.domains} domains ·{' '}
              {counts.mcp} tool bridges
            </p>
          </div>
          <ol className="amora-journey-grid">
            {cards.map((card) => (
              <li key={card.step} className="amora-journey-card">
                <span className="amora-journey-step">{card.step}</span>
                <h3>{card.title}</h3>
                <p>{card.blurb}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="amora-expand amora-expand-lite" aria-label="AMORA full name">
          <ul className="amora-letters">
            {ACRONYM.map((item, i) => (
              <li key={`${item.letter}-${item.word}-${i}`}>
                <b>{item.letter}</b>
                <span>{item.word}</span>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  )
}
