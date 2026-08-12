"""Canonical agent & gate profiles for path selection and UI.

Every node has exactly one map_domain (mutually exclusive across domains).
role / description / tagline / guardrail drive intake-based path scoring display
and operator understanding of why a step is on or off the journey.
"""
from __future__ import annotations

from typing import Any

# Domain caps for the minimum active path (agents only; gates handled separately).
DOMAIN_AGENT_CAPS: dict[str, int] = {
    "A": 3,  # A1, A2, A3
    "B": 2,  # discover — lean
    "C": 2,  # comprehend
    "D": 3,  # design & build — A10 always + lean builders
    "E": 3,  # assure
    "F": 1,  # A18 only
}

# Category → minimum agent set that must stay active when not vetoed.
CATEGORY_MIN_AGENTS: dict[str, set[str]] = {
    "legacy_source": {"A1", "A3", "A4", "A5", "A6", "A7", "A10", "A12", "A14", "A17", "A18"},
    "database": {"A1", "A3", "A4", "A5", "A6", "A7", "A10", "A11", "A14", "A17", "A18"},
    "configuration": {"A1", "A3", "A4", "A5", "A7", "A10", "A12", "A14", "A18"},
    "interfaces": {"A1", "A3", "A4", "A5", "A6", "A7", "A10", "A13", "A14", "A17", "A18"},
    "business_docs": {"A1", "A3", "A6", "A7", "A10", "A14", "A18"},
    "transactions": {"A1", "A3", "A4", "A5", "A8", "A6", "A10", "A14", "A17", "A18"},
    "observability": {"A1", "A3", "A4", "A8", "A7", "A10", "A14", "A15", "A18"},
    "tests": {"A1", "A3", "A4", "A5", "A6", "A10", "A14", "A15", "A17", "A18"},
    "defects": {"A1", "A3", "A4", "A5", "A6", "A10", "A14", "A15", "A16", "A18"},
    "build_deploy": {"A1", "A3", "A4", "A7", "A10", "A12", "A13", "A14", "A18"},
    "security": {"A1", "A3", "A4", "A5", "A10", "A14", "A18"},
    "target_state": {"A1", "A3", "A4", "A7", "A9", "A10", "A12", "A14", "A17", "A18"},
}

