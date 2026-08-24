// Typed API client. One place that knows the wire format.

export type NodeKind = 'agent' | 'gate'

export interface InputField {
  key: string
  type: 'select' | 'text' | 'multi'
  label: string
  category?: string
  hint?: string
  default?: string[] | string
  options?: (string | string[])[]
}

export interface AgentNode {
  kind: 'agent'
  id: string
  domain: string
  name: string
  plain: string
  needs: string
  produces: string
  mcp: string[]
  model_tier: string
  inputs: InputField[]
}

export interface GateNode {
  kind: 'gate'
  id: string
  domain: string
  name: string
  approvers: string
  question: string
  why: string
  after_agent: string
}

export type PipelineNode = AgentNode | GateNode

export interface Domain { key: string; name: string; purpose: string }

export interface McpServer {
  id: string
  name: string
  plain: string
  access: 'read' | 'sandbox' | 'write' | 'approval'
  tools: string[]
  used_by: string[]
}

export interface RunNode {
  kind: NodeKind
  id: string
  name: string
  domain: string
  done: boolean
  unlocked: boolean
}

export interface GateEvidence {
  id: string
  name: string
  approvers: string
  question: string
  why: string
  evidence: { label: string; value: string }[]
  blocker: string | null
  decided: boolean
}

export interface StepBrief {
  run_id: string
  step_id: string
  kind: string
  title: string
  lede: string
  why: string
  approvers: string
  path_status: 'active' | 'eligible' | 'vetoed' | string
  path_status_label: string
  context: {
    category_id: string
    category_name: string
    project_name: string
    requirement: string
    strategy_short: string
    strategies: string[]
    why_modernize: string
    active_ids: string[]
    vetoed_ids: string[]
    eligible_ids: string[]
    next_after_a1: string
  }
  checklist: { id: string; label: string; required?: boolean; source?: string }[]
  needs: string
  produces: string
  note: string
}


export type LogLine = [string, string]

export interface IntakeOption {
  id: string
  label: string
}

export interface IntakeCategory {
  id: string
  name: string
  summary: string
  strategic_importance?: string
  options: IntakeOption[]
}

export interface IntakeSynthesis {
  strategy: string
  strategy_short?: string
  business_reason: string
  enriched_summary: string
  enriched_categories: {
    id: string
    name: string
    selection: string
    enrichment: string
  }[]
  estimated_timeline_weeks?: number
  estimated_cost_factory_k?: number
  estimated_cost_manual_m?: number
  tokens_in: number
  tokens_out: number
  cost_usd: number
  model: string
  project_name?: string
}

export interface IntakeStrategyOption {
  id: string
  label: string
  why: string
}

export interface AgentRunResult {
  result: { agent_id: string; log: LogLine[]; artifacts: string[]; cost_usd: number }
  state: Record<string, unknown>
  cost_usd: number
}

export interface A2Brief {
  run_id: string
  title: string
  lede: string
  form_heading: string
  context_line: string
  checklist_heading?: string
  checklist_note?: string
  checklist?: { id: string; label: string; required?: boolean; source?: string }[]
  category_id?: string
  primary_label?: string
  primary_placeholder?: string
  primary_hint?: string
  suggested_repo: string
  criticality_label?: string
  criticality_options?: [string, string][]
  suggested_criticality: string
  constraints_label?: string
  constraints_options?: [string, string][]
  suggested_regulations: string[]
  regulation_options?: [string, string][]
  evidence_hints: string[]
  activity_status: string
  glossary: { term: string; def: string }[]
  model: string
  warning?: string
  tokens_in?: number
  tokens_out?: number
  cost_usd?: number
}

export interface A3Brief {
  run_id: string
  title: string
  lede: string
  form_heading: string
  context_line: string
  category_id?: string
  category_name?: string
  project_name?: string
  requirement?: string
  strategies?: string[]
  strategy_short?: string
  why_modernize?: string
  a2_criticality?: string
  a2_regulations?: string[]
  a2_code_location?: string
  path_active_ids?: string[]
  prior_agent_id?: string
  prior_agent_name?: string
  prior_line?: string
  sensitive_label?: string
  sensitive_hint?: string
  sensitive_options?: [string, string][]
  suggested_sensitive?: string[]
  models_label?: string
  model_options?: [string, string][]
  suggested_model?: string
  gates_label?: string
  gate_options?: [string, string][]
  suggested_gates?: string
  risk_summary?: string
  evidence_hints: string[]
  activity_status: string
  glossary: { term: string; def: string }[]
  model: string
  warning?: string
  tokens_in?: number
  tokens_out?: number
  cost_usd?: number
}

