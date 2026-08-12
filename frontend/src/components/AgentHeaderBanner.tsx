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
    definition: 'Performs AST parsing, control-flow extraction, and complexity scoring across legacy SAS, Fortran, and COBOL modules.',
    domain: 'Domain B · Understand Old Code',
  },
  A6: {
    id: 'A6',
    name: 'Business Rules Discovery Agent',
    role: 'Domain Knowledge Engineer',
    definition: 'Extracts implicit business heuristics, calculation formulas, and validation logic from legacy source code into structured rule catalogs.',
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
    definition: 'Applies Domain-Driven Design (DDD) to decompose monolithic legacy estates into decoupled domain microservices.',
    domain: 'Domain D · Design Target Code',
  },
  A10: {
    id: 'A10',
    name: 'Data Lineage & Migration Agent',
    role: 'Enterprise Data Engineer & ETL Specialist',
    definition: 'Maps legacy SAS datasets and DB2 tables to modern PostgreSQL/Snowflake data stores and generates automated ETL pipelines.',
    domain: 'Domain D · Design Target Code',
  },
  A11: {
    id: 'A11',
    name: 'Code Transpilation Agent',
    role: 'Automated Code Conversion Lead',
    definition: 'Transpiles legacy code (SAS/COBOL/Fortran) into modern target languages (Python/Java) preserving 100% logic fidelity.',
    domain: 'Domain E · Transform & Build',
  },
  A12: {
    id: 'A12',
    name: 'Code Refactoring Agent',
    role: 'Software Quality & Clean Code Specialist',
    definition: 'Refactors raw transpiled code into PEP8 modular functions, reducing cyclomatic complexity and improving maintainability.',
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
    name: 'Security & Compliance Agent',
    role: 'Application Security Specialist',
    definition: 'Scans target codebase for OWASP Top 10 vulnerabilities, NIST compliance, license issues, and hardcoded secrets.',
    domain: 'Domain E · Transform & Build',
  },
  A15: {
    id: 'A15',
    name: 'Deployment & Packaging Agent',
    role: 'DevOps & Release Engineer',
    definition: 'Builds Docker containers, Kubernetes manifests, Helm charts, and CI/CD pipelines for cloud deployment.',
    domain: 'Domain E · Transform & Build',
  },
  A16: {
    id: 'A16',
    name: 'Integration & API Agent',
    role: 'Enterprise API Architect',
    definition: 'Connects target microservices to API Gateways, Kafka event buses, and enterprise authentication providers.',
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
    name: 'Final Showcase Agent',
    role: 'Client Deliverable Specialist',
    definition: 'Compiles the executive modernization comparison report card, SOW compliance proof, and final client export pack.',
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
    name: 'Gate G3 · Target Architecture Sign-Off',
    role: 'Chief Cloud Architect & Security Lead',
    definition: 'Human governance checkpoint approving microservice blueprints, database migration models, and API contracts before code generation.',
    domain: 'Domain D · Design Target Code',
  },
  G4: {
    id: 'G4',
    name: 'Gate G4 · Transpiled Code Review',
    role: 'Lead Software Development Engineer',
    definition: 'Human governance checkpoint evaluating automated transpilation output, code modularization, and PEP8 clean code quality.',
    domain: 'Domain E · Transform & Build',
  },
  G5: {
    id: 'G5',
    name: 'Gate G5 · Security & Compliance Audit',
    role: 'Chief Information Security Officer (CISO)',
    definition: 'Human governance checkpoint reviewing vulnerability scans, OWASP Top 10 compliance, and license audits before staging.',
    domain: 'Domain E · Transform & Build',
  },
  G6: {
    id: 'G6',
    name: 'Gate G6 · Deployment & CI/CD Staging',
    role: 'DevOps & Infrastructure Director',
    definition: 'Human governance checkpoint approving Docker images, Kubernetes manifests, and deployment pipeline configuration.',
    domain: 'Domain E · Transform & Build',
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
    return (
      AGGREGATE_META(agentId) || {
        id: agentId,
        name: customTitle || `Agent ${agentId}`,
        role: 'Modernization Specialist',
        definition: 'Executes modernization tasks within the AI Modernization Factory pipeline.',
        domain: 'AI Modernization Pipeline',
      }
    )
  }, [agentId, customTitle])

  return (
    <div
      className="agent-header-banner"
      style={{
        background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.9))',
        border: '1px solid rgba(43, 184, 166, 0.45)',
        borderRadius: '10px',
        padding: '16px 20px',
        marginBottom: '16px',
        boxShadow: '0 4px 18px rgba(0,0,0,0.4)',
      }}
    >
      <div className="mf-category-caption" style={{ color: '#2dd4bf', marginBottom: '8px', borderBottom: '1px solid rgba(43, 184, 166, 0.3)' }}>
        🎯 1. AGENT IDENTITY &amp; EXECUTIVE ROLE
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              background: 'linear-gradient(90deg, #2dd4bf, #0284c7)',
              color: '#0f172a',
              fontSize: '11px',
              fontWeight: 900,
              padding: '2px 8px',
              borderRadius: '4px',
              letterSpacing: '0.05em',
            }}
          >
            {meta.id}
          </span>
          <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700 }}>{meta.domain}</span>
        </div>

        {contextTag && (
          <span
            style={{
              background: 'rgba(56, 189, 248, 0.15)',
              color: '#38bdf8',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              fontSize: '10px',
              fontWeight: 800,
              padding: '2px 8px',
              borderRadius: '12px',
            }}
          >
            {contextTag}
          </span>
        )}
      </div>

      <h2 style={{ fontSize: '18px', fontWeight: 900, color: '#f8fafc', margin: '0 0 4px', letterSpacing: '-0.01em' }}>
        🤖 {meta.name}
      </h2>

      <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', marginTop: '6px' }}>
        <div style={{ flex: '1 1 300px' }}>
          <span style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.05em' }}>
            AGENT ROLE &amp; PERSONA
          </span>
          <p style={{ fontSize: '12px', color: '#2dd4bf', fontWeight: 700, margin: '2px 0 0' }}>
            {meta.role}
          </p>
        </div>

        <div style={{ flex: '2 1 400px' }}>
          <span style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.05em' }}>
            AGENT DEFINITION &amp; OBJECTIVE
          </span>
          <p style={{ fontSize: '12px', color: '#cbd5e1', margin: '2px 0 0', lineHeight: '1.4' }}>
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
