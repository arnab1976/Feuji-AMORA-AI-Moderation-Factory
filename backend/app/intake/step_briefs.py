"""Per-step briefs and checklists derived from A1 intake + path map.

Agents and human gates share the same context so operators see why a step is
on the path, what to verify, and what the previous selections imply.
"""
from __future__ import annotations

from typing import Any

from app.graph.gates import GATES_BY_ID
from app.intake.catalog import INTAKE_CATEGORIES
from app.intake.path_map import NODE_META

# Baseline operator checks per agent (always shown when the step is on-path).
AGENT_CHECKLISTS: dict[str, list[str]] = {
    "A1": [
        "Confirm the modernization category matches the estate you intend to work on",
        "Confirm the selected trend / requirement reflects the real scope",
        "Confirm strategies and why-modernize are accurate enough to score the path",
    ],
    "A2": [
        "Confirm the primary location / estate pointer is reachable by the factory",
        "Confirm criticality matches business impact of an outage",
        "Confirm regulatory / constraint tags match policy obligations",
        "Confirm this portfolio slice aligns with the A1 category and path map",
    ],
    "A3": [
        "Confirm data-handling / model rules fit the selected category’s sensitivity",
        "Confirm the spend ceiling covers discovery for this path",
        "Confirm secrets / PII handling rules before any code is read",
        "Confirm policy does not conflict with vetoed steps on the path map",
    ],
    "A4": [
        "Confirm repository / library sources match the A1 requirement",
        "Confirm inventory depth is enough for the promoted discovery agents",
        "Confirm dependency map will cover interfaces needed later on the path",
    ],
    "A5": [
        "Confirm analysis depth matches legacy complexity called out in intake",
        "Confirm data-flow focus includes stores implied by strategy / title",
        "Confirm dead-code signals will feed later decommission gates if active",
    ],
    "A6": [
        "Confirm business-rule extraction covers the selected requirement nouns",
        "Confirm citation threshold is high enough for gate G1 review",
        "Confirm SME / docs sources are available when docs agents are on-path",
    ],
    "A7": [
        "Confirm documentation artefacts match the A1 category and requirement",
        "Confirm the knowledge graph will link rules, modules, and tables from prior agents",
        "Confirm publish targets match where operators actually read docs",
        "Confirm knowledge capture covers retirement risk if G8 is active",
    ],
    "A8": [
        "Confirm runtime window covers peak journeys from the requirement",
        "Confirm telemetry sources exist for this category",
        "Confirm dead-journey findings will be reviewed before design",
    ],
    "A9": [
        "Confirm decomposition cuts align with the modernization strategy",
        "Confirm bounded contexts cover the A1 requirement scope",
        "Confirm strangler / slice order is safe for production",
    ],
    "A10": [
        "Confirm target architecture matches strategy (services, APIs, data-first…)",
        "Confirm contracts cover partner / interface needs from intake",
        "Confirm non-functional needs (security, latency) are explicit",
    ],
    "A11": [
        "Confirm data modernization plan matches stores named in intake",
        "Confirm cutover / dual-write approach fits risk appetite",
        "Confirm PII / residency constraints from A3 are respected",
    ],
    "A12": [
        "Confirm generation stack matches the approved target architecture",
        "Confirm every generated unit traces to an approved rule",
        "Confirm provenance is on before G3 approval",
    ],
    "A13": [
        "Confirm bridge types match interfaces in the A1 requirement",
        "Confirm dual-run / facade plan fits the strangler strategy",
        "Confirm partner versioning windows are acceptable",
    ],
    "A14": [
        "Confirm tests are derived from approved rules, not new code alone",
        "Confirm coverage targets match gate G4 expectations",
        "Confirm characterization / parity tests cover critical journeys",
        "Confirm unit / integration / edge kinds match approved rule density",
        "Confirm parity tests exercise dual-run bridges where present",
        "Confirm golden expectations are captured from the legacy system",
        "Confirm this hand-off is ready for failure triage (A15) and G4",
    ],
    "A15": [
        "Confirm failure taxonomy matches observability signals on the path",
        "Confirm triage will not weaken equivalence criteria",
        "Confirm escalations have clear owners",
    ],
    "A16": [
        "Confirm self-heal attempts stay within safe bounds",
        "Confirm tests are never weakened to force green",
        "Confirm healed cases remain auditable for G4",
    ],
    "A17": [
        "Confirm replay volume covers business-critical cases from intake",
        "Confirm tolerances (rounding, timestamps) are explicitly approved",
        "Confirm unexplained diffs will block G5 until resolved",
    ],
    "A18": [
        "Confirm security scan scope covers generated services and bridges",
        "Confirm release stages and rollback triggers are armed",
        "Confirm operations runbook matches the handover plan",
    ],
}