export interface A4Brief {
  run_id: string
  title: string
  lede: string
  form_heading: string
  context_line: string
  category_id?: string
  repos_label?: string
  repos_hint?: string
  repos_suggested?: string
  missing_label?: string
  missing_hint?: string
  missing_suggested?: string
  sources_label?: string
  sources_hint?: string
  source_options?: [string, string][]
  suggested_sources?: string[]
  discovery_summary?: string
  evidence_hints: string[]
  activity_status: string
  glossary: { term: string; def: string }[]
  model: string
  warning?: string
  tokens_in?: number
  tokens_out?: number
  cost_usd?: number
}

export interface A5Brief {
  run_id: string
  title: string
  lede: string
  form_heading: string
  context_line: string
  prior_line?: string
  category_id?: string
  prior_agent_id?: string
  prior_agent_name?: string
  path_active_ids?: string[]
  depth_label?: string
  depth_hint?: string
  depth_options?: [string, string][]
  suggested_depth?: string
  focus_label?: string
  focus_hint?: string
  focus_options?: [string, string][]
  suggested_focus?: string[]
  analysis_summary?: string
  result_headline?: string
  result_body?: string
  discovery_repos?: string[]
  discovery_sources?: string[]
  evidence_hints: string[]
  activity_status: string
  glossary: { term: string; def: string }[]
  model: string
  warning?: string
  tokens_in?: number
  tokens_out?: number
  cost_usd?: number
}

export interface A6Brief {
  run_id: string
  title: string
  lede: string
  form_heading: string
  domain_kicker?: string
  context_line: string
  prior_line?: string
  category_id?: string
  prior_agent_id?: string
  prior_agent_name?: string
  path_active_ids?: string[]
  confidence_label?: string
  confidence_hint?: string
  confidence_options?: [string, string][]
  suggested_confidence?: string
  scope_label?: string
  scope_hint?: string
  scope_options?: [string, string][]
  suggested_scope?: string[]
  citation_label?: string
  citation_options?: [string, string][]
  require_citation?: boolean
  suggested_citation?: string[]
  extraction_summary?: string
  result_headline?: string
  result_body?: string
  sample_heading?: string
  sample_rules?: {
    rule_id: string
    title: string
    statement: string
    confidence: number
    path?: string
    start?: number | null
    end?: number | null
  }[]
  total_rules?: number
  review_count?: number
  review_headline?: string
  review_body?: string
  evidence_hints: string[]
  activity_status: string
  glossary: { term: string; def: string }[]
  model: string
  warning?: string
  tokens_in?: number
  tokens_out?: number
  cost_usd?: number
}

export interface A7Brief {
  run_id: string
  title: string
  lede: string
  form_heading: string
  domain_kicker?: string
  context_line: string
  prior_line?: string
  category_id?: string
  prior_agent_id?: string
  prior_agent_name?: string
  path_active_ids?: string[]
  artifacts_label?: string
  artifacts_hint?: string
  artifacts_options?: [string, string][]
  suggested_artifacts?: string[]
  publish_label?: string
  publish_options?: [string, string][]
  suggested_publish?: string
  depth_label?: string
  depth_options?: [string, string][]
  suggested_depth?: string
  doc_plan?: string
  result_headline?: string
  result_body?: string
  documents?: { id: string; label: string; value: number; unit: string }[]
  knowledge_graph?: {
    nodes: number
    relationships: number
    rules_linked: number
    rules_total: number
    modules_linked: number
    modules_total: number
    conflicts: number
  }
  evidence_hints: string[]
  activity_status: string
  glossary: { term: string; def: string }[]
  model: string
  warning?: string
  tokens_in?: number
  tokens_out?: number
  cost_usd?: number
}

