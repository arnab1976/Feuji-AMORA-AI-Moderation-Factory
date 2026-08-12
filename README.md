# Modernization Factory

An agentic pipeline that documents legacy code, designs a modern replacement,
generates it, tests it, heals its own failures, and proves the new system
behaves like the old one — with a human approving at nine points along the way.

**18 agents · 9 human gates · 12 MCP servers.**

Runs entirely on mock backends by default. No API keys needed to see the whole
pipeline work end to end.

---

## Quick start

```bash
git clone <your-repo> && cd modernization-factory
make up
```

Then open <http://localhost:5173>. The API is on <http://localhost:8000>,
with generated docs at `/docs`.

Without Docker:

```bash
cd backend && pip install -e ".[dev]" && uvicorn app.main:app --reload   # :8000
cd frontend && npm install && npm run dev                                # :5173
```

Run the tests:

```bash
make test    # 16 tests, ~0.2s
```

---

## Two run modes

| Mode | Set | Needs | Use for |
|---|---|---|---|
| **mock** (default) | `FACTORY_BACKEND=mock` | nothing | demos, development, CI |
| **live** | `FACTORY_BACKEND=live` | `ANTHROPIC_API_KEY` | real extraction and generation |

Mock is deterministic — same inputs, same outputs, every time. That is what
makes the test suite fast and the demo repeatable.

You can go live per-tier rather than all at once. Only four agents genuinely
need a large model: `A6` (rule extraction), `A9` (decomposition), `A12` (code
generation), `A16` (self-healing). Everything else runs fine on a small model
or no model at all.

---

## Layout

```
backend/
  app/
    core/types.py          FactoryState, BusinessRule, trust tiers
    agents/
      base.py              Agent contract + registry
      backends.py          MockBackend / LiveBackend
      discovery.py         A1–A8   setup and understanding the estate
      engineering.py       A9–A13  design and build
      assurance.py         A14–A18 test, heal, prove, release
    graph/
      gates.py             The 9 gates: evidence + blocking rules
      pipeline.py          Sequence derivation, locking, rollback
    mcp/gateway.py         12 servers, allow-list enforcement, audit
    store/
      ledger.py            Hash-chained evidence ledger
      runs.py              Run persistence
    api/routes.py          HTTP surface
    main.py                FastAPI app
  tests/test_pipeline.py   16 tests, mostly guardrails

frontend/
  src/
    api/client.ts          Typed API client
    views/                 AgentView, GateView, GatewayView, MapView
    components/            InputForm, Terminal
    App.tsx                Shell, navigation, progress

infra/sql/                 Postgres + AGE + pgvector schema
```

---

## How the pipeline is assembled

The 27-node sequence is **derived, not hand-written**:

```python
for spec in sorted(all_specs(), key=domain_then_number):
    seq.append(agent_node(spec))
    for gate in GATES_AFTER.get(spec.id, []):
        seq.append(gate_node(gate))
```

Register a new agent and it appears in the pipeline, the sidebar, and the
"who does what" table automatically. Nothing else to update.

---

## The safety properties, and where they live

These are the parts worth reviewing carefully. Each is enforced in code and
covered by a test.

| Property | Where | Test |
|---|---|---|
| An agent cannot run before the prior gate is approved | `Pipeline.is_unlocked` | `test_agent_locked_until_prior_gate_approved` |
| Rejecting a gate discards downstream work | `Pipeline._rewind_to` | `test_rejection_rewinds_and_discards_downstream_work` |
| A derived rule with no citation cannot exist | `BusinessRule` validator + SQL `CHECK` | `test_derived_rule_without_citation_is_rejected` |
| Rules are only promoted to spec at G1 | `Pipeline.decide_gate` | `test_rules_only_approved_at_discovery_gate` |
| An agent cannot reach an undeclared MCP server | `MCPGateway.call` | `test_gateway_rejects_undeclared_server` |
| Deployment tools need an approved release gate | `MCPGateway.call` | `test_gateway_requires_release_gate_for_deployment` |
| Denied tool calls are still logged | `MCPGateway._record` | `test_gateway_logs_denied_calls` |
| Ledger tampering is detectable | `Ledger.verify` | `test_ledger_detects_tampering` |
| Cost ceiling stops the run | `Pipeline.run_agent` | `test_cost_ceiling_halts_the_run` |

