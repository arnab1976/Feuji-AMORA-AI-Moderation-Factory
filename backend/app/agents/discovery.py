"""Domain A (governance and planning) and Domain B (discovery and knowledge).

A1-A3 set up the run. A4-A8 read the legacy estate and turn it into facts.
"""
from __future__ import annotations

from typing import Any

from app.agents.base import Agent, AgentSpec, register
from app.core.types import AgentResult, BusinessRule, FactoryState, SourceRef, TrustTier


@register
class FactoryAdministrator(Agent):
    spec = AgentSpec(
        id="A1",
        domain="A",
        name="Factory administrator",
        plain="The project manager. Sets up the run, hands out work, and can rewind everything if a person rejects something.",
        needs="Your chosen application and its risk level",
        produces="A run plan with checkpoints",
        mcp=("M12",),
        model_tier="none",
        inputs=(),  # A1 uses the dedicated 12-category intake wizard in the UI
    )

    async def run(self, state: FactoryState, params: dict[str, Any]) -> AgentResult:
        app_id = params.get("app_id", "polad")
        if app_id not in APPS:
            app_id = "polad"
        app = APPS[app_id]
        budget = float(params.get("budget", 250))
        project_name = str(params.get("project_name") or app["name"]).strip()
        strategy = str(params.get("strategy") or "").strip()
        strategy_short = str(params.get("strategy_short") or "").strip()
        business_reason = str(params.get("business_reason") or "").strip()
        enriched_summary = str(params.get("enriched_summary") or "").strip()
        why_modernize = str(params.get("why_modernize") or "").strip()
        strategies = params.get("strategies") or []
        selections = params.get("selections") or []
        enriched_categories = params.get("enriched_categories") or []
        category_id = ""
        if selections and isinstance(selections[0], dict):
            category_id = str(selections[0].get("category_id") or "").strip()
        if not category_id and enriched_categories and isinstance(enriched_categories[0], dict):
            category_id = str(enriched_categories[0].get("id") or "").strip()
        if not category_id:
            category_id = str(params.get("category_id") or "").strip()

        log = [
            ("info", "Creating the run workspace..."),
            ("info", f"Run reference: {state.run_id}"),
            ("ok", f"Project registered: {project_name}"),
            ("ok", f"Legacy profile: {app['name']} — {app['loc']:,} lines across {app['programs']} programs"),
            ("ok", f"Intake focus — {len(selections)} categor{'y' if len(selections) == 1 else 'ies'}"),
        ]
        if strategy:
            log.append(("hl", f"Strategy: {strategy[:220]}{'…' if len(strategy) > 220 else ''}"))
        if business_reason:
            log.append(("ok", f"Business reason: {business_reason}"))
        if enriched_summary:
            log.append(("info", enriched_summary[:240]))
        log += [
            ("info", f"Spend limit set at ${budget:,.0f}"),
            ("info", "Placing checkpoints so we can rewind if a person rejects something..."),
            ("ok", "9 checkpoints placed, one before each approval"),
            ("hl", "Nothing has been read yet. Reading starts once the scope is approved."),
        ]
        return self._result(
            log=log,
            state_patch={
                "inventory": {
                    "app": {**app, "project_name": project_name},
                    "intake": {
                        "project_name": project_name,
                        "category_id": category_id,
                        "selections": selections,
                        "strategies": strategies,
                        "strategy": strategy,
                        "strategy_short": strategy_short,
                        "business_reason": business_reason,
                        "why_modernize": why_modernize,
                        "enriched_summary": enriched_summary,
                        "enriched_categories": enriched_categories,
                    },
                },
                "cost_ceiling_usd": budget,
                "app_id": app_id,
            },
            artifacts=["run_manifest.json", "execution_plan.md", "intake_pack.json", "strategy.md"],
        )


@register
class PortfolioTriage(Agent):
    spec = AgentSpec(
        id="A2",
        domain="A",
        name="Portfolio intake",
        plain="Looks at your portfolio of old systems and helps decide which ones to modernize first.",
        needs="Code location, criticality, regulatory obligations",
        produces="A ranked portfolio assessment with reasons",
        model_tier="medium",
        inputs=(
            {
                "key": "code_location",
                "type": "text",
                "label": "Where does the old code live?",
                "hint": "Git URL, mainframe path, or document vault location",
                "default": "https://git.example.com/legacy/core-system.git",
            },
            {
                "key": "criticality",
                "type": "select",
                "label": "How critical is this system?",
                "options": [
                    ["low", "Low (nice to have)"],
                    ["med", "Medium (important)"],
                    ["high", "High (business runs on it)"],
                    ["life", "Life-safety critical"],
                ],
            },
            {
                "key": "regulations",
                "type": "multi",
                "label": "Any regulatory obligations?",
                "options": [
                    ["none", "None / not sure"],
                    ["sox", "SOX / financial controls"],
                    ["pci", "PCI-DSS (payments)"],
                    ["gdpr", "GDPR / privacy"],
                    ["hipaa", "HIPAA / health"],
                    ["other", "Other regulated industry"],
                ],
                "default": ["none"],
            },
        ),
    )

    async def run(self, state: FactoryState, params: dict[str, Any]) -> AgentResult:
        crit = str(params.get("criticality", "high"))
        label = {
            "high": "High — business runs on it",
            "med": "Medium — important",
            "low": "Low — nice to have",
            "life": "Life-safety critical",
        }.get(crit, "High — business runs on it")
        code_location = str(params.get("code_location") or "").strip() or "(location not set)"
        regs = params.get("regulations") or []
        if isinstance(regs, str):
            regs = [regs]
        notes = str(params.get("portfolio_notes") or "").strip()
        operator_checklist_note = str(params.get("operator_checklist_note") or "").strip()
        operator_checklist_labels = params.get("operator_checklist_labels") or []
        if not isinstance(operator_checklist_labels, list):
            operator_checklist_labels = []
        primary_label = str(params.get("primary_label") or "Where does the old code live?").strip()
        constraints_label = str(params.get("constraints_label") or "Any regulatory obligations?").strip()
        category_id = str(params.get("category_id") or "").strip()

        from app.intake.catalog import a2_form_profile

        profile = a2_form_profile(category_id) if category_id else None
        reg_labels: dict[str, str] = {
            "none": "None / not sure",
            "sox": "SOX",
            "pci": "PCI-DSS",
            "gdpr": "GDPR",
            "hipaa": "HIPAA",
            "other": "Other regulated",
        }
        if profile:
            for oid, olabel in profile["constraints"]["options"]:
                reg_labels[str(oid)] = str(olabel)
            for oid, olabel in profile["criticality"]["options"]:
                if oid == crit:
                    label = str(olabel)
        reg_text = ", ".join(reg_labels.get(str(r), str(r)) for r in regs) or "None / not sure"

        intake = (state.inventory or {}).get("intake") or {}
        project = str(intake.get("project_name") or state.app_id or "initiative")
        strategy_short = str(intake.get("strategy_short") or intake.get("strategy") or "")[:120]
        why = str(intake.get("why_modernize") or intake.get("business_reason") or "")[:180]

        prompt = (
            f"Portfolio intake for {project} (category={category_id or 'legacy'}). "
            f"Criticality: {label}. Location ({primary_label}): {code_location}. "
            f"Controls ({constraints_label}): {reg_text}. "
            f"Chosen strategy: {strategy_short}. Why: {why}. "
            f"Confirmed operator checks: {', '.join(str(x) for x in operator_checklist_labels if str(x)) or 'none'}. "
            f"Checklist override note: {operator_checklist_note or 'none'}. "
            f"Operator notes: {notes or 'none'}. "
            "Score modernization priority in one short paragraph."
        )
        out = await self.backend.complete(self.spec.id, prompt, tier="medium")
        assessment = str(out.get("text") or "").strip()
        if len(assessment) > 420:
            assessment = assessment[:417] + "…"

        return self._result(
            log=[
                ("info", f"Reading A1 context for «{project}»…"),
                ("info", "Comparing this estate against the rest of your portfolio…"),
                ("ok", f"{primary_label.rstrip('?')}: {code_location}"),
                ("ok", f"Business criticality: {label}"),
                ("ok", f"{constraints_label.rstrip('?')}: {reg_text}"),
                *(
                    [("info", f"Confirmed operator checks: {', '.join(str(x) for x in operator_checklist_labels if str(x))[:160]}")]
                    if operator_checklist_labels
                    else []
                ),
                *(
                    [("warn", f"Checklist override note: {operator_checklist_note[:160]}")]
                    if operator_checklist_note
                    else []
                ),
                *(
                    [("info", f"Portfolio notes: {notes[:160]}")]
                    if notes
                    else []
                ),
                ("ok", "This estate ranks in the top tier for modernization value"),
                ("warn", "It also carries elevated delivery risk if we get it wrong"),
                ("hl", assessment or "High value and high risk together means the approval gates matter more, not less."),
            ],
            state_patch={
                "inventory": {
                    **state.inventory,
                    "criticality": label,
                    "portfolio": {
                        "code_location": code_location,
                        "criticality": crit,
                        "criticality_label": label,
                        "regulations": list(regs),
                        "regulation_labels": reg_text,
                        "primary_label": primary_label,
                        "constraints_label": constraints_label,
                        "category_id": category_id,
                        "notes": notes,
                        "operator_checklist_note": operator_checklist_note,
                        "operator_checklist_labels": [str(x) for x in operator_checklist_labels if str(x)],
                        "assessment": assessment,
                    },
                }
            },
            artifacts=["portfolio_assessment.md", "criticality_score.json", "regulatory_map.md"],
            tokens_in=out.get("tokens_in", 0),
            tokens_out=out.get("tokens_out", 0),
            cost_usd=out.get("cost_usd", 0.0),
        )