export interface A10Brief {
  run_id: string
  title: string
  lede: string
  form_heading: string
  domain_kicker?: string
  context_line: string
  prior_line?: string
  category_id?: string
  prior_agent_id?: string
  prior_agent_name?: string
  path_active_ids?: string[]
  service_names?: string[]
  shape?: string
  build_first?: string
  comms_label?: string
  comms_hint?: string
  comms_options?: [string, string][]
  suggested_comms?: string
  depth_label?: string
  depth_options?: [string, string][]
  suggested_depth?: string
  architecture_plan?: string
  result_headline?: string
  result_body?: string
  previous_architecture?: {
    headline?: string
    body?: string
    design_traits?: { label: string; value: string }[]
    estate_metrics?: { id: string; label: string; value: number; unit: string }[]
  }
  design_choices?: { label: string; value: string }[]
  contracts_generated?: { id: string; label: string; value: number; unit: string }[]
  comparison_deltas?: { aspect: string; from: string; to: string; change?: string }[]
  evidence_hints: string[]
  activity_status: string
  glossary: { term: string; def: string }[]
  model: string
  warning?: string
  tokens_in?: number
  tokens_out?: number
  cost_usd?: number
}

export interface A9Brief {
  run_id: string
  title: string
  lede: string
  form_heading: string
  domain_kicker?: string
  context_line: string
  prior_line?: string
  category_id?: string
  prior_agent_id?: string
  prior_agent_name?: string
  path_active_ids?: string[]
  g1_approved?: boolean
  approved_rule_count?: number
  programs?: number
  source_language?: string
  target_stack_hint?: string
  shape_label?: string
  shape_hint?: string
  shape_options?: [string, string][]
  suggested_shape?: string
  order_label?: string
  order_hint?: string
  order_options?: [string, string][]
  suggested_order?: string
  build_first_label?: string
  decomposition_plan?: string
  checklist_heading?: string
  checklist_note?: string
  checklist?: { id: string; label: string; required?: boolean }[]
  result_headline?: string
  result_body?: string
  proposed_contexts?: {
    name: string
    description: string
    replaces?: string[]
    cohesion?: number
    coupling?: number
  }[]
  metrics?: { id: string; label: string; value: number; unit: string }[]
  evidence_hints: string[]
  activity_status: string
  glossary: { term: string; def: string }[]
  model: string
  warning?: string
  tokens_in?: number
  tokens_out?: number
  cost_usd?: number
}

export interface A12Brief {
  run_id: string
  title: string
  lede: string
  form_heading: string
  domain_kicker?: string
  context_line: string
  prior_line?: string
  category_id?: string
  prior_agent_id?: string
  prior_agent_name?: string
  path_active_ids?: string[]
  service_names?: string[]
  g2_approved?: boolean
  approved_rule_count?: number
  legacy_language?: string
  target_stack_hint?: string
  design_choices_summary?: { label: string; value: string }[]
  stack_label?: string
  stack_hint?: string
  stack_options?: [string, string][]
  suggested_stack?: string
  extras_label?: string
  extras_hint?: string
  extras_options?: [string, string, string?][]
  suggested_extras?: string[]
  generation_plan?: string
  checklist_heading?: string
  checklist_note?: string
  checklist?: { id: string; label: string; required?: boolean }[]
  result_headline?: string
  result_body?: string
  generated_metrics?: { id: string; label: string; value: number; unit: string }[]
  sample_services?: { name: string; stack: string; methods: number; traces_to: string }[]
  sample_artefacts?: { id: string; label: string; path: string }[]
  evidence_hints: string[]
  activity_status: string
  glossary: { term: string; def: string }[]
  model: string
  warning?: string
  tokens_in?: number
  tokens_out?: number
  cost_usd?: number
}

export interface A13Brief {
  run_id: string
  title: string
  lede: string
  cards?: {
    from_a1: string
    strategy: string
    project: string
    map_status: string
  }
  checklist?: { id: string; label: string; required?: boolean }[]
  suggested_bridges?: string[]
  result_headline?: string
  result_body?: string
  glossary?: { term: string; def: string }[]
  model?: string
  warning?: string
  tokens_in?: number
  tokens_out?: number
  cost_usd?: number
}

export interface A14Brief {
  run_id: string
  title: string
  lede: string
  cards?: {
    from_a1: string
    strategy: string
    project: string
    map_status: string
  }
  what_to_test?: { id: string; label: string; detail: string; source?: string }[]
  what_to_test_heading?: string
  what_to_test_intro?: string
  checklist_heading?: string
  checklist_note?: string
  checklist?: { id: string; label: string; required?: boolean }[]
  suggested_kinds?: string[]
  kinds_options?: (string | string[])[]
  form_heading?: string
  kinds_label?: string
  result_headline?: string
  result_body?: string
  path_status_label?: string
  movement_path?: string
  glossary?: { term: string; def: string }[]
  approved_rule_count?: number
  journeys?: number
  g3_approved?: boolean
  model?: string
  warning?: string
  tokens_in?: number
  tokens_out?: number
  cost_usd?: number
}

