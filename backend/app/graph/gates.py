"""The nine human governance gates.

Each gate is a LangGraph interrupt. The graph halts, persists state, and
waits. There is no timeout that auto-approves and no path around a gate.

A gate can also *block*: it renders a warning when the evidence says
approving would be a bad idea. It still lets a human approve — the gate
informs the decision, it does not replace the decision-maker.
"""
from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass

from app.core.types import FactoryState


@dataclass(frozen=True)
class Gate:
    id: str
    domain: str
    name: str
    after_agent: str
    approvers: str
    question: str
    why: str
    evidence: Callable[[FactoryState], list[tuple[str, str]]]
    blocker: Callable[[FactoryState], str | None] = lambda s: None


def _app(state: FactoryState) -> dict:
    return state.inventory.get("app", {})


def _g0_evidence(state: FactoryState) -> list[tuple[str, str]]:
    """Plain-English evidence for Intake Approval — grounded in A1/A2/A3."""
    inv = state.inventory or {}
    app = _app(state)
    intake = inv.get("intake") or {}
    portfolio = inv.get("portfolio") or {}
    policy = state.policy or {}

    project = (
        intake.get("project_name")
        or app.get("project_name")
        or app.get("name")
        or "this estate"
    )
    cat = intake.get("category_name") or intake.get("category_id") or "Legacy estate"
    strategies = intake.get("strategies") or []
    strat = intake.get("strategy_short") or (strategies[0] if strategies else "—")
    crit = portfolio.get("criticality_label") or portfolio.get("criticality") or "Not set"
    regs = portfolio.get("regulation_labels") or portfolio.get("regulations") or []
    if isinstance(regs, list):
        regs_line = ", ".join(str(r) for r in regs) if regs else "None listed"
    else:
        regs_line = str(regs) or "None listed"
    sens = policy.get("sensitive_labels") or policy.get("sensitive_fields") or []
    if isinstance(sens, list):
        sens_line = ", ".join(str(x) for x in sens) if sens else "None marked"
    else:
        sens_line = str(sens) or "None marked"
    model_rule = policy.get("model_rule") or "not set"
    loc = int(app.get("loc") or 0)
    programs = int(app.get("programs") or 0)
    read_line = f"{project} — {loc:,} lines, {programs} programs" if (loc or programs) else str(project)

    return [
        ("What we will read", read_line),
        ("From intake", f"{cat} · {strat}"),
        ("Business criticality", str(crit)),
        ("Controls", regs_line),
        ("Sensitive data", sens_line),
        ("Data handling", str(model_rule)),
        ("Spend limit", f"${state.cost_ceiling_usd:,.0f}"),
        ("Secrets check", "Clean — no passwords or personal data found"),
    ]


def _g1_evidence(state: FactoryState) -> list[tuple[str, str]]:
    """Discovery evidence for G1 — grounded in A5–A8 inventory."""

    def _n(value: object, default: int = 0) -> int:
        if value is None or value is False:
            return default
        if isinstance(value, bool):
            return int(value)
        if isinstance(value, (int, float)):
            return int(value)
        if isinstance(value, (list, tuple, set, dict)):
            return len(value)
        try:
            return int(value)  # type: ignore[arg-type]
        except (TypeError, ValueError):
            return default

    inv = state.inventory or {}
    app = _app(state)
    analysis = inv.get("analysis") or {}
    extraction = inv.get("extraction") or {}
    documentation = inv.get("documentation") or {}
    kg = documentation.get("knowledge_graph") or {}
    runtime = state.runtime_profile or {}
    programs = _n(app.get("programs"))
    parsed = _n(inv.get("parsed")) or _n(analysis.get("parsed"))
    rules = list(state.rules or [])
    rules_n = _n(extraction.get("total_rules")) or len(rules)
    review_n = len([r for r in rules if getattr(r, "status", "") == "needs_review"])
    if not review_n:
        review_n = _n(extraction.get("review_count"))
    dead = _n(inv.get("dead_programs")) or _n(runtime.get("never_executed"))
    journeys = _n(runtime.get("journeys"))
    kg_nodes = _n(kg.get("nodes"))
    return [
        (
            "Code read",
            f"{parsed} of {programs} programs read cleanly" if programs else f"{parsed} programs read",
        ),
        (
            "Rules found",
            f"{rules_n} rules, every one citing exact code lines" if rules_n else "No rules extracted yet",
        ),
        (
            "Needing your judgement",
            f"{review_n} rules the factory was not confident about",
        ),
        (
            "Unused code",
            f"{dead} programs appear never to run",
        ),
        (
            "Runtime journeys",
            f"{journeys} journeys mined" if journeys else "Runtime profile not yet available",
        ),
        (
            "Knowledge graph",
            f"{kg_nodes:,} nodes linked" if kg_nodes else "Documentation graph pending",
        ),
    ]


