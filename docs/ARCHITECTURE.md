# Architecture notes

## Why the sequence is derived

Hand-written pipelines drift. The agent list, the UI sidebar, and the docs
each become a separate source of truth and they disagree within a month.
Here the registry is the only source: `build_sequence()` sorts registered
specs by domain and inserts gates from `GATES_AFTER`. Add an agent, and the
pipeline, API and UI all update.

## Why agents never call each other

Every agent reads `FactoryState` and returns a patch. There are no
agent-to-agent messages. That is what makes `_rewind_to` correct — rolling
back means dropping completed agent IDs, with no side channels to unwind.

An event bus would be more elegant and much harder to roll back.

## Trust tiers

An SME says "we waive premium after 10 years". The code says 120 months AND
zero claims. If both are facts of equal standing, you generate wrong code.

| Tier | Source | Rule |
|---|---|---|
| 1 Verifiable | source, DDL, copybooks | hash it, it is ground truth |
| 2 Observed | logs, traces | real but sampled — record the window |
| 3 Derived | AST, extracted rules | must cite tier 1 or 2 |
| 4 Asserted | SME statements, old docs | hypothesis to test, never fact |

Enforced twice: a Pydantic validator on `BusinessRule`, and a SQL `CHECK`
on the `fact` table. Application bugs do not get to bypass it.

## Why two agents have no model

`A17` (equivalence) and `A3` (policy) are deterministic.

Equivalence decides whether two financial outputs match. That answer must be
identical on every run and explainable to a regulator. A language model
cannot promise either.

Policy decides what the factory may do with your data. An auditor will ask
why. A rules engine answers precisely.

Marking these as "agents" in the diagram but implementing them as
deterministic code is deliberate — the governance story stays intact while
the guarantees stay real.

## The MCP gateway

Two checks at call time, not registration time:

1. **Allow-list** — the agent's `spec.mcp` tuple. Undeclared server raises
   `NotAllowed`.
2. **Tool membership** — the tool must be on that server's list. A `READ`
   server cannot be talked into a write.

Plus: deployment tools require gate `G7` to have passed. Denied calls are
logged with the reason, because attempted access is exactly what a security
reviewer wants to see.

## What production would change

| Now | Production |
|---|---|
| In-memory `RunStore` | Postgres via the `run` and `checkpoint` tables |
| In-memory `Ledger` | Postgres `ledger` with the no-update/no-delete rules |
| Stub MCP handlers | Real MCP servers behind the same gateway |
| No auth | OIDC on the API, roles mapped to gate approvers |
| Sequential execution | Parallel fan-out for A4/A5/A8 and per-service A12 |

The interfaces are already shaped for these swaps. `RunStore` and `Ledger`
are single-file replacements.