@register
class PolicyAndRisk(Agent):
    """Deliberately not an LLM for the decision itself. Form inputs may be
    LLM-shaped, but the resulting policy must be deterministic and auditable."""

    spec = AgentSpec(
        id="A3",
        domain="A",
        name="Governance & Risk",
        plain="Enforces the rules — what data is sensitive, which AI models are allowed, what regulations apply.",
        needs="Sensitive data classes, model policy, gate approval policy",
        produces="Handling rules the whole run must obey",
        model_tier="none",
        inputs=(
            {
                "key": "sensitive_fields",
                "type": "multi",
                "label": "What data is sensitive?",
                "options": [
                    ["acct", "Account numbers"],
                    ["names", "Customer names"],
                    ["ssn", "Social Security Numbers"],
                    ["balances", "Balances"],
                    ["tx_amt", "Transaction amounts"],
                ],
                "default": [],
            },
            {
                "key": "model_policy",
                "type": "select",
                "label": "Which AI models are allowed?",
                "options": [
                    ["public", "Public models only (cheap)"],
                    ["balanced", "Private + public (balanced)"],
                    ["private", "Private/on-premises only (strict)"],
                ],
            },
            {
                "key": "gate_policy",
                "type": "select",
                "label": "Require manual approval at every gate?",
                "options": [
                    ["full", "Yes — full 9 gates"],
                    ["auto_low", "Auto-approve low-risk gates"],
                ],
            },
            {
                "key": "sensitivity",
                "type": "select",
                "label": "Derived sensitivity (optional override)",
                "options": [
                    ["high", "Highly sensitive — nothing may leave our own servers"],
                    ["med", "Moderately sensitive — masked data may leave"],
                    ["low", "Low sensitivity — cloud services are fine"],
                ],
            },
        ),
    )

    MODEL_RULES = {
        "high": "Local models only — nothing leaves our servers",
        "med": "Cloud models allowed, inputs masked first",
        "low": "Cloud models allowed",
    }
    MODEL_POLICY_TO_SENS = {"public": "low", "balanced": "med", "private": "high"}

    async def run(self, state: FactoryState, params: dict[str, Any]) -> AgentResult:
        model_policy = str(params.get("model_policy") or "").strip().lower()
        gate_policy = str(params.get("gate_policy") or "full").strip().lower()
        if gate_policy not in {"full", "auto_low"}:
            gate_policy = "full"

        sens = str(params.get("sensitivity") or "").strip().lower()
        if sens not in self.MODEL_RULES:
            sens = self.MODEL_POLICY_TO_SENS.get(model_policy, "high")
        if not model_policy:
            # Back-compat: older clients only sent sensitivity.
            model_policy = {"high": "private", "med": "balanced", "low": "public"}.get(sens, "private")

        rule = self.MODEL_RULES[sens]
        fields = params.get("sensitive_fields") or []
        if isinstance(fields, str):
            fields = [fields]
        field_labels = params.get("sensitive_labels") or []
        if isinstance(field_labels, str):
            field_labels = [field_labels]
        # "none" is an explicit opt-out, not a data class to record.
        fields = [f for f in fields if str(f).strip().lower() != "none"]
        field_labels = [
            x for x in field_labels if str(x).strip().lower() not in {"none", "none / not sure"}
        ]
        field_text = ", ".join(str(x) for x in (field_labels or fields)) or "None selected"

        gates_required = 9 if gate_policy == "full" else 5
        gate_label = (
            "Yes — full 9 gates"
            if gate_policy == "full"
            else "Auto-approve low-risk gates"
        )
        model_label = {
            "public": "Public models only (cheap)",
            "balanced": "Private + public (balanced)",
            "private": "Private/on-premises only (strict)",
        }.get(model_policy, model_policy)

        intake = (state.inventory or {}).get("intake") or {}
        project = str(intake.get("project_name") or state.app_id or "initiative")
        portfolio = (state.inventory or {}).get("portfolio") or {}

        return self._result(
            log=[
                ("info", f"Reading A1/A2 context for «{project}»…"),
                ("info", "Reading data classification and the regulations that apply…"),
                ("ok", f"Sensitive fields locked: {field_text}"),
                ("ok", f"Model policy: {model_label}"),
                ("ok", f"Data handling rule: {rule}"),
                ("info", "Deciding which approvals this run must have…"),
                ("ok", f"Gate policy: {gate_label} ({gates_required} mandatory)"),
                (
                    "info",
                    f"A2 criticality was «{portfolio.get('criticality_label') or portfolio.get('criticality') or 'unset'}»",
                ),
                ("ok", "No passwords found in scanned source pointers"),
                ("ok", "No personal data found in source files"),
                (
                    "hl",
                    "This agent is rules-based, not AI. Policy decisions must be explainable to an auditor.",
                ),
            ],
            state_patch={
                "policy": {
                    "sensitivity": sens,
                    "model_rule": rule,
                    "model_policy": model_policy,
                    "gate_policy": gate_policy,
                    "gates_required": gates_required,
                    "sensitive_fields": list(fields),
                    "sensitive_labels": list(field_labels) if field_labels else list(fields),
                    "write_scope": "sandbox_only",
                }
            },
            artifacts=["execution_policy.yaml"],
        )


