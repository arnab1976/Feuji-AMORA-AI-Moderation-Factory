import { useEffect, useMemo, useState } from 'react'
import {
  api,
  ApiError,
  type A12Brief,
  type A12GitHubPublish,
  type A12SourceFile,
  type LogLine,
} from '../api/client'
import type { PathMapIntakeSnapshot } from './AgentGateMapStep'
import type { ActivityPayload, GlossaryTerm } from './A1IntakeWizard'
import { ChecklistPanel, allRequiredChecked, type ChecklistItem } from './ChecklistPanel'

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

interface GenMetric {
  id: string
  label: string
  value: number
  unit: string
}

interface SampleService {
  name: string
  stack: string
  methods: number
  traces_to: string
}

interface SampleArtefact {
  id: string
  label: string
  path: string
}

const FALLBACK_STACK: [string, string][] = [
  ['java', 'Java — Spring Boot / OpenAPI services'],
  ['dotnet', '.NET — ASP.NET Core services'],
  ['python', 'Python — FastAPI / service mesh friendly'],
]

const FALLBACK_EXTRAS: [string, string, string?][] = [
  ['provenance', 'A note on every method naming the rule it implements', 'Strongly recommended'],
  ['infra', 'Packaging and deployment files', ''],
]

const FALLBACK_CHECKS: ChecklistItem[] = [
  { id: 'stack_ok', label: 'Confirm generation stack matches the approved target architecture', required: true },
  { id: 'trace_ok', label: 'Confirm every generated unit traces to an approved rule', required: true },
  { id: 'prov_ok', label: 'Confirm provenance is on before G3 approval', required: true },
]

function truncate(text: string, n = 160): string {
  const t = text.trim()
  if (t.length <= n) return t
  return `${t.slice(0, n - 1)}…`
}

function fmt(n: number): string {
  return n.toLocaleString()
}

function formatMetric(m: GenMetric): string {
  const unit = (m.unit || '').trim()
  if (!unit) return fmt(m.value)
  return `${fmt(m.value)} ${unit}`
}

