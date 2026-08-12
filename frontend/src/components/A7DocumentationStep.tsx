import { useEffect, useMemo, useState } from 'react'
import { api, ApiError, type A7Brief, type A7ConfluencePublish, type LogLine } from '../api/client'
import type { PathMapIntakeSnapshot } from './AgentGateMapStep'
import type { ActivityPayload, GlossaryTerm } from './A1IntakeWizard'

interface Props {
  runId: string
  done: boolean
  formResetKey: number
  intake?: PathMapIntakeSnapshot | null
  onComplete: () => Promise<void>
  onResults: (payload: ActivityPayload) => void
  onContinueNext?: () => void
  continueLabel?: string
}

interface DocStat {
  id: string
  label: string
  value: number
  unit: string
  produced?: boolean
}

interface KnowledgeGraph {
  nodes: number
  relationships: number
  rules_linked: number
  rules_total: number
  modules_linked: number
  modules_total: number
  conflicts: number
}

const FALLBACK_ARTIFACTS: [string, string][] = [
  ['overview', 'System overview'],
  ['modules', 'Module / program docs'],
  ['diagrams', 'Sequence diagrams'],
  ['dictionary', 'Data dictionary'],
  ['runbooks', 'Batch job runbooks'],
  ['confluence', 'Publishable Confluence / wiki pages'],
]

const FALLBACK_PUBLISH: [string, string][] = [
  ['markdown', 'Markdown artefacts in the factory vault'],
  ['confluence', 'Confluence / wiki'],
  ['sharepoint', 'SharePoint / document library'],
]

const FALLBACK_DEPTH: [string, string][] = [
  ['summary', 'Summary — executive overview only'],
  ['standard', 'Standard — modules, diagrams, dictionary'],
  ['deep', 'Deep — runbooks, full graph, publish pack'],
]

function truncate(text: string, n = 160): string {
  const t = text.trim()
  if (t.length <= n) return t
  return `${t.slice(0, n - 1)}…`
}

function fmt(n: number): string {
  return n.toLocaleString()
}

const CONFLUENCE_PERMS: [string, string][] = [
  ['read', 'Read — view pages'],
  ['write', 'Write — edit content'],
  ['admin', 'Admin — manage space & permissions'],
]

function applyConfluenceFromRun(doc: Record<string, unknown>, setTracking: (v: string) => void, setPub: (v: A7ConfluencePublish | null) => void) {
  if (typeof doc.tracking_id === 'string') setTracking(doc.tracking_id)
  const cp = doc.confluence_publish
  if (cp && typeof cp === 'object') {
    setPub({ ...(cp as A7ConfluencePublish), published: true })
  }
}