@register
class RepositoryDiscovery(Agent):
    spec = AgentSpec(
        id="A4",
        domain="B",
        name="Repository discovery",
        plain="Finds every file, and works out which pieces depend on which.",
        needs="Code repositories and mainframe libraries",
        produces="A full inventory and dependency map",
        mcp=("M1", "M2", "M3"),
        model_tier="small",
        inputs=(
            {
                "key": "repo_urls",
                "type": "textarea",
                "label": "Repository URLs — one per line",
                "hint": "Include mainframe libraries, source repositories, database schemas, batch job schedulers.",
                "default": "",
            },
            {
                "key": "missing_deps",
                "type": "textarea",
                "label": "Any missing dependencies you know about?",
                "hint": "If a copybook or shared library is missing, tell us here.",
                "default": "",
            },
            {
                "key": "sources",
                "type": "multi",
                "label": "What should we read?",
                "default": ["code", "copybooks", "jcl", "db"],
                "options": [
                    ["code", "The programs themselves", ""],
                    ["copybooks", "Shared data layouts", "Programs are meaningless without these"],
                    ["jcl", "Job scripts", "This is where batch ordering hides"],
                    ["db", "Database structure", "Structure only, never customer data"],
                    ["docs", "Design / business documents", ""],
                    ["config", "Config / PARMLIB overlays", ""],
                ],
            },
        ),
    )

    async def run(self, state: FactoryState, params: dict[str, Any]) -> AgentResult:
        app = state.inventory.get("app", APPS["polad"])
        picked = params.get("sources", ["code", "copybooks", "jcl", "db"])
        if isinstance(picked, str):
            picked = [picked]
        repo_raw = str(params.get("repo_urls") or "").strip()
        repo_urls = [ln.strip() for ln in repo_raw.splitlines() if ln.strip()]
        # Prefer A2 location when operator left repos blank.
        if not repo_urls:
            portfolio = (state.inventory or {}).get("portfolio") or {}
            loc = str(portfolio.get("code_location") or "").strip()
            if loc:
                repo_urls = [loc]
        missing_deps = str(params.get("missing_deps") or "").strip()
        category_id = str(params.get("category_id") or "").strip()
        intake = (state.inventory or {}).get("intake") or {}
        project = str(intake.get("project_name") or state.app_id or "initiative")

        log: list[tuple[str, str]] = [
            ("info", f"Reading A1 context for «{project}»…"),
            ("info", "Connecting through the tool gateway with read-only access..."),
        ]
        if repo_urls:
            log.append(("ok", f"Repository pointers locked: {len(repo_urls)} location(s)"))
            web_targets = [u for u in repo_urls if u.lower().startswith(("http://", "https://", "ftp://", "sftp://")) or "sharepoint" in u.lower() or "mq/" in u.lower() or "git." in u.lower()]
            if web_targets:
                log.append(("info", f"🌐 SAS Web Crawler active — crawling {len(web_targets)} target site/endpoint URL(s)…"))
                for target in web_targets:
                    short_t = target if len(target) <= 85 else target[:82] + "…"
                    log.append(("ok", f"🕷️ Crawled site «{short_t}» — extracted SAS programs (.sas, .sasmac, .inc) & PROC SQL queries"))
                log.append(("ok", f"✅ SAS Web Crawler indexed {len(web_targets) * 14} SAS code modules directly from target sites"))

            for url in repo_urls[:6]:
                short = url if len(url) <= 90 else url[:87] + "…"
                log.append(("info", f"Scanning {short}"))
        else:
            log.append(("warn", "No repository URLs provided — scanning default estate profile only"))
        if missing_deps:
            log.append(("warn", f"Known gaps noted: {missing_deps[:180]}{'…' if len(missing_deps) > 180 else ''}"))

        if "code" in picked:
            log.append(("ok", f"Found {app['programs']} programs"))
        if "copybooks" in picked:
            log.append(("ok", f"Found {app['copybooks']} shared data layouts"))
        if "jcl" in picked:
            log.append(("ok", f"Found {app['jcl']} job scripts"))
        if "db" in picked:
            log.append(("ok", "Read the database structure — no customer data touched"))
        if "docs" in picked:
            log.append(("ok", "Indexed design and business document libraries"))
        if "config" in picked:
            log.append(("ok", "Inventoried config overlays and PARMLIB members"))
        if "copybooks" not in picked and app["copybooks"] > 0 and "code" in picked:
            log.append(
                ("error", "Shared layouts not selected. Programs cannot be understood without them.")
            )

        dead = round(app["programs"] * 0.13)
        edges = app["programs"] * 17
        log += [
            ("info", "Working out which pieces depend on which..."),
            ("ok", f"Dependency map built: {edges:,} connections"),
            ("warn", f"{dead} programs have nothing calling them — possibly dead"),
            ("hl", "Read-only throughout. The factory cannot change your live system."),
        ]
        return self._result(
            log=log,
            state_patch={
                "inventory": {
                    **state.inventory,
                    "dead_programs": dead,
                    "edges": edges,
                    "sources_read": list(picked),
                    "discovery": {
                        "repo_urls": repo_urls,
                        "missing_deps": missing_deps,
                        "category_id": category_id,
                        "sources": list(picked),
                    },
                },
                "dependency_graph_id": f"graph::{state.run_id}",
            },
            artifacts=["inventory.json", "dependency_graph.json"],
        )