# Baseline human-gate checks (always + intake/path overlays).
GATE_CHECKLISTS: dict[str, list[str]] = {
    "G0": [
        "The business case for this work is clear",
        "Sensitive data classes from Governance & Risk look right",
        "The AI access policy matches how careful we must be",
        "I approve reading this system under these rules",
    ],
    "G1": [
        "I confirm extracted rules match how the business works today",
        "I confirm every rule needing judgement has an owner",
        "I confirm unused-code findings will not surprise production",
        "I confirm documentation and discovery artefacts support these rules",
    ],
    "G2": [
        "I approve the proposed service / domain shape",
        "I approve the build order for this modernization strategy",
        "I confirm interface contracts cover partners named in intake",
        "I confirm Agents A9–A11 on the movement path produced this design",
        "I confirm data strategy matches the A1 requirement",
        "I confirm the target architecture matches A1 strategy",
        "I confirm previous → target architecture deltas are acceptable",
        "I confirm security / auth design for the target has been reviewed",
    ],
    "G3": [
        "I approve merging the generated code for this slice",
        "I confirm the generation stack matches the approved target architecture",
        "I confirm provenance links code to approved rules",
        "I confirm Agents A12–A13 on the movement path produced this code",
        "I confirm bridges / facades are safe for dual-run",
        "I confirm the code matches the A1 requirement and strategy",
        "I confirm no high-severity security findings remain open",
        "I confirm traceability is on so the merge can be audited",
        "I confirm this slice is ready to hand off to test generation",
    ],
    "G4": [
        "I confirm test coverage of approved rules is acceptable",
        "I confirm healed failures were reviewed, not rubber-stamped",
        "I confirm escalated failures have owners before equivalence",
        "I confirm characterization tests protect critical journeys",
    ],
    "G5": [
        "I confirm match rate meets the business bar for go-live risk",
        "I confirm unexplained differences are zero or accepted in writing",
        "I confirm money / ledger totals (if applicable) match exactly",
        "I confirm customers will not see wrong answers from this cutover",
    ],
    "G6": [
        "I confirm no high / critical security findings remain",
        "I confirm dependency and SBOM posture is acceptable",
        "I confirm secrets scanning is clean for release candidates",
        "I confirm security sign-off is independent of business release",
    ],
    "G7": [
        "I approve the staged handover plan",
        "I confirm automatic rollback triggers are armed",
        "I confirm the old system remains ready to take traffic back",
        "I confirm operations has the runbook and on-call path",
    ],
    "G8": [
        "I confirm the new system has been stable under production load",
        "I confirm knowledge / documentation needed after switch-off exists",
        "I confirm business and operations jointly accept turning the old system off",
        "I confirm there is no remaining critical dependency on the legacy estate",
    ],
}


def _cat_name(category_id: str) -> str:
    for c in INTAKE_CATEGORIES:
        if c["id"] == category_id:
            return str(c["name"])
    return category_id or "Legacy estate"


