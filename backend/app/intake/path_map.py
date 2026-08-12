"""Deterministic Agent & Gate path map from A1 intake.

Weights (category outranks everything — veto cannot be overridden):
  Category 50 | Strategy 25 | Title / trend 15 | Description 10

Selection rules:
  - Score every node from category / strategy / title / description
  - Apply minimum-path pruning so each domain keeps a lean, mutually exclusive
    agent list (one domain per agent; cap per domain; category minimums kept)
"""
from __future__ import annotations

from typing import Any

from app.intake.agent_profiles import (
    AGENT_PROFILES,
    DOMAIN_AGENT_CAPS,
    min_agents_for,
)

WEIGHTS = {
    "strategy": 40,
    "description": 30,
    "category": 20,
    "title": 10,
}
ACTIVE_THRESHOLD = 30

MAP_DOMAINS: list[dict[str, str]] = [
    {"key": "A", "name": "Govern & Plan", "purpose": "Setup, portfolio, policy, intake approval"},
    {"key": "B", "name": "Discover", "purpose": "Find and read the estate"},
    {"key": "C", "name": "Comprehend", "purpose": "Rules, docs, discovery approval"},
    {"key": "D", "name": "Design & Build", "purpose": "Architecture and construction"},
    {"key": "E", "name": "Assure", "purpose": "Tests, healing, equivalence"},
    {"key": "F", "name": "Release & Operate", "purpose": "Security, release, decommission"},
]


def _build_node_meta() -> dict[str, dict[str, str]]:
    meta: dict[str, dict[str, str]] = {}
    for nid, profile in AGENT_PROFILES.items():
        meta[nid] = {
            "name": str(profile["name"]),
            "kind": str(profile["kind"]),
            "map_domain": str(profile["map_domain"]),
            "role": str(profile.get("role") or ""),
            "tagline": str(profile.get("tagline") or ""),
            "description": str(profile.get("description") or ""),
            "guardrail": str(profile.get("guardrail") or ""),
        }
    return meta


NODE_META: dict[str, dict[str, str]] = _build_node_meta()
ALL_NODE_IDS = list(NODE_META.keys())

CORE_ALWAYS = {"A1", "A3", "G0", "A10", "A18", "G6", "G7", "G8"}

CATEGORY_PROFILES: dict[str, dict[str, set[str]]] = {
    "legacy_source": {
        "promote": {
            "A1", "A2", "A3", "G0", "A4", "A5", "A6", "A7", "G1",
            "A9", "A10", "A12", "A13", "G2", "G3", "A14", "A16", "A17", "G4", "G5",
            "A18", "G6", "G7",
        },
        "veto": {"A8", "G8"},
    },
    "database": {
        "promote": {
            "A1", "A2", "A3", "G0", "A4", "A5", "A6", "A7", "G1",
            "A9", "A10", "A11", "A12", "G2", "G3", "A14", "A17", "G4", "G5",
            "A18", "G6", "G7",
        },
        "veto": {"A8", "G8"},
    },
    "configuration": {
        "promote": {
            "A1", "A2", "A3", "G0", "A4", "A5", "A7", "G1",
            "A10", "A12", "A13", "G2", "G3", "A14", "A16", "G4",
            "A18", "G6", "G7",
        },
        "veto": {"A8", "A17", "G5", "G8"},
    },
    "interfaces": {
        "promote": {
            "A1", "A2", "A3", "G0", "A4", "A5", "A6", "A7", "G1",
            "A9", "A10", "A13", "G2", "G3", "A14", "A17", "G4", "G5",
            "A18", "G6", "G7",
        },
        "veto": {"A8", "G8"},
    },
    "business_docs": {
        "promote": {
            "A1", "A2", "A3", "G0", "A4", "A6", "A7", "G1",
            "A9", "A10", "G2", "A14", "G4", "A18", "G6", "G7",
        },
        "veto": {"A8", "A11", "A12", "A13", "G3", "A15", "A16", "A17", "G5", "G8"},
    },
    "transactions": {
        "promote": {
            "A1", "A2", "A3", "G0", "A4", "A5", "A8", "A6", "G1",
            "A9", "A10", "A11", "G2", "A14", "A15", "A16", "A17", "G4", "G5",
            "A18", "G6", "G7",
        },
        "veto": {"G8"},
    },
    "observability": {
        "promote": {
            "A1", "A2", "A3", "G0", "A4", "A8", "A7", "G1",
            "A10", "G2", "A14", "A15", "A16", "G4", "A18", "G6", "G7",
        },
        "veto": {"A12", "A13", "G3", "A17", "G5", "G8"},
    },
    "tests": {
        "promote": {
            "A1", "A2", "A3", "G0", "A4", "A5", "A6", "G1",
            "A10", "G2", "A14", "A15", "A16", "A17", "G4", "G5",
            "A18", "G6", "G7",
        },
        "veto": {"A8", "A11", "A12", "A13", "G3", "G8"},
    },
    "defects": {
        "promote": {
            "A1", "A2", "A3", "G0", "A4", "A5", "A6", "G1",
            "A9", "A10", "G2", "A14", "A15", "A16", "G4",
            "A18", "G6", "G7",
        },
        "veto": {"A8", "A12", "A13", "G3", "A17", "G5", "G8"},
    },
    "build_deploy": {
        "promote": {
            "A1", "A2", "A3", "G0", "A4", "A7", "G1",
            "A10", "A12", "A13", "G2", "G3", "A14", "A16", "G4",
            "A18", "G6", "G7", "G8",
        },
        "veto": {"A8", "A17", "G5"},
    },
    "security": {
        "promote": {
            "A1", "A2", "A3", "G0", "A4", "A5", "G1",
            "A10", "G2", "A14", "G4", "A18", "G6", "G7", "G8",
        },
        "veto": {"A8", "A12", "A13", "G3", "A17", "G5"},
    },
    "target_state": {
        "promote": {
            "A1", "A2", "A3", "G0", "A4", "A7", "G1",
            "A9", "A10", "A11", "A12", "A13", "G2", "G3",
            "A14", "A17", "G4", "G5", "A18", "G6", "G7",
        },
        "veto": {"A8", "G8"},
    },
}

