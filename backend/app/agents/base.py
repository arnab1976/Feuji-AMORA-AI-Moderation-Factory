"""Agent contract and registry.

Every agent declares which MCP servers it may use. The gateway enforces that
declaration at call time — an agent cannot reach a tool it did not declare,
even if it tries.
"""
from __future__ import annotations

import abc
from dataclasses import dataclass
from typing import Any, ClassVar

from app.core.types import AgentResult, FactoryState


@dataclass(frozen=True)
class AgentSpec:
    id: str
    domain: str
    name: str
    plain: str  # plain-English description for non-technical viewers
    needs: str  # what it consumes
    produces: str  # what it emits
    mcp: tuple[str, ...] = ()  # declared tool allow-list
    model_tier: str = "medium"  # small | medium | large | none
    inputs: tuple[dict[str, Any], ...] = ()  # UI form definition
    role: str = ""  # short capability role for path selection
    tagline: str = ""  # one-line positioning
    guardrail: str = ""  # hard constraint the agent must not violate


def _enrich_spec(spec: AgentSpec) -> AgentSpec:
    """Merge canonical intake profiles (role / tagline / guardrail / description)."""
    try:
        from app.intake.agent_profiles import AGENT_PROFILES
    except Exception:  # pragma: no cover - profiles optional at import time
        return spec
    profile = AGENT_PROFILES.get(spec.id) or {}
    if not profile:
        return spec
    return AgentSpec(
        id=spec.id,
        domain=spec.domain or str(profile.get("map_domain") or ""),
        name=str(profile.get("name") or spec.name),
        plain=str(profile.get("description") or spec.plain),
        needs=spec.needs,
        produces=spec.produces,
        mcp=spec.mcp,
        model_tier=spec.model_tier,
        inputs=spec.inputs,
        role=str(profile.get("role") or spec.role),
        tagline=str(profile.get("tagline") or spec.tagline),
        guardrail=str(profile.get("guardrail") or spec.guardrail),
    )


class Agent(abc.ABC):
    """Base class. Subclasses implement run() and declare a spec."""

    spec: ClassVar[AgentSpec]

    def __init__(self, backend: AgentBackend) -> None:
        self.backend = backend

    @abc.abstractmethod
    async def run(
        self, state: FactoryState, params: dict[str, Any]
    ) -> AgentResult:  # pragma: no cover - interface
        ...

    def _result(self, **kw: Any) -> AgentResult:
        return AgentResult(agent_id=self.spec.id, **kw)


class AgentBackend(abc.ABC):
    """Where an agent's reasoning actually happens.

    Two implementations ship: MockBackend (deterministic, no API keys, used
    for demos and tests) and LiveBackend (calls a real model). Swapping them
    is one environment variable.
    """

    @abc.abstractmethod
    async def complete(
        self, agent_id: str, prompt: str, *, tier: str = "medium", **kw: Any
    ) -> dict[str, Any]:  # pragma: no cover - interface
        ...


_REGISTRY: dict[str, type[Agent]] = {}


def register(cls: type[Agent]) -> type[Agent]:
    enriched = _enrich_spec(cls.spec)
    cls.spec = enriched  # type: ignore[misc]
    if enriched.id in _REGISTRY:
        raise ValueError(f"Duplicate agent id {enriched.id}")
    _REGISTRY[enriched.id] = cls
    return cls


def get_agent(agent_id: str) -> type[Agent]:
    if agent_id not in _REGISTRY:
        raise KeyError(f"Unknown agent {agent_id}")
    return _REGISTRY[agent_id]


def all_specs() -> list[AgentSpec]:
    return [c.spec for c in _REGISTRY.values()]


def registry() -> dict[str, type[Agent]]:
    return dict(_REGISTRY)