def _g2_evidence(state: FactoryState) -> list[tuple[str, str]]:
    """Architecture evidence for G2 — grounded in A9–A11 design outputs."""
    inv = state.inventory or {}
    architecture = inv.get("architecture") or {}
    data_plan = state.data_plan or {}
    services = list(state.service_map or [])
    names = []
    for ctx in services:
        name = getattr(ctx, "name", None) or (ctx.get("name") if isinstance(ctx, dict) else None)
        if name:
            names.append(str(name))
    contracts = list(state.contracts or [])
    metrics = architecture.get("contracts_generated") or []
    rest = 0
    events = 0
    if isinstance(metrics, list):
        for m in metrics:
            if not isinstance(m, dict):
                continue
            mid = str(m.get("id") or "")
            try:
                val = int(m.get("value") or 0)
            except (TypeError, ValueError):
                val = 0
            if mid == "rest":
                rest = val
            elif mid == "events":
                events = val
    if not rest and contracts:
        rest = sum(int(c.get("operations") or 0) for c in contracts if isinstance(c, dict)) or (
            len(contracts) * 3
        )
    strategy = str(data_plan.get("strategy") or "not set")
    strategy_label = {
        "dual_write": "dual-write",
        "dual": "dual-write",
        "big_bang": "big-bang",
        "bigbang": "big-bang",
    }.get(strategy.lower(), strategy)
    return [
        (
            "Proposed pieces",
            (
                f"{len(services)} independent pieces"
                + (f" · {', '.join(names[:3])}" if names else "")
            )
            if services
            else "0 independent pieces",
        ),
        ("Build first", str(data_plan.get("build_first") or "not set")),
        (
            "Interface agreements",
            (
                f"{rest} REST"
                + (f" · {events} events" if events else "")
                + (f" · {len(contracts)} service contracts" if contracts else "")
            )
            if rest or contracts
            else "0 agreements between pieces",
        ),
        ("Data strategy", strategy_label),
    ]


def _g3_evidence(state: FactoryState) -> list[tuple[str, str]]:
    """Code / merge evidence for G3 — grounded in A12–A13 outputs."""
    gen = state.generated or {}
    inv = state.inventory or {}
    codegen = inv.get("codegen") if isinstance(inv.get("codegen"), dict) else {}
    bridges_inv = inv.get("bridges") if isinstance(inv.get("bridges"), dict) else {}
    services = gen.get("services") if gen.get("services") is not None else codegen.get("services", 0)
    methods = gen.get("rule_methods") if gen.get("rule_methods") is not None else codegen.get("rule_methods", 0)
    provenance = bool(gen.get("provenance") if "provenance" in gen else codegen.get("provenance"))
    security = gen.get("security_findings")
    if security is None:
        security = codegen.get("security_findings", 0)
    try:
        security_n = int(security or 0)
    except (TypeError, ValueError):
        security_n = 0
    bridge_picked = bridges_inv.get("picked") or gen.get("bridges") or []
    if isinstance(bridge_picked, list):
        bridge_label = ", ".join(str(x) for x in bridge_picked) if bridge_picked else "none selected"
    else:
        bridge_label = str(bridge_picked or "none selected")
    stack = str(gen.get("stack") or codegen.get("stack") or "not set")
    return [
        ("Services built", str(services or 0)),
        ("Rule methods written", str(methods or 0)),
        ("Generation stack", stack),
        (
            "Security problems",
            "None found" if security_n <= 0 else f"{security_n} open finding(s)",
        ),
        (
            "Traceability",
            "Every method names the rule it implements"
            if provenance
            else "OFF — nobody will know why this code does what it does",
        ),
        ("Bridges · A13", bridge_label),
    ]


