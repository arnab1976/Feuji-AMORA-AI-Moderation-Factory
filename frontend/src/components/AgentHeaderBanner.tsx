import { useMemo } from 'react'

export interface AgentMetaData {
  id: string
  name: string
  role: string
  definition: string
  domain: string
}

export const AGENT_REGISTRY: Record<string, AgentMetaData> = {
  A1: {
    id: 'A1',
    name: 'Factory Admin Agent',
    role: 'Enterprise Strategy Director & Governance Lead',
    definition: 'Synthesizes intake workload requirements, configures optimized category weightage formulas, and establishes strategic modernization goals.',
    domain: 'Domain A · Strategy & Scope',
  },
  A2: {
    id: 'A2',
    name: 'Estate Discovery Agent',
    role: 'Legacy Estate Assessor & Discovery Specialist',
    definition: 'Analyzes legacy codebase structure, scans file types, and maps source code components into the modernization factory inventory.',
    domain: 'Domain B · Understand Old Code',
  },
  A3: {
    id: 'A3',
    name: 'Governance & Compliance Agent',
    role: 'Enterprise Risk & Compliance Officer',
    definition: 'Audits data classification, security policies, compliance boundaries, and risk constraints prior to code transformation.',
    domain: 'Domain B · Understand Old Code',
  },
  A4: {
    id: 'A4',
    name: 'Repository Discovery Agent',
    role: 'Source Code & Dependency Architect',
    definition: 'Scans Git repositories, mainframe libraries, copybooks, and batch job schedulers to index dependencies and dead code.',
    domain: 'Domain B · Understand Old Code',
  },
  A5: {
    id: 'A5',
    name: 'Legacy Deep Analysis Agent',
    role: 'Static Analysis & AST Parsing Specialist',
    definition: 'Performs AST parsing, control-flow extraction, and complexity scoring across legacy SAS, Fortran, and COBOL modules — uncovering structural complexities to guide Python modernization.',
    domain: 'Domain B · Understand Old Code',
  },
  A6: {
    id: 'A6',
    name: 'Business Rules Discovery Agent',
    role: 'Domain Knowledge Engineer',
    definition: 'Reads legacy source code (SAS DATA steps, PROC SQL, COBOL copybooks, Fortran subroutines) and extracts structured business logic, calculation formulas, and validation heuristics — focusing on business intent over syntax.',
    domain: 'Domain C · Extract Business Rules',
  },
  A7: {
    id: 'A7',
    name: 'Documentation Generator Agent',
    role: 'Technical Documentation Lead',
    definition: 'Synthesizes comprehensive Business Requirement Documents (BRD), technical specifications, and architecture manuals from legacy code.',
    domain: 'Domain C · Extract Business Rules',
  },
  A8: {
    id: 'A8',
    name: 'Target Architecture Agent',
    role: 'Cloud Solutions & Systems Architect',
    definition: 'Designs target microservices, containerization blueprints, cloud infrastructure, and modern API contracts.',
    domain: 'Domain D · Design Target Code',
  },
  A9: {
    id: 'A9',
    name: 'Domain Decomposition Agent',
    role: 'Microservice Domain Architect',
    definition: 'Applies Domain-Driven Design (DDD) to decompose monolithic legacy estates into decoupled domain microservices — proposing service boundaries from measured dependencies.',
    domain: 'Domain D · Design Target Code',
  },
  A10: {
    id: 'A10',
    name: 'Target Architecture Agent',
    role: 'Cloud Solutions & Systems Architect',
    definition: 'Designs target microservices, containerization blueprints, cloud infrastructure, modern API contracts, and database schema mappings.',
    domain: 'Domain D · Design Target Code',
  },
  A11: {
    id: 'A11',
    name: 'Data Modernization Agent',
    role: 'Database & Data Modernization Architect',
    definition: 'Modernizes legacy database schemas, stored procedures, data pipelines, and cutover strategies (dual-write, CDC, event streaming) preserving 100% data fidelity.',
    domain: 'Domain E · Transform & Build',
  },
  A12: {
    id: 'A12',
    name: 'Code Generation Agent',
    role: 'Code Generation & Service Transpiler Specialist',
    definition: 'Generates new target microservices from approved architecture blueprints and extracted business rules with 100% logic fidelity.',
    domain: 'Domain E · Transform & Build',
  },
  A13: {
    id: 'A13',
    name: 'Test Generation Agent',
    role: 'QA Automation Engineer',
    definition: 'Generates automated pytest unit test suites, regression cases, and integration mocks for the modernized target code.',
    domain: 'Domain E · Transform & Build',
  },
  A14: {
    id: 'A14',
    name: 'Test Generation Agent',
    role: 'Automated Test & Quality Assurance Specialist',
    definition: 'Generates pytest unit test suites, regression test cases, and integration mocks for modernized target microservices.',
    domain: 'Domain E · Transform & Build',
  },
  A15: {
    id: 'A15',
    name: 'Failure Triage Agent',
    role: 'Observability & Root Cause Analysis Lead',
    definition: 'Analyzes test execution failures, regression logs, stack traces, and observability signals to categorize root causes with 100% diagnostic accuracy.',
    domain: 'Domain E · Test & Prove It Works',
  },
  A16: {
    id: 'A16',
    name: 'Self-Healing Agent',
    role: 'Autonomous Remediation & Repair Specialist',
    definition: 'Applies bounded code fixes from automated triage diagnoses and escalates to human engineers when attempt thresholds are reached.',
    domain: 'Domain E · Transform & Build',
  },
  A17: {
    id: 'A17',
    name: 'Equivalence Testing Agent',
    role: 'Verification & Validation Specialist',
    definition: 'Replays production data workloads side-by-side to verify 100.0% mathematical equivalence between old and new code.',
    domain: 'Domain F · Verify & Package',
  },
  A18: {
    id: 'A18',
    name: 'Security & Compliance Agent',
    role: 'Security & Release Engineering Specialist',
    definition: 'Runs vulnerability scans, OWASP Top 10 compliance audits, and drives gradual traffic handover with automatic rollback triggers.',
    domain: 'Domain F · Verify & Package',
  },
  G0: {
    id: 'G0',
    name: 'Gate G0 · Intake & Strategy Approval',
    role: 'Executive Steering Committee & Governance Gatekeeper',
    definition: 'Human governance checkpoint confirming intake requirements, strategic modernization goals, and portfolio scope before estate discovery.',
    domain: 'Domain A · Strategy & Scope',
  },
  G1: {
    id: 'G1',
    name: 'Gate G1 · Estate Discovery Approval',
    role: 'Enterprise Architecture Review Board',
    definition: 'Human governance checkpoint validating legacy estate inventory, code classification, and risk boundaries before deep static analysis.',
    domain: 'Domain B · Understand Old Code',
  },
  G2: {
    id: 'G2',
    name: 'Gate G2 · Business Rules & BRD Sign-Off',
    role: 'Business Domain Owner & Systems Analyst',
    definition: 'Human governance checkpoint reviewing extracted business heuristics, calculation formulas, and BRD specs before target design.',
    domain: 'Domain C · Extract Business Rules',
  },
  G3: {
    id: 'G3',
    name: 'Gate G3 · Code Quality Sign-Off',
    role: 'Engineering Lead & Quality Gatekeeper',
    definition: 'Human governance checkpoint approving generated code, unit test coverage, and service implementation before refactoring and integration.',
    domain: 'Domain E · Transform & Build',
  },
  G4: {
    id: 'G4',
    name: 'Gate G4 · Automated Test Approval Gate',
    role: 'QA Lead & Test Governance Specialist',
    definition: 'Evaluates generated test suites, rule coverage metrics, edge case assertions, and test rigor prior to side-by-side equivalence testing.',
    domain: 'Domain E · Transform & Build',
  },
  G5: {
    id: 'G5',
    name: 'Gate G5 · Equivalence & Parity Verification Gate',
    role: 'QA Director & Business Audit Lead',
    definition: 'Human governance checkpoint validating 100.0% mathematical equivalence match on production data workloads prior to security auditing.',
    domain: 'Domain F · Verify & Package',
  },
  G6: {
    id: 'G6',
    name: 'Gate G6 · Security & Compliance Audit Gate',
    role: 'Chief Information Security Officer (CISO)',
    definition: 'Human governance checkpoint reviewing vulnerability scans, OWASP Top 10 compliance, and license audits before staging.',
    domain: 'Domain F · Verify & Package',
  },
  G7: {
    id: 'G7',
    name: 'Gate G7 · Equivalence & Parity Verification',
    role: 'QA Director & Business Audit Lead',
    definition: 'Human governance checkpoint validating 100.0% mathematical equivalence match on historical production data workloads.',
    domain: 'Domain F · Verify & Package',
  },
  G8: {
    id: 'G8',
    name: 'Gate G8 · Final Switch-Off & Cutover',
    role: 'Chief Technology Officer (CTO)',
    definition: 'Final executive authorization gate approving production traffic cutover, legacy system decommission, and client showcase release.',
    domain: 'Domain F · Verify & Package',
  },
}

