"""End-to-end and guardrail tests.

The guardrail tests matter more than the happy path. They assert that the
safety properties actually hold, rather than that the demo looks nice.
"""
from __future__ import annotations

import pytest

from app.agents.backends import MockBackend
from app.core.types import FactoryState, TrustTier
from app.graph.gates import GATES_BY_ID
from app.graph.pipeline import GateNotApproved, Pipeline, build_sequence
from app.mcp.gateway import MCPGateway, NotAllowed, ToolNotPermitted, build_allow_list
from app.store.ledger import Ledger

PARAMS = {
    "A1": {"app_id": "polad", "budget": "500"},
    "A2": {"criticality": "high"},
    "A3": {"sensitivity": "high"},
    "A4": {"sources": ["code", "copybooks", "jcl", "db"]},
    "A5": {"depth": "full"},
    "A6": {"confidence": "0.8", "require_citation": ["cite"]},
    "A7": {"artifacts": ["modules", "diagrams", "dictionary"]},
    "A8": {"window_days": "90"},
    "A9": {"shape": "micro", "order": "safe"},
    "A10": {"comms": "mixed"},
    "A11": {"cutover": "dual"},
    "A12": {"stack": "java", "extras": ["provenance", "infra"]},
    "A13": {"bridges": ["api", "file"]},
    "A14": {"kinds": ["unit", "integration", "edge"]},
    "A15": {"mode": "strict"},
    "A16": {"max_attempts": "3"},
    "A17": {"volume": "50000", "tolerances": ["rounding", "timestamps", "ordering"]},
    "A18": {"plan": "slow", "rollback_on": ["errors", "divergence"]},
}


def make_pipeline() -> Pipeline:
    state_holder = {}
    gw = MCPGateway(
        allow_list=build_allow_list(),
        gate_check=lambda gid: state_holder.get("state", None) is not None
        and state_holder["state"].gate_passed(gid),
    )
    return Pipeline(gateway=gw, backend=MockBackend(), ledger=Ledger())


def fresh_state() -> FactoryState:
    return FactoryState(run_id="TEST-001", app_id="polad", cost_ceiling_usd=1000.0)


# ---- structure -----------------------------------------------------

def test_sequence_has_18_agents_and_9_gates():
    seq = build_sequence()
    assert len([n for n in seq if n.kind == "agent"]) == 18
    assert len([n for n in seq if n.kind == "gate"]) == 9
    assert len(seq) == 27


def test_every_gate_follows_an_existing_agent():
    agent_ids = {n.id for n in build_sequence() if n.kind == "agent"}
    for gate in GATES_BY_ID.values():
        assert gate.after_agent in agent_ids


# ---- happy path ----------------------------------------------------

@pytest.mark.asyncio
async def test_full_run_completes():
    pl = make_pipeline()
    state = fresh_state()
    for node in pl.sequence:
        if node.kind == "agent":
            state, _ = await pl.run_agent(node.id, state, PARAMS[node.id])
        else:
            state = pl.decide_gate(node.id, state, approved=True, actor="test")
    assert len(state.completed_agents) == 18
    assert len([g for g in state.gate_decisions if g.decision == "approved"]) == 9
    assert state.equivalence.match_rate == 100.0
    assert state.equivalence.unexplained == []


# ---- locking -------------------------------------------------------

@pytest.mark.asyncio
async def test_agent_locked_until_prior_gate_approved():
    pl = make_pipeline()
    state = fresh_state()
    for aid in ("A1", "A2", "A3"):
        state, _ = await pl.run_agent(aid, state, PARAMS[aid])
    # G0 has not been approved, so A4 must refuse to run.
    with pytest.raises(GateNotApproved):
        await pl.run_agent("A4", state, PARAMS["A4"])

    state = pl.decide_gate("G0", state, approved=True, actor="test")
    state, _ = await pl.run_agent("A4", state, PARAMS["A4"])
    assert "A4" in state.completed_agents


@pytest.mark.asyncio
async def test_rejection_rewinds_and_discards_downstream_work():
    pl = make_pipeline()
    state = fresh_state()
    for node in pl.sequence[:pl.position_of("G1") + 1]:
        if node.kind == "agent":
            state, _ = await pl.run_agent(node.id, state, PARAMS[node.id])
        elif node.id != "G1":
            state = pl.decide_gate(node.id, state, approved=True, actor="test")

    assert "A8" in state.completed_agents
    state = pl.decide_gate("G1", state, approved=False, actor="test", note="rules wrong")
    # A8 is the gate's agent — it and everything after are no longer trusted.
    assert "A8" not in state.completed_agents
    assert "A4" in state.completed_agents  # earlier work survives


# ---- guardrails ----------------------------------------------------