def _intake_context(state_inventory: dict[str, Any], a1_params: dict[str, Any] | None = None) -> dict[str, Any]:
    a1_params = a1_params or {}
    intake = dict(state_inventory.get("intake") or {})
    path_map = dict(state_inventory.get("path_map") or {})
    inputs = dict(path_map.get("inputs") or {})
    selections = intake.get("selections") or a1_params.get("selections") or []
    category_id = (
        str(intake.get("category_id") or "").strip()
        or str(inputs.get("category_id") or "").strip()
        or (str(selections[0].get("category_id")) if selections and isinstance(selections[0], dict) else "")
        or str(a1_params.get("category_id") or "").strip()
    )
    requirement = ""
    if selections and isinstance(selections[0], dict):
        requirement = str(selections[0].get("custom_text") or "")
    requirement = (
        requirement
        or str(inputs.get("requirement") or "")
        or str(a1_params.get("description") or "")
    )
    strategies = intake.get("strategies") or a1_params.get("strategies") or inputs.get("strategies") or []
    if not isinstance(strategies, list):
        strategies = []
    return {
        "category_id": category_id,
        "category_name": str(inputs.get("category_name") or _cat_name(category_id)),
        "project_name": str(
            intake.get("project_name")
            or inputs.get("title")
            or a1_params.get("project_name")
            or ""
        ),
        "requirement": requirement,
        "strategies": [str(s) for s in strategies],
        "strategy_short": str(
            intake.get("strategy_short") or inputs.get("strategy") or a1_params.get("strategy_short") or ""
        ),
        "why_modernize": str(
            intake.get("why_modernize")
            or inputs.get("description")
            or a1_params.get("why_modernize")
            or ""
        ),
        "path_map": path_map,
        "active_ids": list(path_map.get("active_ids") or []),
        "vetoed_ids": list(path_map.get("vetoed_ids") or []),
        "eligible_ids": list(path_map.get("eligible_ids") or []),
        "next_after_a1": str(path_map.get("next_after_a1") or "A2"),
    }


def _path_status(step_id: str, ctx: dict[str, Any]) -> str:
    if step_id in ctx["vetoed_ids"]:
        return "vetoed"
    if step_id in ctx["active_ids"]:
        return "active"
    if step_id in ctx["eligible_ids"]:
        return "eligible"
    # No map yet — treat as active so the factory can still run.
    if not ctx["active_ids"] and not ctx["vetoed_ids"]:
        return "active"
    return "eligible"


def _overlay_checks(step_id: str, kind: str, ctx: dict[str, Any]) -> list[str]:
    """Extra checklist items derived from A1 + path map combination."""
    extras: list[str] = []
    cat = ctx["category_name"] or ctx["category_id"] or "selected category"
    req = (ctx["requirement"] or "").strip()
    strat = ctx["strategy_short"] or (", ".join(ctx["strategies"][:2]) if ctx["strategies"] else "")
    project = ctx["project_name"] or "this initiative"

    extras.append(f"Confirm this step still belongs on the path for «{cat}»")
    if req:
        extras.append(f"Confirm scope still matches the A1 requirement: «{req[:120]}{'…' if len(req) > 120 else ''}»")
    if strat:
        extras.append(f"Confirm the modernization strategy still applies: «{strat[:100]}»")
    if project:
        extras.append(f"Confirm work remains under project «{project}»")

    # Path-map combination cues
    active = set(ctx["active_ids"])
    vetoed = set(ctx["vetoed_ids"])
    if kind == "agent":
        if step_id in vetoed:
            extras.append("This agent was vetoed on the map — do not run; skip forward")
        elif step_id not in active and ctx["active_ids"]:
            extras.append("This agent is inactive on the map (below threshold) — skip unless scope changed")
        if "A11" in active and step_id in {"A5", "A10", "G2"}:
            extras.append("Data modernization is on-path — keep schema / cutover evidence ready")
        if "A14" in active and step_id in {"A6", "G1", "G4"}:
            extras.append("Test generation is on-path — protect rule quality for later parity tests")
        if "A8" in vetoed and step_id in {"A4", "A5", "G1"}:
            extras.append("Runtime behaviour is out of scope — rely on static discovery, not prod telemetry")
        if "G8" in active and step_id in {"A7", "A18", "G7"}:
            extras.append("Switch-off gate is on-path — capture retirement / knowledge artefacts now")
    else:
        # Gate-specific overlays from map
        if step_id in vetoed:
            extras.append("This gate was vetoed on the map and should already be skipped")
        if step_id == "G0" and "A4" not in active and "A5" not in active:
            extras.append("Discovery agents are limited on this path — approve scope knowing read depth is narrower")
        if step_id == "G1" and "A7" in active:
            extras.append("Documentation agent is on-path — include docs artefacts in this confirmation")
        if step_id == "G2" and "A11" in active:
            extras.append("Data modernization is on-path — explicitly accept the data cutover approach")
        if step_id == "G3" and "A13" in active:
            extras.append("Integration bridges are on-path — approve facade / dual-run safety")
        if step_id == "G5" and "A17" in active:
            extras.append("Equivalence agent is on-path — do not approve with unexplained diffs")
        if step_id == "G8" and ctx["category_id"] in {"business_docs", "tests", "observability"}:
            extras.append("Category rarely needs full switch-off — re-confirm G8 is intentionally on-path")

    # De-dupe while preserving order
    seen: set[str] = set()
    out: list[str] = []
    for item in extras:
        if item not in seen:
            seen.add(item)
            out.append(item)
    return out


