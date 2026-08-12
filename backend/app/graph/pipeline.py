"""Pipeline orchestration.

The execution order is derived, not hand-written: agents are sorted by domain,
gates are inserted after the agent they follow. Adding an agent to the registry
puts it in the pipeline automatically.

Gate semantics:
  * A gate halts the run. Status becomes AWAITING_APPROVAL.
  * Approval records a GateRecord and unlocks the next node.
  * Rejection rewinds to the last agent before the gate and discards every
    result produced after that point. Work built on rejected findings is not
    trusted, so it does not survive.
"""
from __future__ import annotations

import logging
from collections.abc import Iterable
from dataclasses import dataclass
from typing import Any

from app.agents.base import AgentSpec, all_specs, get_agent
from app.core.types import (
    AgentResult,
    FactoryState,
    GateDecision,
    GateRecord,
    RunStatus,
)
from app.graph.gates import GATES_AFTER, GATES_BY_ID, Gate
from app.mcp.gateway import MCPGateway

log = logging.getLogger(__name__)

DOMAIN_ORDER = ["A", "B", "C", "D", "E", "F"]


@dataclass(frozen=True)
class Node:
    kind: str  # "agent" | "gate"
    id: str
    domain: str
    name: str


def build_sequence() -> list[Node]:
    """Derive the 27-node pipeline from the registry and gate table."""
    from app.agents import load_all

    load_all()
    # Order by agent number so domain letters can group the UI without
    # rearranging the factory path (e.g. A6/A7 stay before A8 / G1).
    specs: list[AgentSpec] = sorted(
        all_specs(),
        key=lambda s: int(s.id[1:]),
    )
    seq: list[Node] = []
    for spec in specs:
        seq.append(Node("agent", spec.id, spec.domain, spec.name))
        for gate in GATES_AFTER.get(spec.id, []):
            seq.append(Node("gate", gate.id, gate.domain, gate.name))
    return seq


class CostCeilingExceeded(RuntimeError):
    pass


class GateNotApproved(RuntimeError):
    pass


