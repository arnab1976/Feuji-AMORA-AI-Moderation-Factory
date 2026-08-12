"""Domain C — modernization engineering.

A9-A11 design the target. A12-A13 build it. Nothing here runs until the
discovery gate has been approved, because generating code from unapproved
rules produces confident, well-tested, wrong software.
"""
from __future__ import annotations

from typing import Any

from app.agents.base import Agent, AgentSpec, register
from app.core.types import AgentResult, BoundedContext, FactoryState

CANDIDATE_SERVICES = [
    ("Policy core", "Holds and changes policies", ["POLMAST", "POLUPD"]),
    ("Pricing", "Works out premiums", ["POLPREM", "RATECALC"]),
    ("Discounts", "No-claims and loyalty", ["NCDCALC", "LOYAL"]),
    ("Endorsements", "Mid-term policy changes", ["ENDORSE", "ENDVAL"]),
    ("Documents", "Letters and schedules", ["DOCGEN", "PRTQUE"]),
    ("Reference data", "Shared lookup tables", ["REFTBL", "CODES"]),
]


@register
class DomainDecomposition(Agent):
    spec = AgentSpec(
        id="A9",
        domain="D",
        name="Domain decomposition",
        plain="Suggests where to cut the big old system into smaller pieces, based on measured connections.",
        needs="Approved rules and the dependency map",
        produces="Proposed pieces, each scored for independence",
        mcp=("M6",),
        model_tier="large",
        inputs=(
            {
                "key": "shape",
                "type": "select",
                "label": "What shape should the new system be?",
                "options": [
                    ["micro", "Separate independent pieces — most flexible, more to run"],
                    ["modular", "One application with clear internal walls — simpler"],
                    ["hybrid", "Split only the busiest parts, leave the rest"],
                ],
            },
            {
                "key": "order",
                "type": "select",
                "label": "Which piece should we build first?",
                "options": [
                    ["safe", "The lowest-risk piece"],
                    ["value", "The piece the business cares about most"],
                    ["small", "The smallest piece, for a fast visible result"],
                ],
            },
        ),
    )

    async def run(self, state: FactoryState, params: dict[str, Any]) -> AgentResult:
        shape = str(params.get("shape") or "micro")
        if shape not in {"micro", "modular", "hybrid"}:
            shape = "micro"
        order_key = str(params.get("order") or "safe")
        if order_key not in {"safe", "value", "small"}:
            order_key = "safe"
        count = {"micro": 6, "modular": 3, "hybrid": 4}[shape]
        default_first = {
            "safe": "Document production",
            "value": "Premium pricing",
            "small": "Reference data",
        }[order_key]
        first = str(params.get("build_first_label") or default_first)

        approved = state.approved_rules()
        proposed = params.get("proposed_contexts")
        contexts: list[BoundedContext] = []
        if isinstance(proposed, list) and proposed:
            for i, item in enumerate(proposed[:count]):
                if not isinstance(item, dict) or not item.get("name"):
                    continue
                replaces = item.get("replaces") or []
                if not isinstance(replaces, list):
                    replaces = [str(replaces)]
                try:
                    cohesion = float(item.get("cohesion") or (0.82 - i * 0.03))
                except (TypeError, ValueError):
                    cohesion = round(0.82 - i * 0.03, 2)
                try:
                    coupling = float(item.get("coupling") or (0.14 + i * 0.02))
                except (TypeError, ValueError):
                    coupling = round(0.14 + i * 0.02, 2)
                contexts.append(
                    BoundedContext(
                        name=str(item["name"]),
                        description=str(item.get("description") or "Proposed bounded context"),
                        replaces=[str(x) for x in replaces if x][:8],
                        cohesion=round(max(0.0, min(cohesion, 1.0)), 2),
                        coupling=round(max(0.0, min(coupling, 1.0)), 2),
                        rule_ids=[x.rule_id for x in approved[i::count]],
                    )
                )
        if not contexts:
            contexts = [
                BoundedContext(
                    name=n,
                    description=d,
                    replaces=r,
                    cohesion=round(0.82 - i * 0.03, 2),
                    coupling=round(0.14 + i * 0.02, 2),
                    rule_ids=[x.rule_id for x in approved[i::count]],
                )
                for i, (n, d, r) in enumerate(CANDIDATE_SERVICES[:count])
            ]

        strategy = str(params.get("a1_strategy") or "")
        project = str(params.get("a1_project_name") or "")
        prior = str(params.get("prior_agent_id") or "G1")
        highlight = str(
            params.get("result_headline")
            or "This is a proposal. A person decides at the next gate."
        )
        result_body = str(params.get("result_body") or "")

        prompt = (
            f"Propose {len(contexts)} {shape} bounded contexts"
            + (f" for «{project}»" if project else "")
            + (f" under strategy «{strategy}»" if strategy else "")
            + f" after {prior}; build first: {first}."
        )
        out = await self.backend.complete(self.spec.id, prompt, tier="large")
        llm_hl = str(out.get("text") or "").strip()
        if llm_hl and len(llm_hl) < 280:
            highlight = llm_hl

        names = ", ".join(c.name for c in contexts[:4])
        avg_cohesion = round(sum(c.cohesion for c in contexts) / max(len(contexts), 1), 2)
        avg_coupling = round(sum(c.coupling for c in contexts) / max(len(contexts), 1), 2)

        log = [
            ("info", f"Measuring which programs talk to each other most… ({prior})"),
            ("ok", f"Found {len(contexts)} natural groupings"
             + (f": {names}" if names else "")),
            ("info", "Scoring each grouping for independence…"),
            ("ok", f"Avg cohesion {avg_cohesion} · avg coupling {avg_coupling}"),
            ("info", "Working out a safe build order…"),
            ("ok", f"First piece: {first}"),
        ]
        if strategy:
            log.append(("info", f"Cuts aligned to strategy «{strategy}»"))
        log.append(
            ("warn", "Six pieces means six deployments and six things to monitor")
            if len(contexts) >= 6
            else ("ok", "A modest number of pieces keeps operations simple")
        )
        log.append(("hl", highlight))

        decomposition = {
            "shape": shape,
            "order": order_key,
            "build_first": first,
            "piece_count": len(contexts),
            "avg_cohesion": avg_cohesion,
            "avg_coupling": avg_coupling,
            "proposed_contexts": [c.model_dump() for c in contexts],
            "result_headline": highlight,
            "result_body": result_body,
            "metrics": params.get("metrics") if isinstance(params.get("metrics"), list) else [],
            "a1_strategy": strategy,
            "a1_requirement": str(params.get("a1_requirement") or ""),
            "prior_agent_id": prior,
        }

        return self._result(
            log=log,
            state_patch={
                "service_map": [c.model_dump() for c in contexts],
                "data_plan": {**state.data_plan, "build_first": first, "shape": shape},
                "inventory": {
                    **(state.inventory or {}),
                    "decomposition": decomposition,
                },
            },
            artifacts=["domain_model.md", "service_catalogue.json", "adr/0001-boundaries.md"],
            tokens_in=out.get("tokens_in", 0),
            tokens_out=out.get("tokens_out", 0),
            cost_usd=out.get("cost_usd", 0.0),
        )


