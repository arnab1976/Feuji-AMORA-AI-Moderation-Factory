"""Core domain types for the modernization factory.

Everything in the pipeline reads and writes one state object. Agents never
talk to each other directly — that is what makes rollback possible, because
there are no side-channel messages to unwind.
"""
from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, Literal

from pydantic import BaseModel, Field, model_validator


class TrustTier(int, Enum):
    """How much we trust a piece of information.

    The single most important design decision in the data layer. An SME says
    "we always waive premium after 10 years"; the code says 120 months AND
    zero claims. If both have equal standing you will generate wrong code.
    """

    VERIFIABLE = 1  # source code, DDL, copybooks — ground truth
    OBSERVED = 2  # runtime logs, traces — real but sampled
    DERIVED = 3  # AST, extracted rules — must cite a T1/T2 source
    ASSERTED = 4  # SME statements, old docs — hypothesis, never fact


class AccessLevel(str, Enum):
    READ = "read"
    SANDBOX = "sandbox"
    WRITE = "write"
    APPROVAL = "approval"


class RunStatus(str, Enum):
    CREATED = "created"
    RUNNING = "running"
    AWAITING_APPROVAL = "awaiting_approval"
    REJECTED = "rejected"
    COMPLETE = "complete"
    FAILED = "failed"


class GateDecision(str, Enum):
    APPROVED = "approved"
    REJECTED = "rejected"


class SourceRef(BaseModel):
    """Where a fact came from. No citation, no fact."""

    artifact_id: str
    path: str
    start_line: int | None = None
    end_line: int | None = None


class BusinessRule(BaseModel):
    rule_id: str
    statement: str
    sources: list[SourceRef] = Field(default_factory=list)
    confidence: float = Field(ge=0.0, le=1.0)
    depends_on: list[str] = Field(default_factory=list)
    trust_tier: TrustTier = TrustTier.DERIVED
    status: Literal["draft", "needs_review", "approved", "rejected"] = "draft"

    @model_validator(mode="after")
    def derived_facts_need_citations(self) -> BusinessRule:
        if self.trust_tier <= TrustTier.DERIVED and not self.sources:
            raise ValueError(
                f"Rule {self.rule_id} is derived but cites no source. "
                "A rule without provenance cannot be defended to a regulator."
            )
        return self


class BoundedContext(BaseModel):
    name: str
    description: str
    replaces: list[str] = Field(default_factory=list)
    cohesion: float = 0.0
    coupling: float = 0.0
    rule_ids: list[str] = Field(default_factory=list)


class TestReport(BaseModel):
    total: int = 0
    passed: int = 0
    failed: int = 0
    rule_coverage_pct: float = 0.0
    healed: int = 0
    escalated: int = 0
    # failure class -> count, produced by triage (A15)
    failure_breakdown: dict[str, int] = Field(default_factory=dict)


class Divergence(BaseModel):
    case_id: str
    rule_id: str | None = None
    field: str
    legacy_value: str
    modern_value: str
    explained_by: str | None = None  # tolerance name, or None if unexplained


class EquivalenceReport(BaseModel):
    cases_replayed: int = 0
    match_rate: float = 0.0
    divergences: list[Divergence] = Field(default_factory=list)

    @property
    def unexplained(self) -> list[Divergence]:
        return [d for d in self.divergences if d.explained_by is None]


class GateRecord(BaseModel):
    gate_id: str
    decision: GateDecision
    actor: str
    note: str = ""
    decided_at: datetime = Field(default_factory=datetime.utcnow)


class AgentResult(BaseModel):
    """What every agent returns. Uniform on purpose — the graph node wrapper
    does not need to know which agent it just ran."""

    agent_id: str
    log: list[tuple[str, str]] = Field(default_factory=list)  # (level, message)
    state_patch: dict[str, Any] = Field(default_factory=dict)
    artifacts: list[str] = Field(default_factory=list)
    tokens_in: int = 0
    tokens_out: int = 0
    cost_usd: float = 0.0


class FactoryState(BaseModel):
    """The single object every phase reads and writes."""

    run_id: str
    app_id: str
    strategy: str = "refactor"
    status: RunStatus = RunStatus.CREATED

    policy: dict[str, Any] = Field(default_factory=dict)
    inventory: dict[str, Any] = Field(default_factory=dict)
    dependency_graph_id: str | None = None
    runtime_profile: dict[str, Any] = Field(default_factory=dict)

    rules: list[BusinessRule] = Field(default_factory=list)
    docs: dict[str, Any] = Field(default_factory=dict)

    service_map: list[BoundedContext] = Field(default_factory=list)
    contracts: list[dict[str, Any]] = Field(default_factory=list)
    data_plan: dict[str, Any] = Field(default_factory=dict)

    generated: dict[str, Any] = Field(default_factory=dict)
    test_results: TestReport = Field(default_factory=TestReport)
    heal_attempts: dict[str, int] = Field(default_factory=dict)
    equivalence: EquivalenceReport = Field(default_factory=EquivalenceReport)
    deployment: dict[str, Any] = Field(default_factory=dict)

    gate_decisions: list[GateRecord] = Field(default_factory=list)
    completed_agents: list[str] = Field(default_factory=list)
    errors: list[str] = Field(default_factory=list)

    cost_usd: float = 0.0
    cost_ceiling_usd: float = 250.0

    def approved_rules(self) -> list[BusinessRule]:
        return [r for r in self.rules if r.status == "approved"]

    def gate_passed(self, gate_id: str) -> bool:
        return any(
            g.gate_id == gate_id and g.decision == GateDecision.APPROVED
            for g in self.gate_decisions
        )