export interface A16Brief {
  run_id: string
  title: string
  lede: string
  cards?: {
    from_a1: string
    strategy: string
    project: string
    map_status: string
  }
  checklist?: { id: string; label: string; required?: boolean }[]
  healing_cases?: {
    id: string
    failure_class: string
    title: string
    target: string
    symptom: string
    proposed_fix: string
    safety_status: string
    can_auto_heal?: boolean
  }[]
  failure_breakdown?: Record<string, number>
  suggested_max_attempts?: string
  result_headline?: string
  result_body?: string
  glossary?: { term: string; def: string }[]
  movement_path?: string
  model?: string
  warning?: string
  tokens_in?: number
  tokens_out?: number
  cost_usd?: number
}

export interface G4Brief {
  run_id: string
  title: string
  lede: string
  approvers?: string
  why?: string
  cards?: {
    from_a1: string
    strategy: string
    requirement: string
    map_status: string
  }
  test_metrics?: { label: string; value: string; detail?: string }[]
  checklist_heading?: string
  checklist_note?: string
  checklist?: { id: string; label: string; required?: boolean }[]
  glossary?: { term: string; def: string }[]
  warning?: string
  movement_path?: string
}

export interface G5Brief {
  run_id: string
  title: string
  lede: string
  approvers?: string
  why?: string
  cards?: {
    from_a1: string
    strategy: string
    requirement: string
    map_status: string
  }
  equivalence_metrics?: { label: string; value: string; detail?: string }[]
  checklist?: { id: string; label: string; required?: boolean }[]
  glossary?: { term: string; def: string }[]
  warning?: string
  movement_path?: string
}

export interface G6Brief {
  run_id: string
  title: string
  lede: string
  approvers?: string
  why?: string
  cards?: {
    from_a1: string
    strategy: string
    requirement: string
    map_status: string
  }
  security_metrics?: { label: string; value: string; detail?: string }[]
  checklist?: { id: string; label: string; required?: boolean }[]
  glossary?: { term: string; def: string }[]
  warning?: string
  movement_path?: string
}

export interface G7Brief {
  run_id: string
  title: string
  lede: string
  approvers?: string
  why?: string
  cards?: {
    from_a1: string
    strategy: string
    requirement: string
    map_status: string
  }
  release_metrics?: { label: string; value: string; detail?: string }[]
  checklist?: { id: string; label: string; required?: boolean }[]
  glossary?: { term: string; def: string }[]
  warning?: string
  movement_path?: string
}

export interface G8Brief {
  run_id: string
  title: string
  lede: string
  approvers?: string
  why?: string
  cards?: {
    from_a1: string
    strategy: string
    requirement: string
    map_status: string
  }
  switchoff_metrics?: { label: string; value: string; detail?: string }[]
  checklist?: { id: string; label: string; required?: boolean }[]
  glossary?: { term: string; def: string }[]
  warning?: string
  movement_path?: string
}




export interface A17Brief {
  run_id: string
  title: string
  lede: string
  cards?: {
    from_a1: string
    strategy: string
    project: string
    map_status: string
  }
  checklist?: { id: string; label: string; required?: boolean }[]
  suggested_volume?: string
  result_headline?: string
  result_body?: string
  glossary?: { term: string; def: string }[]
  warning?: string
  movement_path?: string
}

export interface A18Brief {
  run_id: string
  title: string
  lede: string
  cards?: {
    from_a1: string
    strategy: string
    project: string
    map_status: string
  }
  checklist?: { id: string; label: string; required?: boolean }[]
  suggested_plan?: string
  result_headline?: string
  result_body?: string
  glossary?: { term: string; def: string }[]
  warning?: string
  movement_path?: string
}

export interface A12SourceFile {
  id: string
  path: string
  label: string
  filename: string
  language: string
  media_type: string
  content: string
  bytes?: number
}

export interface A12GitHubPublish {
  run_id?: string
  published: boolean
  created_repo?: boolean
  owner?: string
  repo?: string
  full_name?: string
  branch?: string
  html_url?: string
  tree_url?: string
  file_count?: number
  files?: { path: string; url: string }[]
  errors?: string[]
  tracking_id?: string
  published_at?: string
  auth_configured?: boolean
  commit_message?: string
  note?: string
}

