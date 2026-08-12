import { useCallback, useEffect, useState } from 'react'
import {
  api,
  RUN_STORAGE_KEY,
  type Domain,
  type PipelineNode,
  type RunNode,
} from './api/client'
import { LandingView } from './views/LandingView'
import { WorkspaceView } from './views/WorkspaceView'

type Screen = 'landing' | 'workspace'

export default function App() {
  const [screen, setScreen] = useState<Screen>('landing')
  const [sequence, setSequence] = useState<PipelineNode[]>([])
  const [domains, setDomains] = useState<Domain[]>([])
  const [counts, setCounts] = useState({ agents: 18, gates: 9, domains: 6, mcp: 12 })
  const [runId, setRunId] = useState<string | null>(null)
  const [nodes, setNodes] = useState<RunNode[]>([])
  const [runState, setRunState] = useState<Record<string, unknown>>({})
  const [cursor, setCursor] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [bootstrapping, setBootstrapping] = useState(true)

  const loadFactory = useCallback(async () => {
    setBootstrapping(true)
    setError(null)
    try {
      const [p, m] = await Promise.all([api.pipeline(), api.mcp()])
      setSequence(p.sequence)
      setDomains(p.domains)
      setCounts({
        agents: p.counts.agents ?? 18,
        gates: p.counts.gates ?? 9,
        domains: p.domains.length,
        mcp: p.counts.mcp ?? m.servers.length,
      })
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Cannot reach the API. Start the backend on port 8000.',
      )
    } finally {
      setBootstrapping(false)
    }
  }, [])

  useEffect(() => { void loadFactory() }, [loadFactory])

  const openRun = useCallback(async (id: string, jumpToNext = true) => {
    const r = await api.getRun(id)
    setRunId(id)
    localStorage.setItem(RUN_STORAGE_KEY, id)
    setNodes(r.nodes)
    setRunState(r.state ?? {})
    if (jumpToNext) {
      const nextIdx = r.next
        ? r.nodes.findIndex((n) => n.id === r.next)
        : r.nodes.findIndex((n) => !n.done && n.unlocked)
      setCursor(nextIdx >= 0 ? nextIdx : 0)
    } else {
      setCursor(0)
    }
    setScreen('workspace')
  }, [])

  const refreshPipeline = useCallback(async () => {
    const p = await api.pipeline()
    setSequence(p.sequence)
    setDomains(p.domains)
    setCounts((c) => ({
      ...c,
      agents: p.counts.agents ?? c.agents,
      gates: p.counts.gates ?? c.gates,
      domains: p.domains.length,
    }))
    return p.sequence
  }, [])

  const startRun = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      // Always re-fetch pipeline so A1 intake fields stay current.
      await refreshPipeline()
      const { run_id } = await api.createRun('legacy-system')
      await openRun(run_id, false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start a run')
    } finally {
      setBusy(false)
    }
  }, [openRun, refreshPipeline])

  const goHome = useCallback(() => {
    setScreen('landing')
    setError(null)
  }, [])

  const refresh = useCallback(async () => {
    if (!runId) return
    const r = await api.getRun(runId)
    setNodes(r.nodes)
    setRunState(r.state ?? {})
  }, [runId])

  async function onGateDecided(rewoundTo: string | null) {
    await refresh()
    if (rewoundTo) {
      const idx = sequence.findIndex((s) => s.id === rewoundTo)
      if (idx >= 0) setCursor(idx)
      window.alert(
        `Sent back.\n\nRewound to "${sequence[idx]?.name}". Change the choices there and run ` +
        `it again.\n\nEverything produced after that point is no longer trusted.`,
      )
    }
    // Approve advance is handled by WorkspaceView.advanceToNextOpen (path-aware).
  }

  if (bootstrapping || !sequence.length) {
    return (
      <div className="landing">
        <div className="landing-wrap landing-boot">
          {bootstrapping && !error ? (
            <p>Loading AMORA…</p>
          ) : (
            <>
              <h1>API not reachable</h1>
              <p>
                The UI is running, but the backend on{' '}
                <code>http://127.0.0.1:8010</code> is not. Start it, then retry.
              </p>
              {error && <p className="landing-boot-err">{error}</p>}
              <pre className="landing-boot-cmd">
{`cd backend
uvicorn app.main:app --reload --host 127.0.0.1 --port 8010`}
              </pre>
              <button className="landing-start" type="button" onClick={() => void loadFactory()}>
                Retry connection
              </button>
            </>
          )}
        </div>
      </div>
    )
  }

  if (screen === 'landing') {
    return (
      <>
        <LandingView
          counts={counts}
          onStart={() => void startRun()}
          busy={busy}
        />
        {error && <div className="landing-error">{error}</div>}
      </>
    )
  }

  if (!runId) {
    return <div className="landing"><div className="landing-wrap landing-boot"><p>Preparing the run…</p></div></div>
  }

  return (
    <WorkspaceView
      runId={runId}
      sequence={sequence}
      domains={domains}
      nodes={nodes}
      cursor={cursor}
      runState={runState}
      counts={{ agents: counts.agents, gates: counts.gates }}
      onSelect={setCursor}
      onRefresh={refresh}
      onGateDecided={onGateDecided}
      onHome={goHome}
    />
  )
}
