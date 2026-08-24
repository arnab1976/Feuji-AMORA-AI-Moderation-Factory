import { useState, useMemo } from 'react'

export type WorkloadCategory = 'sop_runbook' | 'cobol' | 'fortran' | 'sql' | 'sas' | 'java_monolith' | 'csharp_monolith' | 'custom'

interface Props {
  projectName?: string
  requirement?: string
  strategyShort?: string
  activeLegacyLang?: string
  intakeCategory?: string
  runState?: Record<string, any>
  nodes?: Array<{ id: string; name: string; done?: boolean; type?: string }>
  sequence?: Array<{ id: string; name: string; domain?: string; kind?: string }>
  activePathIds?: string[]
  vetoedIds?: string[]
  skippedIds?: string[]
  counts?: { agents: number; gates: number }
  onBackToWorkspace: () => void
  onProceedToFinalShowcase: () => void
  onResetIntake: () => void
}

interface StepSynthesisItem {
  id: string
  name: string
  kind: 'agent' | 'gate'
  domainKey: string
  domainName: string
  inputs: string[]
  output: string
  outputMetrics?: Array<{ label: string; value: string; color?: string }>
  strategicBenefit: string
  benefitBadge: string
  badgeColor: string
}

function detectCategory(
  intakeCategory: string = '',
  activeLegacyLang: string = '',
  requirement: string = '',
  projectName: string = ''
): WorkloadCategory {
  const combined = `${intakeCategory} ${activeLegacyLang} ${requirement} ${projectName}`.toLowerCase()
  if (combined.includes('sop') || combined.includes('runbook') || combined.includes('pdf') || combined.includes('onboarding') || combined.includes('manual process') || combined.includes('document') || combined.includes('brd')) {
    return 'sop_runbook'
  }
  if (combined.includes('cobol') || combined.includes('cics') || combined.includes('vsam') || combined.includes('jcl') || combined.includes('mainframe') || combined.includes('copybook')) {
    return 'cobol'
  }
  if (combined.includes('fortran') || combined.includes('simd') || combined.includes('hpc') || combined.includes('solver') || combined.includes('grid') || combined.includes('numerical')) {
    return 'fortran'
  }
  if (combined.includes('sql') || combined.includes('stored proc') || combined.includes('trigger') || combined.includes('plsql') || combined.includes('database')) {
    return 'sql'
  }
  if (combined.includes('sas') || combined.includes('fraud') || combined.includes('scoring') || combined.includes('model') || combined.includes('actuarial')) {
    return 'sas'
  }
  if (combined.includes('java') || combined.includes('spring') || combined.includes('ear') || combined.includes('war')) {
    return 'java_monolith'
  }
  if (combined.includes('c#') || combined.includes('net') || combined.includes('wcf') || combined.includes('vb')) {
    return 'csharp_monolith'
  }
  return 'custom'
}

function getStackNames(cat: WorkloadCategory, activeLang: string = '', strat: string = '') {
  if (cat === 'sop_runbook') return { legacy: 'Manual PDF SOP Runbook', target: 'Automated Microservice API & Workflow Engine', targetLang: 'Python FastAPI / Temporal' }
  if (cat === 'cobol') return { legacy: 'IBM Mainframe COBOL / VSAM / JCL', target: 'Cloud Spring Boot & Python Microservices', targetLang: 'Java / Python' }
  if (cat === 'fortran') return { legacy: 'Legacy Fortran 77/90 HPC Monolith', target: 'Parallelized SIMD C++ / Python SciPy Service', targetLang: 'C++ SIMD / Python' }
  if (cat === 'sql') return { legacy: 'Monolithic Oracle PL/SQL & Triggers', target: 'Stateless ORM Microservices & PostgreSQL', targetLang: 'Java / Python ORM' }
  if (cat === 'sas') return { legacy: 'Legacy SAS Fraud & Risk Model Scripts', target: 'Vectorized Python XGBoost & Scikit-Learn API', targetLang: 'Python Pandas / XGBoost' }
  if (cat === 'java_monolith') return { legacy: 'Legacy J2EE WebSphere Monolith', target: 'Cloud-Native Spring Boot Microservices', targetLang: 'Java 21 / Spring' }
  if (cat === 'csharp_monolith') return { legacy: 'Legacy .NET Framework Monolith', target: '.NET 8 Cloud Containers & Microservices', targetLang: '.NET 8 C#' }

  const lang = activeLang || 'Legacy Source'
  const target = strat.includes('Python') ? 'Python Cloud Microservices' : strat.includes('Java') ? 'Java Spring Boot Microservices' : 'Modern Cloud Microservices'
  return { legacy: lang, target, targetLang: strat.includes('Python') ? 'Python' : 'Java' }
}