@pytest.mark.asyncio
async def test_rules_only_approved_at_discovery_gate():
    pl = make_pipeline()
    state = fresh_state()
    for node in pl.sequence[:pl.position_of("G1")]:
        if node.kind == "agent":
            state, _ = await pl.run_agent(node.id, state, PARAMS[node.id])
        else:
            state = pl.decide_gate(node.id, state, approved=True, actor="test")
    assert state.approved_rules() == []  # drafts only
    state = pl.decide_gate("G1", state, approved=True, actor="test")
    assert len(state.approved_rules()) > 0


def test_derived_rule_without_citation_is_rejected():
    from pydantic import ValidationError

    from app.core.types import BusinessRule

    with pytest.raises(ValidationError):
        BusinessRule(
            rule_id="BR-9999", statement="something", sources=[],
            confidence=0.95, trust_tier=TrustTier.DERIVED,
        )


@pytest.mark.asyncio
async def test_equivalence_gate_blocks_on_unexplained_divergence():
    pl = make_pipeline()
    state = fresh_state()
    params = dict(PARAMS)
    params["A17"] = {"volume": "50000", "tolerances": []}  # declare nothing
    for node in pl.sequence[:pl.position_of("G5")]:
        if node.kind == "agent":
            state, _ = await pl.run_agent(node.id, state, params[node.id])
        else:
            state = pl.decide_gate(node.id, state, approved=True, actor="test")
    blocker = GATES_BY_ID["G5"].blocker(state)
    assert blocker is not None
    assert "unexplained" in blocker


@pytest.mark.asyncio
async def test_code_gate_blocks_when_provenance_disabled():
    pl = make_pipeline()
    state = fresh_state()
    params = dict(PARAMS)
    params["A12"] = {"stack": "java", "extras": ["infra"]}  # provenance off
    for node in pl.sequence[:pl.position_of("G3")]:
        if node.kind == "agent":
            state, _ = await pl.run_agent(node.id, state, params[node.id])
        else:
            state = pl.decide_gate(node.id, state, approved=True, actor="test")
    assert GATES_BY_ID["G3"].blocker(state) is not None


@pytest.mark.asyncio
async def test_cost_ceiling_halts_the_run():
    from app.graph.pipeline import CostCeilingExceeded

    pl = make_pipeline()
    state = fresh_state()
    # A1 sets the ceiling from its own budget parameter, so squeeze it after.
    state, _ = await pl.run_agent("A1", state, {"app_id": "polad", "budget": "0.01"})
    state, _ = await pl.run_agent("A2", state, PARAMS["A2"])  # pushes spend over
    assert state.cost_usd > state.cost_ceiling_usd
    with pytest.raises(CostCeilingExceeded):
        await pl.run_agent("A3", state, PARAMS["A3"])


# ---- MCP gateway ---------------------------------------------------

def test_gateway_rejects_undeclared_server():
    gw = MCPGateway(allow_list=build_allow_list())
    # A8 declares only M4 (observability). It must not reach source control.
    with pytest.raises(NotAllowed):
        gw.call(run_id="T", agent_id="A8", server_id="M1", tool="read_repo")


def test_gateway_rejects_tool_not_on_server():
    gw = MCPGateway(allow_list=build_allow_list())
    with pytest.raises(ToolNotPermitted):
        gw.call(run_id="T", agent_id="A4", server_id="M3", tool="drop_table")


def test_gateway_requires_release_gate_for_deployment():
    gw = MCPGateway(allow_list=build_allow_list(), gate_check=lambda g: False)
    with pytest.raises(ToolNotPermitted):
        gw.call(run_id="T", agent_id="A18", server_id="M11", tool="deploy_manifest")

    gw_ok = MCPGateway(allow_list=build_allow_list(), gate_check=lambda g: g == "G7")
    result = gw_ok.call(run_id="T", agent_id="A18", server_id="M11", tool="deploy_manifest")
    assert result["tool"] == "deploy_manifest"


def test_gateway_logs_denied_calls():
    gw = MCPGateway(allow_list=build_allow_list())
    with pytest.raises(NotAllowed):
        gw.call(run_id="T", agent_id="A8", server_id="M1", tool="read_repo")
    assert len(gw.audit) == 1
    assert gw.audit[0].allowed is False
    assert gw.audit[0].reason == "not in allow-list"


# ---- ledger --------------------------------------------------------

def test_ledger_chain_verifies():
    led = Ledger()
    for i in range(5):
        led.record("RUN-1", f"A{i}", "agent_run", {"n": i})
    intact, broken = led.verify()
    assert intact and broken is None


def test_ledger_detects_tampering():
    led = Ledger()
    for i in range(5):
        led.record("RUN-1", f"A{i}", "agent_run", {"n": i})
    led._entries[2].payload["n"] = 999  # tamper
    intact, broken = led.verify()
    assert not intact
    assert broken == 3