export interface A12FilesPayload {
  run_id: string
  tracking_id?: string
  stack?: string
  file_count: number
  files: A12SourceFile[]
  github_auth_configured?: boolean
  github_publish?: A12GitHubPublish
}

export interface A7ConfluencePage {
  doc_id: string
  label: string
  filename: string
  page_id: string
  url: string
  permissions: { read: boolean; write: boolean; admin: boolean }
}

export interface A7ConfluencePublish {
  run_id: string
  published: boolean
  tracking_id?: string
  agent_id?: string
  project?: string
  space_key?: string
  base_url?: string
  published_at?: string
  permissions_requested?: string[]
  permissions?: { read: boolean; write: boolean; admin: boolean }
  pages?: A7ConfluencePage[]
  page_count?: number
  status?: string
  note?: string
  pack_url?: string
  search_url?: string
  space_url?: string
  parent_page_id?: string
  live?: boolean
  api_error?: string
  auth_configured?: boolean
}

export interface G0Brief {
  run_id: string
  title: string
  lede: string
  approver_heading?: string
  paused_line?: string
  expected_approvers?: string
  policy_heading?: string
  policy_intro?: string
  policy_items?: { label: string; value: string; source?: string }[]
  checklist_heading?: string
  checklist_note?: string
  checklist?: { id: string; label: string; required?: boolean }[]
  reject_consequence?: string
  context_line?: string
  requirement_summary?: string
  activity_status: string
  evidence_hints?: string[]
  glossary: { term: string; def: string }[]
  category_id?: string
  model: string
  warning?: string
  tokens_in?: number
  tokens_out?: number
  cost_usd?: number
}

export interface G1Brief {
  run_id: string
  title: string
  lede: string
  approver_heading?: string
  paused_line?: string
  expected_approvers?: string
  evidence_heading?: string
  evidence_intro?: string
  discovery_items?: { label: string; value: string; source?: string }[]
  checklist_heading?: string
  checklist_note?: string
  checklist?: { id: string; label: string; required?: boolean }[]
  reject_consequence?: string
  context_line?: string
  requirement_summary?: string
  activity_status: string
  evidence_hints?: string[]
  glossary: { term: string; def: string }[]
  category_id?: string
  prior_agent_name?: string
  model: string
  warning?: string
  tokens_in?: number
  tokens_out?: number
  cost_usd?: number
}

export interface G2Brief {
  run_id: string
  title: string
  lede: string
  approver_heading?: string
  paused_line?: string
  expected_approvers?: string
  evidence_heading?: string
  evidence_intro?: string
  architecture_items?: { label: string; value: string; source?: string }[]
  comparison_heading?: string
  comparison_intro?: string
  previous_summary?: string
  target_summary?: string
  comparison_deltas?: { aspect: string; from: string; to: string; change?: string }[]
  checklist_heading?: string
  checklist_note?: string
  checklist?: { id: string; label: string; required?: boolean }[]
  reject_consequence?: string
  context_line?: string
  requirement_summary?: string
  path_status_label?: string
  movement_path?: string
  activity_status: string
  evidence_hints?: string[]
  glossary: { term: string; def: string }[]
  category_id?: string
  prior_agent_name?: string
  path_active_ids?: string[]
  service_names?: string[]
  model: string
  warning?: string
  tokens_in?: number
  tokens_out?: number
  cost_usd?: number
}

export interface G3Brief {
  run_id: string
  title: string
  lede: string
  approver_heading?: string
  paused_line?: string
  expected_approvers?: string
  evidence_heading?: string
  evidence_intro?: string
  code_items?: { label: string; value: string; source?: string }[]
  checklist_heading?: string
  checklist_note?: string
  checklist?: { id: string; label: string; required?: boolean }[]
  reject_consequence?: string
  context_line?: string
  requirement_summary?: string
  path_status_label?: string
  movement_path?: string
  activity_status: string
  evidence_hints?: string[]
  glossary: { term: string; def: string }[]
  category_id?: string
  prior_agent_name?: string
  path_active_ids?: string[]
  service_names?: string[]
  model: string
  warning?: string
  tokens_in?: number
  tokens_out?: number
  cost_usd?: number
}

