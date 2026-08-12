import { useEffect, useMemo, useState } from 'react'
import { api, ApiError, type PathMapNode, type PathMapResult } from '../api/client'
import type { ActivityPayload } from './A1IntakeWizard'

export interface PathMapIntakeSnapshot {
  category_id: string
  category_name?: string
  project_name: string
  requirement: string
  strategies: string[]
  strategy_short?: string
  why_modernize: string
  selections: { category_id: string; choice_id: string | null; custom_text: string | null }[]
}

interface Props {
  runId: string
  intake?: PathMapIntakeSnapshot | null
  onContinue: (nextAgentId: string, vetoedIds: string[]) => void
  onResults: (payload: ActivityPayload) => void
  onHome: () => void
  onBack: () => void
  onEdit: () => void
}

/** Leadership-facing status labels derived from scoring. */
function statusLabel(node: PathMapNode): string {
  if (node.status === 'active') return node.kind === 'gate' ? 'Gate · on path' : 'Active · on path'
  if (node.status === 'vetoed') return 'Vetoed · out of scope'
  return node.kind === 'gate' ? 'Gate · inactive' : 'Inactive · below threshold'
}

export function AgentGateMapStep({
  runId,
  intake,
  onContinue,
  onResults,
  onHome,
  onBack,
  onEdit,
}: Props) {
  const [data, setData] = useState<PathMapResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const intakeKey = intake
    ? `${intake.category_id}|${intake.project_name}|${intake.strategies.join(',')}|${intake.requirement}`
    : ''

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    onResults({
      log: [['info', 'Building leadership path map from A1 intake…']],
      synthesis: null,
      projectName: intake?.project_name || '',
      status: 'Path map',
      pageTitle: 'Agent and gate map',
      evidenceItems: [],
    })
    api
      .pathMap(
        runId,
        intake
          ? {
              category_id: intake.category_id,
              category_name: intake.category_name,
              project_name: intake.project_name,
              requirement: intake.requirement,
              strategies: intake.strategies,
              strategy_short: intake.strategy_short,
              why_modernize: intake.why_modernize,
              description: intake.why_modernize,
              selections: intake.selections,
            }
          : undefined,
      )
      .then((r) => {
        if (cancelled) return
        setData(r)
        const firstActive = r.summary.active_ids.find((id) => id !== 'A1') || r.summary.active_ids[0]
        setSelectedId(firstActive || r.nodes[0]?.id || null)
        onResults({
          log: [
            [
              'ok',
              `Path map ready · ${r.inputs.category_name || r.inputs.category_id} · ${r.summary.agents_active}/${r.summary.agents_total} agents on path`,
            ],
            ['info', r.note],
          ],
          synthesis: null,
          projectName: r.inputs.title,
          status: `Next · ${r.summary.next_after_a1}`,
          pageTitle: 'Agent and gate map',
        })
      })
      .catch((e) => {
        if (cancelled) return
        setError(e instanceof ApiError ? e.message : String(e))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId, intakeKey])

  const selected: PathMapNode | null = useMemo(() => {
    if (!data || !selectedId) return null
    return data.nodes.find((n) => n.id === selectedId) ?? null
  }, [data, selectedId])

  const byDomain = useMemo(() => {
    if (!data) return []
    return data.domains.map((d) => {
      const nodes = data.nodes.filter((n) => n.map_domain === d.key)
      return {
        ...d,
        nodes,
        activeCount: nodes.filter((n) => n.status === 'active').length,
        inactiveCount: nodes.filter((n) => n.status === 'eligible').length,
        vetoedCount: nodes.filter((n) => n.status === 'vetoed').length,
      }
    })
  }, [data])

  const counts = useMemo(() => {
    if (!data) return null
    const agents = data.nodes.filter((n) => n.kind === 'agent')
    const gates = data.nodes.filter((n) => n.kind === 'gate')
    return {
      agentsOnPath:
        data.summary.agents_active ?? agents.filter((n) => n.status === 'active').length,
      agentsInactive:
        data.summary.agents_inactive ?? agents.filter((n) => n.status === 'eligible').length,
      agentsVetoed:
        data.summary.agents_vetoed ?? agents.filter((n) => n.status === 'vetoed').length,
      agentsTotal: data.summary.agents_total ?? agents.length,
      gatesOnPath:
        data.summary.gates_active ?? gates.filter((n) => n.status === 'active').length,
      gatesVetoed: gates.filter((n) => n.status === 'vetoed').length,
      gatesTotal: data.summary.gates_total ?? gates.length,
    }
  }, [data])

  const weightage = (data?.weightage ?? [
    {
      key: 'strategy',
      label: 'Modernization Strategy',
      weight: data?.weights?.strategy ?? 40,
      value: data?.inputs.strategy || '',
      blurb: 'Highest technical authority (40%) — promotes agents matching chosen approach.',
      technical_rationale: 'Highest Technical Authority — Dictates target architecture, microservice boundaries, API contracts, build order, and downstream code & test generation agents.',
    },
    {
      key: 'description',
      label: 'Why Modernize / Requirement',
      weight: data?.weights?.description ?? 30,
      value: data?.inputs.description || '',
      blurb: 'High narrative authority (30%) — requirement narrative & business reason keywords.',
      technical_rationale: 'High Narrative Authority — Contains specific legacy language details (e.g. SAS to Python), performance targets, maintainability, scalability, and integration requirements.',
    },
    {
      key: 'category',
      label: 'Input Category',
      weight: data?.weights?.category ?? 20,
      value: data?.inputs.category_name || data?.inputs.category_id || '',
      blurb: 'Domain grouping (20%) — enforces category minimums and hard step vetoes.',
      technical_rationale: 'Domain Grouping & Guardrails — Provides high-level domain boundaries and enforces category minimums and hard step vetoes.',
    },
    {
      key: 'title',
      label: 'Title / Top-5 Trend',
      weight: data?.weights?.title ?? 10,
      value: data?.inputs.title || '',
      blurb: 'Keyword signals (10%) from project title or selected trend.',
      technical_rationale: 'Keyword Signals — Baseline project naming and selected trend signals.',
    },
  ]).map((w) => ({
    ...w,
    technical_rationale:
      (w as { technical_rationale?: string }).technical_rationale ||
      (w.key === 'strategy'
        ? 'Highest Technical Authority — Dictates target architecture, microservice boundaries, API contracts, build order, and downstream code & test generation agents.'
        : w.key === 'description'
        ? 'High Narrative Authority — Contains specific legacy language details (e.g. SAS to Python), performance targets, maintainability, scalability, and integration requirements.'
        : w.key === 'category'
        ? 'Domain Grouping & Guardrails — Provides high-level domain boundaries and enforces category minimums and hard step vetoes.'
        : 'Keyword Signals — Baseline project naming and selected trend signals.'),
  }))

  return (
    <div className="pm-page">
      <div className="pm-top">
        <div className="pm-brand">
          <span className="landing-mark amora-mark">A</span>
          <div>
            <strong>AMORA</strong>
            <p>Agent &amp; gate map · from your A1 selections</p>
          </div>
        </div>
        <div className="pm-nav">
          <button type="button" className="pm-btn pm-btn-ghost" onClick={onBack}>
            ← Back
          </button>
          <button type="button" className="pm-btn pm-btn-ghost" onClick={onEdit}>
            Edit intake
          </button>
          <button type="button" className="pm-btn pm-btn-primary" onClick={onHome}>
            Home
          </button>
        </div>
      </div>

      {data?.summary.active_ids?.length ? (
        <div className="mf-path-bar" aria-label="Agent movement direction">
          <div className="dash-wrap mf-path-bar-inner">
            <span className="mf-path-bar-label">Agent path</span>
            <nav className="mf-path-trail">
              {data.summary.active_ids.map((id, i) => (
                <span key={id} className="mf-path-seg">
                  {i > 0 ? (
                    <span className="mf-path-arrow" aria-hidden="true">
                      →
                    </span>
                  ) : null}
                  <span
                    className={`mf-path-node${id === data.summary.next_after_a1 ? ' on' : ''}${id.startsWith('G') ? ' gate' : ''}`}
                  >
                    {id}
                  </span>
                </span>
              ))}
            </nav>
            <span className="mf-path-bar-next">
              Next · <b>{data.summary.next_after_a1}</b>
            </span>
          </div>
        </div>
      ) : (
        <div className="mf-path-bar" aria-label="Agent movement direction">
          <div className="dash-wrap mf-path-bar-inner">
            <span className="mf-path-bar-label">Agent path</span>
            <span className="mf-path-bar-empty">Scoring path from your intake…</span>
          </div>
        </div>
      )}

      <div className="pm-shell">
        <div className="pm-hero">
          <p className="pm-kicker">Built from your intake choices</p>
          <h1>Agent and gate map</h1>
          <p className="pm-lede">
            Each step is scored from category, strategy, title/trend, and why-modernize. Category can
            veto a step entirely. Below: what runs on this path, what stays inactive, and what is out
            of scope.
          </p>
        </div>

        {loading && <p className="pm-loading">Scoring agents and gates from your intake…</p>}
        {error && <p className="err">{error}</p>}

        {data && counts && (
          <>
            <section className="pm-outcome" aria-label="Path outcome from intake">
              <div className="pm-outcome-item pm-outcome-on">
                <b>{counts.agentsOnPath}</b>
                <span>Agents active</span>
                <small>
                  of {counts.agentsTotal} · on this path
                </small>
              </div>
              <div className="pm-outcome-item pm-outcome-off">
                <b>{counts.agentsInactive}</b>
                <span>Agents inactive</span>
                <small>below threshold or deferred</small>
              </div>
              <div className="pm-outcome-item pm-outcome-veto">
                <b>{counts.agentsVetoed}</b>
                <span>Agents vetoed</span>
                <small>blocked by category</small>
              </div>
              <div className="pm-outcome-item pm-outcome-gate">
                <b>
                  {counts.gatesOnPath}/{counts.gatesTotal}
                </b>
                <span>Gates on path</span>
                <small>{counts.gatesVetoed} skipped</small>
              </div>
            </section>

            <section className="pm-weightage" aria-label="Weightage distribution">
              <div className="pm-weightage-head">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <h2>Weightage distribution</h2>
                  <span style={{ background: 'rgba(43, 184, 166, 0.15)', color: '#2dd4bf', border: '1px solid rgba(43, 184, 166, 0.3)', padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 800, letterSpacing: '0.08em' }}>
                    OPTIMIZED FORMULA (70% STRATEGY + REQUIREMENT)
                  </span>
                </div>
                <p style={{ marginTop: '6px' }}>
                  Score = Strategy ({data.weights.strategy}%) + Description ({data.weights.description}%) + Category ({data.weights.category}%) + Title ({data.weights.title}%). Active if score ≥ {data.threshold}. Minimum path · domain-exclusive agents
                  {data.summary.domain_exclusive === false ? ' · check failed' : ''}.
                </p>
              </div>
              <div className="pm-weight-bars" style={{ marginTop: '12px' }}>
                {weightage.map((w) => (
                  <div key={w.key} className="pm-weight-row" style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '14px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.08)', marginBottom: '12px' }}>
                    <div className="pm-weight-meta" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <strong style={{ fontSize: '13px', color: '#f8fafc' }}>{w.label}</strong>
                      <em style={{ fontStyle: 'normal', fontWeight: 800, color: '#38bdf8', background: 'rgba(56, 189, 248, 0.12)', padding: '2px 8px', borderRadius: '4px', fontSize: '12px' }}>{w.weight}% authority</em>
                    </div>
                    <div className="pm-weight-track" aria-hidden="true" style={{ height: '6px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '3px', overflow: 'hidden', margin: '6px 0 10px' }}>
                      <i style={{ width: `${w.weight}%`, height: '100%', background: 'linear-gradient(90deg, #38bdf8, #2dd4bf)', display: 'block', borderRadius: '3px' }} />
                    </div>
                    <p className="pm-weight-value" style={{ fontWeight: 600, color: '#e2e8f0', margin: '4px 0 6px', fontSize: '13px' }}>{w.value}</p>
                    <div style={{ marginTop: '8px', padding: '8px 10px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '6px', borderLeft: '3px solid #38bdf8' }}>
                      <span style={{ display: 'block', fontSize: '10px', fontWeight: 800, color: '#38bdf8', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '2px' }}>Technical Rationale</span>
                      <small style={{ color: '#94a3b8', fontSize: '11.5px', lineHeight: '1.4', display: 'block' }}>{w.technical_rationale}</small>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <div className="pm-legend" aria-label="Status legend">
              <span className="pm-leg active">
                <i /> Active
              </span>
              <span className="pm-leg eligible">
                <i /> Eligible but below threshold
              </span>
              <span className="pm-leg vetoed">
                <i /> Vetoed by category
              </span>
              <span className="pm-leg gate">
                <i /> Human gate
              </span>
            </div>

            <div className="pm-main">
              <div className="pm-map">
                <h2 className="pm-section-title">
                  Agent and gate map · grouped by domain
                  <span>Click any node for its score breakdown</span>
                </h2>

                {byDomain.map((d) => (
                  <section key={d.key} className="pm-domain">
                    <div className="pm-domain-head">
                      <span className="pm-domain-letter">{d.key}</span>
                      <div className="pm-domain-copy">
                        <h3>{d.name}</h3>
                        <p>{d.purpose}</p>
                        <span className="pm-domain-live">{d.activeCount} live</span>
                      </div>
                    </div>

                    <div className="pm-nodes">
                      {d.nodes.map((n) => {
                        const barPct =
                          n.status === 'vetoed' ? 0 : Math.min(100, Math.max(6, n.score))
                        return (
                          <button
                            key={n.id}
                            type="button"
                            className={[
                              'pm-node',
                              n.status,
                              n.kind === 'gate' ? 'is-gate' : '',
                              selectedId === n.id ? 'on' : '',
                            ]
                              .filter(Boolean)
                              .join(' ')}
                            onClick={() => setSelectedId(n.id)}
                            aria-pressed={selectedId === n.id}
                            title={`${n.id} · ${n.name}`}
                          >
                            <span className="pm-node-id">{n.id}</span>
                            <span className="pm-node-name">{n.name}</span>
                            <span className="pm-node-meter" aria-hidden="true">
                              <span
                                className="pm-node-bar"
                                style={{ width: `${barPct}%` }}
                              />
                            </span>
                            <span className="pm-node-score">
                              {n.status === 'vetoed' ? '—' : n.score}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </section>
                ))}
              </div>

              <aside className="pm-inspect">
                <section className="pm-panel">
                  <h3>Score breakdown</h3>
                  {selected ? (
                    <>
                      <div className="pm-sel-head">
                        <div>
                          <b>
                            {selected.id}: {selected.name}
                          </b>
                          <p>{statusLabel(selected)}</p>
                          {selected.role ? (
                            <p className="pm-role">
                              <strong>Role</strong> · {selected.role}
                            </p>
                          ) : null}
                          {selected.tagline ? <p className="pm-tagline">{selected.tagline}</p> : null}
                        </div>
                        <span className={`pm-node-badge ${selected.status}`}>
                          {selected.status === 'active'
                            ? 'Active'
                            : selected.status === 'vetoed'
                              ? 'Vetoed'
                              : 'Inactive'}
                        </span>
                      </div>
                      {selected.description ? (
                        <p className="pm-reason">{selected.description}</p>
                      ) : null}
                      {selected.guardrail ? (
                        <p className="pm-guardrail">
                          <strong>Guardrail</strong> — {selected.guardrail}
                        </p>
                      ) : null}
                      <p className="pm-reason">{selected.reason}</p>
                      <ul className="pm-break-list">
                        {Object.entries(selected.breakdown).map(([k, v]) => (
                          <li key={k}>
                            <div>
                              <b>{k}</b>
                              <span>{v.points}</span>
                            </div>
                            <small>{v.note}</small>
                          </li>
                        ))}
                      </ul>
                      <p className="pm-total">
                        Total <b>{selected.score}</b>
                        <span> · threshold {data.threshold}</span>
                      </p>
                    </>
                  ) : (
                    <p className="pm-empty">Select a step to inspect its score.</p>
                  )}
                </section>
              </aside>
            </div>

            <footer className="pm-footer">
              <button
                type="button"
                className="pm-btn pm-btn-primary pm-btn-lg"
                onClick={() => onContinue(data.summary.next_after_a1, data.summary.vetoed_ids)}
              >
                Continue with this path → {data.summary.next_after_a1}
              </button>
              <button type="button" className="pm-btn pm-btn-ghost" onClick={onEdit}>
                Edit intake signals
              </button>
              <p>
                Next active step after Factory Administrator. Vetoed steps are skipped
                automatically.
              </p>
            </footer>
          </>
        )}
      </div>
    </div>
  )
}