Two design decisions that look like omissions but are not:

**Equivalence checking (A17) has no model.** It is a deterministic field
comparison. An LLM must never decide whether two money amounts match — that
answer has to be identical every time and defensible to a regulator.

**Policy (A3) has no model either.** An auditor will ask why a decision was
made. A rules engine answers exactly; a language model does not answer the
same way twice.

---

## Gates that block

A gate can render a warning when the evidence says approving would be unwise.
It still lets a human approve — the gate informs the decision, it does not
replace the decision-maker.

| Gate | Blocks when |
|---|---|
| G1 Discovery | rules were extracted without citations |
| G3 Code baseline | provenance comments were disabled |
| G4 Test acceptance | rule coverage is below 85% |
| G5 Equivalence | any unexplained divergence remains |
| G7 Release | no automatic rollback is armed |

Worth demonstrating: run A17 with no tolerances declared, then open G5.

---

## Adding an agent

```python
# app/agents/engineering.py
from app.agents.base import Agent, AgentSpec, register

@register
class MyAgent(Agent):
    spec = AgentSpec(
        id="A19", domain="C", name="My agent",
        plain="What it does, in language a CEO follows.",
        needs="What it consumes", produces="What it emits",
        mcp=("M1",),           # enforced at call time, not just documentation
        model_tier="medium",
        inputs=({"key": "mode", "type": "select", "label": "Which mode?",
                 "options": [["a", "Option A"], ["b", "Option B"]]},),
    )

    async def run(self, state, params):
        return self._result(
            log=[("ok", "Did the thing")],
            state_patch={"generated": {**state.generated, "mine": True}},
        )
```

That is the whole change. The pipeline, the API, and the UI pick it up.

## Adding an MCP server

Add an entry to `SERVERS` in `app/mcp/gateway.py` with its access level and
tool list, then declare it in the `mcp` tuple of any agent that needs it.
Undeclared access raises `NotAllowed` and is written to the audit log.

To connect a real server, pass a handler:

```python
gateway = MCPGateway(
    allow_list=build_allow_list(),
    handlers={"M1": my_github_mcp_handler},
)
```

---

## API

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/pipeline` | Sequence, domains, counts |
| GET | `/api/mcp` | 12 servers with access levels |
| POST | `/api/runs` | Start a run |
| GET | `/api/runs/{id}` | State, node locks, progress |
| POST | `/api/runs/{id}/agents/{aid}` | Run an agent |
| GET | `/api/runs/{id}/gates/{gid}` | Gate evidence and blocker |
| POST | `/api/runs/{id}/gates/{gid}` | Approve or reject |
| GET | `/api/runs/{id}/ledger` | Evidence chain + verification |
| GET | `/api/runs/{id}/audit` | Every MCP call attempted |

Locks are enforced server-side. A crafted request that tries to skip a gate
gets `409 Conflict`.

---

## What is real and what is not

Honest accounting, because this matters when demoing:

**Real:** the pipeline, gate locking, rollback semantics, MCP allow-list
enforcement, the audit ledger and its verification, cost ceilings, the API,
the UI, the schema, the tests.

**Mocked:** the agent reasoning itself. Agents return shaped, plausible
results derived from your inputs rather than parsing actual COBOL. Set
`FACTORY_BACKEND=live` for real model calls — but note that real parsing
(ProLeap, Roslyn, JavaParser) and real MCP servers are still stubs behind the
gateway.

**Not built yet:** the parsers, the equivalence harness against real binaries,
Postgres-backed persistence (in-memory reference implementations ship
instead), and authentication.

The next piece worth building is the ingestion service — copybook parsing with
`COMP-3`, `OCCURS`, and `REDEFINES` handled properly. That is the part most
likely to eat an MVP timeline, and it is very testable in isolation.