export interface PathMapNode {
  id: string
  name: string
  kind: 'agent' | 'gate'
  map_domain: string
  role?: string
  tagline?: string
  description?: string
  guardrail?: string
  score: number
  status: 'active' | 'eligible' | 'vetoed'
  breakdown: Record<string, { points: number; note: string }>
  reason: string
}

export interface PathMapWeightage {
  key: string
  label: string
  weight: number
  value: string
  blurb: string
}

export interface PathMapDomainMapping {
  key: string
  name: string
  purpose: string
  agents: {
    id: string
    name: string
    role?: string
    tagline?: string
    status: string
    score: number
  }[]
  gates: {
    id: string
    name: string
    role?: string
    status: string
    score: number
  }[]
}

export interface PathMapResult {
  run_id: string
  weights: Record<string, number>
  weightage?: PathMapWeightage[]
  threshold: number
  inputs: {
    category_id: string
    category_name: string
    category_weight: number
    strategy: string
    strategies: string[]
    strategy_weight: number
    title: string
    requirement: string
    title_weight: number
    description: string
    description_weight: number
  }
  domains: { key: string; name: string; purpose: string }[]
  mapping?: PathMapDomainMapping[]
  nodes: PathMapNode[]
  summary: {
    agents_active: number
    agents_inactive?: number
    agents_vetoed?: number
    agents_total: number
    gates_active: number
    gates_total: number
    domains_touched: number
    domains_total: number
    eligible_ids: string[]
    vetoed_ids: string[]
    active_ids: string[]
    pruned_ids?: string[]
    next_after_a1: string
    domain_exclusive?: boolean
    minimum_path?: boolean
  }
  domain_coverage: {
    key: string
    name: string
    purpose: string
    active: number
    total: number
  }[]
  note: string
}

const BASE = '/api'

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  })
  if (!res.ok) {
    const detail = await res.json().catch(() => ({ detail: res.statusText }))
    throw new ApiError(res.status, detail.detail ?? res.statusText)
  }
  return res.json() as Promise<T>
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