class Pipeline:
    """Executes the sequence, one node at a time, under human control.

    Deliberately step-driven rather than run-to-completion: the portal drives
    it, and a gate must be able to stop it mid-flight.
    """

    def __init__(self, gateway: MCPGateway, backend: Any, ledger: Any | None = None) -> None:
        self.sequence = build_sequence()
        self.gateway = gateway
        self.backend = backend
        self.ledger = ledger
        self._index: dict[str, int] = {n.id: i for i, n in enumerate(self.sequence)}

    # ---- navigation -------------------------------------------------

    def node_at(self, idx: int) -> Node:
        return self.sequence[idx]

    def position_of(self, node_id: str) -> int:
        return self._index[node_id]

    def is_unlocked(self, idx: int, state: FactoryState) -> bool:
        """A node is reachable only if everything before it is done."""
        if idx == 0:
            return True
        prev = self.sequence[idx - 1]
        if prev.kind == "agent":
            return prev.id in state.completed_agents
        return state.gate_passed(prev.id)

    def next_pending(self, state: FactoryState) -> Node | None:
        for i, node in enumerate(self.sequence):
            done = (
                node.id in state.completed_agents
                if node.kind == "agent"
                else state.gate_passed(node.id)
            )
            if not done:
                return node if self.is_unlocked(i, state) else None
        return None

    # ---- execution --------------------------------------------------

    async def run_agent(
        self, agent_id: str, state: FactoryState, params: dict[str, Any]
    ) -> tuple[FactoryState, AgentResult]:
        idx = self.position_of(agent_id)
        if not self.is_unlocked(idx, state):
            blocker = self.sequence[idx - 1]
            raise GateNotApproved(
                f"{agent_id} is locked. {blocker.id} ({blocker.name}) must complete first."
            )

        # Check before spending, not after. A ceiling that only reports the
        # overspend once it has happened is an invoice, not a control.
        if state.cost_usd >= state.cost_ceiling_usd:
            raise CostCeilingExceeded(
                f"Run has reached its ${state.cost_ceiling_usd:.2f} ceiling "
                f"(spent ${state.cost_usd:.2f}). Raise the limit to continue."
            )

        agent = get_agent(agent_id)(self.backend)
        result = await agent.run(state, params)

        projected = state.cost_usd + result.cost_usd
        if projected > state.cost_ceiling_usd:
            log.warning(
                "Run %s exceeded ceiling: $%.2f > $%.2f",
                state.run_id, projected, state.cost_ceiling_usd,
            )

        new_state = self._apply(state, result)
        if self.ledger:
            self.ledger.record(new_state.run_id, agent_id, "agent_run", result.model_dump())
        return new_state, result

    def decide_gate(
        self, gate_id: str, state: FactoryState, *, approved: bool, actor: str, note: str = ""
    ) -> FactoryState:
        gate = GATES_BY_ID[gate_id]
        record = GateRecord(
            gate_id=gate_id,
            decision=GateDecision.APPROVED if approved else GateDecision.REJECTED,
            actor=actor,
            note=note,
        )
        patch = state.model_copy(deep=True)
        patch.gate_decisions.append(record)

        if approved:
            if gate_id == "G1":
                # Approving discovery promotes every draft rule to the
                # specification of record. This is the moment the rules stop
                # being suggestions.
                for rule in patch.rules:
                    if rule.status == "draft":
                        rule.status = "approved"
            patch.status = RunStatus.RUNNING
        else:
            patch = self._rewind_to(patch, gate)
            patch.status = RunStatus.REJECTED

        if self.ledger:
            self.ledger.record(patch.run_id, gate_id, "gate_decision", record.model_dump())
        return patch

    # ---- internals --------------------------------------------------

    def _apply(self, state: FactoryState, result: AgentResult) -> FactoryState:
        data = state.model_dump()
        for key, value in result.state_patch.items():
            data[key] = value
        data["cost_usd"] = state.cost_usd + result.cost_usd
        completed = list(state.completed_agents)
        if result.agent_id not in completed:
            completed.append(result.agent_id)
        data["completed_agents"] = completed
        data["status"] = RunStatus.RUNNING
        return FactoryState.model_validate(data)

    def _rewind_to(self, state: FactoryState, gate: Gate) -> FactoryState:
        """Discard everything produced at or after the rejected gate's agent.

        Rejecting a gate means the findings it reviewed are wrong. Anything
        built on top of them inherits that wrongness.
        """
        gate_idx = self.position_of(gate.id)
        target = gate.after_agent
        keep: list[str] = []
        for node in self.sequence[:gate_idx]:
            if node.kind == "agent" and node.id in state.completed_agents:
                keep.append(node.id)
        if target in keep:
            keep.remove(target)
        state.completed_agents = keep
        log.info("Rewound run %s to before %s", state.run_id, target)
        return state


def describe_sequence() -> Iterable[dict[str, Any]]:
    """Shape the frontend consumes to draw the pipeline."""
    from app.agents import load_all

    load_all()
    specs = {s.id: s for s in all_specs()}
    for node in build_sequence():
        if node.kind == "agent":
            spec = specs[node.id]
            yield {
                "kind": "agent", "id": spec.id, "domain": spec.domain, "name": spec.name,
                "plain": spec.plain, "needs": spec.needs, "produces": spec.produces,
                "mcp": list(spec.mcp), "model_tier": spec.model_tier,
                "inputs": [dict(i) for i in spec.inputs],
            }
        else:
            gate = GATES_BY_ID[node.id]
            yield {
                "kind": "gate", "id": gate.id, "domain": gate.domain, "name": gate.name,
                "approvers": gate.approvers, "question": gate.question, "why": gate.why,
                "after_agent": gate.after_agent,
            }
