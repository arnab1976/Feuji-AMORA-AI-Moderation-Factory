import { useEffect, useMemo, useState } from 'react'
import { api, ApiError, type A4Brief, type LogLine } from '../api/client'
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

const FALLBACK_SOURCES: [string, string][] = [
  ['code', 'The programs themselves'],
  ['copybooks', 'Shared data layouts / copybooks'],
  ['jcl', 'Job scripts / batch'],
  ['db', 'Database structure'],
  ['docs', 'Design / business documents'],
  ['config', 'Config / PARMLIB overlays'],
]

function truncate(text: string, n = 160): string {
  const t = text.trim()
  if (t.length <= n) return t
  return `${t.slice(0, n - 1)}…`
}

function parseRepoLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((ln) => ln.trim())
    .filter(Boolean)
}

export function A4RepositoryStep({
  runId,
  done,
  formResetKey,
  intake,
  onComplete,
  onResults,
  onContinueNext,
  continueLabel,
}: Props) {
  const [brief, setBrief] = useState<A4Brief | null>(null)
  const [briefLoading, setBriefLoading] = useState(true)
  const [repoUrls, setRepoUrls] = useState('')
  const [missingDeps, setMissingDeps] = useState('')
  const [sources, setSources] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [runComplete, setRunComplete] = useState(false)
  const [log, setLog] = useState<LogLine[]>([])
  const [headline, setHeadline] = useState('')

  const sourceOpts = brief?.source_options?.length ? brief.source_options : FALLBACK_SOURCES

  const a1Context = useMemo(() => {
    return {
      categoryName: intake?.category_name || intake?.category_id || '—',
      categoryId: intake?.category_id || '',
      projectName: intake?.project_name || '—',
      requirement: intake?.requirement || '',
      strategies: intake?.strategies || [],
      strategyShort: intake?.strategy_short || intake?.strategies?.[0] || '—',
      why: intake?.why_modernize || '',
    }
  }, [intake])

  useEffect(() => {
    let cancelled = false
    setBriefLoading(true)
    setError(null)
    setRunComplete(false)
    setLog([])
    setHeadline('')
    setRepoUrls('')
    setMissingDeps('')
    setSources([])
    onResults({
      log: [['info', 'Loading A4 repository discovery brief from A1 context combination…']],
      synthesis: null,
      projectName: a1Context.projectName !== '—' ? a1Context.projectName : '',
      status: 'A4 · synthesizing repository form…',
      glossaryStatus: 'Personalizing glossary for repository discovery…',
      evidenceItems: [],
      pageTitle: 'Repository discovery',
      pageContext: a1Context.categoryName,
    })

    const briefPromise = api.a4Brief(runId)
    const timeout = new Promise<never>((_, reject) => {
      window.setTimeout(
        () => reject(new Error('A4 brief timed out — using category defaults')),
        12000,
      )
    })

    Promise.race([briefPromise, timeout])
      .then((r) => {
        if (cancelled) return
        setBrief(r)
        setRepoUrls(r.repos_suggested || '')
        setMissingDeps(r.missing_suggested || '')
        setSources(
          r.suggested_sources?.length
            ? [...r.suggested_sources]
            : ['code', 'copybooks', 'jcl', 'db'],
        )
        const glossary: GlossaryTerm[] = r.glossary ?? []
        onResults({
          log: [
            ['ok', `A4 brief ready · ${r.model}`],
            ['info', r.context_line],
            ...(r.warning ? ([['warn', r.warning]] as [string, string][]) : []),
          ],
          synthesis: null,
          projectName: a1Context.projectName !== '—' ? a1Context.projectName : '',
          status: r.activity_status || 'A4 ready — enter repositories and run',
          glossary,
          glossaryStatus: r.context_line,
          evidenceItems: (r.evidence_hints || []).map((name) => ({
            label: name,
            value: 'From A1 · awaiting A4 artefacts',
          })),
          pageTitle: r.title,
          pageContext: r.context_line,
        })
      })
      .catch((e) => {
        if (cancelled) return
        setBrief(null)
        const catSlug = (a1Context.categoryName || 'legacy-estate').toLowerCase().replace(/[^a-z0-9]+/g, '-')
        setRepoUrls(
          `https://git.example.com/legacy/${catSlug}-core.git\n` +
            `file:///workspace/source/${catSlug}\n` +
            `db://legacy-prod/schemas/APP_SCHEMA\n` +
            `cron://batch-scheduler/NIGHTLY_SWEEP`,
        )
        setMissingDeps(
          'Legacy schema dictionary is being recovered from legacy archive.',
        )
        setSources(['code', 'schemas', 'jobs', 'db'])
        setError(e instanceof ApiError ? e.message : String(e))
        onResults({
          log: [
            ['warn', e instanceof Error ? e.message : String(e)],
            ['info', 'Continuing with category-shaped repository defaults'],
          ],
          synthesis: null,
          projectName: a1Context.projectName !== '—' ? a1Context.projectName : '',
          status: 'A4 ready with defaults',
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
    api.agentLog(runId, 'A4').then((r) => {
      setLog(r.log)
      if (Object.keys(r.params).length) {
        if (typeof r.params.repo_urls === 'string') setRepoUrls(r.params.repo_urls)
        if (typeof r.params.missing_deps === 'string') setMissingDeps(r.params.missing_deps)
        if (Array.isArray(r.params.sources)) setSources(r.params.sources as string[])
      }
      const hl = r.log.find(([lvl]) => lvl === 'hl')
      if (hl) setHeadline(hl[1])
      setRunComplete(true)
      onResults({
        log: r.log,
        synthesis: null,
        projectName: a1Context.projectName !== '—' ? a1Context.projectName : '',
        status: 'A4 complete',
        evidenceItems: [
          { label: 'inventory.json', value: 'Ready' },
          { label: 'dependency_graph.json', value: 'Ready' },
        ],
      })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, runId])

  const repos = useMemo(() => parseRepoLines(repoUrls), [repoUrls])
  const formReady = repos.length > 0 && sources.length > 0
  const canRun = formReady && !briefLoading

  const blockerHint = useMemo(() => {
    if (briefLoading) return 'Loading repository form from A1…'
    if (!repos.length) return 'Enter at least one repository URL or path (one per line).'
    if (!sources.length) return 'Tick at least one source type to inventory.'
    return ''
  }, [briefLoading, repos.length, sources.length])

  function toggleSource(id: string) {
    setSources((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  function applySuggested() {
    const catSlug = (a1Context.categoryName || 'sas-insurance-fraud-modelling').toLowerCase().replace(/[^a-z0-9]+/g, '-')
    const defaultRepo = brief?.repos_suggested || `https://github.com/enterprise-analytics/${catSlug}.git\nfile:///C:/code/legacy-sas-source/`
    setRepoUrls(defaultRepo)
    setMissingDeps(brief?.missing_suggested || 'Legacy schema dictionary recovered from repository archive.')
    setSources(
      brief?.suggested_sources?.length
        ? [...brief.suggested_sources]
        : ['code', 'copybooks', 'jcl', 'db'],
    )
    setRunComplete(false)
  }

  async function runAgent() {
    if (!canRun) return
    setBusy(true)
    setError(null)
    setRunComplete(false)
    onResults({
      log: [['info', 'Running Repository discovery agent…']],
      synthesis: null,
      projectName: a1Context.projectName !== '—' ? a1Context.projectName : '',
      status: 'A4 running…',
      pageTitle: brief?.title,
      pageContext: brief?.context_line,
    })
    try {
      const res = await api.runAgent(runId, 'A4', {
        repo_urls: repoUrls.trim(),
        missing_deps: missingDeps.trim(),
        sources,
        category_id: brief?.category_id || a1Context.categoryId,
        form_heading: brief?.form_heading,
        a1_project_name: a1Context.projectName,
        a1_strategy: a1Context.strategyShort,
        a1_requirement: a1Context.requirement,
      })
      setLog(res.result.log)
      const hl = res.result.log.find(([lvl]) => lvl === 'hl')
      setHeadline(hl?.[1] ?? '')
      setRunComplete(true)
      onResults({
        log: res.result.log,
        synthesis: null,
        projectName: a1Context.projectName !== '—' ? a1Context.projectName : '',
        status: 'A4 complete — inventory ready',
        glossary: brief?.glossary,
        glossaryStatus: brief?.context_line,
        evidenceItems: (res.result.artifacts?.length
          ? res.result.artifacts
          : ['inventory.json', 'dependency_graph.json']
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
        status: 'A4 failed',
      })
    } finally {
      setBusy(false)
    }
  }

  const title = brief?.title || 'Repository discovery'
  const lede =
    brief?.lede ||
    'Reads your old code repository and figures out what is in it — modules, dependencies, dead code.'
  const formHeading = brief?.form_heading || "Where's the old code?"
  const reposLabel = brief?.repos_label || 'Repository URLs — one per line'
  const reposHint =
    brief?.repos_hint ||
    'Provide GitHub repository URLs, Git SSH links, local directory paths, or mainframe/database URLs.'
  const missingLabel = brief?.missing_label || 'Any missing dependencies you know about?'
  const missingHint =
    brief?.missing_hint || 'If a copybook or shared library is missing, tell us here.'
  const sourcesLabel = brief?.sources_label || 'What should we read?'
  const sourcesHint =
    brief?.sources_hint || 'Tick every source type the factory should inventory.'

  return (
    <div className="a4-step a1-wizard mf-req">
      <p className="dash-kicker">Domain B · Understand the old code · Step A4</p>
      <h2 className="dash-title">{briefLoading ? 'Repository discovery' : title}</h2>
      <p className="dash-lede">
        {briefLoading
          ? 'Synthesizing repository discovery form from A1 context…'
          : lede}
      </p>

      <section className="a2-a1-context a4-context" aria-label="Factory Administrator context">
        <div className="a2-a1-context-head">
          <h4>Domain Level Intake &amp; Context Matrix</h4>
          <span className="a2-a1-lock">Shapes discovery</span>
        </div>
        <p className="dash-sub a2-a1-intro">
          Repository URL examples and source types are synthesized from the locked A1 intake
          combination. When A4 is required for that combination, it is active on the agent &amp;
          gate map and appears on the movement path.
        </p>
        <div className="mf-category-caption">
          📊 3. STRATEGIC INTAKE &amp; CONTEXT MATRIX
        </div>
        <section className="a2-a1-strip">
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
              <dt>Strategy</dt>
              <dd>
                {a1Context.strategies.length > 1
                  ? a1Context.strategies.join(' · ')
                  : a1Context.strategyShort}
              </dd>
            </div>
            {a1Context.requirement ? (
              <div className="a2-a1-why">
                <dt>Requirement / trend</dt>
                <dd>{truncate(a1Context.requirement)}</dd>
              </div>
            ) : null}
            {brief?.discovery_summary ? (
              <div className="a2-a1-why">
                <dt>Discovery plan</dt>
                <dd>{brief.discovery_summary}</dd>
              </div>
            ) : null}
          </dl>
          {brief?.context_line ? <p className="a2-context-chip">{brief.context_line}</p> : null}
        </section>
      </section>

      <div className="mf-category-caption" style={{ marginTop: '16px' }}>
        ⚙️ 5. EXECUTION CONTROLS &amp; SYNTHESIS
      </div>
      <div className="a3-rules-head a4-form-head">
        <h3>{formHeading}</h3>
        <button type="button" className="landing-ghost a3-suggest-btn" onClick={applySuggested}>
          Apply LLM suggestions
        </button>
      </div>

      <section className="a4-form-card">
        <h4>{reposLabel || 'Repository URLs, Local Paths, or Paste Raw Code Directly'}</h4>
        <p className="a4-field-hint">
          {reposHint || 'Paste raw SAS/COBOL/Fortran code snippets directly into this box, or enter GitHub URLs/Local folder paths (one per line).'}
        </p>

        {/* Accepted File Types & Formats Banner */}
        <div className="a4-supported-files-banner" style={{ background: 'rgba(30, 41, 59, 0.7)', border: '1px solid rgba(56, 189, 248, 0.3)', borderRadius: '8px', padding: '12px 14px', margin: '10px 0 14px' }}>
          <div style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: '#38bdf8', marginBottom: '6px', letterSpacing: '0.05em' }}>
            📁 ACCEPTED FILE TYPES &amp; SOURCE FORMATS
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            <span className="a4-file-badge" style={{ background: 'rgba(45, 212, 191, 0.15)', color: '#2dd4bf', border: '1px solid rgba(45, 212, 191, 0.4)', fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '4px' }}>
              SAS (.sas, .sas7bdat, .sasmac, .inc)
            </span>
            <span className="a4-file-badge" style={{ background: 'rgba(236, 72, 153, 0.15)', color: '#f472b6', border: '1px solid rgba(236, 72, 153, 0.4)', fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '4px' }}>
              🌐 SAS Web Crawler &amp; Site Scraping (Crawl SAS Code from Websites &amp; HTTP Endpoints)
            </span>
            <span className="a4-file-badge" style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.4)', fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '4px' }}>
              COBOL &amp; Mainframe (.cbl, .cob, .cpy, .jcl)
            </span>
            <span className="a4-file-badge" style={{ background: 'rgba(251, 146, 60, 0.15)', color: '#fb923c', border: '1px solid rgba(251, 146, 60, 0.4)', fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '4px' }}>
              Fortran &amp; Math (.f, .f90, .for, .f77)
            </span>
            <span className="a4-file-badge" style={{ background: 'rgba(168, 85, 247, 0.15)', color: '#c084fc', border: '1px solid rgba(168, 85, 247, 0.4)', fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '4px' }}>
              Database (.sql, .ddl, .schema, .csv)
            </span>
            <span className="a4-file-badge" style={{ background: 'rgba(234, 179, 8, 0.15)', color: '#fef08a', border: '1px solid rgba(234, 179, 8, 0.4)', fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '4px' }}>
              Raw Code Snippets (Paste Directly)
            </span>
            <span className="a4-file-badge" style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8', border: '1px solid rgba(99, 102, 241, 0.4)', fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '4px' }}>
              Git Repos (HTTPS / SSH / Local Path)
            </span>
          </div>
        </div>

        <div style={{ background: 'rgba(236, 72, 153, 0.08)', borderLeft: '4px solid #f472b6', borderRadius: '4px', padding: '8px 12px', margin: '8px 0 12px', fontSize: '0.84rem', color: '#fbcfe8' }}>
          <strong>🕷️ SAS Web Crawler Enabled:</strong> Enter website URLs (e.g. <code>https://git.company.com/legacy/sas-project</code> or <code>/sharepoint/legacy/sas_files</code>) to automatically crawl, scrape, and extract embedded <code>.sas</code> code, macros, and PROC SQL statements directly from site pages.
        </div>

        {briefLoading ? (
          <p className="dash-empty">Synthesizing repository examples…</p>
        ) : (
          <textarea
            className="a4-textarea"
            rows={6}
            value={repoUrls}
            onChange={(e) => {
              setRepoUrls(e.target.value)
              setRunComplete(false)
            }}
            placeholder="PASTE RAW CODE OR ENTER LOCATIONS / SITE URLS TO CRAWL:&#10;1) https://git.company.com/legacy/sas-project&#10;2) /db2/sas_code_repository&#10;3) /sharepoint/legacy/sas_files&#10;4) /mq/sas_code_queue&#10;5) Paste raw SAS code directly (e.g. DATA work.fraud; SET prod.claims; RUN;)"
            aria-label={reposLabel}
          />
        )}
      </section>

      <section className="a4-form-card">
        <h4>{missingLabel}</h4>
        <p className="a4-field-hint">{missingHint}</p>
        <textarea
          className="a4-textarea a4-textarea-sm"
          rows={3}
          value={missingDeps}
          onChange={(e) => {
            setMissingDeps(e.target.value)
            setRunComplete(false)
          }}
          placeholder="Optional — note copybooks, schemas, or libraries still offline"
          aria-label={missingLabel}
          disabled={briefLoading}
        />
      </section>

      <section className="a4-form-card">
        <h4>{sourcesLabel}</h4>
        <p className="a4-field-hint">{sourcesHint}</p>
        <div className="a3-pills" role="group" aria-label={sourcesLabel}>
          {sourceOpts.map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`a3-pill${sources.includes(id) ? ' on' : ''}`}
              aria-pressed={sources.includes(id)}
              onClick={() => toggleSource(id)}
              disabled={briefLoading}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      {error && <p className="err">{error}</p>}

      <div className="dash-run-row a3-run-row">
        <button
          className="landing-start"
          type="button"
          disabled={!canRun || busy}
          onClick={() => void runAgent()}
        >
          {busy ? 'Running…' : done || runComplete ? '▶ Run this agent again' : '▶ Run this agent'}
        </button>
        <button
          type="button"
          className="landing-ghost"
          disabled={busy}
          onClick={() => onContinueNext?.()}
        >
          Skip →
        </button>
        {!canRun && blockerHint ? (
          <span className="dash-sub a2-blocker-hint">{blockerHint}</span>
        ) : null}
      </div>

      {runComplete && (
        <section className="a1-just-did a4-results" aria-live="polite">
          <h4 className="a1-just-did-title">What we just did</h4>
          <div className="a1-success-banner">
            <strong>Repository discovery complete.</strong>
            <p>
              Inventory and dependency map recorded for <em>{a1Context.projectName}</em> from{' '}
              {repos.length} location{repos.length === 1 ? '' : 's'}.
            </p>
          </div>
          <div className="a1-run-details">
            <h5>Discovery details</h5>
            <dl>
              <div>
                <dt>Repositories</dt>
                <dd>
                  <ul className="a4-repo-list">
                    {repos.map((u) => (
                      <li key={u}>{u}</li>
                    ))}
                  </ul>
                </dd>
              </div>
              {missingDeps.trim() ? (
                <div>
                  <dt>Missing dependencies</dt>
                  <dd>{missingDeps.trim()}</dd>
                </div>
              ) : null}
              <div>
                <dt>Sources read</dt>
                <dd>
                  {sources
                    .map((id) => sourceOpts.find(([v]) => v === id)?.[1] ?? id)
                    .join(', ')}
                </dd>
              </div>
              {headline ? (
                <div>
                  <dt>Note</dt>
                  <dd className="a2-assess">{headline}</dd>
                </div>
              ) : null}
            </dl>
          </div>
          {log.length > 0 && (
            <ul className="dash-activity a2-result-log">
              {log.map(([level, msg], i) => (
                <li key={`${i}-${msg}`} className={level}>
                  {msg}
                </li>
              ))}
            </ul>
          )}
          <div className="a1-just-did-actions">
            <button className="landing-start" type="button" onClick={() => onContinueNext?.()}>
              {continueLabel || 'Continue to next step →'}
            </button>
          </div>
        </section>
      )}
    </div>
  )
}