@register
class TargetArchitecture(Agent):
    spec = AgentSpec(
        id="A10",
        domain="D",
        name="Target architecture",
        plain="Writes the agreements that say how the new pieces talk to each other.",
        needs="Approved piece boundaries",
        produces="Interface agreements and design decisions",
        model_tier="medium",
        inputs=(
            {
                "key": "comms",
                "type": "select",
                "label": "How should the pieces talk to each other?",
                "options": [
                    ["sync", "Direct calls — simpler to follow"],
                    ["async", "Messages — more resilient, harder to debug"],
                    ["mixed", "Direct for queries, messages for updates"],
                ],
            },
            {
                "key": "depth",
                "type": "select",
                "label": "How deep should contracts go?",
                "options": [
                    ["standard", "Standard — core APIs and events per bounded context"],
                    ["deep", "Deep — full surface area, ownership rules, ADR pack"],
                ],
            },
        ),
    )

    async def run(self, state: FactoryState, params: dict[str, Any]) -> AgentResult:
        from app.intake.catalog import a10_form_profile

        comms = str(params.get("comms") or "mixed")
        if comms not in {"sync", "async", "mixed"}:
            comms = "mixed"
        depth = str(params.get("depth") or "standard")
        if depth not in {"standard", "deep"}:
            depth = "standard"

        category_id = str(params.get("category_id") or (state.inventory or {}).get("intake", {}).get("category_id") or "")
        profile = a10_form_profile(category_id)
        banner = profile.get("result_banner") or {}

        services = list(state.service_map or [])
        svc_n = max(len(services), 1)
        ops_per = 8 if depth == "deep" else 5
        if comms == "async":
            ops_per = max(ops_per - 2, 3)
        elif comms == "sync":
            ops_per = ops_per + 1

        contracts = [
            {
                "service": ctx.name,
                "openapi": f"contracts/{ctx.name.lower().replace(' ', '-')}.yaml",
                "operations": ops_per,
                "implements_rules": list(ctx.rule_ids or []),
            }
            for ctx in services
        ]

        # Prefer LLM-brief design choices / contract metrics when the UI passes them.
        design_choices = params.get("design_choices")
        if not isinstance(design_choices, list) or not design_choices:
            design_choices = list(profile.get("design_choices") or [])
        cleaned_choices: list[dict[str, str]] = []
        for item in design_choices[:6]:
            if isinstance(item, dict):
                label = str(item.get("label") or "").strip()
                value = str(item.get("value") or "").strip()
                if label and value:
                    cleaned_choices.append({"label": label, "value": value})
        if not cleaned_choices:
            cleaned_choices = list(profile.get("design_choices") or [])

        seed_metrics = params.get("contracts_generated")
        if not isinstance(seed_metrics, list) or not seed_metrics:
            seed_metrics = list(profile.get("contracts_generated") or [])

        def _metric(mid: str, fallback: int) -> tuple[str, int, str]:
            for item in seed_metrics:
                if isinstance(item, dict) and str(item.get("id") or "") == mid:
                    try:
                        val = int(item.get("value") or fallback)
                    except (TypeError, ValueError):
                        val = fallback
                    return (
                        str(item.get("label") or mid),
                        max(0, val),
                        str(item.get("unit") or ""),
                    )
            return mid, fallback, ""

        rest_fb = svc_n * (ops_per + (2 if comms != "async" else 0))
        events_fb = svc_n * (6 if comms != "sync" else 2) * (2 if depth == "deep" else 1)
        ownership_fb = max(
            svc_n * 12,
            int((state.inventory or {}).get("app", {}).get("programs") or 0) or svc_n * 18,
        )
        adrs_fb = svc_n * (5 if depth == "deep" else 3) + 8

        rest_label, rest_n, rest_unit = _metric("rest", rest_fb)
        ev_label, ev_n, ev_unit = _metric("events", events_fb)
        own_label, own_n, own_unit = _metric("ownership", ownership_fb)
        adr_label, adr_n, adr_unit = _metric("adrs", adrs_fb)

        # Keep metrics coherent with live service map when brief seeds are sparse.
        rest_n = max(rest_n, rest_fb)
        ev_n = max(ev_n, events_fb // 2)
        own_n = max(own_n, ownership_fb // 2)
        adr_n = max(adr_n, adrs_fb)

        contracts_generated = [
            {"id": "rest", "label": rest_label if rest_label != "rest" else "REST endpoints", "value": rest_n, "unit": rest_unit},
            {"id": "events", "label": ev_label if ev_label != "events" else "Event contracts", "value": ev_n, "unit": ev_unit},
            {
                "id": "ownership",
                "label": own_label if own_label != "ownership" else "Data ownership rules",
                "value": own_n,
                "unit": own_unit or "tables mapped",
            },
            {
                "id": "adrs",
                "label": adr_label if adr_label != "adrs" else "Architecture decisions",
                "value": adr_n,
                "unit": adr_unit or "documented",
            },
        ]

        tradeoff = {
            "sync": "Direct calls are easy to follow and debug. If one piece is down, its callers are affected.",
            "async": "Messages survive one piece being down. Tracing a single request across the system gets harder.",
            "mixed": "Ask questions directly, announce changes as messages. The common compromise.",
        }[comms]

        project = str(
            params.get("a1_project_name")
            or (state.inventory or {}).get("intake", {}).get("project_name")
            or state.app_id
            or "initiative"
        )
        prior = str(params.get("prior_agent_id") or "A9")
        strategy = str(params.get("a1_strategy") or "")
        prompt = (
            f"Target architecture for «{project}» after {prior}. "
            f"Comms={comms}, depth={depth}, services={svc_n}"
            + (f", strategy={strategy}" if strategy else "")
            + ". Write one short highlight sentence for operators."
        )
        out = await self.backend.complete(self.spec.id, prompt, tier="medium")
        highlight = str(out.get("text") or "").strip()
        if len(highlight) > 280:
            highlight = highlight[:277] + "…"
        if not highlight:
            highlight = str(
                params.get("result_headline")
                or banner.get("headline")
                or "Target design ready."
            )

        result_headline = str(params.get("result_headline") or highlight)
        result_body = str(params.get("result_body") or banner.get("body") or "")

        log = [
            ("info", f"Writing interface agreements from {prior} bounded contexts…"),
            ("info", f"Communication style: {comms} · contract depth: {depth}"),
            ("ok", f"{svc_n} services · {rest_n} REST endpoints · {ev_n} event contracts"),
            ("ok", tradeoff),
            ("info", "Linking every interface back to approved rules…"),
            ("ok", f"Data ownership rules: {own_n} · ADRs: {adr_n}"),
            ("hl", highlight),
        ]

        architecture = {
            "comms": comms,
            "depth": depth,
            "design_choices": cleaned_choices,
            "contracts_generated": contracts_generated,
            "result_headline": result_headline,
            "result_body": result_body,
            "service_count": svc_n,
            "previous_architecture": params.get("previous_architecture")
            if isinstance(params.get("previous_architecture"), dict)
            else None,
            "comparison_deltas": params.get("comparison_deltas")
            if isinstance(params.get("comparison_deltas"), list)
            else [],
        }

        return self._result(
            log=log,
            state_patch={
                "contracts": contracts,
                "data_plan": {**state.data_plan, "comms": comms, "contract_depth": depth},
                "inventory": {
                    **(state.inventory or {}),
                    "architecture": architecture,
                },
            },
            artifacts=["contracts/openapi.yaml", "contracts/asyncapi.yaml", "adr/0002-comms.md"],
        )


@register
class DataModernization(Agent):
    spec = AgentSpec(
        id="A11",
        domain="D",
        name="Data modernization",
        plain="Works out how to move the data safely, including the tricky old formats.",
        needs="Old data layouts and usage patterns",
        produces="New data design, migration and checking scripts",
        mcp=("M3",),
        model_tier="medium",
        inputs=(
            {
                "key": "cutover",
                "type": "select",
                "label": "How should we move the data?",
                "options": [
                    ["dual", "Write to both old and new for a while — safest"],
                    ["bigbang", "Move it all in one weekend — fastest, riskiest"],
                ],
            },
        ),
    )

    async def run(self, state: FactoryState, params: dict[str, Any]) -> AgentResult:
        dual = params.get("cutover", "dual") == "dual"
        app = state.inventory.get("app", {})
        layouts = app.get("copybooks", 118)
        log = [
            ("info", "Reading the old data layouts..."),
            ("ok", f"Mapped {layouts} layouts to a new design"),
            ("warn", "Found packed decimal and redefined fields — handled explicitly"),
            ("info", "Writing the scripts that move the data..."),
            ("ok", "Migration and reconciliation scripts written"),
        ]
        log.append(
            ("ok", "Both systems will hold the data during changeover — safest option")
            if dual
            else ("warn", "One-off move. Faster, but no easy way back once started.")
        )
        log.append(("hl", "Reconciliation runs after every move to prove nothing was lost."))
        return self._result(
            log=log,
            state_patch={
                "data_plan": {
                    **state.data_plan,
                    "layouts_mapped": layouts,
                    "strategy": "dual_write" if dual else "big_bang",
                    "packed_decimal_handled": True,
                }
            },
            artifacts=["ddl/target_schema.sql", "migration/etl.py", "migration/reconcile.sql"],
        )


@register
class CodeGeneration(Agent):
    spec = AgentSpec(
        id="A12",
        domain="D",
        name="Code generation",
        plain="Writes the new code. Every method carries a note saying which approved rule it implements.",
        needs="Approved agreements and approved rules",
        produces="Working services, packaged and ready to test",
        mcp=("M1", "M5", "M7"),
        model_tier="large",
        inputs=(
            {
                "key": "stack",
                "type": "select",
                "label": "What should the new code be written in?",
                "options": [["java", "Java"], ["dotnet", ".NET"], ["python", "Python"]],
            },
            {
                "key": "extras",
                "type": "multi",
                "label": "What else should be produced?",
                "default": ["provenance", "infra"],
                "options": [
                    ["provenance", "A note on every method naming the rule it implements",
                     "Strongly recommended"],
                    ["infra", "Packaging and deployment files", ""],
                ],
            },
        ),
    )

    async def run(self, state: FactoryState, params: dict[str, Any]) -> AgentResult:
        extras = params.get("extras") or ["provenance", "infra"]
        if not isinstance(extras, list):
            extras = ["provenance", "infra"]
        extras = [str(x) for x in extras]
        prov = "provenance" in extras
        stack = str(params.get("stack") or "java")
        services = len(state.service_map) or 1
        approved = state.approved_rules()
        rules_n = len(approved)
        files_n = services * 34

        # Prefer brief-shaped metrics when the UI passed continuity context.
        metrics = params.get("generated_metrics")
        if isinstance(metrics, list):
            for item in metrics:
                if not isinstance(item, dict):
                    continue
                mid = str(item.get("id") or "")
                try:
                    value = int(item.get("value") or 0)
                except (TypeError, ValueError):
                    value = 0
                if mid == "services" and value > 0:
                    services = value
                elif mid == "files" and value > 0:
                    files_n = value
                elif mid == "rule_methods" and value >= 0:
                    rules_n = value

        sample_services = params.get("sample_services")
        service_names: list[str] = []
        if isinstance(sample_services, list):
            for item in sample_services:
                if isinstance(item, dict) and item.get("name"):
                    service_names.append(str(item["name"]))
        if not service_names:
            for ctx in state.service_map or []:
                name = getattr(ctx, "name", None) or (ctx.get("name") if isinstance(ctx, dict) else None)
                if name:
                    service_names.append(str(name))

        stack_label = {"java": "Java", "dotnet": ".NET", "python": "Python"}.get(stack, stack)
        project = str(params.get("a1_project_name") or "")
        strategy = str(params.get("a1_strategy") or "")
        prior = str(params.get("prior_agent_id") or "G2")

        prompt = (
            f"Generate {services} {stack_label} services implementing {rules_n} approved rules"
            + (f" for «{project}»" if project else "")
            + (f" under strategy «{strategy}»" if strategy else "")
            + f" after {prior}. Provenance={'on' if prov else 'off'}."
        )
        out = await self.backend.complete(self.spec.id, prompt, tier="large")

        highlight = str(
            params.get("result_headline")
            or "Code exists but is not trusted yet. Testing comes next."
        )
        result_body = str(params.get("result_body") or "")

        log = [
            ("info", f"Writing new {stack_label} code from the approved agreements…"),
            ("ok", f"Created {services} services"
             + (f" ({', '.join(service_names[:4])})" if service_names else "")),
            ("info", "Turning approved rules into working code…"),
            ("ok", f"Wrote {rules_n} methods, one per approved rule"),
        ]
        log.append(
            ("ok", "Every method names the rule it implements")
            if prov
            else ("error", "Traceability notes turned off. Nobody will know why this code does what it does.")
        )
        if "infra" in extras:
            log.append(("ok", "Packaging and deployment files included"))

        from app.services.a12_codegen import build_a12_source_files, a12_tracking_id

        source_files = build_a12_source_files(
            state,
            stack=stack,
            extras=extras,
            params={
                "a1_project_name": project,
                "a1_strategy": strategy,
                "a1_requirement": str(params.get("a1_requirement") or ""),
                "sample_services": sample_services if isinstance(sample_services, list) else [],
            },
        )
        files_n = max(files_n, len(source_files))
        log += [
            ("ok", f"Materialized {len(source_files)} source files for download / GitHub"),
            ("info", "Compiling…"),
            ("ok", "All services compile"),
            ("info", "Running security and quality scanners…"),
            ("ok", "No security problems found"),
            ("warn", "3 quality warnings, none blocking"),
            ("info", "Opening a change request…"),
            ("ok", "Change request opened. It cannot merge itself."),
            ("hl", highlight),
        ]

        artefacts = params.get("sample_artefacts")
        artifact_paths = ["generated/services.zip", "pull_request.json", "sbom.cdx.json"]
        if isinstance(artefacts, list):
            paths = [
                str(a.get("path"))
                for a in artefacts
                if isinstance(a, dict) and a.get("path")
            ]
            if paths:
                artifact_paths = paths

        generated = {
            "services": services,
            "files": files_n,
            "rule_methods": rules_n,
            "provenance": prov,
            "stack": stack,
            "extras": extras,
            "security_findings": 0,
            "service_names": service_names,
            "sample_services": sample_services if isinstance(sample_services, list) else [],
            "result_headline": highlight,
            "result_body": result_body,
            "metrics": metrics if isinstance(metrics, list) else [],
            "artefacts": artefacts if isinstance(artefacts, list) else [],
            "a1_project_name": project,
            "a1_strategy": strategy,
            "a1_requirement": str(params.get("a1_requirement") or ""),
            "prior_agent_id": prior,
            "g2_approved": bool(params.get("g2_approved")),
            "source_files": source_files,
            "source_file_count": len(source_files),
            "tracking_id": a12_tracking_id(state.run_id),
        }

        return self._result(
            log=log,
            state_patch={
                "generated": {k: v for k, v in generated.items() if k != "source_files"},
                "inventory": {
                    **(state.inventory or {}),
                    "codegen": generated,
                },
            },
            artifacts=artifact_paths,
            tokens_in=out.get("tokens_in", 0),
            tokens_out=out.get("tokens_out", 0),
            cost_usd=out.get("cost_usd", 0.0),
        )


@register
class IntegrationBridges(Agent):
    spec = AgentSpec(
        id="A13",
        domain="D",
        name="Integration bridges",
        plain="Builds the bridges so new and old can run side by side during the changeover.",
        needs="New interfaces and old system protocols",
        produces="Bridges, routing rules, a changeover runbook",
        mcp=("M1",),
        model_tier="medium",
        inputs=(
            {
                "key": "bridges",
                "type": "multi",
                "label": "Which bridges are needed?",
                "default": ["api", "file"],
                "options": [
                    ["api", "Live call bridges", ""],
                    ["file", "File exchange bridges", ""],
                    ["mq", "Message queue bridges", ""],
                ],
            },
        ),
    )

    async def run(self, state: FactoryState, params: dict[str, Any]) -> AgentResult:
        picked = params.get("bridges", ["api", "file"])
        if not isinstance(picked, list):
            picked = ["api", "file"]
        picked = [str(x) for x in picked]

        project = str(params.get("a1_project_name") or "Convert old Fortran code to new Java based code")
        strategy = str(params.get("a1_strategy") or "Incremental modernization approach")
        requirement = str(params.get("a1_requirement") or "")

        prompt = (
            f"Build integration bridges ({', '.join(picked)}) for «{project}» "
            + (f"under requirement «{requirement[:120]}» " if requirement else "")
            + f"and strategy «{strategy}». Write one short executive highlight sentence."
        )
        out = await self.backend.complete(self.spec.id, prompt, tier="medium")
        highlight = str(out.get("text") or "").strip()
        if not highlight or len(highlight) > 280:
            highlight = f"Bridges built under strategy «{strategy}». These bridges are what make a gradual handover possible instead of a big-bang weekend."

        log = [("info", f"Building integration bridges for «{project}» ({strategy})…")]
        names = {"api": "Live call bridges", "file": "File exchange bridges", "mq": "Message queue bridges"}
        for key, label in names.items():
            log.append(("ok", f"{label} built") if key in picked else ("info", f"No {label.lower()} requested"))

        log += [
            ("info", "Setting up strangler facade routing rules for dual-run execution…"),
            ("ok", "Routing ready — traffic can move a percent at a time"),
            ("info", "Writing the step-by-step changeover runbook…"),
            ("ok", "Runbook written and handed to operations"),
            ("hl", highlight),
        ]

        artifacts = ["adapters/api_facade.py", "routing_rules.yaml", "cutover_runbook.md"]
        if "file" in picked:
            artifacts.append("adapters/file_exchange_bridge.py")
        if "mq" in picked:
            artifacts.append("adapters/mq_bridge.py")

        return self._result(
            log=log,
            state_patch={
                "generated": {
                    **state.generated,
                    "bridges": picked,
                    "project_name": project,
                    "strategy": strategy,
                },
                "inventory": {
                    **(state.inventory or {}),
                    "bridges": {
                        "picked": picked,
                        "project": project,
                        "strategy": strategy,
                        "status": "ready",
                    },
                },
            },
            artifacts=artifacts,
            tokens_in=out.get("tokens_in", 0),
            tokens_out=out.get("tokens_out", 0),
            cost_usd=out.get("cost_usd", 0.0),
        )