AGENT_PROFILES: dict[str, dict[str, Any]] = {
    "A1": {
        "name": "Factory administrator",
        "kind": "agent",
        "map_domain": "A",
        "role": "Run orchestrator",
        "tagline": "Owns the journey plan and rewind rights.",
        "description": (
            "Sets up the modernization run from A1 intake, sequences agents and gates, "
            "and can rewind the factory when a human rejects a checkpoint."
        ),
        "guardrail": "Must not skip human gates or invent category/strategy outside approved intake.",
    },
    "A2": {
        "name": "Portfolio intake",
        "kind": "agent",
        "map_domain": "A",
        "role": "Portfolio prioritiser",
        "tagline": "Ranks which estates to modernize first.",
        "description": (
            "Assesses portfolio criticality, regulations, and code location to decide "
            "order of modernization for the selected estate."
        ),
        "guardrail": "Must not change the locked A1 category or override policy from A3.",
    },
    "A3": {
        "name": "Governance & Risk",
        "kind": "agent",
        "map_domain": "A",
        "role": "Policy & risk controller",
        "tagline": "Rules-based allow-list for data and tools.",
        "description": (
            "Defines what the factory may do with code and data — sensitivity, "
            "regulatory constraints, and tool boundaries. Not an open-ended AI step."
        ),
        "guardrail": "Cannot weaken sensitivity or compliance controls under any score boost.",
    },
    "A4": {
        "name": "Repository discovery",
        "kind": "agent",
        "map_domain": "B",
        "role": "Estate inventory",
        "tagline": "Finds every artefact and dependency edge.",
        "description": (
            "Discovers repositories, PDS/PDSE libraries, and dependency maps so later "
            "agents know what exists before they analyse it."
        ),
        "guardrail": "Must not invent files; inventory must cite discovered paths only.",
    },
    "A5": {
        "name": "Legacy code analysis",
        "kind": "agent",
        "map_domain": "B",
        "role": "Static code analyst",
        "tagline": "Line-level map of calls and data flow.",
        "description": (
            "Reads legacy source (COBOL, Java, .NET, etc.) and builds a precise call "
            "and data-flow map used by rules and design agents."
        ),
        "guardrail": "Analysis stays read-only; no code mutation in this domain.",
    },
    "A6": {
        "name": "Business rule extraction",
        "kind": "agent",
        "map_domain": "C",
        "role": "Rules excavator",
        "tagline": "Turns code into plain-English decisions.",
        "description": (
            "Extracts business decisions from code, docs, or configs into approved "
            "rule statements humans can confirm at G1."
        ),
        "guardrail": "Rules must cite evidence; no speculative business policy.",
    },
    "A7": {
        "name": "Documentation & Knowledge Graph",
        "kind": "agent",
        "map_domain": "C",
        "role": "Knowledge author",
        "tagline": "Writes the docs the estate never had.",
        "description": (
            "Produces operator-facing documentation, diagrams, and a knowledge graph "
            "linking rules, modules, and tables from prior discovery and extraction."
        ),
        "guardrail": "Must not document unapproved design as fact.",
    },
    "A8": {
        "name": "Runtime behaviour",
        "kind": "agent",
        "map_domain": "B",
        "role": "Runtime observer",
        "tagline": "Sees which paths production actually uses.",
        "description": (
            "Studies logs and telemetry to identify hot paths and dead code so "
            "modernization focuses on real behaviour."
        ),
        "guardrail": "Uses masked/approved telemetry only; no production write access.",
    },
    "A9": {
        "name": "Domain decomposition",
        "kind": "agent",
        "map_domain": "D",
        "role": "Bounded-context designer",
        "tagline": "Cuts the monolith where coupling is weakest.",
        "description": (
            "Proposes service or module boundaries from measured dependencies "
            "and approved rules — foundational for strangler/slice strategies."
        ),
        "guardrail": "Boundaries stay proposals until G2; no irreversible cuts.",
    },
    "A10": {
        "name": "Target architecture",
        "kind": "agent",
        "map_domain": "D",
        "role": "Target architect",
        "tagline": "Contracts for how new pieces talk.",
        "description": (
            "Writes interface agreements and design decisions for the target "
            "architecture that construction and bridges must obey."
        ),
        "guardrail": "Architecture changes require G2; no silent contract drift.",
    },
    "A11": {
        "name": "Data modernization",
        "kind": "agent",
        "map_domain": "D",
        "role": "Data migration designer",
        "tagline": "Moves legacy data shapes safely.",
        "description": (
            "Designs schema target, migration, and check scripts for databases "
            "and awkward legacy formats."
        ),
        "guardrail": "No destructive cutover without dual-write or approved big-bang plan.",
    },
    "A12": {
        "name": "Code generation",
        "kind": "agent",
        "map_domain": "D",
        "role": "Code builder",
        "tagline": "Generates production code with rule provenance.",
        "description": (
            "Generates new services from approved architecture and rules; every "
            "method traces to an approved business rule."
        ),
        "guardrail": "Must not generate code for vetoed or unapproved rules.",
    },
    "A13": {
        "name": "Integration bridges",
        "kind": "agent",
        "map_domain": "D",
        "role": "Coexistence bridge builder",
        "tagline": "Keeps old and new talking during cutover.",
        "description": (
            "Builds API, file, and messaging bridges so strangler/facade strategies "
            "can run side by side with the legacy estate."
        ),
        "guardrail": "Bridges must preserve parity contracts; no silent payload drops.",
    },
    "A14": {
        "name": "Test generation",
        "kind": "agent",
        "map_domain": "E",
        "role": "Characterization tester",
        "tagline": "Tests from rules — never from the new code alone.",
        "description": (
            "Writes test suites from approved rules and journeys so equivalence "
            "is proven against intent, not against generated code."
        ),
        "guardrail": "Forbidden to derive expected results only from new implementation.",
    },
    "A15": {
        "name": "Failure triage",
        "kind": "agent",
        "map_domain": "E",
        "role": "Failure diagnostician",
        "tagline": "Finds the cause before any fix.",
        "description": (
            "Diagnoses failing tests with logs and history so healing does not "
            "guess or weaken assertions."
        ),
        "guardrail": "Must classify root cause before A16 may mutate code.",
    },
    "A16": {
        "name": "Self-healing",
        "kind": "agent",
        "map_domain": "E",
        "role": "Safe fixer",
        "tagline": "Fixes code — never the test — within attempt limits.",
        "description": (
            "Applies bounded fixes from triage diagnoses; escalates to humans "
            "when attempts are exhausted."
        ),
        "guardrail": "Never weaken or delete a failing test to force green.",
    },
    "A17": {
        "name": "Equivalence check",
        "kind": "agent",
        "map_domain": "E",
        "role": "Parity prover",
        "tagline": "Old vs new on real cases — no AI guessing.",
        "description": (
            "Replays masked real cases against old and new systems and reports "
            "field-level match rate and diffs."
        ),
        "guardrail": "Deterministic compare only; no LLM to judge business sameness.",
    },
    "A18": {
        "name": "Security and release",
        "kind": "agent",
        "map_domain": "F",
        "role": "Release & security lead",
        "tagline": "Scan, gradual handover, always a way back.",
        "description": (
            "Runs security scans and drives gradual traffic handover with "
            "automatic rollback triggers."
        ),
        "guardrail": "Cannot go 100% without G6/G7; rollback plan always required.",
    },
    "G0": {
        "name": "Intake Approval",
        "kind": "gate",
        "map_domain": "A",
        "role": "Scope gate",
        "tagline": "Leaders lock what is in and out of scope.",
        "description": (
            "Human approval that intake, portfolio ranking, and governance policy "
            "are ready before the factory reads anything."
        ),
        "guardrail": "Reject rewinds to A1/A2/A3; approve advances discovery.",
    },
    "G1": {
        "name": "Confirm we understood it",
        "kind": "gate",
        "map_domain": "C",
        "role": "Understanding gate",
        "tagline": "Humans confirm rules and docs are correct.",
        "description": "Approval that extracted rules and documentation match the estate.",
        "guardrail": "Reject returns to comprehend agents; no design until confirmed.",
    },
    "G2": {
        "name": "Approve the design",
        "kind": "gate",
        "map_domain": "D",
        "role": "Design gate",
        "tagline": "Architecture must be signed before build.",
        "description": "Approval of target architecture and decomposition before code generation.",
        "guardrail": "No A12/A13 execution without G2 when those agents are on path.",
    },
    "G3": {
        "name": "Approve the new code",
        "kind": "gate",
        "map_domain": "D",
        "role": "Build gate",
        "tagline": "Generated code enters assurance only when signed.",
        "description": "Approval that generated code and bridges are ready for test & equivalence.",
        "guardrail": "Reject blocks A14+ until construction is revised.",
    },
    "G4": {
        "name": "Approve the testing",
        "kind": "gate",
        "map_domain": "E",
        "role": "Test gate",
        "tagline": "Test evidence must satisfy leaders.",
        "description": "Approval of test generation and triage/heal outcomes before equivalence.",
        "guardrail": "Cannot proceed to A17/G5 with unresolved critical failures.",
    },
    "G5": {
        "name": "Approve equivalence",
        "kind": "gate",
        "map_domain": "E",
        "role": "Parity gate",
        "tagline": "Leaders accept old≈new match rate.",
        "description": "Approval that equivalence evidence meets the agreed threshold.",
        "guardrail": "Release domain blocked until parity is accepted or explicitly waived.",
    },
    "G6": {
        "name": "Approve security",
        "kind": "gate",
        "map_domain": "F",
        "role": "Security gate",
        "tagline": "Security sign-off before traffic move.",
        "description": "Approval of security scan results and residual risk.",
        "guardrail": "Critical findings must be mitigated or accepted in writing.",
    },
    "G7": {
        "name": "Approve the release",
        "kind": "gate",
        "map_domain": "F",
        "role": "Release gate",
        "tagline": "Go-live authority for gradual handover.",
        "description": "Approval to start production traffic shift with rollback armed.",
        "guardrail": "No production cut without rollback and monitoring checks.",
    },
    "G8": {
        "name": "Approve switch-off",
        "kind": "gate",
        "map_domain": "F",
        "role": "Decommission gate",
        "tagline": "Permission to retire the legacy estate.",
        "description": "Final approval to decommission legacy after stable new-system operation.",
        "guardrail": "Irreversible; only when parity and release gates are complete.",
    },
}


def profile_for(node_id: str) -> dict[str, Any]:
    return dict(AGENT_PROFILES.get(node_id) or {})


def min_agents_for(category_id: str) -> set[str]:
    return set(CATEGORY_MIN_AGENTS.get(category_id) or CATEGORY_MIN_AGENTS["legacy_source"])