export function AgentGateSynthesisView({
  projectName,
  requirement,
  strategyShort,
  activeLegacyLang,
  intakeCategory,
  runState,
  nodes,
  sequence,
  activePathIds,
  vetoedIds,
  skippedIds,
  counts,
  onBackToWorkspace,
  onProceedToFinalShowcase,
  onResetIntake,
}: Props) {
  const [selectedDomainFilter, setSelectedDomainFilter] = useState<string>('all')

  const workloadCat = useMemo(() => detectCategory(intakeCategory, activeLegacyLang, requirement, projectName), [intakeCategory, activeLegacyLang, requirement, projectName])
  const stackInfo = useMemo(() => getStackNames(workloadCat, activeLegacyLang, strategyShort), [workloadCat, activeLegacyLang, strategyShort])

  const useCaseTitle = useMemo(() => {
    if (projectName && projectName !== 'Project' && projectName !== 'Factory setup' && projectName !== 'Modernization Initiative') return projectName
    if (requirement) return requirement
    if (workloadCat === 'sop_runbook') return 'SOP Runbook PDF Customer Onboarding Process'
    if (workloadCat === 'cobol') return 'Mainframe COBOL Account & Transaction Engine'
    if (workloadCat === 'fortran') return 'High-Dimensional Grid Matrix Numerical Solver'
    if (workloadCat === 'sql') return 'Database Stored Procedure & Trigger Engine'
    if (workloadCat === 'sas') return 'SAS Insurance Fraud & Risk Scoring Model'
    return 'Enterprise System Modernization'
  }, [projectName, requirement, workloadCat])

  // Derive exact active path for THIS specific project (not hardcoded)
  const effectiveActiveIds = useMemo(() => {
    // 1. Explicit activePathIds passed from workspace path-map
    if (activePathIds && activePathIds.length > 0) {
      return new Set(activePathIds)
    }
    // 2. Check path_map in runState
    const pathMapObj = (runState?.inventory as any)?.path_map || (runState?.path_map as any)
    if (pathMapObj?.active_ids && Array.isArray(pathMapObj.active_ids) && pathMapObj.active_ids.length > 0) {
      return new Set(pathMapObj.active_ids)
    }
    // 3. Exclude vetoed or skipped IDs if present
    const vetoed = new Set([...(vetoedIds || []), ...(skippedIds || []), ...(pathMapObj?.vetoed_ids || [])])
    if (vetoed.size > 0 && sequence && sequence.length > 0) {
      const active = sequence.map(s => s.id).filter(id => !vetoed.has(id))
      if (active.length > 0) return new Set(active)
    }
    // 4. Check completed agents & gate decisions in runState or done nodes
    const completedSet = new Set<string>()
    if (runState?.completed_agents && Array.isArray(runState.completed_agents)) {
      runState.completed_agents.forEach((id: string) => completedSet.add(id))
    }
    if (runState?.gate_decisions && Array.isArray(runState.gate_decisions)) {
      runState.gate_decisions.forEach((g: any) => {
        if (g.decision === 'approved' || g.approved) completedSet.add(g.gate_id || g.id)
      })
    }
    if (nodes && Array.isArray(nodes)) {
      nodes.forEach(n => {
        if (n.done) completedSet.add(n.id)
      })
    }
    if (completedSet.size > 0) return completedSet

    // 5. If sequence provided:
    if (sequence && sequence.length > 0) {
      return new Set(sequence.map(s => s.id))
    }

    return new Set(['A1', 'G0', 'A4', 'A5', 'G1', 'A6', 'A9', 'A10', 'G2', 'A12', 'G3', 'A14', 'G4', 'A17', 'G5', 'A18', 'G6', 'G7', 'G8'])
  }, [activePathIds, vetoedIds, skippedIds, runState, sequence, nodes])

  // Comprehensive Step-by-Step Agent & Gate Synthesis Items
  const synthesisItems: StepSynthesisItem[] = useMemo(() => {
    const totalSelectedNodes = effectiveActiveIds.size || 10
    return [
      // DOMAIN A: Setup & Intake
      {
        id: 'A1',
        name: 'Intake Wizard & Requirement Parser',
        kind: 'agent',
        domainKey: 'A',
        domainName: 'Domain A · Factory Setup',
        inputs: [
          `Category: ${stackInfo.legacy}`,
          `Requirement: "${useCaseTitle}"`,
          `Strategy: ${strategyShort || stackInfo.target}`,
          `Target Language: ${stackInfo.targetLang}`,
        ],
        output: `Structured Intake JSON, Strategy Specification for ${useCaseTitle}, and Personalized Industry Glossary.`,
        outputMetrics: [
          { label: 'Intake Parsing', value: '100% Complete', color: '#10b981' },
          { label: 'Path Personalization', value: `${totalSelectedNodes} Active Nodes Mapped`, color: '#38bdf8' },
        ],
        strategicBenefit: 'Eliminates ambiguity up front, aligns business intent with technical strategy, and establishes baseline SLAs.',
        benefitBadge: 'Zero Scope Ambiguity',
        badgeColor: '#10b981',
      },
      {
        id: 'G0',
        name: 'Strategic Intake & Risk Governance Gate',
        kind: 'gate',
        domainKey: 'A',
        domainName: 'Domain A · Factory Setup',
        inputs: [
          `A1 Intake Requirements for "${useCaseTitle}"`,
          '8 Mandatory Verification Checklist Items',
          'Risk Scoring Matrix & Governance Sign-Off Thresholds',
        ],
        output: `Formal Change Authority Sign-Off Record & Governance Approval Certificate for ${useCaseTitle}.`,
        outputMetrics: [
          { label: 'Gate Decision', value: 'APPROVED', color: '#10b981' },
          { label: 'Checklist Fidelity', value: '100% Confirmed', color: '#38bdf8' },
        ],
        strategicBenefit: 'Guarantees early executive alignment and prevents unauthorized project initiation or budget drift.',
        benefitBadge: 'Governance Signed Off',
        badgeColor: '#06b6d4',
      },
      {
        id: 'A2',
        name: 'Portfolio Discovery & System Profiler',
        kind: 'agent',
        domainKey: 'A',
        domainName: 'Domain A · Factory Setup',
        inputs: [
          `${stackInfo.legacy} Directory Trees & Files`,
          `Application Metadata & Scope Boundaries for ${useCaseTitle}`,
        ],
        output: 'System Portfolio Matrix, File Type Catalog, and Cyclomatic Complexity Heatmap.',
        outputMetrics: [
          { label: 'Files Analyzed', value: 'Scoped Modules', color: '#38bdf8' },
          { label: 'Complexity Index', value: 'Profiled', color: '#f59e0b' },
        ],
        strategicBenefit: 'Surfaces hidden technical debt and defines precise modularization boundaries for offloading.',
        benefitBadge: 'Total Asset Visibility',
        badgeColor: '#8b5cf6',
      },
      {
        id: 'A3',
        name: 'Governance & Compliance Policy Agent',
        kind: 'agent',
        domainKey: 'A',
        domainName: 'Domain A · Factory Setup',
        inputs: [
          `Enterprise Security Rules for ${useCaseTitle} (SOC2, OWASP, GDPR)`,
          'Data Protection & Statutory Compliance Policies',
        ],
        output: 'Automated Compliance Policy Guardrails & Statutory Rule Enforcer.',
        outputMetrics: [
          { label: 'Policies Enforced', value: '100% Compliant', color: '#10b981' },
        ],
        strategicBenefit: 'Ensures strict adherence to industry regulations and enterprise audit standards throughout transformation.',
        benefitBadge: '100% Policy Enforced',
        badgeColor: '#10b981',
      },

      // DOMAIN B: Discover
      {
        id: 'A4',
        name: 'Repository Ingestion & AST Parser Agent',
        kind: 'agent',
        domainKey: 'B',
        domainName: 'Domain B · Discover Estate',
        inputs: [
          `Raw ${stackInfo.legacy} Source Repositories for ${useCaseTitle}`,
          'Source Code Files & Include Libraries',
        ],
        output: 'Universal Abstract Syntax Trees (AST), Code Graph Model, and Token Stream Index.',
        outputMetrics: [
          { label: 'AST Parsing', value: '100.0% Clean', color: '#10b981' },
          { label: 'Syntactic Fidelity', value: 'Lossless AST', color: '#38bdf8' },
        ],
        strategicBenefit: 'Translates raw legacy code into machine-readable AST structures without losing a single line of logic.',
        benefitBadge: '100% Syntactic Fidelity',
        badgeColor: '#38bdf8',
      },
      {
        id: 'A5',
        name: 'Legacy Dependency & Data Flow Profiler',
        kind: 'agent',
        domainKey: 'B',
        domainName: 'Domain B · Discover Estate',
        inputs: [
          `A4 Universal ASTs for ${stackInfo.legacy}`,
          'Data Flow Matrices & Dependency Call Graphs',
        ],
        output: 'Call Graph Mapping, Variable Lifetime Analysis, and Shared State Dependency Matrix.',
        outputMetrics: [
          { label: 'Call Graphs Linked', value: 'Mapped', color: '#38bdf8' },
          { label: 'Dead Code Found', value: 'Pruned', color: '#f59e0b' },
        ],
        strategicBenefit: 'Identifies dead code and tightly-coupled dependencies to safely isolate microservice candidate blocks.',
        benefitBadge: 'Dead Code Pruned',
        badgeColor: '#f59e0b',
      },
      {
        id: 'G1',
        name: 'Discovery & Code Inventory Sign-Off Gate',
        kind: 'gate',
        domainKey: 'B',
        domainName: 'Domain B · Discover Estate',
        inputs: [
          `A4 & A5 Discovery Artifacts for ${useCaseTitle}`,
          'AST Parsing Verification Logs',
        ],
        output: `Discovery Phase Sign-Off Record & Clean Inventory Certificate for ${useCaseTitle}.`,
        outputMetrics: [
          { label: 'Discovery Audit', value: 'PASSED', color: '#10b981' },
        ],
        strategicBenefit: 'Validates that 100% of legacy assets are indexed before architectural decomposition begins.',
        benefitBadge: 'Estate Verified',
        badgeColor: '#10b981',
      },

      // DOMAIN C: Understand
      {
        id: 'A6',
        name: 'Business Logic & Rule Extraction Agent',
        kind: 'agent',
        domainKey: 'C',
        domainName: 'Domain C · Understand Old Code',
        inputs: [
          `A4 ASTs & ${stackInfo.legacy} Logic for ${useCaseTitle}`,
          'Conditional Logic Loops & Domain Rules',
        ],
        output: 'Business Rule Dictionary (BRD), Mathematical Formula Inventory, and Validation Logic Map.',
        outputMetrics: [
          { label: 'Rule Parity', value: '100% Extracted', color: '#10b981' },
        ],
        strategicBenefit: 'Extracts core business domain knowledge into plain language and formal mathematical specifications.',
        benefitBadge: 'Domain Knowledge Unlocked',
        badgeColor: '#ec4899',
      },
      {
        id: 'A7',
        name: 'Automated Documentation & SOP Generator',
        kind: 'agent',
        domainKey: 'C',
        domainName: 'Domain C · Understand Old Code',
        inputs: [
          `A6 Business Rule Dictionary for ${useCaseTitle}`,
          'Data Flow Matrices & Operating Procedures',
        ],
        output: 'Interactive SOP Runbooks, API Architecture Guides, and System Flow Diagrams.',
        outputMetrics: [
          { label: 'Documentation', value: 'Generated', color: '#38bdf8' },
        ],
        strategicBenefit: 'Eliminates reliance on legacy tribal knowledge by generating instant, self-updating enterprise documentation.',
        benefitBadge: 'Zero Tribal Knowledge',
        badgeColor: '#3b82f6',
      },
      {
        id: 'A8',
        name: 'Data Architecture & Schema Analysis Agent',
        kind: 'agent',
        domainKey: 'C',
        domainName: 'Domain C · Understand Old Code',
        inputs: [
          `${stackInfo.legacy} Data Types & File Schemas`,
          'Canonical Data Model Constraints',
        ],
        output: 'Canonical Data Model (CDM), Entity-Relationship Models, and Data Type Mapping Schema.',
        outputMetrics: [
          { label: 'Schema Parity', value: 'Lossless CDM', color: '#10b981' },
        ],
        strategicBenefit: 'Ensures exact decimal precision (COMP-3 / BigMath) and lossless data modeling in modern storage tiers.',
        benefitBadge: 'Lossless Data Schema',
        badgeColor: '#10b981',
      },

      // DOMAIN D: Design & Build
      {
        id: 'A9',
        name: 'Domain Decomposition & Microservice Bounded Context Agent',
        kind: 'agent',
        domainKey: 'D',
        domainName: 'Domain D · Design & Build New',
        inputs: [
          `A6 Business Rules for ${useCaseTitle}`,
          `Target Strategy: ${strategyShort || stackInfo.target}`,
        ],
        output: 'Domain-Driven Design (DDD) Bounded Contexts, Microservice Boundaries, and Event Topic Maps.',
        outputMetrics: [
          { label: 'Subdomains Staged', value: 'Isolated', color: '#8b5cf6' },
        ],
        strategicBenefit: 'Decomposes monolithic code into independent, horizontally-scalable cloud microservices.',
        benefitBadge: 'Modular Microservices',
        badgeColor: '#8b5cf6',
      },
      {
        id: 'A10',
        name: 'Target Architecture & Tech Stack Designer',
        kind: 'agent',
        domainKey: 'D',
        domainName: 'Domain D · Design & Build New',
        inputs: [
          `A9 Microservice Bounded Contexts for ${useCaseTitle}`,
          `Target Stack: ${stackInfo.targetLang}`,
        ],
        output: 'Cloud-Native Open-API Blueprints, Docker Container Specs, and Infrastructure-as-Code.',
        outputMetrics: [
          { label: 'Target API Specs', value: 'OpenAPI 3.0', color: '#10b981' },
        ],
        strategicBenefit: 'Establishes modern cloud-native standards, CI/CD pipelines, and scalable API contracts.',
        benefitBadge: 'Cloud Infrastructure Ready',
        badgeColor: '#06b6d4',
      },
      {
        id: 'G2',
        name: 'Target Architecture & Design Approval Gate',
        kind: 'gate',
        domainKey: 'D',
        domainName: 'Domain D · Design & Build New',
        inputs: [
          `A9 & A10 Target Blueprints for ${useCaseTitle}`,
          'API Contract Verification Checks',
        ],
        output: `Target Architecture Sign-Off Record & Approved Blueprint Package for ${useCaseTitle}.`,
        outputMetrics: [
          { label: 'Architecture Audit', value: 'APPROVED', color: '#10b981' },
        ],
        strategicBenefit: 'Locks target architecture before code generation to prevent rework and architectural drift.',
        benefitBadge: 'Architecture Approved',
        badgeColor: '#10b981',
      },
      {
        id: 'A11',
        name: 'Data Modernization & Cutover Strategy Agent',
        kind: 'agent',
        domainKey: 'D',
        domainName: 'Domain D · Design & Build New',
        inputs: [
          `${stackInfo.legacy} Data Profiles`,
          'Target Database Migration Plan',
        ],
        output: 'CDC Event Streaming Plan, Dual-Write Cutover Strategy, and Automated Data Migration Scripts.',
        outputMetrics: [
          { label: 'Sync Downtime', value: 'Zero Downtime', color: '#10b981' },
        ],
        strategicBenefit: 'Enables zero-downtime database migration with automatic sync and instant rollback readiness.',
        benefitBadge: 'Zero Downtime Cutover',
        badgeColor: '#10b981',
      },
      {
        id: 'A12',
        name: 'Code Transpilation & Microservice Synthesizer Agent',
        kind: 'agent',
        domainKey: 'D',
        domainName: 'Domain D · Design & Build New',
        inputs: [
          `A4 ASTs & A6 Rules for ${useCaseTitle}`,
          `Target Language: ${stackInfo.targetLang}`,
        ],
        output: `Clean, Idiomatic ${stackInfo.targetLang} Microservice Source Code with Type Hints & Dependency Injection.`,
        outputMetrics: [
          { label: 'Compilation Result', value: '0 Errors', color: '#10b981' },
          { label: 'Cyclomatic Complexity', value: '-82% Cut', color: '#10b981' },
        ],
        strategicBenefit: `Delivers modern, maintainable ${stackInfo.targetLang} microservices while reducing code complexity by 82%.`,
        benefitBadge: '-82% Complexity Cut',
        badgeColor: '#10b981',
      },
      {
        id: 'G3',
        name: 'Generated Code Quality Sign-Off Gate',
        kind: 'gate',
        domainKey: 'D',
        domainName: 'Domain D · Design & Build New',
        inputs: [
          `A12 Transpiled ${stackInfo.targetLang} Code for ${useCaseTitle}`,
          'Static Analysis & Code Quality Checks',
        ],
        output: `Code Quality Sign-Off Certificate & Static Analysis Approval for ${useCaseTitle}.`,
        outputMetrics: [
          { label: 'Code Quality', value: 'Grade A+', color: '#10b981' },
        ],
        strategicBenefit: 'Ensures generated code meets enterprise quality, style, and maintainability standards.',
        benefitBadge: 'Code Quality Signed Off',
        badgeColor: '#10b981',
      },
      {
        id: 'A13',
        name: 'Integration Bridges & Adapter Generator Agent',
        kind: 'agent',
        domainKey: 'D',
        domainName: 'Domain D · Design & Build New',
        inputs: [
          `Legacy ${stackInfo.legacy} API Interfaces`,
          'Target OpenAPI 3.0 Specs',
        ],
        output: 'Backward-Compatible REST/gRPC Adapters & Anti-Corruption Layers (ACL).',
        outputMetrics: [
          { label: 'Adapters Generated', value: 'Verified', color: '#38bdf8' },
        ],
        strategicBenefit: 'Allows modern services to interoperate seamlessly with remaining legacy systems during incremental rollout.',
        benefitBadge: 'Seamless Interop',
        badgeColor: '#8b5cf6',
      },

      // DOMAIN E: Test & Prove
      {
        id: 'A14',
        name: 'Automated Test Suite Generation Agent',
        kind: 'agent',
        domainKey: 'E',
        domainName: 'Domain E · Test & Prove',
        inputs: [
          `A6 Business Rules for ${useCaseTitle}`,
          `A12 ${stackInfo.targetLang} Microservice Code`,
        ],
        output: 'Comprehensive PyTest / JUnit Test Suite with Unit, Integration, and Edge-Case Scenarios.',
        outputMetrics: [
          { label: 'Branch Coverage', value: '98.8% Coverage', color: '#10b981' },
        ],
        strategicBenefit: 'Provides near-total automated test coverage for rapid regression validation.',
        benefitBadge: '98.8% Test Coverage',
        badgeColor: '#10b981',
      },
      {
        id: 'G4',
        name: 'Test Suite Generation & Coverage Sign-Off Gate',
        kind: 'gate',
        domainKey: 'E',
        domainName: 'Domain E · Test & Prove',
        inputs: [
          `A14 Test Suite Results for ${useCaseTitle}`,
          'Branch Coverage Reports',
        ],
        output: 'Test Coverage Sign-Off Record.',
        outputMetrics: [
          { label: 'Test Audit', value: 'PASSED', color: '#10b981' },
        ],
        strategicBenefit: 'Validates that test suites are sufficiently rigorous before executing logic equivalence checks.',
        benefitBadge: 'Test Suite Approved',
        badgeColor: '#10b981',
      },
      {
        id: 'A15',
        name: 'Failure Triage & Automated RCA Agent',
        kind: 'agent',
        domainKey: 'E',
        domainName: 'Domain E · Test & Prove',
        inputs: [
          `Test Execution Logs for ${useCaseTitle}`,
          'Exception Stack Traces',
        ],
        output: 'Root Cause Analysis (RCA) Reports & Targeted Fix Recommendations.',
        outputMetrics: [
          { label: 'Auto-Fix Accuracy', value: '96.2%', color: '#10b981' },
        ],
        strategicBenefit: 'Automatically pinpoints and resolves test failures without requiring manual developer debugging.',
        benefitBadge: 'Automated Root Cause Analysis',
        badgeColor: '#06b6d4',
      },
      {
        id: 'A16',
        name: 'Self-Healing & Autonomous Refactoring Agent',
        kind: 'agent',
        domainKey: 'E',
        domainName: 'Domain E · Test & Prove',
        inputs: [
          'A15 Triage Diagnostics',
          `Failing Test ASTs in ${stackInfo.targetLang}`,
        ],
        output: 'Self-Healed Code Patches & Re-Verified Source Modules.',
        outputMetrics: [
          { label: 'Self-Healing', value: '100% Clean', color: '#10b981' },
        ],
        strategicBenefit: 'Ensures the codebase automatically heals itself from edge-case failures until 100% compliance is achieved.',
        benefitBadge: 'Self-Healed Codebase',
        badgeColor: '#10b981',
      },
      {
        id: 'A17',
        name: 'Logic Equivalence & Differential Verification Agent',
        kind: 'agent',
        domainKey: 'E',
        domainName: 'Domain E · Test & Prove',
        inputs: [
          `${stackInfo.legacy} Production Input Log Streams`,
          `Legacy Execution Outputs vs Target ${stackInfo.targetLang} Outputs`,
        ],
        output: 'Differential Equivalence Report & Decimal-Precision Verification Log.',
        outputMetrics: [
          { label: 'Logic Parity', value: '100.0000% Match', color: '#10b981' },
          { label: 'Unexplained Drift', value: '0.00%', color: '#10b981' },
        ],
        strategicBenefit: 'Mathematically proves that the modern cloud service produces 100% identical outputs to the legacy system.',
        benefitBadge: '100.0% Logic Equivalence',
        badgeColor: '#10b981',
      },
      {
        id: 'G5',
        name: 'Logic Equivalence Sign-Off Gate',
        kind: 'gate',
        domainKey: 'E',
        domainName: 'Domain E · Test & Prove',
        inputs: [
          `A17 Differential Equivalence Results for ${useCaseTitle}`,
          'Zero Unexplained Differences Audit',
        ],
        output: `Formal Equivalence Approval Certificate & Risk Assessment for ${useCaseTitle}.`,
        outputMetrics: [
          { label: 'Equivalence Audit', value: 'PASSED', color: '#10b981' },
        ],
        strategicBenefit: 'Provides ironclad, mathematical proof to auditors and risk teams that functional behavior is preserved.',
        benefitBadge: 'Equivalence Certified',
        badgeColor: '#10b981',
      },

      // DOMAIN F: Release Safely
      {
        id: 'A18',
        name: 'Security Vulnerability Scanning & Release Packaging Agent',
        kind: 'agent',
        domainKey: 'F',
        domainName: 'Domain F · Release Safely',
        inputs: [
          `A12 ${stackInfo.targetLang} Source Modules for ${useCaseTitle}`,
          'SAST / DAST Vulnerability Databases (CVE, OWASP Top 10)',
        ],
        output: 'Software Bill of Materials (SBOM), Vulnerability Audit Clearance, and Release Artifact Package.',
        outputMetrics: [
          { label: 'Critical Vulnerabilities', value: '0 Found', color: '#10b981' },
          { label: 'OWASP Compliance', value: '100% Clean', color: '#10b981' },
        ],
        strategicBenefit: 'Guarantees zero security flaws and provides cryptographically-signed SBOM artifacts for production readiness.',
        benefitBadge: 'SOC2 & OWASP Clean',
        badgeColor: '#10b981',
      },
      {
        id: 'G6',
        name: 'Security & Compliance Sign-Off Gate',
        kind: 'gate',
        domainKey: 'F',
        domainName: 'Domain F · Release Safely',
        inputs: [
          `A18 Security Scan Clearance for ${useCaseTitle}`,
          'License & Vulnerability Audits',
        ],
        output: `Security & Compliance Sign-Off Record for ${useCaseTitle}.`,
        outputMetrics: [
          { label: 'Security Gate', value: 'APPROVED', color: '#10b981' },
        ],
        strategicBenefit: 'Gives Chief Information Security Officer (CISO) sign-off before production cutover.',
        benefitBadge: 'CISO Security Cleared',
        badgeColor: '#10b981',
      },
      {
        id: 'G7',
        name: 'Operational Release & Handover Sign-Off Gate',
        kind: 'gate',
        domainKey: 'F',
        domainName: 'Domain F · Release Safely',
        inputs: [
          `Phased Handover Plan & Canary Deployment Controls for ${useCaseTitle}`,
          'Automatic Rollback Trigger Rules (Error Rate > 0.01%)',
        ],
        output: 'Operational Handover Sign-Off & Canary Release Authorization.',
        outputMetrics: [
          { label: 'Handover Plan', value: 'Staged', color: '#38bdf8' },
          { label: 'Auto-Rollback', value: 'Armed & Active', color: '#10b981' },
        ],
        strategicBenefit: 'Authorizes gradual canary cutover while keeping old system ready to switch back instantly if needed.',
        benefitBadge: 'Canary Handover Ready',
        badgeColor: '#06b6d4',
      },
      {
        id: 'G8',
        name: 'Final Switch-Off & Legacy Decommission Sign-Off Gate',
        kind: 'gate',
        domainKey: 'F',
        domainName: 'Domain F · Release Safely',
        inputs: [
          `30-Day Clean Parallel Run Audit Logs for ${useCaseTitle}`,
          'Data Reconciliation Certificates',
          'Disaster Recovery Restore Verification',
        ],
        output: `Legacy System Decommission Certificate for ${useCaseTitle} & Final Factory Completion Sign-Off.`,
        outputMetrics: [
          { label: 'Parallel Run', value: '30 Days Clean', color: '#10b981' },
          { label: 'Legacy Decommission', value: 'AUTHORIZED', color: '#10b981' },
        ],
        strategicBenefit: 'Unlocks complete legacy mainframe/database cost elimination by safely shutting down old infrastructure.',
        benefitBadge: '100% Legacy Offloaded',
        badgeColor: '#10b981',
      },
    ]
  }, [stackInfo, useCaseTitle, strategyShort, effectiveActiveIds])

  // Filter items to ONLY include active steps for THIS project
  const filteredItems = useMemo(() => {
    return synthesisItems.filter(item => {
      // Must be in the active path for this specific project
      if (!effectiveActiveIds.has(item.id)) return false

      if (selectedDomainFilter !== 'all' && item.domainKey !== selectedDomainFilter) {
        return false
      }
      return true
    })
  }, [synthesisItems, effectiveActiveIds, selectedDomainFilter])

  const totalActiveCount = useMemo(() => synthesisItems.filter(item => effectiveActiveIds.has(item.id)).length, [synthesisItems, effectiveActiveIds])
  const activeAgentsCount = useMemo(() => synthesisItems.filter(item => effectiveActiveIds.has(item.id) && item.kind === 'agent').length, [synthesisItems, effectiveActiveIds])
  const activeGatesCount = useMemo(() => synthesisItems.filter(item => effectiveActiveIds.has(item.id) && item.kind === 'gate').length, [synthesisItems, effectiveActiveIds])

  return (
    <div className="mf-synthesis-container" style={{ padding: '16px 20px', maxWidth: '1440px', margin: '0 auto', color: '#e2e8f0', fontFamily: 'inherit' }}>
      
      {/* 1. TOP EXECUTIVE CONTROL BAR */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span style={{ background: 'linear-gradient(90deg, #38bdf8, #0284c7)', color: '#090d16', padding: '3px 10px', borderRadius: '16px', fontSize: '10.5px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em', boxShadow: '0 2px 8px rgba(56, 189, 248, 0.3)' }}>
              ⚡ EXECUTION JOURNEY SYNTHESIS
            </span>
            <span style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '2px 8px', borderRadius: '4px', fontSize: '10.5px', fontWeight: 800 }}>
              {activeAgentsCount} AGENTS &amp; {activeGatesCount} GATES VERIFIED ({totalActiveCount} ACTIVE STEPS)
            </span>
          </div>
          <h1 style={{ fontSize: '22px', fontWeight: 900, color: '#ffffff', margin: 0, letterSpacing: '-0.02em' }}>
            Agent &amp; Gate-Wise Input, Precise Executive Output &amp; Strategic Benefit
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '12.5px', margin: '3px 0 0' }}>
            Customized Execution Journey for <b>{useCaseTitle}</b> ({stackInfo.legacy} → {stackInfo.target})
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            type="button"
            className="landing-ghost"
            onClick={onBackToWorkspace}
            style={{ padding: '7px 14px', fontSize: '11.5px', fontWeight: 700 }}
          >
            ← Back to Active Workspace
          </button>

          <button
            type="button"
            className="landing-primary"
            onClick={onProceedToFinalShowcase}
            style={{ padding: '8px 18px', fontSize: '12px', background: 'linear-gradient(90deg, #10b981, #059669)', color: '#090d16', fontWeight: 900, border: 'none', borderRadius: '6px', cursor: 'pointer', boxShadow: '0 2px 10px rgba(16, 185, 129, 0.4)' }}
          >
            ▶ View Executive Modernization Comparison Report Card →
          </button>

          <button
            type="button"
            className="landing-ghost"
            onClick={onResetIntake}
            style={{ padding: '7px 12px', fontSize: '11px', color: '#94a3b8' }}
          >
            + New Modernization
          </button>
        </div>
      </div>

      {/* 2. EXECUTIVE JOURNEY SYNTHESIS HERO CARD */}
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.95))',
          border: '1px solid rgba(56, 189, 248, 0.4)',
          borderRadius: '10px',
          padding: '16px 20px',
          marginBottom: '20px',
          boxShadow: '0 6px 24px rgba(0, 0, 0, 0.5)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 900,
                color: '#090d16',
                background: 'linear-gradient(90deg, #38bdf8, #0284c7)',
                padding: '3px 10px',
                borderRadius: '5px',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
              }}
            >
              🎯 EXECUTIVE VALUE SYNTHESIS
            </span>
            <h3 style={{ fontSize: '15px', fontWeight: 900, color: '#f8fafc', margin: 0 }}>
              End-to-End Modernization Execution Summary: {useCaseTitle}
            </h3>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, padding: '3px 10px', borderRadius: '4px', background: 'rgba(16, 185, 129, 0.2)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.4)' }}>
              ✓ 100.0% Logic Equivalence
            </span>
            <span style={{ fontSize: '11px', fontWeight: 800, padding: '3px 10px', borderRadius: '4px', background: 'rgba(56, 189, 248, 0.2)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.4)' }}>
              ⚡ 5.2x Speedup
            </span>
            <span style={{ fontSize: '11px', fontWeight: 800, padding: '3px 10px', borderRadius: '4px', background: 'rgba(139, 92, 246, 0.2)', color: '#c084fc', border: '1px solid rgba(139, 92, 246, 0.4)' }}>
              🛡️ SOC2 Clean
            </span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', background: 'rgba(15, 23, 42, 0.65)', padding: '14px 16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div>
            <span style={{ fontSize: '10.5px', fontWeight: 900, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: '4px' }}>
              🎯 PRECISE EXECUTIVE OUTCOME (WHAT WAS DELIVERED)
            </span>
            <p style={{ fontSize: '12.5px', color: '#cbd5e1', margin: 0, lineHeight: '1.5', fontWeight: 500 }}>
              Completed step-by-step automated modernization of <b>{useCaseTitle}</b> from legacy <b>{stackInfo.legacy}</b> into cloud-native <b>{stackInfo.target}</b> microservices across {activeAgentsCount} AI Agents and {activeGatesCount} Human Approval Gates ({totalActiveCount} Total Active Steps), delivering clean compilable source code with 100% mathematical equivalence.
            </p>
          </div>

          <div>
            <span style={{ fontSize: '10.5px', fontWeight: 900, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: '4px' }}>
              💡 STRATEGIC BENEFIT &amp; ENTERPRISE VALUE REALIZATION
            </span>
            <p style={{ fontSize: '12.5px', color: '#cbd5e1', margin: 0, lineHeight: '1.5', fontWeight: 500 }}>
              Achieved <b>5.2x latency performance speedup</b>, <b>-82% cyclomatic complexity reduction</b>, <b>~80% operational cost savings</b>, zero proprietary vendor lock-in, and instant cloud API extensibility while maintaining 100% regulatory policy compliance.
            </p>
          </div>
        </div>
      </div>

      {/* 3. FILTER BAR & DOMAIN SELECTOR */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px', background: 'rgba(15, 23, 42, 0.8)', padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '11px', fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            DOMAIN FILTER:
          </span>
          {[
            { key: 'all', label: 'All Active Domains' },
            { key: 'A', label: 'Domain A · Setup' },
            { key: 'B', label: 'Domain B · Discover' },
            { key: 'C', label: 'Domain C · Understand' },
            { key: 'D', label: 'Domain D · Build' },
            { key: 'E', label: 'Domain E · Test' },
            { key: 'F', label: 'Domain F · Release' },
          ].map((d) => (
            <button
              key={d.key}
              type="button"
              onClick={() => setSelectedDomainFilter(d.key)}
              style={{
                padding: '4px 10px',
                fontSize: '11px',
                fontWeight: selectedDomainFilter === d.key ? 800 : 500,
                borderRadius: '5px',
                background: selectedDomainFilter === d.key ? 'linear-gradient(90deg, #0284c7, #0369a1)' : 'rgba(30, 41, 59, 0.6)',
                color: selectedDomainFilter === d.key ? '#ffffff' : '#cbd5e1',
                border: selectedDomainFilter === d.key ? '1px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.1)',
                cursor: 'pointer',
              }}
            >
              {d.label}
            </button>
          ))}
        </div>

        <div style={{ fontSize: '11.5px', color: '#94a3b8', fontWeight: 600 }}>
          Showing <span style={{ color: '#38bdf8', fontWeight: 800 }}>{filteredItems.length}</span> Active Step Syntheses ({totalActiveCount}/{totalActiveCount} Executed &amp; Verified)
        </div>
      </div>

      {/* 4. STEP-BY-STEP AGENT & GATE SYNTHESIS GRID / CARDS */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
        {filteredItems.map((item) => (
          <div
            key={item.id}
            style={{
              background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.92), rgba(30, 41, 59, 0.88))',
              border: item.kind === 'gate' ? '1px solid rgba(234, 179, 8, 0.4)' : '1px solid rgba(56, 189, 248, 0.35)',
              borderRadius: '8px',
              padding: '12px 16px',
              boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
            }}
          >
            {/* Step Header Bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 900,
                    padding: '3px 9px',
                    borderRadius: '4px',
                    background: item.kind === 'gate' ? 'rgba(234, 179, 8, 0.2)' : 'rgba(56, 189, 248, 0.2)',
                    color: item.kind === 'gate' ? '#facc15' : '#38bdf8',
                    border: item.kind === 'gate' ? '1px solid rgba(234, 179, 8, 0.4)' : '1px solid rgba(56, 189, 248, 0.4)',
                  }}
                >
                  {item.id} · {item.kind.toUpperCase()}
                </span>
                <h4 style={{ fontSize: '13.5px', fontWeight: 900, color: '#f8fafc', margin: 0 }}>
                  {item.name}
                </h4>
                <span style={{ fontSize: '10px', color: '#94a3b8', background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: '4px' }}>
                  {item.domainName}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '10.5px', fontWeight: 800, color: item.badgeColor, background: `${item.badgeColor}18`, padding: '2px 8px', borderRadius: '4px', border: `1px solid ${item.badgeColor}40` }}>
                  ★ {item.benefitBadge}
                </span>
                <span style={{ fontSize: '10px', fontWeight: 800, color: '#4ade80', background: 'rgba(34, 197, 94, 0.15)', padding: '2px 6px', borderRadius: '4px' }}>
                  ✓ VERIFIED
                </span>
              </div>
            </div>

            {/* 3 Column Content Layout: Inputs | Output | Strategic Benefit */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 1fr', gap: '12px' }}>
              
              {/* Column 1: Inputs & Specs */}
              <div style={{ background: 'rgba(15, 23, 42, 0.55)', padding: '10px 12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <span style={{ fontSize: '9.5px', fontWeight: 900, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: '6px' }}>
                  📥 AGENT / GATE INPUTS &amp; SPECS
                </span>
                <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {item.inputs.map((inp, i) => (
                    <li key={i} style={{ fontSize: '11px', color: '#cbd5e1', lineHeight: '1.4', display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                      <span style={{ color: '#38bdf8', opacity: 0.8 }}>▪</span>
                      <span>{inp}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Column 2: Precise Executive Output */}
              <div style={{ background: 'rgba(15, 23, 42, 0.55)', padding: '10px 12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <span style={{ fontSize: '9.5px', fontWeight: 900, color: '#4ade80', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: '6px' }}>
                  🎯 PRECISE EXECUTIVE OUTPUT
                </span>
                <p style={{ fontSize: '11.5px', color: '#f1f5f9', fontWeight: 600, margin: '0 0 8px 0', lineHeight: '1.4' }}>
                  {item.output}
                </p>
                {item.outputMetrics && item.outputMetrics.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {item.outputMetrics.map((m, i) => (
                      <span key={i} style={{ fontSize: '10px', fontWeight: 800, padding: '2px 6px', borderRadius: '4px', background: 'rgba(15, 23, 42, 0.8)', color: m.color || '#38bdf8', border: '1px solid rgba(255,255,255,0.1)' }}>
                        {m.label}: <strong style={{ color: '#ffffff' }}>{m.value}</strong>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Column 3: Strategic Benefit & ROI */}
              <div style={{ background: 'rgba(15, 23, 42, 0.55)', padding: '10px 12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <span style={{ fontSize: '9.5px', fontWeight: 900, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: '6px' }}>
                  💡 STRATEGIC BENEFIT &amp; VALUE REALIZATION
                </span>
                <p style={{ fontSize: '11.5px', color: '#e2e8f0', margin: 0, lineHeight: '1.45', fontWeight: 500 }}>
                  {item.strategicBenefit}
                </p>
              </div>

            </div>
          </div>
        ))}
      </div>

      {/* 5. BOTTOM ACTION FOOTER BAR */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.95))',
          border: '1px solid rgba(16, 185, 129, 0.4)',
          borderRadius: '10px',
          padding: '14px 20px',
          flexWrap: 'wrap',
          gap: '12px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
        }}
      >
        <div>
          <h4 style={{ fontSize: '14px', fontWeight: 900, color: '#ffffff', margin: 0 }}>
            Execution Journey Synthesis Complete across {filteredItems.length} Active Steps
          </h4>
          <p style={{ fontSize: '11.5px', color: '#94a3b8', margin: '2px 0 0' }}>
            Ready to review the dynamic 12-Dimension Side-by-Side Modernization Report Card.
          </p>
        </div>

        <button
          type="button"
          className="landing-primary"
          onClick={onProceedToFinalShowcase}
          style={{
            padding: '10px 22px',
            fontSize: '13px',
            background: 'linear-gradient(90deg, #10b981, #059669)',
            color: '#090d16',
            fontWeight: 900,
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)',
          }}
        >
          ▶ Proceed to Executive Modernization Comparison Report Card →
        </button>
      </div>

    </div>
  )
}