interface AgentHeaderProps {
  agentId: string
  customTitle?: string
  contextTag?: string
}

export function AgentHeaderBanner({ agentId, customTitle, contextTag }: AgentHeaderProps) {
  const meta = useMemo(() => {
    return AGGREGATE_META(agentId) || {
      id: agentId || 'A1',
      name: customTitle || 'Modernization Agent',
      role: 'Enterprise Strategy & Engineering Specialist',
      definition: 'Executes modernization factory tasks with full semantic alignment to locked intake goals.',
      domain: 'Modernization Pipeline',
    }
  }, [agentId, customTitle])

  const isGate = (agentId || '').toUpperCase().startsWith('G')

  return (
    <div
      className="agent-header-banner"
      style={{
        background: isGate
          ? 'linear-gradient(135deg, rgba(26, 20, 10, 0.95), rgba(40, 30, 15, 0.9))'
          : 'linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.9))',
        border: isGate
          ? '1px solid rgba(245, 158, 11, 0.45)'
          : '1px solid rgba(56, 189, 248, 0.35)',
        borderRadius: '6px',
        padding: '6px 12px',
        marginBottom: '6px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px', flexWrap: 'wrap', gap: '6px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span
            style={{
              background: 'linear-gradient(90deg, #2dd4bf, #0284c7)',
              color: '#0f172a',
              fontSize: '10px',
              fontWeight: 900,
              padding: '1px 6px',
              borderRadius: '4px',
              letterSpacing: '0.05em',
            }}
          >
            {meta.id}
          </span>
          <span style={{ fontSize: '10.5px', color: '#94a3b8', fontWeight: 700 }}>{meta.domain}</span>
        </div>

        {contextTag && (
          <span
            style={{
              background: 'rgba(56, 189, 248, 0.15)',
              color: '#38bdf8',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              fontSize: '9.5px',
              fontWeight: 800,
              padding: '1px 6px',
              borderRadius: '10px',
            }}
          >
            {contextTag}
          </span>
        )}
      </div>

      <h2 style={{ fontSize: '13.5px', fontWeight: 900, color: isGate ? '#fbbf24' : '#f8fafc', margin: '0 0 2px', letterSpacing: '-0.01em' }}>
        {isGate ? `🛡️ ${meta.name}` : `🤖 ${meta.name}`}
      </h2>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
        <div style={{ flex: '1 1 240px', background: isGate ? 'rgba(245, 158, 11, 0.08)' : 'rgba(56, 189, 248, 0.08)', padding: '5px 8px', borderRadius: '5px', border: isGate ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid rgba(56, 189, 248, 0.25)' }}>
          <span style={{ fontSize: '9.5px', color: isGate ? '#fbbf24' : '#38bdf8', textTransform: 'uppercase', fontWeight: 900, letterSpacing: '0.08em' }}>
            {isGate ? '🛡️ HUMAN GATE ROLE & OVERSIGHT' : '🤖 AGENT ROLE & PERSONA'}
          </span>
          <p style={{ fontSize: '11.5px', color: isGate ? '#fef08a' : '#2dd4bf', fontWeight: 700, margin: '2px 0 0' }}>
            {meta.role}
          </p>
        </div>

        <div style={{ flex: '2 1 320px', background: isGate ? 'rgba(245, 158, 11, 0.08)' : 'rgba(56, 189, 248, 0.08)', padding: '5px 8px', borderRadius: '5px', border: isGate ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid rgba(56, 189, 248, 0.25)' }}>
          <span style={{ fontSize: '9.5px', color: isGate ? '#fbbf24' : '#38bdf8', textTransform: 'uppercase', fontWeight: 900, letterSpacing: '0.08em' }}>
            {isGate ? '📋 GATE DEFINITION & GOVERNANCE OBJECTIVE' : '🎯 AGENT DEFINITION & OBJECTIVE'}
          </span>
          <p style={{ fontSize: '11.5px', color: '#cbd5e1', margin: '2px 0 0', lineHeight: '1.35' }}>
            {meta.definition}
          </p>
        </div>
      </div>
    </div>
  )
}

function AGGREGATE_META(id: string): AgentMetaData | undefined {
  const cleanId = id.toUpperCase().trim()
  return AGENT_REGISTRY[cleanId]
}