export function A12CodeGenerationStep({
  runId,
  done,
  formResetKey,
  intake,
  onComplete,
  onResults,
  onContinueNext,
  continueLabel,
}: Props) {
  const [brief, setBrief] = useState<A12Brief | null>(null)
  const [briefLoading, setBriefLoading] = useState(true)
  const [stack, setStack] = useState('java')
  const [extras, setExtras] = useState<string[]>(['provenance', 'infra'])
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [runComplete, setRunComplete] = useState(false)
  const [log, setLog] = useState<LogLine[]>([])
  const [metrics, setMetrics] = useState<GenMetric[]>([])
  const [sampleServices, setSampleServices] = useState<SampleService[]>([])
  const [artefacts, setArtefacts] = useState<SampleArtefact[]>([])
  const [resultHeadline, setResultHeadline] = useState('')
  const [resultBody, setResultBody] = useState('')
  const [sourceFiles, setSourceFiles] = useState<A12SourceFile[]>([])
  const [activeFileId, setActiveFileId] = useState<string>('')
  const [filesLoading, setFilesLoading] = useState(false)
  const [downloadBusy, setDownloadBusy] = useState<string | null>(null)
  const [downloadError, setDownloadError] = useState<string | null>(null)
  const [githubRepo, setGithubRepo] = useState('')
  const [githubBranch, setGithubBranch] = useState('main')
  const [githubToken, setGithubToken] = useState('')
  const [githubPrivate, setGithubPrivate] = useState(true)
  const [githubBusy, setGithubBusy] = useState(false)
  const [githubError, setGithubError] = useState<string | null>(null)
  const [githubPublish, setGithubPublish] = useState<A12GitHubPublish | null>(null)
  const [githubAuthConfigured, setGithubAuthConfigured] = useState(false)

  const stackOpts = brief?.stack_options?.length ? brief.stack_options : FALLBACK_STACK
  const extrasOpts = brief?.extras_options?.length ? brief.extras_options : FALLBACK_EXTRAS
  const activeFile = useMemo(
    () => sourceFiles.find((f) => f.id === activeFileId) || sourceFiles[0] || null,
    [sourceFiles, activeFileId],
  )

  async function loadGeneratedFiles() {
    setFilesLoading(true)
    setDownloadError(null)
    try {
      const payload = await api.a12Files(runId)
      setSourceFiles(payload.files || [])
      setActiveFileId((prev) => {
        if (prev && payload.files?.some((f) => f.id === prev)) return prev
        return payload.files?.[0]?.id || ''
      })
      setGithubAuthConfigured(Boolean(payload.github_auth_configured))
      if (payload.github_publish?.published) {
        setGithubPublish(payload.github_publish)
        if (payload.github_publish.full_name) setGithubRepo(payload.github_publish.full_name)
        if (payload.github_publish.branch) setGithubBranch(payload.github_publish.branch)
      }
    } catch (e) {
      setDownloadError(e instanceof ApiError ? e.message : String(e))
      setSourceFiles([])
    } finally {
      setFilesLoading(false)
    }
  }

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

  const checklist: ChecklistItem[] = useMemo(() => {
    const source = brief?.checklist?.length ? brief.checklist : FALLBACK_CHECKS
    return source.map((c) => ({
      id: c.id,
      label: c.label,
      required: true,
    }))
  }, [brief])

  const checklistReady = useMemo(
    () => allRequiredChecked(checklist, checked),
    [checklist, checked],
  )

  useEffect(() => {
    let cancelled = false
    setBriefLoading(true)
    setError(null)
    setRunComplete(false)
    setLog([])
    setChecked({})
    setMetrics([])
    setSampleServices([])
    setArtefacts([])
    onResults({
      log: [['info', 'Loading A12 code generation brief from A1 + path + A9–G2…']],
      synthesis: null,
      projectName: a1Context.projectName !== '—' ? a1Context.projectName : '',
      status: 'A12 · synthesizing code generation…',
      glossaryStatus: 'Personalizing glossary for code generation…',
      evidenceItems: [],
      pageTitle: 'Code generation',
      pageContext: a1Context.categoryName,
    })

    const briefPromise = api.a12Brief(runId)
    const timeout = new Promise<never>((_, reject) => {
      window.setTimeout(
        () => reject(new Error('A12 brief timed out — using catalog defaults')),
        50000,
      )
    })

    Promise.race([briefPromise, timeout])
      .then((r) => {
        if (cancelled) return
        setBrief(r)
        setStack(r.suggested_stack || 'java')
        setExtras(r.suggested_extras?.length ? r.suggested_extras : ['provenance', 'infra'])
        setMetrics(r.generated_metrics || [])
        setSampleServices(r.sample_services || [])
        setArtefacts(r.sample_artefacts || [])
        setResultHeadline(r.result_headline || '')
        setResultBody(r.result_body || '')
        const glossary: GlossaryTerm[] = r.glossary ?? []
        onResults({
          log: [
            ['ok', `A12 brief ready · ${r.model}`],
            ['info', r.context_line],
            ...(r.prior_line ? ([['info', r.prior_line]] as [string, string][]) : []),
            ...(r.generation_plan ? ([['info', r.generation_plan]] as [string, string][]) : []),
            ...(r.warning ? ([['warn', r.warning]] as [string, string][]) : []),
          ],
          synthesis: null,
          projectName: a1Context.projectName !== '—' ? a1Context.projectName : '',
          status: r.activity_status || 'A12 ready — confirm checklist and run',
          glossary,
          glossaryStatus: r.context_line,
          evidenceItems: (r.evidence_hints || []).map((name) => ({
            label: name,
            value: 'From A10/G2 · awaiting generation',
          })),
          pageTitle: r.title,
          pageContext: r.context_line,
        })
      })
      .catch((e) => {
        if (cancelled) return
        setBrief(null)
        setStack('java')
        setExtras(['provenance', 'infra'])
        setError(e instanceof ApiError ? e.message : String(e))
        onResults({
          log: [
            ['warn', e instanceof Error ? e.message : String(e)],
            ['info', 'Continuing with category-shaped code generation defaults'],
          ],
          synthesis: null,
          projectName: a1Context.projectName !== '—' ? a1Context.projectName : '',
          status: 'A12 ready with defaults',
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
    void Promise.all([api.agentLog(runId, 'A12'), api.getRun(runId)]).then(([r, run]) => {
      setLog(r.log)
      if (typeof r.params.stack === 'string') setStack(r.params.stack)
      if (Array.isArray(r.params.extras)) setExtras(r.params.extras.map(String))
      const inv = (run.state as { inventory?: Record<string, unknown>; generated?: Record<string, unknown> } | undefined)
      const codegen = ((inv?.inventory as Record<string, unknown> | undefined)?.codegen ||
        inv?.generated ||
        {}) as Record<string, unknown>
      if (Array.isArray(codegen.metrics)) setMetrics(codegen.metrics as GenMetric[])
      if (Array.isArray(codegen.sample_services)) setSampleServices(codegen.sample_services as SampleService[])
      if (Array.isArray(codegen.artefacts)) setArtefacts(codegen.artefacts as SampleArtefact[])
      if (typeof codegen.result_headline === 'string') setResultHeadline(codegen.result_headline)
      if (typeof codegen.result_body === 'string') setResultBody(codegen.result_body)
      setRunComplete(true)
      onResults({
        log: r.log,
        synthesis: null,
        projectName: a1Context.projectName !== '—' ? a1Context.projectName : '',
        status: 'A12 complete',
        evidenceItems: [
          { label: 'generated/services.zip', value: 'Ready' },
          { label: 'pull_request.json', value: 'Ready' },
          { label: 'sbom.cdx.json', value: 'Ready' },
        ],
      })
      void loadGeneratedFiles()
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, runId])

  async function downloadFile(fileId: string) {
    setDownloadBusy(fileId)
    setDownloadError(null)
    try {
      await api.a12DownloadFile(runId, fileId)
    } catch (e) {
      setDownloadError(e instanceof ApiError ? e.message : String(e))
    } finally {
      setDownloadBusy(null)
    }
  }

  async function downloadZip() {
    setDownloadBusy('zip')
    setDownloadError(null)
    try {
      await api.a12DownloadZip(runId)
    } catch (e) {
      setDownloadError(e instanceof ApiError ? e.message : String(e))
    } finally {
      setDownloadBusy(null)
    }
  }

  async function pushToGithub() {
    if (!githubRepo.trim()) {
      setGithubError('Enter a repository as owner/name or a github.com URL.')
      return
    }
    if (!githubToken.trim() && !githubAuthConfigured) {
      setGithubError('GitHub token is required. Paste a personal access token below.')
      return
    }
    setGithubBusy(true)
    setGithubError(null)
    try {
      const record = await api.a12GithubPush(runId, {
        repo: githubRepo.trim(),
        branch: githubBranch.trim() || 'main',
        private: githubPrivate,
        create_if_missing: true,
        token: githubToken.trim() || undefined,
      })
      setGithubPublish(record)
      setGithubAuthConfigured(Boolean(record.auth_configured ?? true))
    } catch (e) {
      setGithubError(e instanceof ApiError ? e.message : String(e))
    } finally {
      setGithubBusy(false)
    }
  }

  const canRun = Boolean(stack) && checklistReady && !briefLoading

  const blockerHint = useMemo(() => {
    if (briefLoading) return 'Loading code generation fields from A1 + path + G2…'
    if (!stack) return 'Select the target stack for generated services.'
    if (!checklistReady) return 'Confirm every checklist item before generation.'
    return ''
  }, [briefLoading, stack, checklistReady])

  function toggleExtra(id: string) {
    setExtras((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
    setRunComplete(false)
  }

  async function runAgent() {
    if (!canRun) return
    setBusy(true)
    setError(null)
    setRunComplete(false)
    onResults({
      log: [['info', 'Running Code generation agent…']],
      synthesis: null,
      projectName: a1Context.projectName !== '—' ? a1Context.projectName : '',
      status: 'A12 running…',
      pageTitle: brief?.title,
      pageContext: brief?.context_line,
    })
    try {
      const res = await api.runAgent(runId, 'A12', {
        stack,
        extras,
        category_id: brief?.category_id || a1Context.categoryId,
        prior_agent_id: brief?.prior_agent_id,
        prior_agent_name: brief?.prior_agent_name,
        g2_approved: brief?.g2_approved,
        result_headline: brief?.result_headline,
        result_body: brief?.result_body,
        generated_metrics: brief?.generated_metrics || metrics,
        sample_services: brief?.sample_services || sampleServices,
        sample_artefacts: brief?.sample_artefacts || artefacts,
        a1_project_name: a1Context.projectName,
        a1_strategy: a1Context.strategyShort,
        a1_requirement: a1Context.requirement,
      })
      setLog(res.result.log)
      const inv = (res.state as { inventory?: Record<string, unknown>; generated?: Record<string, unknown> } | undefined)
      const codegen = ((inv?.inventory as Record<string, unknown> | undefined)?.codegen ||
        inv?.generated ||
        {}) as Record<string, unknown>
      if (Array.isArray(codegen.metrics)) setMetrics(codegen.metrics as GenMetric[])
      else if (brief?.generated_metrics?.length) setMetrics(brief.generated_metrics)
      if (Array.isArray(codegen.sample_services)) {
        setSampleServices(codegen.sample_services as SampleService[])
      } else if (brief?.sample_services?.length) {
        setSampleServices(brief.sample_services)
      }
      if (Array.isArray(codegen.artefacts)) setArtefacts(codegen.artefacts as SampleArtefact[])
      else if (brief?.sample_artefacts?.length) setArtefacts(brief.sample_artefacts)
      if (typeof codegen.result_headline === 'string') setResultHeadline(codegen.result_headline)
      else setResultHeadline(brief?.result_headline || '')
      if (typeof codegen.result_body === 'string') setResultBody(codegen.result_body)
      else setResultBody(brief?.result_body || '')
      setRunComplete(true)
      onResults({
        log: res.result.log,
        synthesis: null,
        projectName: a1Context.projectName !== '—' ? a1Context.projectName : '',
        status: 'A12 complete — code exists, not trusted yet',
        glossary: brief?.glossary,
        glossaryStatus: brief?.context_line,
        evidenceItems: (res.result.artifacts?.length
          ? res.result.artifacts
          : ['generated/services.zip', 'pull_request.json', 'sbom.cdx.json']
        ).map((name) => ({ label: name, value: 'Produced this step' })),
        pageTitle: brief?.title,
        pageContext: brief?.context_line,
      })
      await loadGeneratedFiles()
      await onComplete()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e))
      onResults({
        log: [['error', e instanceof Error ? e.message : String(e)]],
        synthesis: null,
        projectName: a1Context.projectName !== '—' ? a1Context.projectName : '',
        status: 'A12 failed',
      })
    } finally {
      setBusy(false)
    }
  }

  const title = brief?.title || 'Code generation'
  const lede =
    brief?.lede ||
    'Generates new services from approved architecture and rules; every method traces to an approved business rule.'
  const formHeading = brief?.form_heading || 'Choose stack and extras'
  const kicker = brief?.domain_kicker || 'Domain D · Design & build the new · Step A12'
  const services = brief?.service_names || []
  const shownMetrics = metrics.length ? metrics : brief?.generated_metrics || []
  const shownServices = sampleServices.length ? sampleServices : brief?.sample_services || []
  const shownArtefacts = artefacts.length ? artefacts : brief?.sample_artefacts || []
  const projectCard = a1Context.requirement
    ? truncate(a1Context.requirement, 140)
    : a1Context.projectName

  const activeLegacyLang = useMemo(() => {
    const raw = brief?.legacy_language || ''
    const reqLower = (a1Context.requirement || '').toLowerCase()
    const projLower = (a1Context.projectName || '').toLowerCase()
    const catLower = (a1Context.categoryName || '').toLowerCase()
    const combined = `${reqLower} ${projLower} ${catLower}`

    if (combined.includes('sas')) return 'SAS'
    if (combined.includes('fortran')) return 'Fortran'
    if (combined.includes('cobol')) return 'COBOL'
    if (combined.includes('pl/i') || combined.includes('pli')) return 'PL/I'
    if (combined.includes('natural')) return 'Natural'
    if (combined.includes('rpg')) return 'RPG'
    if (combined.includes('pascal') || combined.includes('delphi')) return 'Delphi/Pascal'
    if (combined.includes('vb6') || combined.includes('visual basic')) return 'VB6'
    if (combined.includes('assembler') || combined.includes('asm')) return 'Assembler'
    if (combined.includes('java')) return 'Java'
    if (combined.includes('c#') || combined.includes('.net')) return '.NET'

    if (raw && !raw.toLowerCase().includes('cobol')) return raw
    return 'Legacy'
  }, [brief?.legacy_language, a1Context])

  return (
    <div className="a12-step a10-step a7-step a1-wizard mf-req">
      <p className="dash-kicker">{kicker}</p>
      <h2 className="dash-title">{briefLoading ? 'Code generation' : title}</h2>
      <p className="dash-lede">
        {briefLoading
          ? 'Personalizing this step from your Factory Administrator (A1) context, path map, and approved architecture…'
          : lede}
      </p>

      <section className="a2-a1-context" aria-label="A1 path and architecture context">
        <div className="a2-a1-context-head">
          <h4>Domain Level Intake &amp; Context Matrix</h4>
          <span className="a2-a1-lock">Semantic continuity</span>
        </div>
        <p className="dash-sub a2-a1-intro">
          Stack, checklist, and generated output stay close to the locked A1 combination, the active
          movement path, and the architecture approved at G2.
        </p>
        <dl className="a2-a1-grid">
          <div>
            <dt>From A1</dt>
            <dd>{a1Context.categoryName}</dd>
          </div>
          <div>
            <dt>Strategy</dt>
            <dd>{a1Context.strategyShort}</dd>
          </div>
          <div>
            <dt>Project</dt>
            <dd>{projectCard}</dd>
          </div>
          <div>
            <dt>Map status</dt>
            <dd>
              {brief?.path_active_ids?.includes('A12')
                ? 'Active · on path'
                : brief?.path_active_ids?.length
                  ? 'Path loaded'
                  : '—'}
            </dd>
          </div>
          <div>
            <dt>Prior step</dt>
            <dd>
              {brief?.prior_agent_id
                ? `${brief.prior_agent_id} · ${brief.prior_agent_name || ''}`
                : 'G2 · Architecture Approval'}
              {brief?.g2_approved ? ' · approved' : ''}
            </dd>
          </div>
          <div>
            <dt>Target stack</dt>
            <dd>
              {brief?.target_stack_hint || (stack === 'python' ? 'Python' : stack === 'java' ? 'Java' : stack === 'dotnet' ? '.NET' : stack)}
              {activeLegacyLang ? ` ← ${activeLegacyLang}` : ''}
            </dd>
          </div>
          <div>
            <dt>A9 services</dt>
            <dd>{services.length ? services.join(' · ') : 'Awaiting A9'}</dd>
          </div>
          <div>
            <dt>Approved rules</dt>
            <dd>{fmt(brief?.approved_rule_count ?? 0)}</dd>
          </div>
          {brief?.generation_plan ? (
            <div className="a2-a1-span">
              <dt>Generation plan</dt>
              <dd>{brief.generation_plan}</dd>
            </div>
          ) : null}
          {brief?.prior_line ? (
            <div className="a2-a1-span">
              <dt>Continuity</dt>
              <dd>{brief.prior_line}</dd>
            </div>
          ) : null}
        </dl>
        {brief?.warning ? <p className="dash-sub a2-warn">{brief.warning}</p> : null}
      </section>

      {!runComplete ? (
        <>
          <ChecklistPanel
            items={checklist}
            checked={checked}
            disabled={briefLoading || busy}
            title={brief?.checklist_heading || 'Operator checklist (required)'}
            note={
              (brief?.checklist_note ||
                'Confirm every item before generation. Labels combine standard controls with A1, path, and strategy.') +
              ' Generation is blocked until all items are confirmed.'
            }
            onToggle={(id, value) => setChecked((p) => ({ ...p, [id]: value }))}
          />
          {!checklistReady && checklist.length > 0 && (
            <div className="dash-run-row">
              <button
                type="button"
                className="landing-ghost"
                disabled={briefLoading || busy}
                onClick={() => {
                  const next: Record<string, boolean> = {}
                  for (const item of checklist) next[item.id] = true
                  setChecked(next)
                }}
              >
                Confirm all checklist items
              </button>
            </div>
          )}

          <h3 className="a4-form-heading">{formHeading}</h3>
          {brief?.stack_hint ? <p className="dash-sub">{brief.stack_hint}</p> : null}

          <section className="a4-form-card a6-form-card">
            <h4>{brief?.stack_label || 'What should the new code be written in?'}</h4>
            <div className="a3-pills" role="radiogroup" aria-label="Target stack">
              {stackOpts.map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={`a3-pill${stack === id ? ' on' : ''}`}
                  aria-pressed={stack === id}
                  onClick={() => {
                    setStack(id)
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
            <h4>{brief?.extras_label || 'What else should be produced?'}</h4>
            {brief?.extras_hint ? <p className="dash-sub">{brief.extras_hint}</p> : null}
            <div className="a3-pills a12-extras" role="group" aria-label="Generation extras">
              {extrasOpts.map(([id, label, badge]) => (
                <button
                  key={id}
                  type="button"
                  className={`a3-pill${extras.includes(id) ? ' on' : ''}`}
                  aria-pressed={extras.includes(id)}
                  onClick={() => toggleExtra(id)}
                  disabled={briefLoading}
                >
                  <span>{label}</span>
                  {badge ? <em className="a12-extra-badge">{badge}</em> : null}
                </button>
              ))}
            </div>
          </section>

          {blockerHint ? <p className="dash-sub a12-blocker">{blockerHint}</p> : null}
          {error ? <p className="err">{error}</p> : null}

          <div className="dash-run-row">
            <button
              className="landing-start"
              type="button"
              onClick={() => void runAgent()}
              disabled={!canRun || busy}
            >
              {busy ? 'Generating…' : done ? 'Generate again' : '▶ Generate code'}
            </button>
          </div>
        </>
      ) : (
        <section className="a5-results a12-results" aria-label="Code generation results">
          <div className="a5-results-banner">
            <h3>{resultHeadline || brief?.result_headline || 'Code exists but is not trusted yet.'}</h3>
            <p>{resultBody || brief?.result_body || ''}</p>
          </div>

          {shownMetrics.length > 0 ? (
            <div className="a5-metric-grid">
              {shownMetrics.map((m) => (
                <div key={m.id} className="a5-metric">
                  <span className="a5-metric-label">{m.label}</span>
                  <strong className="a5-metric-value">{formatMetric(m)}</strong>
                </div>
              ))}
            </div>
          ) : null}

          {shownServices.length > 0 ? (
            <div className="a12-service-list">
              <h4>Services generated</h4>
              <ul>
                {shownServices.map((s) => (
                  <li key={s.name}>
                    <strong>{s.name}</strong>
                    <span>
                      {s.stack} · {fmt(s.methods)} methods · {s.traces_to}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {shownArtefacts.length > 0 ? (
            <div className="a12-artefact-list">
              <h4>Artefacts</h4>
              <ul>
                {shownArtefacts.map((a) => (
                  <li key={a.id || a.path}>
                    <strong>{a.label}</strong>
                    <code>{a.path}</code>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <section className="a12-code-panel" aria-label="Generated source code">
            <div className="a12-code-head">
              <div>
                <h4>Generated source</h4>
                <p className="dash-sub">
                  {filesLoading
                    ? 'Loading source files…'
                    : `${fmt(sourceFiles.length)} files ready to review, download, or push.`}
                </p>
              </div>
              <div className="a12-code-actions">
                <button
                  type="button"
                  className="landing-ghost"
                  disabled={!sourceFiles.length || downloadBusy === 'zip'}
                  onClick={() => void downloadZip()}
                >
                  {downloadBusy === 'zip' ? 'Preparing ZIP…' : '⬇ Download ZIP'}
                </button>
                {activeFile ? (
                  <button
                    type="button"
                    className="landing-ghost"
                    disabled={downloadBusy === activeFile.id}
                    onClick={() => void downloadFile(activeFile.id)}
                  >
                    {downloadBusy === activeFile.id ? 'Downloading…' : '⬇ Download file'}
                  </button>
                ) : null}
              </div>
            </div>
            {downloadError ? <p className="err">{downloadError}</p> : null}

            {sourceFiles.length > 0 ? (
              <div className="a12-code-layout">
                <ul className="a12-file-tree" aria-label="Source files">
                  {sourceFiles.map((f) => (
                    <li key={f.id}>
                      <button
                        type="button"
                        className={activeFile?.id === f.id ? 'on' : ''}
                        onClick={() => setActiveFileId(f.id)}
                      >
                        <strong>{f.label}</strong>
                        <span>{f.path}</span>
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="a12-code-view">
                  <div className="a12-code-view-head">
                    <code>{activeFile?.path}</code>
                    <span>{activeFile?.language}</span>
                  </div>
                  <pre className="a12-code-pre">
                    <code>{activeFile?.content || '// No file selected'}</code>
                  </pre>
                </div>
              </div>
            ) : (
              <p className="dash-sub">
                {filesLoading
                  ? 'Materializing source…'
                  : 'No source files yet — generate code to populate this panel.'}
              </p>
            )}
          </section>

          <section className="a12-github-panel a4-form-card" aria-label="Push to GitHub">
            <h4>Push to GitHub</h4>
            <p className="dash-sub">
              Paste a GitHub personal access token below (used for this push only — not written to
              disk). Token needs <code>repo</code> or Contents: Read and write. Repository accepts
              <code> owner/name</code> or a full github.com URL.
            </p>
            <div className="a12-github-form">
              <label className="a12-github-token">
                GitHub token <span className="a12-required">required</span>
                <input
                  type="password"
                  autoComplete="off"
                  spellCheck={false}
                  value={githubToken}
                  onChange={(e) => setGithubToken(e.target.value)}
                  placeholder="ghp_… or github_pat_…"
                  disabled={githubBusy}
                />
              </label>
              <label>
                Repository (owner/name or URL)
                <input
                  type="text"
                  value={githubRepo}
                  onChange={(e) => setGithubRepo(e.target.value)}
                  placeholder="Arnab-Feuji/Kuch-bhi"
                  disabled={githubBusy}
                />
              </label>
              <label>
                Branch
                <input
                  type="text"
                  value={githubBranch}
                  onChange={(e) => setGithubBranch(e.target.value)}
                  placeholder="main"
                  disabled={githubBusy}
                />
              </label>
              <label className="a12-github-private">
                <input
                  type="checkbox"
                  checked={githubPrivate}
                  onChange={(e) => setGithubPrivate(e.target.checked)}
                  disabled={githubBusy}
                />
                Create as private repo if missing
              </label>
            </div>
            {githubError ? <p className="err">{githubError}</p> : null}
            {githubPublish?.published ? (
              <p className="dash-sub a12-github-ok">
                Pushed {fmt(githubPublish.file_count || 0)} files to{' '}
                <a href={githubPublish.html_url || githubPublish.tree_url} target="_blank" rel="noreferrer">
                  {githubPublish.full_name || 'repository'}
                </a>
                {githubPublish.branch ? ` · ${githubPublish.branch}` : ''}
                {githubPublish.published_at ? ` · ${githubPublish.published_at}` : ''}
              </p>
            ) : null}
            <div className="dash-run-row">
              <button
                type="button"
                className="landing-start"
                disabled={
                  !sourceFiles.length ||
                  githubBusy ||
                  !githubRepo.trim() ||
                  (!githubToken.trim() && !githubAuthConfigured)
                }
                onClick={() => void pushToGithub()}
              >
                {githubBusy ? 'Pushing…' : githubPublish?.published ? 'Push again to GitHub' : 'Push to GitHub'}
              </button>
            </div>
          </section>

          {log.length > 0 ? (
            <div className="a5-log">
              <h4>Activity</h4>
              <ul>
                {log.map((line, i) => (
                  <li key={`${line[0]}-${i}`} className={`log-${line[0]}`}>
                    {line[1]}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="dash-run-row">
            <button
              className="landing-ghost"
              type="button"
              onClick={() => {
                setRunComplete(false)
                setChecked({})
              }}
            >
              Adjust &amp; generate again
            </button>
            {onContinueNext ? (
              <button className="landing-start" type="button" onClick={onContinueNext}>
                {continueLabel || 'Continue to next step →'}
              </button>
            ) : null}
          </div>
        </section>
      )}
    </div>
  )
}