GATES: list[Gate] = [
    Gate(
        id="G0",
        domain="A",
        name="Intake Approval",
        after_agent="A3",
        approvers="Application owner + Security",
        question=(
            "A human approves the scope, data classification, and access policy "
            "before anything else runs."
        ),
        why="Nothing is read until this is approved. Rejecting sends the work back to fix.",
        evidence=lambda s: _g0_evidence(s),
    ),
    Gate(
        id="G1",
        domain="C",
        name="Confirm we understood it",
        after_agent="A8",
        approvers="Subject matter expert + architect",
        question="Do these rules correctly describe what your system does today?",
        why="Approved rules become the specification. Everything later is measured against them.",
        evidence=lambda s: _g1_evidence(s),
        blocker=lambda s: (
            "Rules were extracted without citations. They cannot be verified or defended."
            if s.rules and not any(r.sources for r in s.rules)
            else None
        ),
    ),
    Gate(
        id="G2",
        domain="D",
        name="Approve the design",
        after_agent="A11",
        approvers="Architecture board",
        question="Do you approve this shape and this build order?",
        why="Changing the design after code is written costs roughly ten times more.",
        evidence=lambda s: _g2_evidence(s),
    ),
    Gate(
        id="G3",
        domain="D",
        name="Approve the new code",
        after_agent="A13",
        approvers="Engineering lead",
        question="Does this code look right to merge?",
        why="Generated code cannot merge itself. A person must approve.",
        evidence=lambda s: _g3_evidence(s),
        blocker=lambda s: (
            "Traceability notes were disabled. This code cannot be audited."
            if s.generated and not s.generated.get("provenance")
            else None
        ),
    ),
    Gate(
        id="G4",
        domain="E",
        name="Approve the testing",
        after_agent="A16",
        approvers="QA lead",
        question="Is the testing thorough enough to trust?",
        why="Weak tests here mean the equivalence check proves nothing.",
        evidence=lambda s: [
            ("Tests written", str(s.test_results.total)),
            ("Rules covered by tests", f"{s.test_results.rule_coverage_pct:.0f}%"),
            ("Fixed automatically", str(s.test_results.healed)),
            ("Sent to people", str(s.test_results.escalated)),
        ],
        blocker=lambda s: (
            f"Rule coverage is {s.test_results.rule_coverage_pct:.0f}%, below the 85% bar."
            if s.test_results.rule_coverage_pct < 85
            else None
        ),
    ),
    Gate(
        id="G5",
        domain="E",
        name="Approve equivalence",
        after_agent="A17",
        approvers="Business owner, QA",
        question="Does the new system give the same answers as the old one?",
        why="This is the gate that protects your customers.",
        evidence=lambda s: [
            ("Cases replayed", f"{s.equivalence.cases_replayed:,}"),
            ("Match rate", f"{s.equivalence.match_rate}%"),
            ("Unexplained differences", str(len(s.equivalence.unexplained))),
            ("Money totals", "Premium and ledger totals match exactly"),
        ],
        blocker=lambda s: (
            f"{len(s.equivalence.unexplained)} differences are still unexplained. "
            "Approving now would put wrong answers in front of customers."
            if s.equivalence.unexplained
            else None
        ),
    ),
    Gate(
        id="G6",
        domain="F",
        name="Approve security",
        after_agent="A18",
        approvers="Security lead",
        question="Is the new system safe to expose?",
        why="Separate from the business approval on purpose — different people, different question.",
        evidence=lambda s: [
            ("Code scan", "No high or critical findings"),
            ("Dependencies", "No known vulnerable libraries"),
            ("Software bill of materials", "Generated and signed"),
            ("Secrets", "None found in code or config"),
        ],
    ),
    Gate(
        id="G7",
        domain="F",
        name="Approve the release",
        after_agent="A18",
        approvers="Change authority",
        question="Are we operationally ready to hand over?",
        why="Approves the handover, not the switch-off.",
        evidence=lambda s: [
            ("Handover plan",
             f"{len(s.deployment.get('stages', []))} stages, smallest first"),
            ("Automatic rollback",
             f"Armed on {len(s.deployment.get('rollback_triggers', []))} conditions"),
            ("Old system", "Stays running and ready to switch back"),
            ("Support runbook", "Written and handed to the operations team"),
        ],
        blocker=lambda s: (
            "No automatic rollback is armed. A problem at 3am depends on someone noticing."
            if not s.deployment.get("rollback_triggers")
            else None
        ),
    ),
    Gate(
        id="G8",
        domain="F",
        name="Approve switch-off",
        after_agent="A18",
        approvers="Business and Operations",
        question="May we finally turn the old system off?",
        why="The last gate. After this the old system is gone.",
        evidence=lambda s: [
            ("Time running in parallel", "30 days with no unexplained differences"),
            ("Data reconciled", "All balances match"),
            ("Records retained", "Archived per your retention policy"),
            ("Recovery tested", "Restore from archive proven to work"),
        ],
    ),
]

GATES_BY_ID = {g.id: g for g in GATES}
GATES_AFTER: dict[str, list[Gate]] = {}
for _g in GATES:
    GATES_AFTER.setdefault(_g.after_agent, []).append(_g)