export function A7DocumentationStep({
  runId,
  done,
  formResetKey,
  intake,
  onComplete,
  onResults,
  onContinueNext,
  continueLabel,
}: Props) {
  const [brief, setBrief] = useState<A7Brief | null>(null)
  const [briefLoading, setBriefLoading] = useState(true)
  const [artifacts, setArtifacts] = useState<string[]>([])
  const [publish, setPublish] = useState('markdown')
  const [depth, setDepth] = useState('standard')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [, setRunComplete] = useState(false)
  const [log, setLog] = useState<LogLine[]>([])
  const [documents, setDocuments] = useState<DocStat[]>([])
  const [kg, setKg] = useState<KnowledgeGraph | null>(null)
  const [resultHeadline, setResultHeadline] = useState('')
  const [resultBody, setResultBody] = useState('')
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [downloadError, setDownloadError] = useState<string | null>(null)
  const [confluencePerms, setConfluencePerms] = useState<string[]>(['read', 'write', 'admin'])
  const [trackingId, setTrackingId] = useState('')
  const [confluencePublish, setConfluencePublish] = useState<A7ConfluencePublish | null>(null)
  const [confluenceBusy, setConfluenceBusy] = useState(false)
  const [confluenceError, setConfluenceError] = useState<string | null>(null)

  const artOpts = brief?.artifacts_options?.length ? brief.artifacts_options : FALLBACK_ARTIFACTS
  const pubOpts = brief?.publish_options?.length ? brief.publish_options : FALLBACK_PUBLISH
  const depthOpts = brief?.depth_options?.length ? brief.depth_options : FALLBACK_DEPTH

  const a1Context = useMemo(
    () => ({
      categoryName: intake?.category_name || intake?.category_id || '—',
      categoryId: intake?.category_id || '',
      projectName: intake?.project_name || '—',
      requirement: intake?.requirement || '',
      strategies: intake?.strategies || [],
      strategyShort: intake?.strategy_short || intake?.strategies?.[0] || '—',
      why: intake?.why_modernize || '',
    }),
    [intake],
  )

  useEffect(() => {
    let cancelled = false
    setBriefLoading(true)
    setError(null)
    setRunComplete(false)
    setLog([])
    setDocuments([])
    setKg(null)
    setConfluencePublish(null)
    setTrackingId('')
    setConfluenceError(null)
    onResults({
      log: [['info', 'Loading A7 documentation brief from A1 + path + prior agent…']],
      synthesis: null,
      projectName: a1Context.projectName !== '—' ? a1Context.projectName : '',
      status: 'A7 · synthesizing documentation lens…',
      glossaryStatus: 'Personalizing glossary for documentation & knowledge graph…',
      evidenceItems: [],
      pageTitle: 'Documentation & Knowledge Graph',
      pageContext: a1Context.categoryName,
    })

    const briefPromise = api.a7Brief(runId)
    const timeout = new Promise<never>((_, reject) => {
      window.setTimeout(
        () => reject(new Error('A7 brief timed out — using catalog defaults')),
        14000,
      )
    })

    Promise.race([briefPromise, timeout])
      .then((r) => {
        if (cancelled) return
        setBrief(r)
        setArtifacts(r.suggested_artifacts?.length ? r.suggested_artifacts : ['overview', 'modules', 'diagrams', 'dictionary'])
        setPublish(r.suggested_publish || 'markdown')
        setDepth(r.suggested_depth || 'standard')
        setDocuments(r.documents || [])
        setKg(r.knowledge_graph || null)
        setResultHeadline(r.result_headline || '')
        setResultBody(r.result_body || '')
        const glossary: GlossaryTerm[] = r.glossary ?? []
        onResults({
          log: [
            ['ok', `A7 brief ready · ${r.model}`],
            ['info', r.context_line],
            ...(r.prior_line ? ([['info', r.prior_line]] as [string, string][]) : []),
            ...(r.warning ? ([['warn', r.warning]] as [string, string][]) : []),
          ],
          synthesis: null,
          projectName: a1Context.projectName !== '—' ? a1Context.projectName : '',
          status: r.activity_status || 'A7 ready — set the documentation lens and run',
          glossary,
          glossaryStatus: r.context_line,
          evidenceItems: (r.evidence_hints || []).map((name) => ({
            label: name,
            value: 'From A1 · awaiting A7 artefacts',
          })),
          pageTitle: r.title,
          pageContext: r.context_line,
        })
      })
      .catch((e) => {
        if (cancelled) return
        setBrief(null)
        setArtifacts(['overview', 'modules', 'diagrams', 'dictionary'])
        setError(e instanceof ApiError ? e.message : String(e))
        onResults({
          log: [
            ['warn', e instanceof Error ? e.message : String(e)],
            ['info', 'Continuing with category-shaped documentation defaults'],
          ],
          synthesis: null,
          projectName: a1Context.projectName !== '—' ? a1Context.projectName : '',
          status: 'A7 ready with defaults',
        })
      })
      .finally(() => {
        if (!cancelled) setBriefLoading(false)
      })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId, formResetKey])

  useEffect(() => {
    if (!done) return
    void Promise.all([api.agentLog(runId, 'A7'), api.getRun(runId), api.a7ConfluenceStatus(runId)]).then(
      ([r, run, cf]) => {
        setLog(r.log)
        if (Array.isArray(r.params.artifacts)) setArtifacts(r.params.artifacts as string[])
        if (typeof r.params.publish === 'string') setPublish(r.params.publish)
        if (typeof r.params.depth === 'string') setDepth(r.params.depth)
        const inv = (run.state as { inventory?: Record<string, unknown> } | undefined)?.inventory
        const documentation = (inv?.documentation || {}) as Record<string, unknown>
        if (Array.isArray(documentation.documents)) setDocuments(documentation.documents as DocStat[])
        if (documentation.knowledge_graph && typeof documentation.knowledge_graph === 'object') {
          setKg(documentation.knowledge_graph as KnowledgeGraph)
        }
        if (typeof documentation.result_headline === 'string') setResultHeadline(documentation.result_headline)
        if (typeof documentation.result_body === 'string') setResultBody(documentation.result_body)
        applyConfluenceFromRun(documentation, setTrackingId, setConfluencePublish)
        if (cf.published) setConfluencePublish(cf)
        else if (cf.tracking_id) setTrackingId(cf.tracking_id)
        setRunComplete(true)
        onResults({
          log: r.log,
          synthesis: null,
          projectName: a1Context.projectName !== '—' ? a1Context.projectName : '',
          status: 'A7 complete',
          evidenceItems: [
            { label: 'system_docs.md', value: 'Ready' },
            { label: 'knowledge_graph.json', value: 'Ready' },
            { label: 'data_dictionary.json', value: 'Ready' },
          ],
        })
      },
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, runId])

  const canRun = artifacts.length > 0 && Boolean(publish) && Boolean(depth)

  const blockerHint = useMemo(() => {
    if (briefLoading) return 'Loading documentation fields from A1…'
    if (!artifacts.length) return 'Select at least one documentation artefact.'
    if (!publish) return 'Select a publish target.'
    if (!depth) return 'Select a documentation depth.'
    return ''
  }, [briefLoading, artifacts, publish, depth])

  function toggleArtifact(id: string) {
    setArtifacts((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
    setRunComplete(false)
  }

  function applySuggested() {
    if (!brief) return
    setArtifacts(brief.suggested_artifacts?.length ? brief.suggested_artifacts : artifacts)
    setPublish(brief.suggested_publish || publish)
    setDepth(brief.suggested_depth || depth)
    setRunComplete(false)
  }

  function toggleConfluencePerm(id: string) {
    setConfluencePerms((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  async function publishToConfluence() {
    if (!confluencePerms.length) return
    setConfluenceError(null)
    setConfluenceBusy(true)
    try {
      const res = await api.a7ConfluencePublish(runId, confluencePerms)
      setConfluencePublish(res)
      if (res.tracking_id) setTrackingId(res.tracking_id)
    } catch (e) {
      setConfluenceError(e instanceof ApiError ? e.message : String(e))
    } finally {
      setConfluenceBusy(false)
    }
  }

  async function downloadDoc(docId: string) {
    setDownloadError(null)
    setDownloadingId(docId)
    try {
      await api.a7DownloadDocument(runId, docId)
    } catch (e) {
      setDownloadError(e instanceof ApiError ? e.message : String(e))
    } finally {
      setDownloadingId(null)
    }
  }

  async function downloadAllProduced() {
    const source: DocStat[] = documents.length
      ? documents
      : (brief?.documents || []).map((d) => ({ ...d, produced: artifacts.includes(d.id) }))
    const ids = source.filter((d) => d.produced !== false).map((d) => d.id)
    if (kg) ids.push('knowledge_graph')
    setDownloadError(null)
    for (const id of ids) {
      setDownloadingId(id)
      try {
        await api.a7DownloadDocument(runId, id)
      } catch (e) {
        setDownloadError(e instanceof ApiError ? e.message : String(e))
        break
      }
    }
    setDownloadingId(null)
  }

  async function runAgent() {
    if (!canRun) return
    setBusy(true)
    setError(null)
    setRunComplete(false)
    onResults({
      log: [['info', 'Running Documentation & Knowledge Graph agent…']],
      synthesis: null,
      projectName: a1Context.projectName !== '—' ? a1Context.projectName : '',
      status: 'A7 running…',
      pageTitle: brief?.title,
      pageContext: brief?.context_line,
    })
    try {
      const res = await api.runAgent(runId, 'A7', {
        artifacts,
        publish,
        depth,
        confluence_permissions: confluencePerms,
        category_id: brief?.category_id || a1Context.categoryId,
        prior_agent_id: brief?.prior_agent_id,
        prior_agent_name: brief?.prior_agent_name,
        result_headline: brief?.result_headline,
        result_body: brief?.result_body,
        a1_project_name: a1Context.projectName,
        a1_strategy: a1Context.strategyShort,
        a1_requirement: a1Context.requirement,
      })
      setLog(res.result.log)
      const inv = (res.state as { inventory?: Record<string, unknown> } | undefined)?.inventory
      const documentation = (inv?.documentation || {}) as Record<string, unknown>
      if (Array.isArray(documentation.documents)) {
        setDocuments(documentation.documents as DocStat[])
      } else if (brief?.documents?.length) {
        setDocuments(brief.documents)
      }
      if (documentation.knowledge_graph && typeof documentation.knowledge_graph === 'object') {
        setKg(documentation.knowledge_graph as KnowledgeGraph)
      } else {
        setKg(brief?.knowledge_graph || null)
      }
      if (typeof documentation.result_headline === 'string') setResultHeadline(documentation.result_headline)
      else setResultHeadline(brief?.result_headline || '')
      if (typeof documentation.result_body === 'string') setResultBody(documentation.result_body)
      else setResultBody(brief?.result_body || '')
      applyConfluenceFromRun(documentation, setTrackingId, setConfluencePublish)
      setRunComplete(true)
      onResults({
        log: res.result.log,
        synthesis: null,
        projectName: a1Context.projectName !== '—' ? a1Context.projectName : '',
        status: 'A7 complete — results below',
        glossary: brief?.glossary,
        glossaryStatus: brief?.context_line,
        evidenceItems: (res.result.artifacts?.length
          ? res.result.artifacts
          : ['system_docs.md', 'knowledge_graph.json', 'data_dictionary.json']
        ).map((name) => ({ label: name, value: 'Produced this step' })),
        pageTitle: brief?.title,
        pageContext: brief?.context_line,
      })
      await onComplete()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e))
      onResults({
        log: [['error', e instanceof Error ? e.message : String(e)]],
        synthesis: null,
        projectName: a1Context.projectName !== '—' ? a1Context.projectName : '',
        status: 'A7 failed',
      })
    } finally {
      setBusy(false)
    }
  }

  const title = brief?.title || 'Documentation & Knowledge Graph'
  const lede =
    brief?.lede ||
    'Writes fresh, accurate documentation for the old system — often for the first time in decades.'
  const formHeading = brief?.form_heading || 'Set the documentation lens'
  const kicker = brief?.domain_kicker || 'Domain B · Understand the old code · Step A7'
  const shownDocs = documents.length
    ? documents
    : (brief?.documents || []).map((d) => ({ ...d, produced: artifacts.includes(d.id) }))

  return (
    <div className="a7-step a1-wizard mf-req">
      <p className="dash-kicker">{kicker}</p>
      <h2 className="dash-title">{briefLoading ? 'Documentation & Knowledge Graph' : title}</h2>
      <p className="dash-lede">
        {briefLoading
          ? 'Personalizing this step from your Factory Administrator (A1) context, path map, and prior agent…'
          : lede}
      </p>

      <section className="a2-a1-context" aria-label="A1 and prior agent context">
        <div className="a2-a1-context-head">
          <h4>Domain Level Intake &amp; Context Matrix</h4>
          <span className="a2-a1-lock">Semantic continuity</span>
        </div>
        <p className="dash-sub a2-a1-intro">
          Documentation artefacts below stay close to the locked A1 combination and whatever the
          immediate prior agent finished.
        </p>
        <dl className="a2-a1-grid">
          <div>
            <dt>Category</dt>
            <dd>{a1Context.categoryName}</dd>
          </div>
          <div>
            <dt>Application / title</dt>
            <dd>{a1Context.projectName}</dd>
          </div>
          <div>
            <dt>Requirement / trend</dt>
            <dd>{a1Context.requirement ? truncate(a1Context.requirement, 160) : '—'}</dd>
          </div>
          <div>
            <dt>Prior agent</dt>
            <dd>
              {brief?.prior_agent_id
                ? `${brief.prior_agent_id} · ${brief.prior_agent_name || ''}`
                : '—'}
            </dd>
          </div>
          {brief?.doc_plan ? (
            <div className="a2-a1-why">
              <dt>Documentation plan</dt>
              <dd>{brief.doc_plan}</dd>
            </div>
          ) : null}
        </dl>
        {brief?.context_line ? <p className="a2-context-chip">{brief.context_line}</p> : null}
        {brief?.prior_line ? <p className="dash-sub">{brief.prior_line}</p> : null}
      </section>

      {/* Execution Controls Section */}
      <div className="mf-category-caption" style={{ marginTop: '16px' }}>
        ⚙️ 5. EXECUTION CONTROLS &amp; DOCUMENTATION LENS
      </div>
      <div className="a3-rules-head a4-form-head">
            <h3>{formHeading}</h3>
            {brief?.suggested_artifacts?.length ? (
              <button type="button" className="landing-ghost a3-suggest-btn" onClick={applySuggested}>
                Apply LLM suggestions
              </button>
            ) : null}
          </div>

          <section className="a4-form-card a6-form-card">
            <h4>{brief?.artifacts_label || 'What documentation should we produce?'}</h4>
            <p className="a4-field-hint">{brief?.artifacts_hint || 'Stay close to prior agent outputs.'}</p>
            <div className="a3-pills" role="group" aria-label="Documentation artefacts">
              {artOpts.map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={`a3-pill${artifacts.includes(id) ? ' on' : ''}`}
                  aria-pressed={artifacts.includes(id)}
                  onClick={() => toggleArtifact(id)}
                  disabled={briefLoading}
                >
                  {label}
                </button>
              ))}
            </div>
          </section>

          <section className="a4-form-card a6-form-card">
            <h4>{brief?.publish_label || 'Where should operators find the docs?'}</h4>
            <div className="a3-pills" role="radiogroup" aria-label="Publish target">
              {pubOpts.map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={`a3-pill${publish === id ? ' on' : ''}`}
                  aria-pressed={publish === id}
                  onClick={() => {
                    setPublish(id)
                    setRunComplete(false)
                  }}
                  disabled={briefLoading}
                >
                  {label}
                </button>
              ))}
            </div>
          </section>

          <section className="a4-form-card a6-form-card">
            <h4>{brief?.depth_label || 'How deep should documentation go?'}</h4>
            <div className="a3-pills" role="radiogroup" aria-label="Documentation depth">
              {depthOpts.map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={`a3-pill${depth === id ? ' on' : ''}`}
                  aria-pressed={depth === id}
                  onClick={() => {
                    setDepth(id)
                    setRunComplete(false)
                  }}
                  disabled={briefLoading}
                >
                  {label}
                </button>
              ))}
            </div>
          </section>

          {error && <p className="err">{error}</p>}

          <div className="dash-run-row a3-run-row" style={{ marginBottom: '24px' }}>
            <button
              className="landing-start"
              type="button"
              disabled={!canRun || busy}
              onClick={() => void runAgent()}
            >
              {busy ? 'Documenting…' : done ? '▶ Run this agent again' : '▶ Generate documentation'}
            </button>
            <button type="button" className="landing-ghost" disabled={busy} onClick={() => onContinueNext?.()}>
              Skip →
            </button>
            {!canRun && blockerHint ? <span className="dash-sub a2-blocker-hint">{blockerHint}</span> : null}
          </div>

      {/* Generated Documents Catalog - ALWAYS VISIBLE UPFRONT */}
      {shownDocs.length > 0 ? (
        <section className="a7-results a5-results" aria-live="polite">
          <div className="a6-banner a7-banner">
            <strong>
              {resultHeadline ||
                'The old system now has proper documentation — often for the first time in decades.'}
            </strong>
            <p>
              {resultBody ||
                'We wrote operator-facing docs and linked rules, modules, and tables into a knowledge graph.'}
            </p>
          </div>

          <div className="a5-panels a7-panels">
            <section className="a5-panel">
              <div className="a7-panel-head">
                <h4>Documents generated</h4>
                <button
                  type="button"
                  className="landing-ghost a7-dl-all"
                  disabled={Boolean(downloadingId) || shownDocs.every((d) => d.produced === false)}
                  onClick={() => void downloadAllProduced()}
                >
                  {downloadingId ? 'Downloading…' : 'Download all'}
                </button>
              </div>
              <dl className="a5-metrics a7-doc-metrics">
                {shownDocs.map((doc) => (
                  <div key={doc.id} className={doc.produced === false ? 'a7-doc-skipped' : ''}>
                    <dt>
                      <span className="a7-check" aria-hidden>
                        {doc.produced === false ? '○' : '✓'}
                      </span>
                      {doc.label}
                    </dt>
                    <dd className="a7-doc-dd">
                      {doc.produced === false ? (
                        '—'
                      ) : (
                        <>
                          <span>
                            {fmt(doc.value)} {doc.unit}
                          </span>
                          <button
                            type="button"
                            className="a7-dl-btn"
                            title={`Download ${doc.label}`}
                            aria-label={`Download ${doc.label}`}
                            disabled={Boolean(downloadingId)}
                            onClick={() => void downloadDoc(doc.id)}
                          >
                            {downloadingId === doc.id ? '…' : '⬇ Download'}
                          </button>
                        </>
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
              {downloadError ? <p className="err a7-dl-err">{downloadError}</p> : null}
            </section>

            <section className="a5-panel">
              <div className="a7-panel-head">
                <h4>Knowledge graph</h4>
                {kg ? (
                  <button
                    type="button"
                    className="a7-dl-btn"
                    title="Download knowledge graph JSON"
                    aria-label="Download knowledge graph"
                    disabled={Boolean(downloadingId)}
                    onClick={() => void downloadDoc('knowledge_graph')}
                  >
                    {downloadingId === 'knowledge_graph' ? '…' : '⬇ Download'}
                  </button>
                ) : null}
              </div>
              {kg ? (
                <dl className="a5-metrics">
                  <div>
                    <dt>Nodes</dt>
                    <dd>{fmt(kg.nodes)}</dd>
                  </div>
                  <div>
                    <dt>Relationships</dt>
                    <dd>{fmt(kg.relationships)}</dd>
                  </div>
                  <div>
                    <dt>Rules linked to code</dt>
                    <dd className="a7-ok">
                      {fmt(kg.rules_linked)} of {fmt(kg.rules_total)}
                    </dd>
                  </div>
                  <div>
                    <dt>Modules linked to tables</dt>
                    <dd className="a7-ok">
                      {fmt(kg.modules_linked)} of {fmt(kg.modules_total)}
                    </dd>
                  </div>
                  <div className="a5-metric-warn">
                    <dt>Documentation conflicts</dt>
                    <dd>
                      {fmt(kg.conflicts)} need review
                    </dd>
                  </div>
                </dl>
              ) : (
                <p className="dash-sub">Knowledge graph metrics will appear after the agent runs.</p>
              )}
            </section>
          </div>

          <section className="a5-panel a7-confluence-panel">
            <div className="a7-panel-head">
              <h4>Confluence publish</h4>
              {trackingId ? (
                confluencePublish?.search_url || confluencePublish?.pack_url ? (
                  <a
                    className="a7-tracking-id a7-tracking-link"
                    href={confluencePublish.pack_url || confluencePublish.search_url}
                    target="_blank"
                    rel="noreferrer"
                    title="Open Confluence by tracking ID"
                  >
                    {trackingId} ↗
                  </a>
                ) : (
                  <code className="a7-tracking-id" title="Instance tracking ID">
                    {trackingId}
                  </code>
                )
              ) : null}
            </div>
            <p className="dash-sub a7-confluence-note">
              Store produced documents in Confluence with Read, Write, and Admin permissions.
              Each page is tagged with a tracking ID so anyone can identify which factory run
              instance created it. Click the tracking ID or any page link to open Confluence.
            </p>
            {!confluencePublish?.pages?.length ? (
              <>
                <div className="a3-pills a7-confluence-perms" role="group" aria-label="Confluence permissions">
                  {CONFLUENCE_PERMS.map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      className={`a3-pill${confluencePerms.includes(id) ? ' on' : ''}`}
                      aria-pressed={confluencePerms.includes(id)}
                      disabled={confluenceBusy}
                      onClick={() => toggleConfluencePerm(id)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="a7-confluence-actions">
                  <button
                    type="button"
                    className="landing-start a7-confluence-btn"
                    disabled={confluenceBusy || !confluencePerms.length}
                    onClick={() => void publishToConfluence()}
                  >
                    {confluenceBusy ? 'Publishing…' : 'Publish to Confluence'}
                  </button>
                </div>
              </>
            ) : (
              <div className="a7-confluence-done">
                <p className="a7-confluence-status">
                  {confluencePublish.live ? '✓' : '○'}{' '}
                  {confluencePublish.live ? 'Published' : 'Staged'}{' '}
                  {confluencePublish.page_count ?? confluencePublish.pages?.length ?? 0} pages
                  {confluencePublish.published_at ? ` · ${confluencePublish.published_at}` : ''}
                </p>
                <div className="a7-confluence-open-row">
                  {(confluencePublish.pack_url || confluencePublish.search_url) && (
                    <a
                      className="landing-start a7-confluence-open"
                      href={confluencePublish.pack_url || confluencePublish.search_url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open Confluence pack →
                    </a>
                  )}
                  {confluencePublish.search_url ? (
                    <a
                      className="landing-ghost a7-confluence-search"
                      href={confluencePublish.search_url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Search by {trackingId || 'tracking ID'} ↗
                    </a>
                  ) : null}
                  <button
                    type="button"
                    className="landing-ghost"
                    disabled={confluenceBusy}
                    onClick={() => void publishToConfluence()}
                  >
                    {confluenceBusy ? 'Publishing…' : 'Re-publish'}
                  </button>
                </div>
                {confluencePublish.pages?.length ? (
                  <ul className="a7-confluence-links">
                    {confluencePublish.pages.map((p) => (
                      <li key={p.page_id}>
                        <a href={p.url} target="_blank" rel="noreferrer" title={p.url}>
                          {p.label} ↗
                        </a>
                        <span className="a7-perm-tags">
                          {p.permissions.read ? 'R' : ''}
                          {p.permissions.write ? 'W' : ''}
                          {p.permissions.admin ? 'A' : ''}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {confluencePublish.note ? (
                  <p className="dash-sub a7-confluence-note">{confluencePublish.note}</p>
                ) : null}
                {confluencePublish.api_error ? (
                  <p className="err a7-dl-err">{confluencePublish.api_error}</p>
                ) : null}
              </div>
            )}
            {confluenceError ? <p className="err a7-dl-err">{confluenceError}</p> : null}
          </section>

          {log.length > 0 ? (
            <ul className="dash-activity a2-result-log">
              {log.map(([level, msg], i) => (
                <li key={`${i}-${msg}`} className={level}>
                  {msg}
                </li>
              ))}
            </ul>
          ) : null}

          <div className="a1-just-did-actions a5-footer">
            <button className="landing-start" type="button" onClick={() => onContinueNext?.()}>
              {continueLabel || 'Continue to next step →'}
            </button>
            <span className="a1-step-badge a5-complete-pill">✓ Step complete</span>
          </div>
        </section>
      ) : null}
    </div>
  )
}
