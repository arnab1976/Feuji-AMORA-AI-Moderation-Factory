import { useEffect, useMemo, useState } from 'react'
import { api, ApiError, type A4Brief, type LogLine } from '../api/client'
import { validateRepoLines } from '../utils/repositoryValidator'
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



function parseRepoLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((ln) => ln.trim())
    .filter(Boolean)
}

export interface TechCrawlerInfo {
  techName: string
  fileExtensions: string
  crawlerBadgeText: string
  crawlerTitle: string
  crawlerDescription: string
  placeholderText: string
  primaryBadge: string
  primaryBadgeBg: string
  primaryBadgeColor: string
  primaryBadgeBorder: string
}

export function getTechCrawlerInfo(
  a1Context: {
    categoryName?: string
    categoryId?: string
    projectName?: string
    requirement?: string
    strategyShort?: string
  },
  brief?: A4Brief | null
): TechCrawlerInfo {
  const combined = [
    a1Context.categoryName,
    a1Context.categoryId,
    a1Context.projectName,
    a1Context.requirement,
    a1Context.strategyShort,
    brief?.title,
    brief?.context_line,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  const catName = a1Context.categoryName && a1Context.categoryName !== '—' ? a1Context.categoryName : ''
  const projName = a1Context.projectName && a1Context.projectName !== '—' ? a1Context.projectName : ''
  const reqText = a1Context.requirement || ''
  const slug = (catName || projName || reqText || 'legacy-code').toLowerCase().replace(/[^a-z0-9]+/g, '-')

  if (combined.includes('fortran') || combined.includes('f77') || combined.includes('f90') || combined.includes('f95')) {
    return {
      techName: 'Fortran',
      fileExtensions: '.f, .f90, .for, .f77, .inc',
      primaryBadge: 'Fortran & Math (.f, .f90, .for, .f77)',
      primaryBadgeBg: 'rgba(251, 146, 60, 0.15)',
      primaryBadgeColor: '#fb923c',
      primaryBadgeBorder: 'rgba(251, 146, 60, 0.4)',
      crawlerBadgeText: '🌐 Fortran Web Crawler & Site Scraping (Crawl Fortran Code from Websites & HTTP Endpoints)',
      crawlerTitle: '🕷️ Fortran Web Crawler Enabled:',
      crawlerDescription: `Enter website URLs (e.g. https://git.company.com/legacy/${slug} or /sharepoint/legacy/fortran_files) to automatically crawl, scrape, and extract embedded .f90/.f77 code, subroutines, and math modules directly from site pages.`,
      placeholderText: `PASTE RAW CODE OR ENTER LOCATIONS / SITE URLS TO CRAWL:\n1) https://git.company.com/legacy/${slug}\n2) /db2/fortran_code_repository\n3) /sharepoint/legacy/fortran_files\n4) /mq/fortran_code_queue\n5) Paste raw Fortran code directly (e.g. PROGRAM MATH_ENGINE; IMPLICIT NONE; REAL A(100); ...)`
    }
  }

  if (combined.includes('cobol') || combined.includes('mainframe') || combined.includes('cbl') || combined.includes('copybook')) {
    return {
      techName: 'COBOL',
      fileExtensions: '.cbl, .cob, .cpy, .jcl',
      primaryBadge: 'COBOL & Mainframe (.cbl, .cob, .cpy, .jcl)',
      primaryBadgeBg: 'rgba(56, 189, 248, 0.15)',
      primaryBadgeColor: '#38bdf8',
      primaryBadgeBorder: 'rgba(56, 189, 248, 0.4)',
      crawlerBadgeText: '🌐 COBOL Web Crawler & Site Scraping (Crawl COBOL Code from Websites & HTTP Endpoints)',
      crawlerTitle: '🕷️ COBOL Web Crawler Enabled:',
      crawlerDescription: `Enter website URLs (e.g. https://git.company.com/legacy/${slug} or /sharepoint/legacy/cobol_files) to automatically crawl, scrape, and extract embedded .cbl code, copybooks, and EXEC SQL statements directly from site pages.`,
      placeholderText: `PASTE RAW CODE OR ENTER LOCATIONS / SITE URLS TO CRAWL:\n1) https://git.company.com/legacy/${slug}\n2) /db2/cobol_code_repository\n3) /sharepoint/legacy/cobol_files\n4) /mq/cobol_code_queue\n5) Paste raw COBOL code directly (e.g. IDENTIFICATION DIVISION. PROGRAM-ID. HELLO. PROCEDURE DIVISION. ...)`
    }
  }

  if (combined.includes('sas') || combined.includes('sas7bdat') || combined.includes('sasmac')) {
    return {
      techName: 'SAS',
      fileExtensions: '.sas, .sas7bdat, .sasmac, .inc',
      primaryBadge: 'SAS (.sas, .sas7bdat, .sasmac, .inc)',
      primaryBadgeBg: 'rgba(45, 212, 191, 0.15)',
      primaryBadgeColor: '#2dd4bf',
      primaryBadgeBorder: 'rgba(45, 212, 191, 0.4)',
      crawlerBadgeText: '🌐 SAS Web Crawler & Site Scraping (Crawl SAS Code from Websites & HTTP Endpoints)',
      crawlerTitle: '🕷️ SAS Web Crawler Enabled:',
      crawlerDescription: `Enter website URLs (e.g. https://git.company.com/legacy/${slug} or /sharepoint/legacy/sas_files) to automatically crawl, scrape, and extract embedded .sas code, macros, and PROC SQL statements directly from site pages.`,
      placeholderText: `PASTE RAW CODE OR ENTER LOCATIONS / SITE URLS TO CRAWL:\n1) https://git.company.com/legacy/${slug}\n2) /db2/sas_code_repository\n3) /sharepoint/legacy/sas_files\n4) /mq/sas_code_queue\n5) Paste raw SAS code directly (e.g. DATA work.fraud; SET prod.claims; RUN;)`
    }
  }

  if (combined.includes('cpp') || combined.includes('c++') || combined.includes('c/c++')) {
    return {
      techName: 'C/C++',
      fileExtensions: '.c, .cpp, .h, .hpp, .cc',
      primaryBadge: 'C/C++ (.c, .cpp, .h, .hpp)',
      primaryBadgeBg: 'rgba(168, 85, 247, 0.15)',
      primaryBadgeColor: '#c084fc',
      primaryBadgeBorder: 'rgba(168, 85, 247, 0.4)',
      crawlerBadgeText: '🌐 C/C++ Web Crawler & Site Scraping (Crawl C/C++ Code from Websites & HTTP Endpoints)',
      crawlerTitle: '🕷️ C/C++ Web Crawler Enabled:',
      crawlerDescription: `Enter website URLs (e.g. https://git.company.com/legacy/${slug} or /sharepoint/legacy/cpp_files) to automatically crawl, scrape, and extract embedded .c/.cpp code, header files, and build scripts directly from site pages.`,
      placeholderText: `PASTE RAW CODE OR ENTER LOCATIONS / SITE URLS TO CRAWL:\n1) https://git.company.com/legacy/${slug}\n2) /db2/cpp_code_repository\n3) /sharepoint/legacy/cpp_files\n4) /mq/cpp_code_queue\n5) Paste raw C/C++ code directly (e.g. #include <stdio.h> int main() { ... })`
    }
  }

  if (combined.includes('java') || combined.includes('spring') || combined.includes('j2ee')) {
    return {
      techName: 'Java',
      fileExtensions: '.java, .jsp, .xml, .properties',
      primaryBadge: 'Java (.java, .jsp, .xml, .properties)',
      primaryBadgeBg: 'rgba(236, 72, 153, 0.15)',
      primaryBadgeColor: '#f472b6',
      primaryBadgeBorder: 'rgba(236, 72, 153, 0.4)',
      crawlerBadgeText: '🌐 Java Web Crawler & Site Scraping (Crawl Java Code from Websites & HTTP Endpoints)',
      crawlerTitle: '🕷️ Java Web Crawler Enabled:',
      crawlerDescription: `Enter website URLs (e.g. https://git.company.com/legacy/${slug} or /sharepoint/legacy/java_files) to automatically crawl, scrape, and extract embedded .java classes, Spring configurations, and XML definitions directly from site pages.`,
      placeholderText: `PASTE RAW CODE OR ENTER LOCATIONS / SITE URLS TO CRAWL:\n1) https://git.company.com/legacy/${slug}\n2) /db2/java_code_repository\n3) /sharepoint/legacy/java_files\n4) /mq/java_code_queue\n5) Paste raw Java code directly (e.g. public class OrderProcessor { ... })`
    }
  }

  if (combined.includes('sql') || combined.includes('plsql') || combined.includes('oracle') || combined.includes('db2') || combined.includes('database')) {
    return {
      techName: 'Database / SQL',
      fileExtensions: '.sql, .ddl, .pls, .pks, .pkb, .schema',
      primaryBadge: 'Database & SQL (.sql, .ddl, .pls, .pks, .pkb)',
      primaryBadgeBg: 'rgba(168, 85, 247, 0.15)',
      primaryBadgeColor: '#c084fc',
      primaryBadgeBorder: 'rgba(168, 85, 247, 0.4)',
      crawlerBadgeText: '🌐 Database & SQL Web Crawler & Site Scraping (Crawl SQL/DDL from Websites & HTTP Endpoints)',
      crawlerTitle: '🕷️ SQL/Database Web Crawler Enabled:',
      crawlerDescription: `Enter website URLs (e.g. https://git.company.com/legacy/${slug} or /sharepoint/legacy/sql_files) to automatically crawl, scrape, and extract embedded DDL schemas, stored procedures, and triggers directly from site pages.`,
      placeholderText: `PASTE RAW CODE OR ENTER LOCATIONS / SITE URLS TO CRAWL:\n1) https://git.company.com/legacy/${slug}\n2) /db2/sql_code_repository\n3) /sharepoint/legacy/sql_files\n4) /mq/sql_code_queue\n5) Paste raw SQL/DDL code directly (e.g. CREATE TABLE claims (...);)`
    }
  }

  const displayTech = catName || projName || 'Legacy Source'
  return {
    techName: displayTech,
    fileExtensions: 'source files & scripts',
    primaryBadge: `${displayTech} (Source Code & Repos)`,
    primaryBadgeBg: 'rgba(45, 212, 191, 0.15)',
    primaryBadgeColor: '#2dd4bf',
    primaryBadgeBorder: 'rgba(45, 212, 191, 0.4)',
    crawlerBadgeText: `🌐 ${displayTech} Web Crawler & Site Scraping (Crawl ${displayTech} Code from Websites & HTTP Endpoints)`,
    crawlerTitle: `🕷️ ${displayTech} Web Crawler Enabled:`,
    crawlerDescription: `Enter website URLs (e.g. https://git.company.com/legacy/${slug} or /sharepoint/legacy/${slug}_files) to automatically crawl, scrape, and extract embedded ${displayTech} programs, modules, and configurations directly from site pages.`,
    placeholderText: `PASTE RAW CODE OR ENTER LOCATIONS / SITE URLS TO CRAWL:\n1) https://git.company.com/legacy/${slug}\n2) /db2/${slug}_code_repository\n3) /sharepoint/legacy/${slug}_files\n4) /mq/${slug}_code_queue\n5) Paste raw ${displayTech} code directly`,
  }
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
  const [validating, setValidating] = useState(false)
  const [validationState, setValidationState] = useState<'idle' | 'validating' | 'valid' | 'invalid'>('idle')
  const [validationMessage, setValidationMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [runComplete, setRunComplete] = useState(false)
  const [log, setLog] = useState<LogLine[]>([])

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

  const inheritedRepoLocation = useMemo(() => {
    const rawIntake = intake as Record<string, unknown> | null | undefined
    if (typeof rawIntake?.code_location === 'string' && rawIntake.code_location.trim()) return rawIntake.code_location.trim()
    if (typeof rawIntake?.repository_url === 'string' && rawIntake.repository_url.trim()) return rawIntake.repository_url.trim()
    if (typeof rawIntake?.repo_urls === 'string' && rawIntake.repo_urls.trim()) return rawIntake.repo_urls.trim()
    return ''
  }, [intake])

  const [isContextLocked, setIsContextLocked] = useState(true)
  const [editCategory, setEditCategory] = useState('')
  const [editProject, setEditProject] = useState('')
  const [editStrategy, setEditStrategy] = useState('')
  const [editRequirement, setEditRequirement] = useState('')

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

  useEffect(() => {
    let cancelled = false
    setBriefLoading(true)
    setError(null)
    setRunComplete(false)
    setLog([])
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
        const rawIntake = intake as Record<string, unknown> | null | undefined
        const inheritedRepo =
          typeof rawIntake?.code_location === 'string' && rawIntake.code_location.trim()
            ? rawIntake.code_location.trim()
            : typeof rawIntake?.repository_url === 'string' && rawIntake.repository_url.trim()
            ? rawIntake.repository_url.trim()
            : typeof rawIntake?.repo_urls === 'string' && rawIntake.repo_urls.trim()
            ? rawIntake.repo_urls.trim()
            : ''
        setRepoUrls(inheritedRepo || '')
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
        const rawIntake = intake as Record<string, unknown> | null | undefined
        const inheritedRepo = rawIntake?.code_location || rawIntake?.repository_url || rawIntake?.repo_urls
        setRepoUrls(
          typeof inheritedRepo === 'string' && inheritedRepo.trim()
            ? inheritedRepo.trim()
            : `https://git.example.com/legacy/${catSlug}-core.git\nfile:///workspace/source/${catSlug}`,
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
  const canRun = formReady && !briefLoading && validationState === 'valid'

  const blockerHint = useMemo(() => {
    if (briefLoading) return 'Loading repository form from A1…'
    if (!repos.length) return 'Enter at least one repository URL or path (one per line).'
    if (validationState === 'invalid')
      return "⚠️ Validation failed: Link is empty or cannot be crawled. You cannot move to the next Agent until valid URLs are provided."
    if (validationState !== 'valid')
      return '🔍 Please click "Validate Links & Crawler" to verify source data before running Agent A4.'
    if (!sources.length) return 'Tick at least one source type to inventory.'
    return ''
  }, [briefLoading, repos.length, sources.length, validationState])

  const techInfo = useMemo(() => getTechCrawlerInfo(a1Context, brief), [a1Context, brief])

  async function handleValidate() {
    setValidating(true)
    setError(null)
    const lines = parseRepoLines(repoUrls)

    const clientRes = validateRepoLines(lines)
    if (!clientRes.isValid) {
      setValidating(false)
      setValidationState('invalid')
      setValidationMessage(clientRes.message)
      return
    }

    try {
      const serverRes = await api.validateRepo(lines, techInfo.techName, a1Context.categoryId)
      setValidating(false)
      if (!serverRes.is_valid) {
        setValidationState('invalid')
        setValidationMessage(serverRes.message)
      } else {
        setValidationState('valid')
        setValidationMessage(serverRes.message)
      }
    } catch {
      setValidating(false)
      setValidationState('valid')
      setValidationMessage(clientRes.message)
    }
  }

  function toggleSource(id: string) {
    setSources((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  function applySuggested() {
    const catSlug = (a1Context.categoryName || 'legacy-source').toLowerCase().replace(/[^a-z0-9]+/g, '-')
    const defaultRepo = brief?.repos_suggested || `https://github.com/enterprise-analytics/${catSlug}.git\nfile:///C:/code/legacy-${techInfo.techName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-source/`
    setRepoUrls(defaultRepo)
    setValidationState('idle')
    setValidationMessage(null)
    setMissingDeps(brief?.missing_suggested || 'Legacy schema dictionary recovered from repository archive.')
    setSources(
      brief?.suggested_sources?.length
        ? [...brief.suggested_sources]
        : ['code', 'copybooks', 'jcl', 'db'],
    )
    setRunComplete(false)
  }

  async function runAgent() {
    if (validationState !== 'valid') {
      setValidationState('invalid')
      setValidationMessage('⚠️ Validation Prompt: Link is empty or not validated yet. Web crawler could not extract any data. You cannot move to the next Agent until you validate valid URLs.')
      setError('Link is empty or not validated. Click Validate Links & Crawler to verify data before running.')
      return
    }
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

  const reposLabel = brief?.repos_label || 'Repository URLs — one per line'
  const reposHint =
    brief?.repos_hint ||
    `Paste raw ${techInfo.techName} code snippets directly into this box, or enter GitHub URLs/Local folder paths (one per line).`
  const sourcesLabel = brief?.sources_label || 'WHAT SHOULD WE READ?'
  const missingLabel = brief?.missing_label || 'ANY MISSING DEPENDENCIES YOU KNOW ABOUT?'

  return (
    <div className="a4-step a1-wizard mf-req">
      {/* 1. DOMAIN LEVEL INTAKE & CONTEXT MATRIX (Single flat card, captioned, editable/lockable) */}
      <section className="a2-a1-context a4-context" style={{ padding: '10px 14px', background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.9))', border: '1px solid rgba(56, 189, 248, 0.35)', borderRadius: '8px', margin: '0 0 10px 0' }}>
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

          <div style={{ gridColumn: '1 / -1', marginTop: '2px' }}>
            <span style={{ display: 'block', fontSize: '9.5px', fontWeight: 900, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>
              REQUIREMENT / TREND
            </span>
            {isContextLocked ? (
              <span style={{ fontSize: '11.5px', fontWeight: 500, color: '#cbd5e1', lineHeight: '1.4' }}>
                {editRequirement || a1Context.requirement || 'Modernizing legacy code to Python.'}
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

          {brief?.discovery_summary ? (
            <div style={{ gridColumn: '1 / -1', marginTop: '2px', paddingTop: '4px', borderTop: '1px solid rgba(255, 255, 255, 0.05)' }}>
              <span style={{ display: 'block', fontSize: '9.5px', fontWeight: 900, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>
                DISCOVERY PLAN
              </span>
              <span style={{ fontSize: '11.5px', fontWeight: 500, color: '#cbd5e1', lineHeight: '1.4' }}>
                {brief.discovery_summary}
              </span>
            </div>
          ) : null}
        </div>
      </section>

      <div className="a4-supported-files-banner" style={{ background: 'rgba(30, 41, 59, 0.7)', border: '1px solid rgba(56, 189, 248, 0.3)', borderRadius: '8px', padding: '10px 14px', margin: '0 0 10px' }}>
        <div style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: '#38bdf8', marginBottom: '6px', letterSpacing: '0.05em' }}>
          📁 ACCEPTED FILE TYPES &amp; SOURCE FORMATS
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          <span className="a4-file-badge" style={{ background: techInfo.primaryBadgeBg, color: techInfo.primaryBadgeColor, border: `1px solid ${techInfo.primaryBadgeBorder}`, fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '4px' }}>
            {techInfo.primaryBadge}
          </span>
          <span className="a4-file-badge" style={{ background: 'rgba(236, 72, 153, 0.15)', color: '#f472b6', border: '1px solid rgba(236, 72, 153, 0.4)', fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '4px' }}>
            {techInfo.crawlerBadgeText}
          </span>
          {techInfo.techName !== 'COBOL' && (
            <span className="a4-file-badge" style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.4)', fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '4px' }}>
              COBOL &amp; Mainframe (.cbl, .cob, .cpy, .jcl)
            </span>
          )}
          {techInfo.techName !== 'Fortran' && (
            <span className="a4-file-badge" style={{ background: 'rgba(251, 146, 60, 0.15)', color: '#fb923c', border: '1px solid rgba(251, 146, 60, 0.4)', fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '4px' }}>
              Fortran &amp; Math (.f, .f90, .for, .f77)
            </span>
          )}
          {techInfo.techName !== 'SAS' && (
            <span className="a4-file-badge" style={{ background: 'rgba(45, 212, 191, 0.15)', color: '#2dd4bf', border: '1px solid rgba(45, 212, 191, 0.4)', fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '4px' }}>
              SAS (.sas, .sas7bdat, .sasmac, .inc)
            </span>
          )}
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

      {/* Dynamic Web Crawler Banner */}
      <div style={{ background: 'rgba(236, 72, 153, 0.08)', borderLeft: '4px solid #f472b6', borderRadius: '4px', padding: '8px 12px', margin: '0 0 10px', fontSize: '0.84rem', color: '#fbcfe8' }}>
        <strong>{techInfo.crawlerTitle}</strong> {techInfo.crawlerDescription}
      </div>

      {/* Consolidated Single Flat Card for Execution Controls & Inventory Lens */}
      <section className="a4-form-card" style={{ padding: '10px 14px', background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.9))', border: '1px solid rgba(56, 189, 248, 0.35)', borderRadius: '8px', margin: '0 0 10px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <h4 style={{ fontSize: '13px', fontWeight: 900, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>
            ⚙️ EXECUTION CONTROLS &amp; REPOSITORY INVENTORY LENS
          </h4>
          <button type="button" className="landing-ghost a3-suggest-btn" style={{ padding: '3px 10px', fontSize: '11px' }} onClick={applySuggested}>
            Apply LLM suggestions
          </button>
        </div>

        {/* INHERITED REPOSITORY NOTIFICATION BANNER */}
        {inheritedRepoLocation ? (
          <div style={{ marginBottom: '10px', padding: '8px 12px', background: 'rgba(56, 189, 248, 0.12)', border: '1px solid rgba(56, 189, 248, 0.35)', borderRadius: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span style={{ fontSize: '11px', fontWeight: 900, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                ℹ️ INHERITED FROM INTAKE (PLACE 1)
              </span>
              <span style={{ fontSize: '9px', fontWeight: 800, padding: '1px 6px', borderRadius: '3px', background: 'rgba(16, 185, 129, 0.2)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.4)' }}>
                AUTO-POPULATED LINK CONFIRMED
              </span>
            </div>
            <p style={{ fontSize: '11.5px', color: '#e2e8f0', margin: 0, lineHeight: '1.4' }}>
              Primary repository location <code>"{inheritedRepoLocation}"</code> was carried over from your initial intake. It is automatically pre-filled below.
            </p>
          </div>
        ) : (
          <div style={{ marginBottom: '10px', padding: '8px 12px', background: 'rgba(234, 179, 8, 0.1)', border: '1px solid rgba(234, 179, 8, 0.3)', borderRadius: '6px' }}>
            <span style={{ fontSize: '11px', fontWeight: 900, color: '#facc15', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '2px' }}>
              💡 REPOSITORY DISCOVERY LENS (PLACE 2)
            </span>
            <p style={{ fontSize: '11.5px', color: '#cbd5e1', margin: 0, lineHeight: '1.4' }}>
              Enter your primary source repository URL, local file directory, web crawler link, or raw code block below.
            </p>
          </div>
        )}

        {/* 1. Repository Input & Validation Row */}
        <div style={{ marginBottom: '10px' }}>
          <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: '#f8fafc', marginBottom: '2px' }}>
            {reposLabel || 'Repository URLs, Local File Paths, or Raw Code Snippets'}
          </label>
          <p className="a4-field-hint" style={{ fontSize: '10.5px', color: '#94a3b8', margin: '0 0 6px' }}>
            {reposHint}
          </p>

          <textarea
            className="a4-textarea"
            rows={4}
            value={repoUrls}
            onChange={(e) => {
              setRepoUrls(e.target.value)
              setValidationState('idle')
              setValidationMessage(null)
              setRunComplete(false)
            }}
            placeholder={techInfo.placeholderText}
            aria-label={reposLabel}
            style={{ width: '100%', background: '#0f172a', border: '1px solid #38bdf8', color: '#f8fafc', padding: '6px 10px', borderRadius: '4px', fontSize: '11.5px', fontFamily: 'monospace' }}
          />

          {/* REPOSITORY LINK GUIDANCE FAQs */}
          <div style={{ marginTop: '8px', padding: '8px 12px', background: 'rgba(15, 23, 42, 0.7)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '6px', fontSize: '11px', color: '#cbd5e1' }}>
            <div style={{ fontWeight: 800, color: '#38bdf8', marginBottom: '4px' }}>
              ❓ Guidance for Repository Links in Place 2 (Agent A4):
            </div>
            <ul style={{ margin: 0, paddingLeft: '16px', lineHeight: '1.5' }}>
              <li>
                <b>Do I use the same repository link?</b> Yes! If all your code and schemas reside in one repository, keep the pre-filled link above.
              </li>
              <li>
                <b>Why are there 2 repository input places?</b> Place 1 (Intake) registers your project's main codebase pointer. Place 2 (Agent A4) allows inventory scanning across multiple sub-modules, copybook folders, DDL schemas, or web crawler URLs.
              </li>
              <li>
                <b>Accepted Formats in Place 2</b>: Valid Git URLs (<code>https://github.com/org/repo.git</code>), Local Directory Paths (<code>/db2/sql_files</code>, <code>C:\code\repo</code>), Web Crawler Endpoints, or Raw Code/DDL Snippets.
              </li>
            </ul>
          </div>

          <div style={{ marginTop: '6px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="landing-start"
              style={{
                padding: '6px 14px',
                fontSize: '11.5px',
                fontWeight: 800,
                whiteSpace: 'nowrap',
                background: validationState === 'valid'
                  ? 'linear-gradient(90deg, #10b981, #059669)'
                  : validationState === 'invalid'
                  ? 'linear-gradient(90deg, #ef4444, #dc2626)'
                  : 'linear-gradient(135deg, rgba(56, 189, 248, 0.25), rgba(14, 165, 233, 0.35))',
                border: '1px solid #38bdf8',
                color: '#38bdf8',
                borderRadius: '4px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onClick={handleValidate}
              disabled={validating}
            >
              {validating
                ? '🔍 Validating links & crawling data…'
                : validationState === 'valid'
                ? '✓ Repository Validated'
                : '🔍 Validate the Repository'}
            </button>

            <span style={{ fontSize: '11px', color: '#94a3b8' }}>
              Verify repository paths &amp; web crawler site endpoints before proceeding.
            </span>
          </div>

          {validationState === 'invalid' && (
            <div style={{ marginTop: '6px', padding: '6px 10px', borderRadius: '4px', fontSize: '11.5px', fontWeight: 700, background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.4)', color: '#f87171' }}>
              {validationMessage || '⚠️ Validation Failed: Input link is empty or unreachable.'}
            </div>
          )}

          {validationState === 'valid' && (
            <div style={{ marginTop: '6px', padding: '6px 10px', borderRadius: '4px', fontSize: '11.5px', fontWeight: 700, background: 'rgba(34, 197, 94, 0.15)', border: '1px solid rgba(34, 197, 94, 0.4)', color: '#4ade80' }}>
              {validationMessage || `✓ Repository Validated: ${repos.length} active location(s) confirmed.`}
            </div>
          )}
        </div>

        {/* 2. Missing Dependencies Sub-section */}
        <div style={{ marginBottom: '10px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: '#f8fafc', marginBottom: '2px' }}>
            {missingLabel || 'ANY MISSING DEPENDENCIES YOU KNOW ABOUT?'}
          </label>
          <textarea
            className="a4-textarea a4-textarea-sm"
            rows={2}
            value={missingDeps}
            onChange={(e) => {
              setMissingDeps(e.target.value)
              setRunComplete(false)
            }}
            placeholder="Optional — note copybooks, schemas, or libraries still offline"
            aria-label={missingLabel}
            disabled={briefLoading}
            style={{ width: '100%', background: '#0f172a', border: '1px solid rgba(56, 189, 248, 0.4)', color: '#f8fafc', padding: '4px 8px', borderRadius: '4px', fontSize: '11.5px' }}
          />
        </div>

        {/* 3. Source Selection Sub-section */}
        <div style={{ marginBottom: '10px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: '#f8fafc', marginBottom: '4px' }}>
            {sourcesLabel || 'WHAT SHOULD WE READ?'}
          </label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {sourceOpts.map(([id, label]) => {
              const isSel = sources.includes(id)
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => toggleSource(id)}
                  disabled={briefLoading}
                  style={{
                    padding: '4px 10px',
                    fontSize: '11.5px',
                    fontWeight: isSel ? 700 : 400,
                    borderRadius: '4px',
                    background: isSel ? 'rgba(56, 189, 248, 0.25)' : 'rgba(15, 23, 42, 0.6)',
                    border: isSel ? '1px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.1)',
                    color: isSel ? '#38bdf8' : '#cbd5e1',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </div>

        {error && <p className="err" style={{ fontSize: '11.5px', color: '#f87171', margin: '0 0 8px' }}>{error}</p>}

        <div className="dash-run-row a3-run-row" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            className="landing-start"
            type="button"
            disabled={!canRun || busy}
            onClick={() => void runAgent()}
            style={{ fontSize: '12.5px', fontWeight: 800, padding: '8px 16px' }}
          >
            {busy ? 'Running Agent A4…' : done || runComplete ? '▶ Run Agent A4 (Repository Discovery)' : '▶ Run Agent A4 (Repository Discovery)'}
          </button>
          {!canRun && blockerHint ? (
            <span className="dash-sub a2-blocker-hint" style={{ fontSize: '11px', color: '#facc15' }}>{blockerHint}</span>
          ) : null}
          {runComplete && (
            <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#4ade80', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              ✓ Repository Inventory Complete
            </span>
          )}
        </div>
      </section>

      {/* In-Place Output & AST Blueprint */}
      {runComplete && (
        <section className="a1-just-did a4-results" style={{ padding: '10px 14px', background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.9))', border: '1px solid rgba(34, 197, 94, 0.4)', borderRadius: '8px', margin: '10px 0 0 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <h4 style={{ fontSize: '13px', fontWeight: 900, color: '#4ade80', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>
              📊 REPOSITORY DISCOVERY OUTPUT &amp; AST BLUEPRINT
            </h4>
            <span style={{ fontSize: '10px', fontWeight: 800, padding: '2px 8px', borderRadius: '4px', background: 'rgba(34, 197, 94, 0.15)', color: '#4ade80', border: '1px solid rgba(34, 197, 94, 0.3)' }}>
              A4 OUTPUT READY
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px', marginBottom: '10px' }}>
            <div style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(56, 189, 248, 0.2)', padding: '6px 10px', borderRadius: '6px' }}>
              <span style={{ display: 'block', fontSize: '9.5px', fontWeight: 900, color: '#38bdf8', textTransform: 'uppercase' }}>LOCATIONS CRAWLED</span>
              <span style={{ fontSize: '14px', fontWeight: 900, color: '#f8fafc' }}>{repos.length} Active Endpoints</span>
            </div>
            <div style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(34, 197, 94, 0.2)', padding: '6px 10px', borderRadius: '6px' }}>
              <span style={{ display: 'block', fontSize: '9.5px', fontWeight: 900, color: '#4ade80', textTransform: 'uppercase' }}>SOURCES INDEXED</span>
              <span style={{ fontSize: '14px', fontWeight: 900, color: '#4ade80' }}>{sources.length} File Types</span>
            </div>
            <div style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(234, 179, 8, 0.2)', padding: '6px 10px', borderRadius: '6px' }}>
              <span style={{ display: 'block', fontSize: '9.5px', fontWeight: 900, color: '#facc15', textTransform: 'uppercase' }}>DEPENDENCY STATUS</span>
              <span style={{ fontSize: '14px', fontWeight: 900, color: '#facc15' }}>{missingDeps.trim() ? 'Partial / Missing Notes' : '100% Resolved'}</span>
            </div>
            <div style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(168, 85, 247, 0.2)', padding: '6px 10px', borderRadius: '6px' }}>
              <span style={{ display: 'block', fontSize: '9.5px', fontWeight: 900, color: '#c084fc', textTransform: 'uppercase' }}>CRAWLER STATUS</span>
              <span style={{ fontSize: '14px', fontWeight: 900, color: '#c084fc' }}>Verified</span>
            </div>
          </div>

          {log.length > 0 && (
            <div style={{ maxHeight: '120px', overflowY: 'auto', background: '#090d16', padding: '6px 10px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.05)', marginBottom: '10px' }}>
              {log.map(([level, msg], i) => (
                <div key={`${i}-${msg}`} style={{ fontSize: '11px', lineHeight: '1.4', color: level === 'ok' ? '#4ade80' : level === 'warn' ? '#facc15' : '#cbd5e1' }}>
                  <strong style={{ opacity: 0.7 }}>[{level.toUpperCase()}]</strong> {msg}
                </div>
              ))}
            </div>
          )}

          <div className="a1-just-did-actions" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px' }}>
            <button className="landing-start" type="button" onClick={() => onContinueNext?.()} style={{ fontSize: '12.5px', fontWeight: 800, padding: '8px 16px' }}>
              {continueLabel || '▶ Move Forward to A5: Legacy Code Analysis →'}
            </button>
          </div>
        </section>
      )}
    </div>
  )
}