def build_step_brief(
    step_id: str,
    *,
    inventory: dict[str, Any],
    a1_params: dict[str, Any] | None = None,
    agent_spec: dict[str, Any] | None = None,
) -> dict[str, Any]:
    ctx = _intake_context(inventory, a1_params)
    meta = NODE_META.get(step_id) or {}
    kind = str(meta.get("kind") or ("gate" if step_id.startswith("G") else "agent"))
    status = _path_status(step_id, ctx)

    if kind == "gate":
        gate = GATES_BY_ID.get(step_id)
        title = gate.name if gate else str(meta.get("name") or step_id)
        lede = gate.question if gate else "Human approval required before the factory continues."
        why = gate.why if gate else ""
        approvers = gate.approvers if gate else "Named approvers"
        base = list(GATE_CHECKLISTS.get(step_id, [
            "I have reviewed the evidence pack for this gate",
            "I accept responsibility for approving or rejecting this step",
        ]))
    else:
        title = (agent_spec or {}).get("name") or meta.get("name") or step_id
        lede = (agent_spec or {}).get("plain") or f"Run {step_id} for this modernization path."
        why = (agent_spec or {}).get("produces") or ""
        approvers = ""
        base = list(AGENT_CHECKLISTS.get(step_id, [
            "Confirm inputs for this agent match the A1 selections",
            "Confirm this agent is still on the scored path",
            "Confirm outputs will be reviewable at the next human gate",
        ]))

    checklist = base + _overlay_checks(step_id, kind, ctx)
    # Stable ids for the UI
    items = [
        {
            "id": f"{step_id}-c{i+1}",
            "label": label,
            "required": True,
            "source": "baseline" if i < len(base) else "intake_path_map",
        }
        for i, label in enumerate(checklist)
    ]

    return {
        "step_id": step_id,
        "kind": kind,
        "title": title,
        "lede": lede,
        "why": why,
        "approvers": approvers,
        "path_status": status,
        "path_status_label": {
            "active": "Active · on path",
            "eligible": "Inactive · below threshold",
            "vetoed": "Vetoed · out of scope",
        }.get(status, status),
        "context": {
            "category_id": ctx["category_id"],
            "category_name": ctx["category_name"],
            "project_name": ctx["project_name"],
            "requirement": ctx["requirement"],
            "strategy_short": ctx["strategy_short"],
            "strategies": ctx["strategies"],
            "why_modernize": ctx["why_modernize"],
            "active_ids": ctx["active_ids"],
            "vetoed_ids": ctx["vetoed_ids"],
            "eligible_ids": ctx["eligible_ids"],
            "next_after_a1": ctx["next_after_a1"],
        },
        "checklist": items,
        "needs": (agent_spec or {}).get("needs") or "",
        "produces": (agent_spec or {}).get("produces") or why,
        "note": (
            "Checklist items combine the step’s standard controls with your A1 category, "
            "requirement, strategy, and the agent & gate map combination."
        ),
    }