export const api = {
  pipeline: () =>
    req<{ sequence: PipelineNode[]; domains: Domain[]; counts: Record<string, number> }>(
      '/pipeline',
    ),
  mcp: () => req<{ servers: McpServer[] }>('/mcp'),
  intakeCategories: () =>
    req<{ categories: IntakeCategory[]; count: number; options_per_category: number }>(
      '/intake/categories',
    ),
  intakeTrends: (runId: string, category_id: string) =>
    req<{
      category_id: string
      name: string
      summary: string
      options: IntakeOption[]
      model: string
      warning?: string
    }>(`/runs/${runId}/intake/trends`, {
      method: 'POST',
      body: JSON.stringify({ category_id }),
    }),
  intakeStrategies: (
    runId: string,
    category_id: string,
    project_title: string,
    requirement = '',
  ) =>
    req<{ strategies: IntakeStrategyOption[]; model: string; warning?: string }>(
      `/runs/${runId}/intake/strategies`,
      { method: 'POST', body: JSON.stringify({ category_id, project_title, requirement }) },
    ),
  intakeWhy: (
    runId: string,
    body: { category_id: string; project_title: string; strategies: string[]; requirement?: string },
  ) =>
    req<{ why_modernize: string; model: string; warning?: string }>(`/runs/${runId}/intake/why`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  intakeGlossary: (
    runId: string,
    body: {
      category_id: string
      focus?: string
      trend_options?: string[]
      strategies?: string[]
    },
  ) =>
    req<{ terms: { term: string; def: string }[]; model: string; focus: string; warning?: string }>(
      `/runs/${runId}/intake/glossary`,
      { method: 'POST', body: JSON.stringify(body) },
    ),
  synthesizeIntake: (
    runId: string,
    body: {
      project_name?: string
      description?: string
      why_modernize?: string
      strategies?: string[]
      app_id?: string
      selections: { category_id: string; choice_id: string | null; custom_text: string | null }[]
    },
  ) =>
    req<IntakeSynthesis & { run_id: string; app_id: string }>(
      `/runs/${runId}/intake/synthesize`,
      { method: 'POST', body: JSON.stringify(body) },
    ),
  validateRepo: (urls: string[] | string, techName?: string, categoryId?: string) =>
    req<{ is_valid: boolean; message: string; invalid_line?: string }>(`/validate-repo`, {
      method: 'POST',
      body: JSON.stringify({ urls, tech_name: techName, category_id: categoryId }),
    }),
  a2Brief: (runId: string) =>
    req<A2Brief>(`/runs/${runId}/agents/A2/brief`, { method: 'POST', body: '{}' }),
  a3Brief: (runId: string) =>
    req<A3Brief>(`/runs/${runId}/agents/A3/brief`, { method: 'POST', body: '{}' }),
  a4Brief: (runId: string) =>
    req<A4Brief>(`/runs/${runId}/agents/A4/brief`, { method: 'POST', body: '{}' }),
  a5Brief: (runId: string) =>
    req<A5Brief>(`/runs/${runId}/agents/A5/brief`, { method: 'POST', body: '{}' }),
  a6Brief: (runId: string) =>
    req<A6Brief>(`/runs/${runId}/agents/A6/brief`, { method: 'POST', body: '{}' }),
  a7Brief: (runId: string) =>
    req<A7Brief>(`/runs/${runId}/agents/A7/brief`, { method: 'POST', body: '{}' }),
  a9Brief: (runId: string) =>
    req<A9Brief>(`/runs/${runId}/agents/A9/brief`, { method: 'POST', body: '{}' }),
  a10Brief: (runId: string) =>
    req<A10Brief>(`/runs/${runId}/agents/A10/brief`, { method: 'POST', body: '{}' }),
  a12Brief: (runId: string) =>
    req<A12Brief>(`/runs/${runId}/agents/A12/brief`, { method: 'POST', body: '{}' }),
  a13Brief: (runId: string) =>
    req<A13Brief>(`/runs/${runId}/agents/A13/brief`, { method: 'POST', body: '{}' }),
  a14Brief: (runId: string) =>
    req<A14Brief>(`/runs/${runId}/agents/A14/brief`, { method: 'POST', body: '{}' }),
  a16Brief: (runId: string) =>
    req<A16Brief>(`/runs/${runId}/agents/A16/brief`, { method: 'POST', body: '{}' }),
  g4Brief: (runId: string) =>
    req<G4Brief>(`/runs/${runId}/gates/G4/brief`, { method: 'POST', body: '{}' }),
  g5Brief: (runId: string) =>
    req<G5Brief>(`/runs/${runId}/gates/G5/brief`, { method: 'POST', body: '{}' }),
  g6Brief: (runId: string) =>
    req<G6Brief>(`/runs/${runId}/gates/G6/brief`, { method: 'POST', body: '{}' }),
  g7Brief: (runId: string) =>
    req<G7Brief>(`/runs/${runId}/gates/G7/brief`, { method: 'POST', body: '{}' }),
  g8Brief: (runId: string) =>
    req<G8Brief>(`/runs/${runId}/gates/G8/brief`, { method: 'POST', body: '{}' }),
  a17Brief: (runId: string) =>
    req<A17Brief>(`/runs/${runId}/agents/A17/brief`, { method: 'POST', body: '{}' }),
  a18Brief: (runId: string) =>
    req<A18Brief>(`/runs/${runId}/agents/A18/brief`, { method: 'POST', body: '{}' }),
  a12Files: (runId: string) =>
    req<A12FilesPayload>(`/runs/${runId}/agents/A12/files`),
  a12DownloadFile: async (runId: string, fileId: string) => {
    const res = await fetch(`${BASE}/runs/${runId}/agents/A12/files/${encodeURIComponent(fileId)}`)
    if (!res.ok) {
      const detail = await res.json().catch(() => ({ detail: res.statusText }))
      throw new ApiError(res.status, detail.detail ?? res.statusText)
    }
    const blob = await res.blob()
    const disposition = res.headers.get('Content-Disposition') || ''
    const match = /filename="?([^";]+)"?/i.exec(disposition)
    const filename = match?.[1] || `${fileId}.txt`
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
    return { filename }
  },
  a12DownloadZip: async (runId: string) => {
    const res = await fetch(`${BASE}/runs/${runId}/agents/A12/download.zip`)
    if (!res.ok) {
      const detail = await res.json().catch(() => ({ detail: res.statusText }))
      throw new ApiError(res.status, detail.detail ?? res.statusText)
    }
    const blob = await res.blob()
    const disposition = res.headers.get('Content-Disposition') || ''
    const match = /filename="?([^";]+)"?/i.exec(disposition)
    const filename = match?.[1] || `a12-${runId}-services.zip`
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
    return { filename }
  },
  a12GithubStatus: (runId: string) =>
    req<A12GitHubPublish>(`/runs/${runId}/agents/A12/github`),
  a12GithubPush: (
    runId: string,
    body: {
      repo: string
      branch?: string
      private?: boolean
      create_if_missing?: boolean
      commit_message?: string
      token?: string
    },
  ) =>
    req<A12GitHubPublish>(`/runs/${runId}/agents/A12/github/push`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  a7DownloadDocument: async (runId: string, docId: string) => {
    const res = await fetch(`${BASE}/runs/${runId}/agents/A7/documents/${encodeURIComponent(docId)}`)
    if (!res.ok) {
      const detail = await res.json().catch(() => ({ detail: res.statusText }))
      throw new ApiError(res.status, detail.detail ?? res.statusText)
    }
    const blob = await res.blob()
    const disposition = res.headers.get('Content-Disposition') || ''
    const match = /filename="?([^";]+)"?/i.exec(disposition)
    const filename = match?.[1] || `${docId}.txt`
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
    return { filename }
  },
  a7ConfluenceStatus: (runId: string) =>
    req<A7ConfluencePublish>(`/runs/${runId}/agents/A7/confluence`),
  a7ConfluencePublish: (runId: string, permissions: string[]) =>
    req<A7ConfluencePublish>(`/runs/${runId}/agents/A7/confluence/publish`, {
      method: 'POST',
      body: JSON.stringify({ permissions }),
    }),
  g0Brief: (runId: string) =>
    req<G0Brief>(`/runs/${runId}/gates/G0/brief`, { method: 'POST', body: '{}' }),
  g1Brief: (runId: string) =>
    req<G1Brief>(`/runs/${runId}/gates/G1/brief`, { method: 'POST', body: '{}' }),
  g2Brief: (runId: string) =>
    req<G2Brief>(`/runs/${runId}/gates/G2/brief`, { method: 'POST', body: '{}' }),
  g3Brief: (runId: string) =>
    req<G3Brief>(`/runs/${runId}/gates/G3/brief`, { method: 'POST', body: '{}' }),
  stepBrief: (runId: string, stepId: string) =>
    req<StepBrief>(`/runs/${runId}/steps/${stepId}/brief`),
  pathMap: (
    runId: string,
    intake?: {
      category_id?: string
      category_name?: string
      project_name?: string
      requirement?: string
      strategies?: string[]
      strategy_short?: string
      why_modernize?: string
      description?: string
      selections?: { category_id: string; choice_id: string | null; custom_text: string | null }[]
    },
  ) =>
    req<PathMapResult>(`/runs/${runId}/path-map`, {
      method: 'POST',
      body: JSON.stringify(intake ?? {}),
    }),
  createRun: (app_id: string) =>
    req<{ run_id: string }>('/runs', { method: 'POST', body: JSON.stringify({ app_id }) }),
  listRuns: () =>
    req<{
      runs: {
        run_id: string
        app_id: string
        status: string
        agents_done: number
        gates_passed: number
      }[]
    }>('/runs'),
  getRun: (id: string) =>
    req<{ state: any; nodes: RunNode[]; next: string | null; mcp_used: string[] }>(`/runs/${id}`),
  runAgent: (runId: string, agentId: string, params: Record<string, unknown>) =>
    req<AgentRunResult>(`/runs/${runId}/agents/${agentId}`, {
      method: 'POST',
      body: JSON.stringify({ params }),
    }),
  agentLog: (runId: string, agentId: string) =>
    req<{ log: LogLine[]; params: Record<string, unknown> }>(
      `/runs/${runId}/agents/${agentId}/log`,
    ),
  gate: (runId: string, gateId: string) => req<GateEvidence>(`/runs/${runId}/gates/${gateId}`),
  decideGate: (runId: string, gateId: string, approved: boolean, actor = 'operator') =>
    req<{ state: any; rewound_to: string | null }>(`/runs/${runId}/gates/${gateId}`, {
      method: 'POST',
      body: JSON.stringify({ approved, actor }),
    }),
  ledger: (runId: string) =>
    req<{ entries: any[]; intact: boolean; broken_at: number | null }>(`/runs/${runId}/ledger`),
}

export const RUN_STORAGE_KEY = 'mf.activeRunId'