STRATEGY_BOOSTS: list[tuple[tuple[str, ...], set[str], int]] = [
    (("strangler", "slice", "parity"), {"A9", "A13", "A14", "A17", "G2", "G5"}, 40),
    (("refactor", "service", "decompose", "microservice", "python", "java", ".net", "modular", "conversion"), {"A9", "A10", "A12", "G2", "G3"}, 40),
    (("api", "facade", "bridge", "integration"), {"A13", "A10", "G2", "G3"}, 40),
    (("data", "schema", "cdc", "migration"), {"A11", "A17", "G2", "G5"}, 40),
    (("platform", "ci", "cd", "devops", "pipeline"), {"A12", "A18", "G6", "G7"}, 40),
    (("compliance", "control", "sox", "pci", "gdpr"), {"A3", "A18", "G0", "G6"}, 40),
    (("test", "equivalence", "parity", "characterization"), {"A14", "A15", "A16", "A17", "G4", "G5"}, 40),
    (("decommission", "retire", "switch-off", "sunset"), {"G8", "A18", "G7"}, 40),
    (("observability", "telemetry", "runtime", "log"), {"A8", "A15", "A16"}, 40),
    (("documentation", "knowledge", "brd", "sop"), {"A6", "A7", "G1"}, 40),
]

TITLE_KEYWORDS: list[tuple[tuple[str, ...], set[str], int]] = [
    (("cobol", "pl/i", "mainframe", "copybook", "pds", "sas", "fortran"), {"A4", "A5", "A6", "A9"}, 10),
    (("policy", "manual", "brd", "sop", "sharepoint", "sme"), {"A6", "A7", "G1"}, 10),
    (("db2", "oracle", "vsam", "schema", "database"), {"A5", "A11", "A17"}, 10),
    (("mq", "soap", "rest", "edi", "kafka"), {"A13", "A8"}, 10),
    (("test", "selenium", "junit", "parity", "golden"), {"A14", "A17", "G4", "G5"}, 10),
    (("splunk", "otel", "smf", "observability"), {"A8", "A15"}, 10),
    (("security", "racf", "vault", "pci", "sox"), {"A3", "A18", "G6"}, 10),
    (("cloud", "kubernetes", "microserv"), {"A10", "A12", "A9"}, 10),
]

DESC_KEYWORDS: list[tuple[tuple[str, ...], set[str], int]] = [
    (("retir", "decommission", "knowledge loss", "sunset"), {"G8", "A7", "A18"}, 30),
    (("risk", "outage", "incident", "p1"), {"A15", "A16", "A3"}, 30),
    (("cost", "budget", "spend"), {"A2", "A3", "G0"}, 30),
    (("compliance", "audit", "regulator"), {"A3", "A18", "G6"}, 30),
    (("speed", "time-to-market", "agile", "maintainability", "scalability", "enhanc"), {"A9", "A12", "A14"}, 30),
    (("parity", "equivalence", "no regression", "convert", "migration", "integration"), {"A14", "A17", "G5"}, 30),
]


