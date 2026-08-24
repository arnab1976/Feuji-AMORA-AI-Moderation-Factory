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

  const [isContextLocked, setIsContextLocked] = useState(true)
  const [editCategory, setEditCategory] = useState('')
  const [editProject, setEditProject] = useState('')
  const [editStrategy, setEditStrategy] = useState('')
  const [editRequirement, setEditRequirement] = useState('')

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
    if (!editCategory && a1Context.categoryName && a1Context.categoryName !== '—') {
      setEditCategory(a1Context.categoryName)
    }
    if (!editProject && a1Context.projectName && a1Context.projectName !== '—') {
      setEditProject(a1Context.projectName)
    }
    if (!editStrategy && a1Context.strategyShort && a1Context.strategyShort !== '—') {
      setEditStrategy(a1Context.strategyShort)
    }
    if (!editRequirement && a1Context.requirement) {
      setEditRequirement(a1Context.requirement)
    }
  }, [a1Context])

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

  const shownMetrics = metrics.length ? metrics : brief?.generated_metrics || []
  const shownServices = sampleServices.length ? sampleServices : brief?.sample_services || []

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

  function applySuggested() {
    setStack(brief?.suggested_stack || 'java')
    setExtras(brief?.suggested_extras?.length ? brief.suggested_extras : ['provenance', 'infra'])
  }

  return (
    <div className="a12-step a10-step a7-step a1-wizard mf-req">
      {/* 1. DOMAIN LEVEL INTAKE & CONTEXT MATRIX (Single flat card, captioned, editable/lockable) */}
      <section className="a2-a1-context" style={{ padding: '10px 14px', background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.9))', border: '1px solid rgba(56, 189, 248, 0.35)', borderRadius: '8px', margin: '0 0 10px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h4 style={{ fontSize: '13px', fontWeight: 900, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>
              🌐 DOMAIN LEVEL INTAKE &amp; CONTEXT MATRIX
            </h4>
            <span
              style={{
                fontSize: '10px',
                fontWeight: 800,
                padding: '2px 8px',
                borderRadius: '4px',
                background: isContextLocked ? 'rgba(34, 197, 94, 0.15)' : 'rgba(234, 179, 8, 0.15)',
                color: isContextLocked ? '#4ade80' : '#facc15',
                border: isContextLocked ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid rgba(234, 179, 8, 0.3)',
              }}
            >
              {isContextLocked ? '🔒 LOCKED' : '✏️ EDITABLE'}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setIsContextLocked(!isContextLocked)}
            style={{
              fontSize: '11px',
              fontWeight: 800,
              padding: '4px 10px',
              borderRadius: '5px',
              background: isContextLocked ? 'rgba(56, 189, 248, 0.15)' : 'rgba(34, 197, 94, 0.2)',
              color: isContextLocked ? '#38bdf8' : '#4ade80',
              border: isContextLocked ? '1px solid rgba(56, 189, 248, 0.4)' : '1px solid rgba(34, 197, 94, 0.4)',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            {isContextLocked ? '✏️ Edit Context' : '🔒 Lock & Save'}
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '6px', background: 'rgba(15, 23, 42, 0.45)', padding: '8px 10px', borderRadius: '6px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
          <div>
            <span style={{ display: 'block', fontSize: '9.5px', fontWeight: 900, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>
              CATEGORY
            </span>
            {isContextLocked ? (
              <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#cbd5e1' }}>
                {editCategory || a1Context.categoryName}
              </span>
            ) : (
              <input
                type="text"
                value={editCategory}
                onChange={(e) => setEditCategory(e.target.value)}
                style={{ width: '100%', background: '#0f172a', border: '1px solid #38bdf8', color: '#f8fafc', padding: '3px 6px', borderRadius: '4px', fontSize: '11.5px' }}
              />
            )}
          </div>

          <div>
            <span style={{ display: 'block', fontSize: '9.5px', fontWeight: 900, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>
              APPLICATION / TITLE
            </span>
            {isContextLocked ? (
              <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#cbd5e1' }}>
                {editProject || a1Context.projectName}
              </span>
            ) : (
              <input
                type="text"
                value={editProject}
                onChange={(e) => setEditProject(e.target.value)}
                style={{ width: '100%', background: '#0f172a', border: '1px solid #38bdf8', color: '#f8fafc', padding: '3px 6px', borderRadius: '4px', fontSize: '11.5px' }}
              />
            )}
          </div>

          <div>
            <span style={{ display: 'block', fontSize: '9.5px', fontWeight: 900, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>
              STRATEGY
            </span>
            {isContextLocked ? (
              <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#cbd5e1' }}>
                {editStrategy || a1Context.strategyShort}
              </span>
            ) : (
              <input
                type="text"
                value={editStrategy}
                onChange={(e) => setEditStrategy(e.target.value)}
                style={{ width: '100%', background: '#0f172a', border: '1px solid #38bdf8', color: '#f8fafc', padding: '3px 6px', borderRadius: '4px', fontSize: '11.5px' }}
              />
            )}
          </div>

          <div>
            <span style={{ display: 'block', fontSize: '9.5px', fontWeight: 900, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>
              PRIOR STEP
            </span>
            <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#cbd5e1' }}>
              G2 · Architecture Approval
            </span>
          </div>

          <div>
            <span style={{ display: 'block', fontSize: '9.5px', fontWeight: 900, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>
              TARGET STACK
            </span>
            <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#cbd5e1' }}>
              {brief?.target_stack_hint || (stack === 'python' ? 'Python' : stack === 'java' ? 'Java' : stack === 'dotnet' ? '.NET' : stack)}
              {activeLegacyLang ? ` ← ${activeLegacyLang}` : ''}
            </span>
          </div>

          <div>
            <span style={{ display: 'block', fontSize: '9.5px', fontWeight: 900, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>
              APPROVED RULES
            </span>
            <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#cbd5e1' }}>
              {fmt(brief?.approved_rule_count ?? 0)} rules
            </span>
          </div>

          <div style={{ gridColumn: '1 / -1', marginTop: '2px' }}>
            <span style={{ display: 'block', fontSize: '9.5px', fontWeight: 900, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>
              REQUIREMENT / TREND
            </span>
            {isContextLocked ? (
              <span style={{ fontSize: '11.5px', fontWeight: 500, color: '#cbd5e1', lineHeight: '1.4' }}>
                {editRequirement || a1Context.requirement || 'Modernizing legacy application estate.'}
              </span>
            ) : (
              <textarea
                rows={2}
                value={editRequirement}
                onChange={(e) => setEditRequirement(e.target.value)}
                style={{ width: '100%', background: '#0f172a', border: '1px solid #38bdf8', color: '#f8fafc', padding: '4px 6px', borderRadius: '4px', fontSize: '11.5px', fontFamily: 'inherit' }}
              />
            )}
          </div>
        </div>
      </section>

      {/* 2. VERIFICATION CHECKLIST */}
      <ChecklistPanel
        items={checklist}
        checked={checked}
        disabled={briefLoading || busy}
        title={brief?.checklist_heading || 'OPTIONAL / MANDATORY VERIFICATION CHECKLIST'}
        note="Confirm each mandatory item before generating code. Labels combine standard controls with A1, path, and strategy."
        onToggle={(id, value) => setChecked((p) => ({ ...p, [id]: value }))}
      />

      {/* 3. EXECUTION CONTROLS & GENERATION LENS (Single rich compact card) */}
      <section className="a12-execution-card" style={{ padding: '10px 14px', background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.9))', border: '1px solid rgba(56, 189, 248, 0.35)', borderRadius: '8px', margin: '0 0 10px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <h4 style={{ fontSize: '13px', fontWeight: 900, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>
            ⚙️ EXECUTION CONTROLS &amp; GENERATION LENS
          </h4>
          <button
            type="button"
            className="landing-ghost a3-suggest-btn"
            style={{ padding: '3px 8px', fontSize: '11px' }}
            onClick={applySuggested}
          >
            Apply LLM suggestions
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div>
            <span style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#f8fafc', marginBottom: '2px' }}>
              {brief?.stack_label || 'What should the new code be written in?'}
            </span>
            <div className="a3-pills" role="radiogroup" aria-label="Target stack" style={{ gap: '4px' }}>
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
                  style={{ padding: '4px 10px', fontSize: '11.5px' }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#f8fafc', marginBottom: '2px' }}>
              {brief?.extras_label || 'What else should be produced?'}
            </span>
            <div className="a3-pills a12-extras" role="group" aria-label="Generation extras" style={{ gap: '4px' }}>
              {extrasOpts.map(([id, label, badge]) => (
                <button
                  key={id}
                  type="button"
                  className={`a3-pill${extras.includes(id) ? ' on' : ''}`}
                  aria-pressed={extras.includes(id)}
                  onClick={() => toggleExtra(id)}
                  disabled={briefLoading}
                  style={{ padding: '4px 10px', fontSize: '11.5px' }}
                >
                  <span>{label}</span>
                  {badge ? <em className="a12-extra-badge">{badge}</em> : null}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {blockerHint ? <p className="dash-sub a12-blocker">{blockerHint}</p> : null}
      {error ? <p className="err">{error}</p> : null}

      <div className="dash-run-row a3-run-row" style={{ marginBottom: '10px' }}>
        <button
          className="landing-start"
          type="button"
          onClick={() => void runAgent()}
          disabled={!canRun || busy}
          style={{ fontSize: '12.5px', fontWeight: 800, padding: '8px 16px' }}
        >
          {busy ? 'Generating…' : runComplete || done ? '▶ Generate code again' : '▶ Generate code'}
        </button>
      </div>

      {/* 4. RESULTS SECTION (Renders cleanly in-place below form controls once complete) */}
      {(runComplete || done) && (
        <section className="a5-results a12-results" aria-label="Code generation results" style={{ padding: '12px 14px', background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.9))', border: '1px solid rgba(56, 189, 248, 0.35)', borderRadius: '8px', marginTop: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', paddingBottom: '6px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
            <h4 style={{ fontSize: '12.5px', fontWeight: 900, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>
              📊 CODE GENERATION OUTPUT &amp; SERVICE BLUEPRINT
            </h4>
            <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', background: 'rgba(34, 197, 94, 0.15)', color: '#4ade80', border: '1px solid rgba(34, 197, 94, 0.3)' }}>
              ✓ Code Generated
            </span>
          </div>

          {shownMetrics.length > 0 ? (
            <div className="a5-metric-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px', marginBottom: '10px' }}>
              {shownMetrics.map((m) => (
                <div key={m.id} className="a5-metric" style={{ padding: '8px 10px', background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(56, 189, 248, 0.25)', borderRadius: '6px' }}>
                  <span className="a5-metric-label" style={{ fontSize: '10px', color: '#94a3b8' }}>{m.label}</span>
                  <strong className="a5-metric-value" style={{ fontSize: '16px', color: '#38bdf8', display: 'block', marginTop: '2px' }}>{formatMetric(m)}</strong>
                </div>
              ))}
            </div>
          ) : null}

          {shownServices.length > 0 ? (
            <div className="a12-service-list" style={{ marginBottom: '10px' }}>
              <h4 style={{ fontSize: '11px', fontWeight: 900, color: '#38bdf8', textTransform: 'uppercase', margin: '0 0 6px' }}>Services generated</h4>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {shownServices.map((s) => (
                  <li key={s.name} style={{ padding: '6px 10px', background: 'rgba(15, 23, 42, 0.5)', borderRadius: '4px', border: '1px solid rgba(255, 255, 255, 0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px' }}>
                    <strong style={{ color: '#f8fafc' }}>{s.name}</strong>
                    <span style={{ color: '#94a3b8' }}>
                      {s.stack} · {fmt(s.methods)} methods · {s.traces_to}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <section className="a12-code-panel" aria-label="Generated source code" style={{ marginBottom: '10px' }}>
            <div className="a12-code-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <div>
                <h4 style={{ fontSize: '11.5px', fontWeight: 900, color: '#38bdf8', textTransform: 'uppercase', margin: 0 }}>Generated source</h4>
                <p className="dash-sub" style={{ fontSize: '10px', margin: '2px 0 0', color: '#94a3b8' }}>
                  {filesLoading
                    ? 'Loading source files…'
                    : `${fmt(sourceFiles.length)} files ready to review, download, or push.`}
                </p>
              </div>
              <div className="a12-code-actions" style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  className="landing-ghost"
                  disabled={!sourceFiles.length || downloadBusy === 'zip'}
                  onClick={() => void downloadZip()}
                  style={{ fontSize: '11px', padding: '3px 8px' }}
                >
                  {downloadBusy === 'zip' ? 'Preparing ZIP…' : '⬇ Download ZIP'}
                </button>
                {activeFile ? (
                  <button
                    type="button"
                    className="landing-ghost"
                    disabled={downloadBusy === activeFile.id}
                    onClick={() => void downloadFile(activeFile.id)}
                    style={{ fontSize: '11px', padding: '3px 8px' }}
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
              <p className="dash-sub" style={{ fontSize: '11px' }}>
                {filesLoading
                  ? 'Materializing source…'
                  : 'No source files yet — generate code to populate this panel.'}
              </p>
            )}
          </section>

          <section className="a12-github-panel a4-form-card" aria-label="Push to GitHub" style={{ padding: '10px 12px', background: 'rgba(15, 23, 42, 0.4)', borderRadius: '6px', border: '1px solid rgba(255, 255, 255, 0.05)', marginBottom: '10px' }}>
            <h4 style={{ fontSize: '11.5px', fontWeight: 900, color: '#38bdf8', textTransform: 'uppercase', margin: '0 0 4px' }}>Push to GitHub</h4>
            <p className="dash-sub" style={{ fontSize: '10.5px', margin: '0 0 8px' }}>
              Paste a GitHub token below to publish generated code to a repository.
            </p>
            <div className="a12-github-form" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '6px' }}>
              <label className="a12-github-token" style={{ fontSize: '10.5px' }}>
                GitHub token <span className="a12-required">required</span>
                <input
                  type="password"
                  autoComplete="off"
                  spellCheck={false}
                  value={githubToken}
                  onChange={(e) => setGithubToken(e.target.value)}
                  placeholder="ghp_… or github_pat_…"
                  disabled={githubBusy}
                  style={{ fontSize: '11px', padding: '3px 6px' }}
                />
              </label>
              <label style={{ fontSize: '10.5px' }}>
                Repository (owner/name)
                <input
                  type="text"
                  value={githubRepo}
                  onChange={(e) => setGithubRepo(e.target.value)}
                  placeholder="Arnab-Feuji/Kuch-bhi"
                  disabled={githubBusy}
                  style={{ fontSize: '11px', padding: '3px 6px' }}
                />
              </label>
              <label style={{ fontSize: '10.5px' }}>
                Branch
                <input
                  type="text"
                  value={githubBranch}
                  onChange={(e) => setGithubBranch(e.target.value)}
                  placeholder="main"
                  disabled={githubBusy}
                  style={{ fontSize: '11px', padding: '3px 6px' }}
                />
              </label>
              <label className="a12-github-private" style={{ fontSize: '10.5px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <input
                  type="checkbox"
                  checked={githubPrivate}
                  onChange={(e) => setGithubPrivate(e.target.checked)}
                  disabled={githubBusy}
                />
                Private repo
              </label>
            </div>
            {githubError ? <p className="err">{githubError}</p> : null}
            {githubPublish?.published ? (
              <p className="dash-sub a12-github-ok" style={{ fontSize: '11px', marginTop: '6px' }}>
                Pushed {fmt(githubPublish.file_count || 0)} files to{' '}
                <a href={githubPublish.html_url || githubPublish.tree_url} target="_blank" rel="noreferrer">
                  {githubPublish.full_name || 'repository'}
                </a>
                {githubPublish.branch ? ` · ${githubPublish.branch}` : ''}
              </p>
            ) : null}
            <div className="dash-run-row" style={{ marginTop: '8px' }}>
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
                style={{ fontSize: '11.5px', padding: '4px 12px' }}
              >
                {githubBusy ? 'Pushing…' : githubPublish?.published ? 'Push again to GitHub' : 'Push to GitHub'}
              </button>
            </div>
          </section>

          {log.length > 0 ? (
            <div className="a5-log" style={{ marginBottom: '10px' }}>
              <h4 style={{ fontSize: '11px', fontWeight: 900, color: '#38bdf8', textTransform: 'uppercase', margin: '0 0 4px' }}>Activity Log</h4>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '1px' }}>
                {log.map((line, i) => (
                  <li key={`${line[0]}-${i}`} style={{ fontSize: '10px', fontFamily: 'monospace', color: line[0] === 'error' ? '#f87171' : line[0] === 'warn' ? '#facc15' : line[0] === 'ok' ? '#4ade80' : '#94a3b8' }}>
                    {line[1]}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="dash-run-row a3-run-row a10-continue-row" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {onContinueNext ? (
              <button className="landing-start" type="button" onClick={onContinueNext} style={{ fontSize: '12.5px', fontWeight: 800, padding: '8px 16px' }}>
                {continueLabel || '▶ Move Forward to G3: Code Quality Gate →'}
              </button>
            ) : null}
          </div>
        </section>
      )}
    </div>
  )
}