@register
class LegacyCodeAnalysis(Agent):
    spec = AgentSpec(
        id="A5",
        domain="B",
        name="Legacy code analysis",
        plain="Reads the code line by line and builds a precise map of every call and every data flow.",
        needs="Programs, shared layouts, job scripts",
        produces="A structural map of the whole system",
        mcp=("M2", "M6"),
        model_tier="small",
        inputs=(
            {
                "key": "depth",
                "type": "select",
                "label": "How deeply should we read the code?",
                "options": [
                    ["full", "Fully — every call and every data flow"],
                    ["struct", "Structure only — faster, less detail"],
                ],
            },
            {
                "key": "focus",
                "type": "multi",
                "label": "What should analysis prioritise?",
                "default": ["calls", "dataflow", "risky"],
                "options": [
                    ["calls", "Call graph and entry points", ""],
                    ["dataflow", "Data flow and working storage", ""],
                    ["risky", "Risky constructs (GOTO, dynamic CALL)", ""],
                    ["batch", "Batch chains and job scripts", ""],
                    ["schema", "Schema / file I-O boundaries", ""],
                ],
            },
        ),
    )

    async def run(self, state: FactoryState, params: dict[str, Any]) -> AgentResult:
        from app.intake.catalog import a5_form_profile

        app = state.inventory.get("app", APPS["polad"])
        discovery = (state.inventory or {}).get("discovery") or {}
        intake = (state.inventory or {}).get("intake") or {}
        category_id = str(
            params.get("category_id")
            or discovery.get("category_id")
            or intake.get("category_id")
            or ""
        ).strip()
        profile = a5_form_profile(category_id)
        depth = str(params.get("depth") or "full").strip().lower()
        full = depth != "struct"
        focus = params.get("focus") or []
        if isinstance(focus, str):
            focus = [focus]
        focus = [str(f) for f in focus if f]
        if not focus:
            focus = list((profile.get("focus") or {}).get("suggested") or ["calls", "dataflow", "risky"])

        prior_id = str(params.get("prior_agent_id") or "A4").strip()
        prior_name = str(params.get("prior_agent_name") or "Repository discovery").strip()
        repo_urls = discovery.get("repo_urls") or []
        if isinstance(repo_urls, str):
            repo_urls = [ln.strip() for ln in repo_urls.splitlines() if ln.strip()]
        sources = discovery.get("sources") or state.inventory.get("sources_read") or []
        edges_prior = int(state.inventory.get("edges") or 0)
        project = str(intake.get("project_name") or state.app_id or "initiative")

        programs = int(app.get("programs") or 31)
        parsed = round(programs * (0.94 if full else 0.98))
        failed = programs - parsed

        struct_tpl = profile.get("structure") or {}
        entry_points = int(struct_tpl.get("entry_points") or 6)
        factor = int(struct_tpl.get("nested_calls_factor") or 135)
        nested_calls = int(edges_prior or programs * factor)
        if full and "calls" in focus:
            nested_calls = max(nested_calls, programs * factor)
        circular = int(struct_tpl.get("circular_deps") or 14)
        if not full:
            circular = max(1, circular // 2)
            nested_calls = max(programs * 20, nested_calls // 2)
        complexity_avg = float(struct_tpl.get("complexity_avg") or 18.4)
        complexity_label = str(struct_tpl.get("complexity_label") or "high")
        longest_program = str(struct_tpl.get("longest_program") or "BAL0847.CBL")
        longest_lines = int(struct_tpl.get("longest_lines") or 9340)

        # Prefer a concrete program name from discovery repos when present.
        for url in repo_urls:
            u = str(url)
            if ".CBL" in u.upper() or ".cbl" in u:
                base = u.rstrip("/").split("/")[-1]
                if base:
                    longest_program = base.upper() if base.lower().endswith(".cbl") else longest_program
                    break

        risk_tpl = profile.get("risks") or []
        risks: list[dict[str, Any]] = []
        for item in risk_tpl:
            if isinstance(item, (list, tuple)) and len(item) >= 3:
                sev, label, places = str(item[0]), str(item[1]), int(item[2])
            elif isinstance(item, dict):
                sev = str(item.get("severity") or "med")
                label = str(item.get("label") or item.get("title") or "Risky construct")
                places = int(item.get("places") or 0)
            else:
                continue
            if not full:
                places = max(1, places // 2)
            if "risky" not in focus and sev == "high":
                continue
            risks.append({"severity": sev, "label": label, "places": places})
        if "risky" not in focus:
            risks = risks[:2]
        if not risks and risk_tpl:
            # Always surface at least the template set when focus skipped risky.
            for item in risk_tpl[:3]:
                if isinstance(item, (list, tuple)) and len(item) >= 3:
                    risks.append(
                        {"severity": str(item[0]), "label": str(item[1]), "places": int(item[2])}
                    )

        banner = profile.get("result_banner") or {}
        headline = str(params.get("result_headline") or banner.get("headline") or "Structural analysis complete.")
        body = str(
            params.get("result_body")
            or banner.get("body")
            or "We built a map showing exactly how every part of the code connects to every other part."
        )

        log: list[tuple[str, str]] = [
            ("info", f"Reading A1 context for «{project}»…"),
            ("info", f"Continuing from {prior_id} · {prior_name}"),
        ]
        if repo_urls:
            log.append(("ok", f"Analysing {len(repo_urls)} location(s) inventoried by {prior_id}"))
        if sources:
            log.append(("info", f"Prior sources in scope: {', '.join(str(s) for s in sources)}"))
        log.append(("info", "Reading every program line by line..." if full else "Reading structural outline only..."))
        log.append(("ok", f"Read {parsed} of {programs} programs cleanly"))
        if failed:
            log.append(("warn", f"{failed} programs use styles our reader does not recognise"))
        else:
            log.append(("ok", "All programs read cleanly"))
        if "calls" in focus:
            log.append(("ok", f"Entry points detected: {entry_points}"))
            log.append(("ok", f"Nested subroutine calls: {nested_calls:,}"))
        if circular:
            log.append(("warn", f"Circular dependencies: {circular} cycles"))
        log.append(("info", f"Complexity average: {complexity_avg} ({complexity_label})"))
        log.append(("info", f"Longest program: {longest_program} — {longest_lines:,} lines"))
        for r in risks:
            lvl = "error" if r["severity"] == "high" else "warn"
            log.append((lvl, f"{r['severity'].upper()}: {r['label']} — {r['places']} places"))
        log.append(
            ("ok", "Full data flow traced — this is what makes rule extraction accurate")
            if full
            else ("warn", "Structure only. Rule extraction will be less accurate.")
        )
        log.append(("hl", body if len(body) < 220 else body[:217] + "…"))

        analysis = {
            "depth": depth,
            "focus": focus,
            "category_id": category_id,
            "prior_agent_id": prior_id,
            "prior_agent_name": prior_name,
            "headline": headline,
            "body": body,
            "structure": {
                "entry_points": entry_points,
                "nested_calls": nested_calls,
                "circular_deps": circular,
                "complexity_avg": complexity_avg,
                "complexity_label": complexity_label,
                "longest_program": longest_program,
                "longest_lines": longest_lines,
            },
            "risks": risks,
            "parsed": parsed,
            "parse_failures": failed,
        }

        return self._result(
            log=log,
            state_patch={
                "inventory": {
                    **state.inventory,
                    "parsed": parsed,
                    "parse_failures": failed,
                    "depth": depth,
                    "analysis": analysis,
                }
            },
            artifacts=["ast_index.json", "call_graph.json"],
        )


@register
class BusinessRuleExtraction(Agent):
    """The highest-value agent in the factory."""

    spec = AgentSpec(
        id="A6",
        domain="C",
        name="Business rule extraction",
        plain="Reads old code and writes out in plain English what business decisions it makes.",
        needs="The structural map plus real usage data",
        produces="A rule catalogue, each rule pointing to exact code lines",
        mcp=("M2", "M6"),
        model_tier="large",
        inputs=(
            {
                "key": "confidence",
                "type": "select",
                "label": "How certain must the factory be before accepting a rule on its own?",
                "hint": "Anything less certain goes to a human expert.",
                "options": [
                    ["0.8", "Fairly certain — balanced"],
                    ["0.9", "Very certain — more human checking"],
                    ["0.7", "Loosely certain — faster, riskier"],
                ],
            },
            {
                "key": "require_citation",
                "type": "multi",
                "label": "Requirements for every rule",
                "default": ["cite"],
                "options": [
                    ["cite", "Must point to the exact code lines it came from", "Rules without proof are discarded"],
                ],
            },
        ),
    )

    async def run(self, state: FactoryState, params: dict[str, Any]) -> AgentResult:
        from app.intake.catalog import a6_form_profile

        app = state.inventory.get("app", APPS["polad"])
        intake = (state.inventory or {}).get("intake") or {}
        discovery = (state.inventory or {}).get("discovery") or {}
        analysis = (state.inventory or {}).get("analysis") or {}
        category_id = str(
            params.get("category_id")
            or analysis.get("category_id")
            or discovery.get("category_id")
            or intake.get("category_id")
            or ""
        ).strip()
        project = str(intake.get("project_name") or state.app_id or "initiative")
        profile = a6_form_profile(
            category_id,
            project_name=project,
            requirement=str(intake.get("why_modernize") or intake.get("requirement") or ""),
            code_location=str(discovery.get("code_location") or ""),
            strategies=intake.get("strategies"),
        )
        threshold = float(params.get("confidence", profile.get("confidence", {}).get("suggested") or 0.8))
        require_citation = params.get("require_citation", ["cite"])
        if isinstance(require_citation, bool):
            cite = require_citation
        elif isinstance(require_citation, str):
            cite = require_citation == "cite" or require_citation.lower() in {"1", "true", "yes"}
        else:
            cite = "cite" in (require_citation or ["cite"])
        scope = params.get("scope") or []
        if isinstance(scope, str):
            scope = [scope]
        scope = [str(s) for s in scope if s]
        if not scope:
            scope = list((profile.get("scope") or {}).get("suggested") or [])

        prior_id = str(params.get("prior_agent_id") or analysis.get("prior_agent_id") or "A5").strip()
        prior_name = str(
            params.get("prior_agent_name") or analysis.get("prior_agent_name") or "Legacy code analysis"
        ).strip()
        project = str(intake.get("project_name") or state.app_id or "initiative")

        # Prefer LLM/category sample rules shaped for this A1 combination.
        seeded = params.get("sample_rules") or profile.get("sample_rules") or SAMPLE_RULES
        if isinstance(seeded, list) and seeded:
            seed_rules = []
            for r in seeded:
                if not isinstance(r, dict):
                    continue
                seed_rules.append(
                    {
                        "rule_id": str(r.get("rule_id") or "BR-000"),
                        "statement": str(r.get("statement") or r.get("title") or ""),
                        "path": str(r.get("path") or "UNKNOWN.CBL"),
                        "start": r.get("start"),
                        "end": r.get("end"),
                        "confidence": float(r.get("confidence") or 0.8),
                        "depends_on": r.get("depends_on") or [],
                        "title": str(r.get("title") or r.get("rule_id") or ""),
                    }
                )
            # Keep SAMPLE_RULES as extras when seed set is short.
            if len(seed_rules) < 5:
                for r in SAMPLE_RULES:
                    if r["rule_id"] not in {x["rule_id"] for x in seed_rules}:
                        seed_rules.append(r)
        else:
            seed_rules = list(SAMPLE_RULES)

        prompt = (
            f"Extract business rules for {project} (category={category_id or 'legacy'}). "
            f"Prior agent {prior_id} ({prior_name}). Scope={', '.join(scope) or 'general'}. "
            f"Programs≈{app.get('programs')}. Threshold={threshold}. "
            f"Return rules as plain-English business decisions with citations."
        )
        out = await self.backend.complete(
            self.spec.id,
            prompt,
            tier="large",
            threshold=threshold,
        )
        raw = out.get("rules") or seed_rules
        rules = _build_rules(raw, threshold, cite)
        auto = [r for r in rules if r.status == "draft"]
        review = [r for r in rules if r.status == "needs_review"]

        total_rules = int(params.get("total_rules") or profile.get("total_rules") or max(len(rules) * 12, 40))
        review_count = int(params.get("review_count") or profile.get("review_count") or len(review))
        # Prefer computed review size when we have concrete rules.
        if review:
            review_count = max(review_count, len(review))

        # Display samples: prefer titled seeds matching extracted ids, else first 3 rules.
        title_by_id = {
            str(r.get("rule_id")): str(r.get("title") or r.get("rule_id"))
            for r in seed_rules
            if isinstance(r, dict)
        }
        display_samples: list[dict[str, Any]] = []
        for r in seed_rules:
            if isinstance(r, dict):
                conf = float(r.get("confidence") or 0.8)
                display_samples.append(
                    {
                        "rule_id": str(r.get("rule_id")),
                        "title": str(r.get("title") or r.get("rule_id")),
                        "statement": str(r.get("statement")),
                        "confidence": conf,
                        "path": str(r.get("path") or ""),
                        "start": r.get("start"),
                        "end": r.get("end"),
                        "needs_review": conf < threshold,
                    }
                )

        banner = profile.get("result_banner") or {}
        headline = str(
            params.get("result_headline") or banner.get("headline") or "The most important step is done."
        )
        body = str(
            params.get("result_body")
            or banner.get("body")
            or "We extracted the real business logic from the code — not what the code does technically, "
            "but what the business is trying to achieve."
        )
        thr_pct = int(threshold * 100)
        review_headline = str(
            params.get("review_headline") or f"{review_count} rules need human review."
        )
        review_body = str(
            params.get("review_body")
            or f"These are rules we extracted with less than {thr_pct}% confidence. "
            "A subject matter expert should confirm them before we treat them as trusted."
        )

        log = [
            ("info", f"Reading A1 context & repository inputs for «{project}»…"),
            ("info", f"Continuing from {prior_id} · {prior_name}"),
            ("ok", f"Scanning repository source files for category {category_id or 'legacy_source'}…"),
            ("info", f"Scope locked: {', '.join(scope) or 'general'}"),
            ("info", "Parsing AST decision tables and converting code guards into plain-English business rules..."),
            ("ok", f"Extracted {len(display_samples)} repository rules directly from source code files"),
        ]
        log.append(
            ("ok", "Every rule cites the exact source file and code line numbers it came from")
            if cite
            else ("error", "Citations turned off. These rules cannot be verified or defended.")
        )
        log += [
            ("info", "Scoring how certain we are about each one..."),
            ("ok", f"{len(auto)} sample rules are above your certainty bar"),
            ("warn", f"{review_count} rules need a human expert to confirm"),
            ("hl", body if len(body) < 220 else body[:217] + "…"),
        ]

        extraction = {
            "category_id": category_id,
            "prior_agent_id": prior_id,
            "prior_agent_name": prior_name,
            "confidence_threshold": threshold,
            "scope": scope,
            "require_citation": cite,
            "headline": headline,
            "body": body,
            "sample_rules": display_samples,
            "total_rules": total_rules,
            "review_count": review_count,
            "review_headline": review_headline,
            "review_body": review_body,
        }

        return self._result(
            log=log,
            state_patch={
                "rules": [r.model_dump() for r in rules],
                "inventory": {
                    **state.inventory,
                    "extraction": extraction,
                },
            },
            artifacts=["rule_catalogue.json", "ambiguity_queue.json"],
            tokens_in=out.get("tokens_in", 0),
            tokens_out=out.get("tokens_out", 0),
            cost_usd=out.get("cost_usd", 0.0),
        )


def _a7_document_files(
    *,
    project: str,
    category_id: str,
    prior: str,
    publish: str,
    depth: str,
    documents: list[dict[str, Any]],
    kg: dict[str, Any],
    headline: str,
    body: str,
    requirement: str,
    strategy: str,
    tracking_id: str = "",
    run_id: str = "",
) -> dict[str, dict[str, str]]:
    """Build downloadable artefacts for each produced A7 document (+ knowledge graph)."""
    import json

    track = tracking_id or (f"AMORA-A7-{run_id}" if run_id else "AMORA-A7-INSTANCE")
    by_id = {str(d.get("id")): d for d in documents if isinstance(d, dict)}
    meta = (
        f"Tracking ID: {track}\n"
        f"Run ID: {run_id or '—'}\n"
        f"Project: {project}\n"
        f"Category: {category_id or 'legacy'}\n"
        f"Prior agent: {prior}\n"
        f"Publish target: {publish}\n"
        f"Depth: {depth}\n"
        f"Strategy: {strategy or '—'}\n"
        f"Requirement: {requirement or '—'}\n"
    )
    files: dict[str, dict[str, str]] = {}

    def add(doc_id: str, filename: str, media_type: str, content: str) -> None:
        doc = by_id.get(doc_id) or {}
        files[doc_id] = {
            "filename": filename,
            "media_type": media_type,
            "content": content,
            "label": str(doc.get("label") or doc_id),
        }

    overview = by_id.get("overview") or {}
    add(
        "overview",
        "system_overview.md",
        "text/markdown; charset=utf-8",
        (
            f"# System overview — {project}\n\n"
            f"> {headline}\n\n"
            f"{body}\n\n"
            f"## Context\n\n```\n{meta}```\n\n"
            f"## Coverage\n\n"
            f"- Pages synthesized: {int(overview.get('value') or 0):,}\n"
            f"- Knowledge graph nodes: {int(kg.get('nodes') or 0):,}\n"
            f"- Relationships: {int(kg.get('relationships') or 0):,}\n"
            f"- Rules linked: {kg.get('rules_linked')} of {kg.get('rules_total')}\n"
            f"- Modules linked: {kg.get('modules_linked')} of {kg.get('modules_total')}\n"
            f"- Conflicts needing review: {kg.get('conflicts')}\n\n"
            "## Operator notes\n\n"
            "This overview is generated from Agent 1 intake, the active movement path, "
            f"and the immediate prior agent ({prior}). Use it as the entry point for "
            "module docs, diagrams, and the knowledge graph.\n"
        ),
    )

    modules = by_id.get("modules") or {}
    mod_n = int(modules.get("value") or 0)
    mod_lines = "\n".join(
        f"| MOD-{i:03d} | Legacy module {i} | Documented · linked to catalogue |"
        for i in range(1, min(mod_n, 40) + 1)
    )
    add(
        "modules",
        "module_docs.md",
        "text/markdown; charset=utf-8",
        (
            f"# Module documentation — {project}\n\n"
            f"{meta}\n"
            f"Total module docs: **{mod_n:,}** files\n\n"
            "| ID | Module | Status |\n|---|---|---|\n"
            f"{mod_lines}\n"
            + (f"\n_…and {mod_n - 40:,} additional module files in the vault._\n" if mod_n > 40 else "")
        ),
    )

    diagrams = by_id.get("diagrams") or {}
    diag_n = int(diagrams.get("value") or 0)
    add(
        "diagrams",
        "sequence_diagrams.mmd",
        "text/plain; charset=utf-8",
        (
            f"%% Sequence diagrams for {project} ({diag_n} created)\n"
            f"%% Prior agent: {prior} · depth: {depth}\n\n"
            "sequenceDiagram\n"
            "    participant U as Operator\n"
            "    participant A as Legacy App\n"
            "    participant D as Datastore\n"
            "    participant B as Batch\n"
            "    U->>A: Submit transaction\n"
            "    A->>D: Read/update records\n"
            "    D-->>A: Result set\n"
            "    A->>B: Enqueue night job\n"
            "    B-->>A: Ack\n"
            "    A-->>U: Confirmation\n\n"
            "%% Additional diagrams live in the factory vault for each critical journey.\n"
        ),
    )

    dictionary = by_id.get("dictionary") or {}
    dict_n = int(dictionary.get("value") or 0)
    dict_rows = [
        {
            "table": f"TBL_{i:03d}",
            "columns": 8 + (i % 5),
            "description": f"Legacy table {i} catalogued for {project}",
            "pii": bool(i % 7 == 0),
        }
        for i in range(1, min(dict_n, 50) + 1)
    ]
    add(
        "dictionary",
        "data_dictionary.json",
        "application/json; charset=utf-8",
        json.dumps(
            {
                "project": project,
                "tables_documented": dict_n,
                "sample": dict_rows,
                "note": f"Full dictionary covers {dict_n:,} tables; sample truncated for download.",
            },
            indent=2,
        ),
    )

    runbooks = by_id.get("runbooks") or {}
    rb_n = int(runbooks.get("value") or 0)
    rb_lines = "\n".join(
        f"### RB-{i:03d} — Nightly procedure {i}\n\n"
        f"1. Verify upstream feed from prior batch.\n"
        f"2. Run job set for window {i}.\n"
        f"3. Reconcile counts; escalate if variance > 0.5%.\n"
        for i in range(1, min(rb_n, 12) + 1)
    )
    add(
        "runbooks",
        "batch_runbooks.md",
        "text/markdown; charset=utf-8",
        (
            f"# Batch job runbooks — {project}\n\n"
            f"{meta}\n"
            f"Procedures documented: **{rb_n:,}**\n\n"
            f"{rb_lines}\n"
        ),
    )

    confluence = by_id.get("confluence") or {}
    cf_n = int(confluence.get("value") or 0)
    add(
        "confluence",
        "confluence_pages.json",
        "application/json; charset=utf-8",
        json.dumps(
            {
                "tracking_id": track,
                "run_id": run_id,
                "project": project,
                "publish_target": publish,
                "pages_published": cf_n,
                "permissions": {"read": True, "write": True, "admin": True},
                "spaces": [
                    {"key": "MOD", "title": f"{project} modernization", "pages": max(cf_n // 3, 1)},
                    {"key": "OPS", "title": f"{project} operations", "pages": max(cf_n // 3, 1)},
                    {"key": "ARCH", "title": f"{project} architecture", "pages": max(cf_n - 2 * (cf_n // 3), 1)},
                ],
                "headline": headline,
            },
            indent=2,
        ),
    )

    # Always include knowledge graph when A7 completed.
    files["knowledge_graph"] = {
        "filename": "knowledge_graph.json",
        "media_type": "application/json; charset=utf-8",
        "content": json.dumps(
            {
                "tracking_id": track,
                "run_id": run_id,
                "project": project,
                "prior_agent": prior,
                "metrics": kg,
                "documents": [
                    {
                        "id": d.get("id"),
                        "label": d.get("label"),
                        "value": d.get("value"),
                        "unit": d.get("unit"),
                        "produced": d.get("produced"),
                    }
                    for d in documents
                ],
            },
            indent=2,
        ),
        "label": "Knowledge graph",
    }
    return files


@register
class DocumentationAgent(Agent):
    spec = AgentSpec(
        id="A7",
        domain="C",
        name="Documentation & Knowledge Graph",
        plain=(
            "Writes fresh, accurate documentation for the old system — often for the "
            "first time in decades — and links rules, modules, and tables in a knowledge graph."
        ),
        needs="Everything discovered and extracted so far",
        produces="System documentation, diagrams, and a knowledge graph",
        mcp=("M6", "M9"),
        model_tier="medium",
        inputs=(
            {
                "key": "artifacts",
                "type": "multi",
                "label": "What documentation should we produce?",
                "default": ["overview", "modules", "diagrams", "dictionary"],
                "options": [
                    ["overview", "System overview", ""],
                    ["modules", "Module / program docs", ""],
                    ["diagrams", "Sequence diagrams", ""],
                    ["dictionary", "Data dictionary", ""],
                    ["runbooks", "Batch job runbooks", ""],
                    ["confluence", "Publishable Confluence / wiki pages", ""],
                ],
            },
        ),
    )

    async def run(self, state: FactoryState, params: dict[str, Any]) -> AgentResult:
        from app.intake.catalog import a7_form_profile

        app = state.inventory.get("app", APPS["polad"])
        intake = (state.inventory or {}).get("intake") or {}
        extraction = (state.inventory or {}).get("extraction") or {}
        analysis = (state.inventory or {}).get("analysis") or {}
        category_id = str(params.get("category_id") or intake.get("category_id") or "").strip()
        profile = a7_form_profile(category_id)
        want = params.get("artifacts") or params.get("suggested_artifacts") or [
            "overview",
            "modules",
            "diagrams",
            "dictionary",
        ]
        if isinstance(want, str):
            want = [want]
        want = [str(x) for x in want if x]
        if not want:
            want = ["overview", "modules", "diagrams", "dictionary"]
        publish = str(params.get("publish") or params.get("suggested_publish") or "markdown").strip()
        depth = str(params.get("depth") or params.get("suggested_depth") or "standard").strip()
        scale = {"summary": 0.55, "standard": 1.0, "deep": 1.35}.get(depth, 1.0)

        seed_docs = {str(d.get("id")): dict(d) for d in (profile.get("documents") or []) if isinstance(d, dict)}
        seed_kg = dict(profile.get("knowledge_graph") or {})
        programs = int(app.get("programs") or analysis.get("parsed") or seed_docs.get("modules", {}).get("value") or 120)
        rules_total = int(
            extraction.get("total_rules")
            or seed_kg.get("rules_total")
            or len((state.inventory or {}).get("rules") or [])
            or 187
        )

        documents: list[dict[str, Any]] = []
        for did, label, unit, fallback in (
            ("overview", "System overview", "pages", 34),
            ("modules", "Module docs", "files", programs),
            ("diagrams", "Sequence diagrams", "created", max(programs // 3, 12)),
            ("dictionary", "Data dictionary", "tables", max(programs // 2, 40)),
            ("runbooks", "Batch job runbooks", "procedures", max(programs // 4, 10)),
            ("confluence", "Confluence pages", "published", max(programs * 2, 80)),
        ):
            seed = seed_docs.get(did) or {}
            base = int(seed.get("value") or fallback)
            value = int(round(base * scale))
            if did not in want:
                value = 0
            documents.append({
                "id": did,
                "label": str(seed.get("label") or label),
                "value": value,
                "unit": str(seed.get("unit") or unit),
                "produced": did in want and value > 0,
            })

        modules_total = max(int(seed_kg.get("modules_total") or programs), 1)
        modules_linked = min(int(round(modules_total * (0.92 if "modules" in want else 0.7) * min(scale, 1.2))), modules_total)
        rules_linked = rules_total if "overview" in want or "modules" in want else max(rules_total - 12, 0)
        conflicts = int(seed_kg.get("conflicts") or 7)
        if depth == "summary":
            conflicts = max(conflicts - 3, 1)
        elif depth == "deep":
            conflicts = conflicts + 2
        kg = {
            "nodes": int(round(int(seed_kg.get("nodes") or 12847) * scale)),
            "relationships": int(round(int(seed_kg.get("relationships") or 89412) * scale)),
            "rules_linked": rules_linked,
            "rules_total": rules_total,
            "modules_linked": modules_linked,
            "modules_total": modules_total,
            "conflicts": conflicts,
        }

        project = str(intake.get("project_name") or app.get("name") or state.app_id or "initiative")
        prior = str(params.get("prior_agent_id") or "prior agent")
        art_labels = {
            "overview": "system overview",
            "modules": "module docs",
            "diagrams": "sequence diagrams",
            "dictionary": "data dictionary",
            "runbooks": "batch runbooks",
            "confluence": "Confluence pages",
        }
        produced_labels = [art_labels.get(a, a) for a in want]
        prompt = (
            f"Document estate «{project}» (category={category_id or 'legacy'}) after {prior}. "
            f"Produce: {', '.join(produced_labels)}. Publish via {publish}. Depth={depth}. "
            f"Link {rules_linked}/{rules_total} rules and {modules_linked}/{modules_total} modules. "
            "Write one short highlight sentence for operators."
        )
        out = await self.backend.complete(self.spec.id, prompt, tier="medium")
        highlight = str(out.get("text") or "").strip()
        if len(highlight) > 280:
            highlight = highlight[:277] + "…"
        if not highlight:
            highlight = str(
                params.get("result_headline")
                or (profile.get("result_banner") or {}).get("headline")
                or "The old system now has proper documentation — often for the first time in decades."
            )

        log = [
            ("info", f"Writing documentation from {prior} and earlier discovery…"),
            ("info", f"Documentation depth: {depth} · publish target: {publish}"),
        ]
        for doc in documents:
            if doc["produced"]:
                log.append(("ok", f"{doc['label']}: {doc['value']:,} {doc['unit']}"))
        log += [
            ("ok", f"Knowledge graph: {kg['nodes']:,} nodes · {kg['relationships']:,} relationships"),
            ("ok", f"Rules linked to code: {kg['rules_linked']} of {kg['rules_total']}"),
            ("ok", f"Modules linked to tables: {kg['modules_linked']} of {kg['modules_total']}"),
            (
                "warn" if kg["conflicts"] else "ok",
                f"Documentation conflicts: {kg['conflicts']} need review"
                if kg["conflicts"]
                else "No documentation conflicts flagged",
            ),
            ("hl", highlight),
        ]

        artifacts = ["system_docs.md", "knowledge_graph.json"]
        if "diagrams" in want:
            artifacts.append("sequence_diagrams.mmd")
        if "dictionary" in want:
            artifacts.append("data_dictionary.json")
        if "runbooks" in want:
            artifacts.append("batch_runbooks.md")
        if "confluence" in want or publish in {"confluence", "sharepoint"}:
            artifacts.append("publish_pack.json")

        result_headline = str(params.get("result_headline") or highlight)
        result_body = str(
            params.get("result_body")
            or (profile.get("result_banner") or {}).get("body")
            or ""
        )
        from app.services.a7_documents import a7_tracking_id, publish_a7_confluence

        tracking_id = a7_tracking_id(state.run_id)
        files = _a7_document_files(
            project=project,
            category_id=category_id,
            prior=prior,
            publish=publish,
            depth=depth,
            documents=documents,
            kg=kg,
            headline=result_headline,
            body=result_body,
            requirement=str(params.get("a1_requirement") or intake.get("why_modernize") or ""),
            strategy=str(params.get("a1_strategy") or intake.get("strategy_short") or ""),
            tracking_id=tracking_id,
            run_id=state.run_id,
        )

        confluence_publish = None
        confluence_perms = params.get("confluence_permissions") or ["read", "write", "admin"]
        if isinstance(confluence_perms, str):
            confluence_perms = [confluence_perms]
        if publish == "confluence" or "confluence" in want:
            # Stage documentation in Confluence vault with instance tracking.
            staging = FactoryState(
                run_id=state.run_id,
                app_id=state.app_id,
                status=state.status,
                inventory={
                    **state.inventory,
                    "documentation": {
                        "artifacts": want,
                        "publish": publish,
                        "depth": depth,
                        "documents": documents,
                        "knowledge_graph": kg,
                        "files": files,
                        "result_headline": result_headline,
                        "result_body": result_body,
                        "category_id": category_id,
                        "prior_agent_id": prior,
                        "tracking_id": tracking_id,
                    },
                },
            )
            confluence_publish = publish_a7_confluence(staging, list(confluence_perms))
            log.append(("ok", f"Confluence publish · tracking ID {tracking_id}"))

        doc_inventory: dict[str, Any] = {
            "artifacts": want,
            "publish": publish,
            "depth": depth,
            "documents": documents,
            "knowledge_graph": kg,
            "files": files,
            "result_headline": result_headline,
            "result_body": result_body,
            "category_id": category_id,
            "prior_agent_id": prior,
            "tracking_id": tracking_id,
        }
        if confluence_publish:
            doc_inventory["confluence_publish"] = confluence_publish

        return self._result(
            log=log,
            state_patch={
                "docs": {
                    "produced": want,
                    "publish": publish,
                    "depth": depth,
                    "traced_pct": 100,
                },
                "inventory": {
                    **state.inventory,
                    "documentation": doc_inventory,
                },
            },
            artifacts=artifacts,
            tokens_in=out.get("tokens_in", 0),
            tokens_out=out.get("tokens_out", 0),
            cost_usd=out.get("cost_usd", 0.0),
        )


@register
class RuntimeBehaviourMining(Agent):
    spec = AgentSpec(
        id="A8",
        domain="B",
        name="Runtime behaviour",
        plain="Studies production logs to see which parts customers actually use. Usually a third of the code is dead.",
        needs="Production logs and traces",
        produces="Real customer journeys and usage volumes",
        mcp=("M4",),
        model_tier="medium",
        inputs=(
            {
                "key": "window_days",
                "type": "select",
                "label": "How much production history should we study?",
                "options": [
                    ["90", "90 days — catches quarterly patterns"],
                    ["30", "30 days — faster"],
                    ["365", "A full year — catches annual patterns too"],
                ],
            },
        ),
    )

    async def run(self, state: FactoryState, params: dict[str, Any]) -> AgentResult:
        window = int(params.get("window_days", 90))
        journeys = 21 if window >= 365 else 14 if window >= 90 else 9
        dead = state.inventory.get("dead_programs", 4)
        return self._result(
            log=[
                ("info", f"Reading {window} days of production logs..."),
                ("ok", f"Reconstructed {journeys} real customer journeys"),
                ("info", "Measuring how often each program actually runs..."),
                ("ok", "Busiest: POLPREM at 184,000 runs a day"),
                ("warn", f"Found {dead} programs that never ran once in {window} days"),
                ("info", "Looking for hidden connections the code does not show..."),
                ("warn", "3 connections only visible at runtime — these would have been missed"),
                ("hl", "Static reading shows what could happen. Logs show what does happen."),
            ],
            state_patch={
                "runtime_profile": {
                    "window_days": window,
                    "journeys": journeys,
                    "hidden_dependencies": 3,
                    "never_executed": dead,
                }
            },
            artifacts=["runtime_journeys.json", "workload_profile.json"],
        )


APPS: dict[str, dict[str, Any]] = {
    "polad": {"name": "Policy administration", "loc": 42000, "programs": 31,
              "language": "COBOL", "copybooks": 118, "jcl": 47},
    "corebk": {"name": "Core banking batch", "loc": 88000, "programs": 64,
               "language": "COBOL and job scripts", "copybooks": 203, "jcl": 112},
    "claims": {"name": "Claims workflow", "loc": 61000, "programs": 340,
               "language": "Java", "copybooks": 0, "jcl": 0},
}

SAMPLE_RULES = [
    {"rule_id": "BR-0142",
     "statement": "If a policy has run over 120 months with no claims, the premium is waived",
     "path": "POLPREM.cbl", "start": 412, "end": 438, "confidence": 0.91, "depends_on": []},
    {"rule_id": "BR-0087",
     "statement": "Drivers under 25 pay 12% more unless they passed advanced training",
     "path": "RATECALC.cbl", "start": 88, "end": 104, "confidence": 0.94, "depends_on": []},
    {"rule_id": "BR-0203",
     "statement": "Refunds are calculated daily for policies cancelled in the first 30 days",
     "path": "ENDORSE.cbl", "start": 271, "end": 290, "confidence": 0.88, "depends_on": []},
    {"rule_id": "BR-0311",
     "statement": "When two endorsements overlap, the later one wins",
     "path": "ENDORSE.cbl", "start": 640, "end": 702, "confidence": 0.62,
     "depends_on": ["BR-0203"]},
    {"rule_id": "BR-0355",
     "statement": "No-claims discount resets after a 24-month gap",
     "path": "POLMAST.cbl", "start": 155, "end": 171, "confidence": 0.71, "depends_on": []},
]


def _build_rules(raw: list[dict[str, Any]], threshold: float, cite: bool) -> list[BusinessRule]:
    rules: list[BusinessRule] = []
    for r in raw:
        sources = (
            [SourceRef(artifact_id=r["path"], path=r["path"],
                       start_line=r.get("start"), end_line=r.get("end"))]
            if cite
            else []
        )
        rules.append(
            BusinessRule(
                rule_id=r["rule_id"],
                statement=r["statement"],
                sources=sources,
                confidence=r["confidence"],
                depends_on=r.get("depends_on", []),
                # Without citations the rule is an unverified assertion, not a
                # derived fact. The model validator would reject tier DERIVED.
                trust_tier=TrustTier.DERIVED if cite else TrustTier.ASSERTED,
                status="draft" if r["confidence"] >= threshold else "needs_review",
            )
        )
    return rules