def _category_profile(category_id: str) -> dict[str, set[str]]:
    return CATEGORY_PROFILES.get(category_id) or CATEGORY_PROFILES["legacy_source"]


def _match_boosts(
    text: str,
    rules: list[tuple[tuple[str, ...], set[str], int]],
) -> dict[str, tuple[int, str]]:
    low = (text or "").lower()
    hits: dict[str, tuple[int, str]] = {}
    if not low.strip():
        return hits
    for keys, nodes, points in rules:
        matched = [k for k in keys if k in low]
        if not matched:
            continue
        reason = f"Matched «{matched[0]}»"
        for nid in nodes:
            prev = hits.get(nid)
            if not prev or points > prev[0]:
                hits[nid] = (points, reason)
    return hits


def _apply_minimum_path(nodes_out: list[dict[str, Any]], category_id: str) -> list[str]:
    """Keep a lean, domain-exclusive active agent set. Returns pruned agent ids."""
    must = min_agents_for(category_id) | (
        CORE_ALWAYS & {n["id"] for n in nodes_out if n["kind"] == "agent"}
    )
    pruned: list[str] = []

    for domain in MAP_DOMAINS:
        dkey = domain["key"]
        cap = DOMAIN_AGENT_CAPS.get(dkey, 2)
        active_agents = [
            n
            for n in nodes_out
            if n["map_domain"] == dkey and n["kind"] == "agent" and n["status"] == "active"
        ]
        if len(active_agents) <= cap:
            continue

        keep: set[str] = {n["id"] for n in active_agents if n["id"] in must}
        ranked = sorted(
            [n for n in active_agents if n["id"] not in keep],
            key=lambda n: (-int(n["score"]), n["id"]),
        )
        for n in ranked:
            if len(keep) >= cap:
                break
            keep.add(n["id"])

        for n in active_agents:
            if n["id"] in keep:
                continue
            n["status"] = "eligible"
            n["reason"] = (
                (n["reason"] + " ").strip()
                + " Deferred for minimum path — another agent already covers this "
                f"capability in domain {dkey}."
            ).strip()
            pruned.append(n["id"])

    return pruned


def build_path_map(
    *,
    category_id: str,
    category_name: str,
    project_title: str,
    requirement: str,
    strategies: list[str],
    strategy_short: str,
    description: str,
) -> dict[str, Any]:
    cat_profile = _category_profile(category_id)
    promote = set(cat_profile.get("promote") or set()) | CORE_ALWAYS
    veto = set(cat_profile.get("veto") or set()) - CORE_ALWAYS

    strat_text = " ".join([strategy_short or ""] + [str(s) for s in strategies if s])
    title_text = f"{project_title} {requirement}".strip()
    desc_text = description or ""

    strat_hits = _match_boosts(strat_text, STRATEGY_BOOSTS)
    title_hits = _match_boosts(title_text, TITLE_KEYWORDS)
    desc_hits = _match_boosts(desc_text, DESC_KEYWORDS)

    nodes_out: list[dict[str, Any]] = []
    for nid in ALL_NODE_IDS:
        meta = NODE_META[nid]
        parts: dict[str, int] = {
            "category": 0,
            "strategy": 0,
            "title": 0,
            "description": 0,
        }
        reasons: list[str] = []

        if nid in veto:
            status = "vetoed"
            score = 0
            reasons.append(
                f"{category_name or 'This category'}-led modernization does not use this step. "
                "No promotion from strategy, title or description can activate it."
            )
            breakdown = {
                "category": {"points": 0, "note": "Veto — category blocks this step"},
                "strategy": {"points": 0, "note": "Ignored under veto"},
                "title": {"points": 0, "note": "Ignored under veto"},
                "description": {"points": 0, "note": "Ignored under veto"},
            }
        else:
            if nid in promote:
                parts["category"] = WEIGHTS["category"]
                reasons.append(f"Category promotes this step ({category_name or category_id}).")
            else:
                parts["category"] = 0
                reasons.append(
                    "Category allows this step but does not promote it "
                    f"({category_name or category_id})."
                )

            if nid in strat_hits:
                pts, why = strat_hits[nid]
                parts["strategy"] = pts
                reasons.append(f"Strategy: {why}.")
            if nid in title_hits:
                pts, why = title_hits[nid]
                parts["title"] = pts
                reasons.append(f"Title / trend: {why}.")
            if nid in desc_hits:
                pts, why = desc_hits[nid]
                parts["description"] = pts
                reasons.append(f"Description: {why}.")

            score = sum(parts.values())
            status = "active" if score >= ACTIVE_THRESHOLD else "eligible"

            breakdown = {
                "category": {
                    "points": parts["category"],
                    "note": (
                        "Full weight — category promotes"
                        if parts["category"] == WEIGHTS["category"]
                        else "No category promotion"
                    ),
                },
                "strategy": {
                    "points": parts["strategy"],
                    "note": strat_hits[nid][1] if nid in strat_hits else "No strategy keyword match",
                },
                "title": {
                    "points": parts["title"],
                    "note": title_hits[nid][1] if nid in title_hits else "No title/trend keyword match",
                },
                "description": {
                    "points": parts["description"],
                    "note": desc_hits[nid][1] if nid in desc_hits else "No description keyword match",
                },
            }

        nodes_out.append(
            {
                "id": nid,
                "name": meta["name"],
                "kind": meta["kind"],
                "map_domain": meta["map_domain"],
                "role": meta.get("role") or "",
                "tagline": meta.get("tagline") or "",
                "description": meta.get("description") or "",
                "guardrail": meta.get("guardrail") or "",
                "score": score,
                "status": status,
                "breakdown": breakdown,
                "reason": " ".join(reasons),
            }
        )

    for domain in MAP_DOMAINS:
        dkey = domain["key"]
        domain_nodes = [n for n in nodes_out if n["map_domain"] == dkey]
        any_active_agent = any(
            n["kind"] == "agent" and n["status"] == "active" for n in domain_nodes
        )
        if not any_active_agent:
            continue
        for n in domain_nodes:
            if n["kind"] != "gate" or n["status"] == "vetoed":
                continue
            if n["status"] != "active" and n["score"] < ACTIVE_THRESHOLD:
                n["score"] = max(n["score"], ACTIVE_THRESHOLD)
                n["status"] = "active"
                n["reason"] = (
                    (n["reason"] + " ").strip()
                    + " Activated because sibling agents in this domain are on the path."
                ).strip()

    must_agents = min_agents_for(category_id)
    for n in nodes_out:
        if n["kind"] != "agent" or n["id"] not in must_agents:
            continue
        if n["status"] == "vetoed":
            continue
        if n["status"] != "active":
            n["status"] = "active"
            n["score"] = max(int(n["score"]), ACTIVE_THRESHOLD)
            n["reason"] = (
                (n["reason"] + " ").strip()
                + " Forced active — minimum agent required for this intake category."
            ).strip()

    pruned_ids = _apply_minimum_path(nodes_out, category_id)

    for domain in MAP_DOMAINS:
        dkey = domain["key"]
        domain_nodes = [n for n in nodes_out if n["map_domain"] == dkey]
        any_active_agent = any(
            n["kind"] == "agent" and n["status"] == "active" for n in domain_nodes
        )
        for n in domain_nodes:
            if n["kind"] != "gate" or n["status"] == "vetoed":
                continue
            if n["id"] in CORE_ALWAYS:
                if n["status"] != "active":
                    n["status"] = "active"
                    n["score"] = max(int(n["score"]), ACTIVE_THRESHOLD)
                continue
            if not any_active_agent and n["status"] == "active":
                n["status"] = "eligible"
                n["reason"] = (
                    (n["reason"] + " ").strip()
                    + " Inactive — no active agents remain in this domain after minimum-path selection."
                ).strip()

    agents = [n for n in nodes_out if n["kind"] == "agent"]
    gates = [n for n in nodes_out if n["kind"] == "gate"]
    active_agents = [n for n in agents if n["status"] == "active"]
    inactive_agents = [n for n in agents if n["status"] == "eligible"]
    vetoed_agents = [n for n in agents if n["status"] == "vetoed"]
    active_gates = [n for n in gates if n["status"] == "active"]
    eligible = [n["id"] for n in nodes_out if n["status"] == "eligible"]
    vetoed = [n["id"] for n in nodes_out if n["status"] == "vetoed"]
    active_ids = [n["id"] for n in nodes_out if n["status"] == "active"]

    seen_agents: dict[str, str] = {}
    domain_exclusive = True
    for n in agents:
        prev = seen_agents.get(n["id"])
        if prev and prev != n["map_domain"]:
            domain_exclusive = False
        seen_agents[n["id"]] = n["map_domain"]

    domain_coverage = []
    domains_touched = 0
    mapping: list[dict[str, Any]] = []
    for domain in MAP_DOMAINS:
        members = [n for n in nodes_out if n["map_domain"] == domain["key"]]
        active_n = sum(1 for n in members if n["status"] == "active")
        if active_n:
            domains_touched += 1
        domain_coverage.append(
            {
                "key": domain["key"],
                "name": domain["name"],
                "purpose": domain["purpose"],
                "active": active_n,
                "total": len(members),
            }
        )
        mapping.append(
            {
                "key": domain["key"],
                "name": domain["name"],
                "purpose": domain["purpose"],
                "agents": [
                    {
                        "id": n["id"],
                        "name": n["name"],
                        "role": n.get("role"),
                        "tagline": n.get("tagline"),
                        "status": n["status"],
                        "score": n["score"],
                    }
                    for n in members
                    if n["kind"] == "agent"
                ],
                "gates": [
                    {
                        "id": n["id"],
                        "name": n["name"],
                        "role": n.get("role"),
                        "status": n["status"],
                        "score": n["score"],
                    }
                    for n in members
                    if n["kind"] == "gate"
                ],
            }
        )

    pipeline_order = [
        "A1", "A2", "A3", "G0", "A4", "A5", "A6", "A7", "A8", "G1",
        "A9", "A10", "A11", "G2", "A12", "A13", "G3",
        "A14", "A15", "A16", "G4", "A17", "G5",
        "A18", "G6", "G7", "G8",
    ]
    next_after_a1 = next(
        (nid for nid in pipeline_order if nid != "A1" and nid in active_ids),
        "A2",
    )

    weightage = [
        {
            "key": "strategy",
            "label": "Modernization strategy",
            "weight": WEIGHTS["strategy"],
            "value": strategy_short or (strategies[0] if strategies else "(none)"),
            "blurb": "Highest technical authority (40%) — promotes agents matching chosen approach.",
            "technical_rationale": "Highest Technical Authority — Dictates target architecture, microservice boundaries, API contracts, build order, and downstream code & test generation agents.",
        },
        {
            "key": "description",
            "label": "Why modernize / requirement",
            "weight": WEIGHTS["description"],
            "value": description or "(none)",
            "blurb": "High narrative authority (30%) — requirement narrative & business reason keywords.",
            "technical_rationale": "High Narrative & Requirement Authority — Contains specific legacy language details (e.g. SAS to Python), performance targets, maintainability, scalability, and integration requirements.",
        },
        {
            "key": "category",
            "label": "Input category",
            "weight": WEIGHTS["category"],
            "value": category_name or category_id,
            "blurb": "Domain grouping (20%) — enforces category minimums and hard step vetoes.",
            "technical_rationale": "Domain Grouping & Guardrails — Provides high-level domain boundaries and enforces category minimums and hard step vetoes.",
        },
        {
            "key": "title",
            "label": "Title / top-5 trend",
            "weight": WEIGHTS["title"],
            "value": project_title or requirement or "(none)",
            "blurb": "Keyword signals (10%) from project title or selected trend.",
            "technical_rationale": "Keyword Signals — Baseline project naming and selected trend signals.",
        },
    ]

    return {
        "weights": WEIGHTS,
        "weightage": weightage,
        "threshold": ACTIVE_THRESHOLD,
        "inputs": {
            "category_id": category_id,
            "category_name": category_name,
            "category_weight": WEIGHTS["category"],
            "strategy": strategy_short or (strategies[0] if strategies else ""),
            "strategies": strategies,
            "strategy_weight": WEIGHTS["strategy"],
            "title": project_title or requirement,
            "requirement": requirement,
            "title_weight": WEIGHTS["title"],
            "description": description,
            "description_weight": WEIGHTS["description"],
        },
        "domains": MAP_DOMAINS,
        "mapping": mapping,
        "nodes": nodes_out,
        "summary": {
            "agents_active": len(active_agents),
            "agents_inactive": len(inactive_agents),
            "agents_vetoed": len(vetoed_agents),
            "agents_total": len(agents),
            "gates_active": len(active_gates),
            "gates_total": len(gates),
            "domains_touched": domains_touched,
            "domains_total": len(MAP_DOMAINS),
            "eligible_ids": eligible,
            "vetoed_ids": vetoed,
            "active_ids": active_ids,
            "pruned_ids": pruned_ids,
            "next_after_a1": next_after_a1,
            "domain_exclusive": domain_exclusive,
            "minimum_path": True,
        },
        "domain_coverage": domain_coverage,
        "note": (
            "Category outranks the rest — it decides whether a step is possible at all. "
            "The path keeps the minimum agents required for this intake, one exclusive "
            "domain each."
        ),
    }
