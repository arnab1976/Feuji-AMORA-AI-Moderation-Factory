"""LLM-driven intake: trends, strategies, and why-modernize narrative."""
from __future__ import annotations

import json
import re
from typing import Any

from app.agents.backends import get_backend
from app.intake.catalog import INTAKE_CATEGORIES


def _parse_json(text: str) -> Any | None:
    text = (text or "").strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"[\{\[].*[\}\]]", text, re.DOTALL)
        if not match:
            return None
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            return None


def _cat(category_id: str) -> dict[str, Any]:
    return next((c for c in INTAKE_CATEGORIES if c["id"] == category_id), INTAKE_CATEGORIES[0])


def _meta(out: dict[str, Any]) -> dict[str, Any]:
    return {
        "tokens_in": out.get("tokens_in", 0),
        "tokens_out": out.get("tokens_out", 0),
        "cost_usd": out.get("cost_usd", 0.0),
        "model": out.get("model", "unknown"),
    }


def detect_legacy_language(text: str, default: str = "Legacy") -> str:
    blob = (text or "").lower()
    tokens = (
        ("sas", "SAS"),
        ("fortran", "Fortran"),
        ("cobol", "COBOL"),
        ("pl/i", "PL/I"),
        ("pli", "PL/I"),
        ("natural", "Natural"),
        ("rpg", "RPG"),
        ("assembler", "Assembler"),
        ("asm", "Assembler"),
        ("vb6", "VB6"),
        ("visual basic", "VB6"),
        ("pascal", "Pascal"),
        ("delphi", "Delphi"),
        ("c++", "C/C++"),
        ("cpp", "C/C++"),
        ("c", "C"),
        ("java", "Java"),
        ("c#", "C#"),
        (".net", ".NET"),
        ("dotnet", ".NET"),
        ("python", "Python"),
    )
    for tok, label in tokens:
        if re.search(r"\b" + re.escape(tok) + r"\b", blob):
            return label
    return default if default else "Legacy"


def sanitize_brief_outputs(data: Any, legacy_lang: str) -> Any:
    """Recursively sanitize any hardcoded COBOL, Fortran, or copybook references in brief dicts/lists."""
    lang = (legacy_lang or "").strip()
    if not lang or lang.lower() in ("unknown", "legacy"):
        lang = "Legacy"

    def _clean(val: Any) -> Any:
        if isinstance(val, str):
            res = val
            if lang.upper() != "COBOL":
                res = re.sub(r"\bCOBOL monolith\b", f"{lang} monolith", res, flags=re.IGNORECASE)
                res = re.sub(r"\bCOBOL system\b", f"{lang} system", res, flags=re.IGNORECASE)
                res = re.sub(r"\bCOBOL estate\b", f"{lang} estate", res, flags=re.IGNORECASE)
                res = re.sub(r"\bCOBOL codebase\b", f"{lang} codebase", res, flags=re.IGNORECASE)
                res = re.sub(r"\bCOBOL code\b", f"{lang} code", res, flags=re.IGNORECASE)
                res = re.sub(r"\blegacy COBOL\b", f"legacy {lang}", res, flags=re.IGNORECASE)
                res = re.sub(r"\bCOBOL\b", lang, res, flags=re.IGNORECASE)

            if lang.upper() != "FORTRAN":
                res = re.sub(r"\bFortran monolith\b", f"{lang} monolith", res, flags=re.IGNORECASE)
                res = re.sub(r"\bFortran system\b", f"{lang} system", res, flags=re.IGNORECASE)
                res = re.sub(r"\bFortran estate\b", f"{lang} estate", res, flags=re.IGNORECASE)
                res = re.sub(r"\bFortran codebase\b", f"{lang} codebase", res, flags=re.IGNORECASE)
                res = re.sub(r"\bFortran code\b", f"{lang} code", res, flags=re.IGNORECASE)
                res = re.sub(r"\blegacy Fortran\b", f"legacy {lang}", res, flags=re.IGNORECASE)
                res = re.sub(r"\bFortran\b", lang, res, flags=re.IGNORECASE)

            res = re.sub(r"\bcopybooks\b", "schemas", res, flags=re.IGNORECASE)
            res = re.sub(r"\bcopybook\b", "schema", res, flags=re.IGNORECASE)
            return res
        elif isinstance(val, dict):
            return {k: _clean(v) for k, v in val.items()}
        elif isinstance(val, list):
            return [_clean(v) for v in val]
        return val

    return _clean(data)




def _a2_fallback_checklist(
    *,
    category_name: str,
    requirement: str,
    strategy_short: str,
    why_modernize: str,
    primary_label: str,
    constraints_label: str,
) -> list[dict[str, Any]]:
    req = (requirement or "").strip()
    strat = (strategy_short or "").strip()
    why = (why_modernize or "").strip()
    cat = (category_name or "legacy estate").strip()
    combined = f"{cat} {req} {strat} {why}".lower()

    focus = "evidence"
    if any(k in combined for k in ("brd", "document", "sharepoint", "confluence", "policy", "sop")):
        focus = "documents"
    elif any(k in combined for k in ("db2", "oracle", "sql", "schema", "database", "vsam")):
        focus = "data stores"
    elif any(k in combined for k in ("api", "service", "microservice", "integration", "interface")):
        focus = "interfaces"
    elif any(k in combined for k in ("test", "junit", "selenium", "parity", "characterization")):
        focus = "test suites"
    elif any(k in combined for k in ("splunk", "otel", "observability", "telemetry", "runtime")):
        focus = "telemetry"

    prompts = [
        f"Confirm the {primary_label.rstrip('?').lower()} points to the exact {focus} needed for this A1 requirement",
        f"Confirm the selected estate slice is the one most affected by «{req[:100]}{'…' if len(req) > 100 else ''}»"
        if req
        else f"Confirm the selected estate slice is the best portfolio match for «{cat}»",
        f"Confirm the portfolio priority supports the modernization strategy «{strat[:90]}»"
        if strat
        else "Confirm the portfolio priority supports the modernization strategy chosen in A1",
        f"Confirm {constraints_label.rstrip('?').lower()} are the real obligations for this estate, not copied from a nearby system",
    ]
    if why:
        prompts[2] = (
            f"Confirm this estate should move first because it best supports «{why[:110]}{'…' if len(why) > 110 else ''}»"
        )

    items = [
        {"id": f"a2_semantic_{i+1}", "label": label, "required": False, "source": "a1_semantic_fallback"}
        for i, label in enumerate(prompts[:4])
    ]
    items.append({
        "id": "none_of_these",
        "label": "None of these",
        "required": False,
        "source": "manual_override",
    })
    return items


def _a2_checklist_matches_context(
    checklist: list[dict[str, Any]],
    *,
    category_name: str,
    requirement: str,
    strategy_short: str,
    why_modernize: str,
) -> bool:
    text = " ".join(str(item.get("label") or "") for item in checklist).lower()
    source = f"{category_name} {requirement} {strategy_short} {why_modernize}".lower()
    anchor_terms = {
        token
        for token in re.findall(r"[a-z]{4,}", source)
        if token
        not in {
            "this", "that", "with", "from", "into", "your", "have", "will", "must", "work",
            "under", "need", "needs", "using", "used", "application", "modernization", "legacy",
            "system", "strategy", "project", "requirement", "business",
        }
    }
    if not anchor_terms:
        return True
    hits = sum(1 for token in anchor_terms if token in text)
    return hits >= 2


async def generate_trends(category_id: str) -> dict[str, Any]:
    cat = _cat(category_id)
    examples = str(cat.get("examples") or "")
    # Prefer catalog options as deterministic fallback; LLM enriches labels when available.
    fallback = [
        {"id": o["id"], "label": o["label"]}
        for o in cat.get("options", [])[:5]
    ]
    prompt = f"""You are an enterprise modernization strategist (2025–2026 trends).
Category: {cat['name']}
Purpose: {cat['summary']}

Concrete examples the user must recognize for THIS category (include these kinds of nouns):
{examples}

Return ONLY valid JSON:
{{
  "options": [
    {{"id": "snake_case_id", "label": "requirement that names a concrete example (max 22 words)"}}
  ]
}}

Rules:
- Exactly 5 options
- EVERY label must include at least one precise, category-relevant example noun
  (languages, databases, document types, platforms, protocols, products — as fits the category)
- So a business user instantly sees what codebase / database / documents / systems apply
- Still a modernization requirement (what to do), not just a bare technology name
- Feasible for banks/insurers/enterprises with legacy estates
- No markdown, no generic fluff without named examples"""

    backend = get_backend()
    out = await backend.complete("A1-trends", prompt, tier="medium")
    parsed = _parse_json(out.get("text", ""))
    options: list[dict[str, str]] = []
    if isinstance(parsed, dict) and isinstance(parsed.get("options"), list):
        for i, item in enumerate(parsed["options"][:5]):
            if not isinstance(item, dict):
                continue
            oid = str(item.get("id") or f"trend_{i+1}").strip()
            label = str(item.get("label") or "").strip()
            if label:
                options.append({"id": oid, "label": label})
    used_fallback = len(options) < 5 or bool(out.get("error"))
    if used_fallback:
        options = fallback
    meta = _meta(out)
    if used_fallback and out.get("error"):
        meta["model"] = "catalog-fallback"
        meta["warning"] = "LLM unavailable — showing catalog trend options"
    return {
        "category_id": category_id,
        "name": cat["name"],
        "summary": cat["summary"],
        "examples_hint": examples,
        "options": options,
        **meta,
    }


async def generate_strategies(
    project_title: str,
    category_id: str,
    requirement: str = "",
) -> dict[str, Any]:
    cat = _cat(category_id)
    title = project_title.strip() or "Untitled modernization"
    req = (requirement or "").strip()
    fallback = [
        {"id": "strangler", "label": "Strangler-fig slice migration with parity gates", "why": "Limits blast radius while proving equivalence."},
        {"id": "api_facade", "label": "API facade over legacy channels first", "why": "Unlocks new channels without a big-bang rewrite."},
        {"id": "data_first", "label": "Data-model modernization ahead of UI rewrite", "why": "Stabilizes the hardest dependency early."},
        {"id": "platform", "label": "Platform / CI-CD foundation before feature ports", "why": "Makes later slices repeatable and auditable."},
        {"id": "risk_hotspots", "label": "Prioritize defect and change hotspots", "why": "Spend lands where operational risk is highest."},
        {"id": "compliance", "label": "Control-preserving redesign (SOX/PCI/privacy)", "why": "Keeps regulators and auditors onside."},
    ]
    prompt = f"""You are a CIO advisor. Propose modernization strategies that are business-feasible.
Project title: {title}
Focus category: {cat['name']} — {cat['summary']}
Selected requirement / example: {req or "(custom project — no trend example selected)"}

Return ONLY valid JSON:
{{
  "strategies": [
    {{
      "id": "snake_case",
      "label": "strategy name (max 12 words)",
      "why": "one sentence on business feasibility"
    }}
  ]
}}

Rules:
- Exactly 6 strategies
- Multi-select friendly (complementary, not mutually exclusive)
- Practical for regulated enterprises
- No markdown"""

    backend = get_backend()
    out = await backend.complete("A1-strategies", prompt, tier="medium")
    parsed = _parse_json(out.get("text", ""))
    strategies: list[dict[str, str]] = []
    if isinstance(parsed, dict) and isinstance(parsed.get("strategies"), list):
        for i, item in enumerate(parsed["strategies"][:6]):
            if not isinstance(item, dict):
                continue
            label = str(item.get("label") or "").strip()
            if not label:
                continue
            strategies.append(
                {
                    "id": str(item.get("id") or f"strategy_{i+1}"),
                    "label": label,
                    "why": str(item.get("why") or "").strip(),
                }
            )
    used_fallback = len(strategies) < 4 or bool(out.get("error"))
    if used_fallback:
        strategies = fallback
    meta = _meta(out)
    if used_fallback and out.get("error"):
        meta["model"] = "catalog-fallback"
        meta["warning"] = "LLM unavailable — showing catalog strategies"
    return {"project_title": title, "category_id": category_id, "strategies": strategies, **meta}


async def generate_why(
    project_title: str,
    category_id: str,
    selected_strategies: list[str],
    requirement: str = "",
) -> dict[str, Any]:
    cat = _cat(category_id)
    title = project_title.strip() or "Untitled modernization"
    strat = "; ".join(s for s in selected_strategies if s) or "general modernization"
    req = requirement.strip() or cat["summary"]
    fallback_text = (
        f"{title} should modernize because legacy constraints in «{cat['name']}» raise "
        f"cost, risk, and change latency. Focusing on {strat} improves delivery speed "
        f"while protecting critical business outcomes around: {req}."
    )
    prompt = f"""Write a concise executive rationale.
Project: {title}
Category: {cat['name']}
Requirement context: {req}
Chosen strategies: {strat}

Return ONLY valid JSON:
{{
  "why_modernize": "2-4 sentences answering WHY MODERNIZE THIS SYSTEM? Business tone, feasible, no hype."
}}
No markdown."""

    backend = get_backend()
    out = await backend.complete("A1-why", prompt, tier="medium")
    parsed = _parse_json(out.get("text", ""))
    text = fallback_text
    if not out.get("error") and isinstance(parsed, dict) and parsed.get("why_modernize"):
        text = str(parsed["why_modernize"]).strip() or fallback_text
    meta = _meta(out)
    if out.get("error"):
        meta["model"] = "catalog-fallback"
        meta["warning"] = "LLM unavailable — using template rationale"
    return {"why_modernize": text, **meta}


async def generate_glossary(
    category_id: str,
    focus: str = "",
    trend_options: list[str] | None = None,
    strategies: list[str] | None = None,
) -> dict[str, Any]:
    """Plain-English glossary tailored to the selected category / use case."""
    cat = _cat(category_id)
    focus_text = (focus or "").strip()
    trends = [t.strip() for t in (trend_options or []) if t and str(t).strip()]
    strat = [s.strip() for s in (strategies or []) if s and str(s).strip()]
    examples = str(cat.get("examples") or "")

    fallback = [
        {"term": "Strangler pattern", "def": "Replace a legacy system piece by piece while the old system keeps running."},
        {"term": "Human gate", "def": "A checkpoint where people must approve before the factory continues."},
        {"term": "Equivalence", "def": "Proof the new system gives the same answers as the old one on real workloads."},
        {"term": cat["name"].split(". ", 1)[-1][:40], "def": cat["summary"]},
        {
            "term": "Modernization requirement",
            "def": focus_text or "The specific change this run will deliver for the selected category.",
        },
        {"term": "Evidence pack", "def": "Artifacts and proofs agents produce so humans can approve the next step."},
    ]

    trends_block = "\n".join(f"- {t}" for t in trends[:5]) or "- (none yet)"
    strat_block = "; ".join(strat[:6]) if strat else "(none yet)"
    prompt = f"""You write a plain-English glossary for non-technical executives on a modernization program.

Category: {cat['name']}
Category purpose: {cat['summary']}
Named examples that belong in this category: {examples}
Selected use case / project focus: {focus_text or "(category only — no use case chosen yet)"}
Top trend requirements shown for this category:
{trends_block}
Chosen strategies (if any): {strat_block}

Return ONLY valid JSON:
{{
  "terms": [
    {{"term": "short term", "def": "one plain-English sentence, max 28 words"}}
  ]
}}

Rules:
- Exactly 6 terms
- Every term must be relevant to THIS category and the selected use case (or the trend list if no use case yet)
- Prefer concrete nouns from the category (languages, databases, documents, platforms) when they fit
- Definitions must be plain English — no jargon without explanation
- Include the selected use case as one term when a focus is provided
- No markdown"""

    backend = get_backend()
    out = await backend.complete("A1-glossary", prompt, tier="medium")
    parsed = _parse_json(out.get("text", ""))
    terms: list[dict[str, str]] = []
    if isinstance(parsed, dict) and isinstance(parsed.get("terms"), list):
        for item in parsed["terms"][:6]:
            if not isinstance(item, dict):
                continue
            term = str(item.get("term") or "").strip()
            definition = str(item.get("def") or item.get("definition") or "").strip()
            if term and definition:
                terms.append({"term": term, "def": definition})
    used_fallback = len(terms) < 4 or bool(out.get("error"))
    if used_fallback:
        terms = fallback
    meta = _meta(out)
    if used_fallback and out.get("error"):
        meta["model"] = "catalog-fallback"
        meta["warning"] = "LLM unavailable — showing catalog glossary"
    return {
        "category_id": category_id,
        "focus": focus_text,
        "terms": terms,
        **meta,
    }


async def finalize_intake(
    project_title: str,
    category_id: str,
    requirement: str,
    strategies: list[str],
    why_modernize: str,
) -> dict[str, Any]:
    cat = _cat(category_id)
    title = project_title.strip() or requirement[:80] or "Modernization initiative"
    strat_line = "; ".join(strategies) if strategies else "balanced strangler approach"
    why = why_modernize.strip()
    prompt = f"""Synthesize a run-ready modernization brief.
Project: {title}
Category: {cat['name']}
Requirement: {requirement}
Strategies: {strat_line}
Why modernize: {why}

Return ONLY valid JSON:
{{
  "strategy": "2-4 sentence modernization strategy",
  "strategy_short": "short label max 8 words, e.g. Refactor (break into services)",
  "business_reason": "exactly one sentence",
  "enriched_summary": "2-3 sentence enriched intake summary",
  "estimated_timeline_weeks": 14,
  "estimated_cost_factory_k": 487,
  "estimated_cost_manual_m": 6.2,
  "enriched_categories": [
    {{
      "id": "{category_id}",
      "name": "{cat['name']}",
      "selection": "requirement text",
      "enrichment": "one enriched sentence"
    }}
  ]
}}
Rules:
- estimated_timeline_weeks: integer 6-52, realistic for the selected strategies
- estimated_cost_factory_k: AI-assisted factory cost in thousands USD (integer)
- estimated_cost_manual_m: traditional manual rewrite cost in millions USD (number)
- No markdown"""

    backend = get_backend()
    out = await backend.complete("A1-intake", prompt, tier="medium")
    parsed = _parse_json(out.get("text", ""))

    def _estimates(src: dict[str, Any] | None = None) -> dict[str, Any]:
        n = max(1, len(strategies))
        weeks = 8 + n * 2
        factory_k = 180 + n * 55
        manual_m = round(3.5 + n * 0.9, 1)
        if src:
            try:
                weeks = max(6, min(52, int(src.get("estimated_timeline_weeks") or weeks)))
            except (TypeError, ValueError):
                pass
            try:
                factory_k = max(50, int(float(src.get("estimated_cost_factory_k") or factory_k)))
            except (TypeError, ValueError):
                pass
            try:
                manual_m = max(1.0, float(src.get("estimated_cost_manual_m") or manual_m))
            except (TypeError, ValueError):
                pass
        return {
            "estimated_timeline_weeks": weeks,
            "estimated_cost_factory_k": factory_k,
            "estimated_cost_manual_m": round(manual_m, 1),
        }

    short_default = (strategies[0] if strategies else "Strangler-fig modernization")[:72]
    if not isinstance(parsed, dict) or "strategy" not in parsed:
        return {
            "strategy": (
                f"For {title}, advance «{cat['name']}» via {strat_line}. "
                f"Inventory evidence, deliver strangler slices with equivalence gates, then canary release."
            ),
            "strategy_short": short_default,
            "business_reason": why.split(".")[0].strip() + "." if why else f"{title} reduces legacy risk while unlocking change velocity.",
            "enriched_summary": why or f"Intake ready for {title} on {cat['name']}.",
            "enriched_categories": [
                {
                    "id": category_id,
                    "name": cat["name"],
                    "selection": requirement,
                    "enrichment": f"Execute with owners and acceptance checks for «{requirement}».",
                }
            ],
            **_estimates(),
            **_meta(out),
        }

    short = str(parsed.get("strategy_short") or "").strip() or short_default
    return {
        "strategy": str(parsed.get("strategy", "")).strip(),
        "strategy_short": short,
        "business_reason": str(parsed.get("business_reason", "")).strip(),
        "enriched_summary": str(parsed.get("enriched_summary", "")).strip(),
        "enriched_categories": parsed.get("enriched_categories")
        or [
            {
                "id": category_id,
                "name": cat["name"],
                "selection": requirement,
                "enrichment": why[:180],
            }
        ],
        **_estimates(parsed),
        **_meta(out),
    }


async def generate_a2_brief(
    project_name: str,
    category_name: str,
    requirement: str,
    strategies: list[str],
    strategy_short: str,
    why_modernize: str,
    enriched_summary: str = "",
    category_id: str = "",
) -> dict[str, Any]:
    from app.intake.catalog import a2_form_profile

    title = (project_name or "Modernization initiative").strip()
    cat = (category_name or "Legacy estate").strip()
    req = (requirement or "").strip()
    strat = (strategy_short or (strategies[0] if strategies else "Strangler-fig slice")).strip()
    why = (why_modernize or enriched_summary or "").strip()
    strat_line = "; ".join(s for s in strategies if s) or strat
    profile = a2_form_profile(category_id)
    primary = profile["primary"]
    crit_field = profile["criticality"]
    cons_field = profile["constraints"]

    # Soft-personalize suggested primary path from the requirement nouns when possible.
    suggested_primary = str(primary.get("suggested") or "")
    req_l = req.lower()
    if "sharepoint" in req_l or "policy manual" in req_l or "brd" in req_l:
        suggested_primary = "https://sharepoint.example.com/sites/ClaimsPolicy"
    elif "confluence" in req_l:
        suggested_primary = "https://confluence.example.com/display/LEGACY/Rules"
    elif "cobol" in req_l or "pl/i" in req_l:
        suggested_primary = "https://git.example.com/legacy/cobol-core.git"
    elif "db2" in req_l or "oracle" in req_l or "vsam" in req_l:
        suggested_primary = "db2://prod/CLAIMS · oracle://core/LEDGER"
    elif "selenium" in req_l or "junit" in req_l or "parity" in req_l:
        suggested_primary = "https://git.example.com/qa/legacy-characterization.git"
    elif "servicenow" in req_l or "jira" in req_l:
        suggested_primary = "https://company.service-now.com"
    elif "splunk" in req_l or "otel" in req_l or "smf" in req_l:
        suggested_primary = "https://splunk.example.com/en-US/app/legacy-sli"

    fallback_glossary = [
        {
            "term": profile.get("title", "Portfolio intake").split()[0] + " intake",
            "def": "Confirm location, criticality, and controls for this category before ranking.",
        },
        {"term": "Criticality", "def": "How badly the business feels it if this estate stops working."},
        {
            "term": str(cons_field.get("label") or "Controls").split("?")[0].strip() or "Controls",
            "def": "Rules and obligations that constrain how agents may handle this estate.",
        },
        {
            "term": str(primary.get("label") or "Location").rstrip("?"),
            "def": str(primary.get("hint") or "Where the category assets live."),
        },
        {"term": "Strangler pattern", "def": "Replace a legacy system piece by piece while the old system keeps running."},
        {"term": cat.split(". ", 1)[-1][:40] if cat else "Legacy", "def": f"Focus area from A1: {cat}."},
    ]

    prompt = f"""You are writing the Portfolio Intake (A2) screen for a modernization factory UI.
Personalize for THIS category — do not reuse a generic source-code form.

Project title: {title}
Category id: {category_id or "(unknown)"}
Category: {cat}
Selected requirement / example: {req or "(custom)"}
Master strategies: {strat_line}
Strategy short label: {strat}
Why modernize / description: {why or "(not provided)"}
Enriched summary: {(enriched_summary or "")[:400]}

Default form shape for this category (refine labels/suggestions; keep option ids stable):
primary_label: {primary['label']}
primary_placeholder: {primary['placeholder']}
crit_label: {crit_field['label']}
constraint_label: {cons_field['label']}
constraint_option_ids: {[o[0] for o in cons_field['options']]}

Return ONLY valid JSON:
{{
  "title": "short page title for this category",
  "lede": "1-2 sentences tying this step to the project and requirement",
  "form_heading": "section heading for the form",
  "context_line": "short chip text, e.g. Based on «project» · category · strategy",
  "checklist_heading": "short heading for the optional operator checklist",
  "checklist_note": "short note explaining these are optional and tailored from A1",
  "checklist": [
    {{"id": "a2_semantic_1", "label": "plain English operator check", "required": false}}
  ],
  "primary_label": "category-specific location question",
  "primary_placeholder": "example location for this category",
  "primary_hint": "short hint",
  "suggested_repo": "plausible location for this estate",
  "criticality_label": "category-specific criticality question",
  "suggested_criticality": "high",
  "constraints_label": "category-specific controls question",
  "suggested_regulations": ["traceability"],
  "evidence_hints": ["artifact1.md", "artifact2.json"],
  "activity_status": "short status for the right panel",
  "glossary": [
    {{"term": "Term", "def": "plain English definition"}}
  ]
}}
Rules:
- suggested_criticality one of: low, med, high, life
- suggested_regulations subset of the constraint_option_ids listed above
- Exactly 4 checklist items, all highly specific to THIS A1 combination
- Checklist items must help an operator validate the right portfolio slice for this category, requirement, and strategy
- Avoid generic wording like "confirm criticality" unless tied to the requirement, estate, or source named above
- Exactly 5 glossary terms relevant to this project/category
- No markdown
- Questions must fit the category (docs → SharePoint/BRDs; DB → schemas; tests → suites; etc.)"""

    backend = get_backend()
    try:
        import asyncio

        out = await asyncio.wait_for(
            backend.complete("A2-brief", prompt, tier="medium"),
            timeout=10.0,
        )
    except Exception as exc:  # noqa: BLE001 — catalog fallback on timeout / LLM errors
        out = {"text": "", "error": str(exc), "model": "catalog-fallback", "tokens_in": 0, "tokens_out": 0, "cost_usd": 0.0}
    parsed = _parse_json(out.get("text", ""))
    used_fallback = not isinstance(parsed, dict) or bool(out.get("error"))

    def _pack(
        *,
        page_title: str,
        lede: str,
        form_heading: str,
        context_line: str,
        primary_label: str,
        primary_placeholder: str,
        primary_hint: str,
        suggested_repo: str,
        criticality_label: str,
        crit: str,
        constraints_label: str,
        regs: list[str],
        evidence_hints: list[str],
        activity_status: str,
        checklist_heading: str,
        checklist_note: str,
        checklist: list[dict[str, Any]],
        glossary: list[dict[str, str]],
        meta: dict[str, Any],
    ) -> dict[str, Any]:
        return {
            "title": page_title,
            "lede": lede,
            "form_heading": form_heading,
            "context_line": context_line,
            "checklist_heading": checklist_heading,
            "checklist_note": checklist_note,
            "checklist": checklist,
            "category_id": category_id,
            "primary_label": primary_label,
            "primary_placeholder": primary_placeholder,
            "primary_hint": primary_hint,
            "suggested_repo": suggested_repo,
            "criticality_label": criticality_label,
            "criticality_options": crit_field["options"],
            "suggested_criticality": crit,
            "constraints_label": constraints_label,
            "constraints_options": cons_field["options"],
            # Keep legacy keys for older clients / agent params.
            "suggested_regulations": regs,
            "regulation_options": cons_field["options"],
            "evidence_hints": evidence_hints,
            "activity_status": activity_status,
            "glossary": glossary,
            **meta,
        }

    allowed_reg = {str(o[0]) for o in cons_field["options"]}
    default_regs = [str(x) for x in (cons_field.get("suggested") or ["none"]) if str(x) in allowed_reg] or ["none"]
    default_crit = str(crit_field.get("suggested") or "high")
    if default_crit not in {"low", "med", "high", "life"}:
        default_crit = "high"
    fallback_checklist = _a2_fallback_checklist(
        category_name=cat,
        requirement=req,
        strategy_short=strat,
        why_modernize=why,
        primary_label=str(primary["label"]),
        constraints_label=str(cons_field["label"]),
    )

    if used_fallback:
        meta = _meta(out)
        if out.get("error"):
            meta["model"] = "catalog-fallback"
            meta["warning"] = "LLM unavailable — using category-shaped A2 form"
        return _pack(
            page_title=str(profile.get("title") or "Portfolio intake"),
            lede=str(profile.get("lede") or "")
            or (
                f"Looks at how «{title}» sits in your portfolio so we can confirm it is the right "
                f"system to modernize first under {strat}."
            ),
            form_heading=str(profile.get("form_heading") or "Tell us about your application"),
            context_line=f"Based on «{title}» · {cat} · {strat}",
            primary_label=str(primary["label"]),
            primary_placeholder=str(primary["placeholder"]),
            primary_hint=str(primary.get("hint") or ""),
            suggested_repo=suggested_primary,
            criticality_label=str(crit_field["label"]),
            crit=default_crit,
            constraints_label=str(cons_field["label"]),
            regs=default_regs,
            evidence_hints=["run_manifest.json", "execution_plan.md", "intake_pack.json"],
            activity_status=f"A2 ready for {title}",
            checklist_heading="Operator checklist (optional)",
            checklist_note=(
                "These checks are synthesized from the locked A1 combination so the portfolio slice "
                "stays semantically aligned before downstream agents use it."
            ),
            checklist=fallback_checklist,
            glossary=fallback_glossary[:5],
            meta=meta,
        )

    gloss: list[dict[str, str]] = []
    if isinstance(parsed.get("glossary"), list):
        for item in parsed["glossary"][:5]:
            if not isinstance(item, dict):
                continue
            term = str(item.get("term") or "").strip()
            definition = str(item.get("def") or item.get("definition") or "").strip()
            if term and definition:
                gloss.append({"term": term, "def": definition})
    if len(gloss) < 4:
        gloss = fallback_glossary[:5]

    crit = str(parsed.get("suggested_criticality") or default_crit).strip().lower()
    if crit not in {"low", "med", "high", "life"}:
        crit = default_crit
    regs_raw = parsed.get("suggested_regulations") or default_regs
    regs = [str(r).lower() for r in regs_raw if str(r).lower() in allowed_reg] or default_regs
    hints = parsed.get("evidence_hints") if isinstance(parsed.get("evidence_hints"), list) else []
    evidence_hints = [str(h) for h in hints[:6]] or [
        "run_manifest.json",
        "execution_plan.md",
        "intake_pack.json",
    ]
    raw_checklist = parsed.get("checklist") if isinstance(parsed.get("checklist"), list) else []
    checklist: list[dict[str, Any]] = []
    for i, item in enumerate(raw_checklist[:4]):
        if not isinstance(item, dict):
            continue
        label = str(item.get("label") or "").strip()
        if not label:
            continue
        checklist.append({
            "id": f"a2_semantic_{i+1}",
            "label": label,
            "required": False,
            "source": "a1_semantic_llm",
        })
    if len(checklist) < 4 or not _a2_checklist_matches_context(
        checklist,
        category_name=cat,
        requirement=req,
        strategy_short=strat,
        why_modernize=why,
    ):
        checklist = fallback_checklist[:-1]
    checklist.append({
        "id": "none_of_these",
        "label": "None of these",
        "required": False,
        "source": "manual_override",
    })

    return _pack(
        page_title=str(parsed.get("title") or profile.get("title") or "Portfolio intake").strip(),
        lede=str(parsed.get("lede") or profile.get("lede") or "").strip()
        or f"Confirm where «{title}» lives and how critical it is before portfolio ranking.",
        form_heading=str(
            parsed.get("form_heading") or profile.get("form_heading") or "Tell us about your application"
        ).strip(),
        context_line=str(parsed.get("context_line") or f"Based on «{title}» · {cat} · {strat}").strip(),
        checklist_heading=str(parsed.get("checklist_heading") or "Operator checklist (optional)").strip(),
        checklist_note=str(
            parsed.get("checklist_note")
            or "These optional checks are tailored from the A1 context so the wrong estate is less likely to be carried forward."
        ).strip(),
        checklist=checklist,
        primary_label=str(parsed.get("primary_label") or primary["label"]).strip(),
        primary_placeholder=str(parsed.get("primary_placeholder") or primary["placeholder"]).strip(),
        primary_hint=str(parsed.get("primary_hint") or primary.get("hint") or "").strip(),
        suggested_repo=str(parsed.get("suggested_repo") or suggested_primary).strip(),
        criticality_label=str(parsed.get("criticality_label") or crit_field["label"]).strip(),
        crit=crit,
        constraints_label=str(parsed.get("constraints_label") or cons_field["label"]).strip(),
        regs=regs,
        evidence_hints=evidence_hints,
        activity_status=str(parsed.get("activity_status") or f"A2 ready for {title}").strip(),
        glossary=gloss,
        meta=_meta(out),
    )


async def generate_a3_brief(
    project_name: str,
    category_name: str,
    requirement: str,
    strategies: list[str],
    strategy_short: str,
    why_modernize: str,
    enriched_summary: str = "",
    category_id: str = "",
    criticality: str = "",
    regulations: list[str] | None = None,
    code_location: str = "",
    path_active_ids: list[str] | None = None,
) -> dict[str, Any]:
    """LLM-shaped Governance & Risk (A3) form from A1 + A2 + path map movement."""
    from app.intake.catalog import a3_form_profile

    title = (project_name or "Modernization initiative").strip()
    cat = (category_name or "Legacy estate").strip()
    req = (requirement or "").strip()
    strat = (strategy_short or (strategies[0] if strategies else "Strangler-fig slice")).strip()
    why = (why_modernize or enriched_summary or "").strip()
    strat_line = "; ".join(s for s in strategies if s) or strat
    regs = [str(r) for r in (regulations or []) if r]
    active = [str(x) for x in (path_active_ids or []) if x]
    path_hint = " → ".join(active[:12]) if active else "A1 → A2 → A3"
    profile = a3_form_profile(category_id)
    sens = profile["sensitive"]
    models = profile["models"]
    gates = profile["gates"]

    fallback_glossary = [
        {"term": "Sensitivity", "def": "How carefully agents must treat data before calling a model."},
        {"term": "Model policy", "def": "Whether public cloud, private, or mixed models may be used."},
        {"term": "Human gate", "def": "A checkpoint where a person must approve before the factory continues."},
        {"term": "PII", "def": "Personal data that identifies a person — must stay off public models unless allowed."},
        {"term": cat.split(". ", 1)[-1][:40] if cat else "Legacy", "def": f"Focus area locked in A1: {cat}."},
    ]

    echo = {
        "project_name": title,
        "category_id": category_id,
        "category_name": cat,
        "requirement": req,
        "strategies": [str(s) for s in strategies if s],
        "strategy_short": strat,
        "why_modernize": why,
        "a2_criticality": criticality,
        "a2_regulations": regs,
        "a2_code_location": code_location,
        "path_active_ids": active,
        "prior_agent_id": "A2",
        "prior_agent_name": "Portfolio ranking",
        "prior_line": (
            f"Immediate prior: A2 Portfolio ranking"
            + (f" · criticality={criticality}" if criticality else "")
            + (f" · regs={', '.join(regs)}" if regs else "")
            + (f" · location={code_location}" if code_location else "")
        ),
    }

    prompt = f"""You are writing the Governance & Risk (A3) screen for a modernization factory UI.
Every field MUST have maximum semantic similarity to the Factory Administrator (A1) combination
and the A2 portfolio ranking on this agent movement path. Do NOT invent banking/finance PII
unless the A1 requirement explicitly mentions accounts, payments, SSN, or similar.

Project title: {title}
Category id: {category_id or "(unknown)"}
Category: {cat}
A1 selected requirement / trend: {req or "(custom)"}
Master strategies: {strat_line}
Strategy short label: {strat}
Why modernize: {why or "(not provided)"}
A2 criticality: {criticality or "(not set)"}
A2 regulations: {", ".join(regs) or "(not set)"}
A2 location: {code_location or "(not set)"}
Agent movement path (active): {path_hint}
Immediate prior agent: A2 Portfolio ranking
Enriched summary: {(enriched_summary or "")[:400]}

Seed sensitive option ids (you MAY replace ids/labels so they match THIS requirement):
{[o[0] for o in sens["options"]]}
Model option ids (keep stable): {[o[0] for o in models["options"]]}
Gate option ids (keep stable): {[o[0] for o in gates["options"]]}

Return ONLY valid JSON:
{{
  "title": "Governance & Risk",
  "lede": "1-2 sentences on enforcing rules for THIS A1 project (mention languages/systems from the requirement when present)",
  "form_heading": "Set the rules",
  "context_line": "short chip echoing A1 title + category + A2 criticality",
  "sensitive_label": "What data is sensitive?",
  "sensitive_hint": "Tick everything that applies for this modernization…",
  "sensitive_options": [["id", "Label"], ["id2", "Label2"]],
  "suggested_sensitive": ["id"],
  "models_label": "Which AI models are allowed?",
  "suggested_model": "balanced",
  "gates_label": "Require manual approval at every gate?",
  "suggested_gates": "full",
  "risk_summary": "1 sentence risk posture grounded in A1 requirement + A2 criticality/regulations",
  "evidence_hints": ["execution_policy.yaml"],
  "activity_status": "short status",
  "glossary": [{{"term": "Term", "def": "plain English"}}]
}}
Rules:
- 4 to 6 sensitive_options that match the A1 requirement (e.g. Fortran→Java → source IP, embedded secrets, licenses — NOT bank accounts unless required)
- Always include a ["none", "None / not sure"] option
- suggested_model one of: public, balanced, private (prefer private when criticality is high)
- suggested_gates one of: full, auto_low (prefer full when criticality is high)
- suggested_sensitive subset of sensitive option ids (may be empty)
- Exactly 5 glossary terms tied to this estate
- No markdown"""

    backend = get_backend()
    try:
        import asyncio

        out = await asyncio.wait_for(
            backend.complete("A3-brief", prompt, tier="medium"),
            timeout=10.0,
        )
    except Exception as exc:  # noqa: BLE001
        out = {
            "text": "",
            "error": str(exc),
            "model": "catalog-fallback",
            "tokens_in": 0,
            "tokens_out": 0,
            "cost_usd": 0.0,
        }
    parsed = _parse_json(out.get("text", ""))
    used_fallback = not isinstance(parsed, dict) or bool(out.get("error"))

    def _with_none(opts: list[list[str]]) -> list[list[str]]:
        """Operators must always have an explicit opt-out."""
        if any(o[0] == "none" for o in opts):
            return opts
        return [*opts, ["none", "None / not sure"]]

    def _norm_opts(raw: Any, fallback: list[list[str]]) -> list[list[str]]:
        if not isinstance(raw, list):
            return fallback
        out_opts: list[list[str]] = []
        for item in raw[:8]:
            if isinstance(item, (list, tuple)) and len(item) >= 2:
                oid, olabel = str(item[0]).strip(), str(item[1]).strip()
                if oid and olabel:
                    out_opts.append([oid, olabel])
            elif isinstance(item, dict):
                oid = str(item.get("id") or item.get("key") or "").strip()
                olabel = str(item.get("label") or item.get("name") or "").strip()
                if oid and olabel:
                    out_opts.append([oid, olabel])
        return out_opts or fallback

    default_sens_opts = _with_none([[str(a), str(b)] for a, b in sens["options"]])
    default_model = str(models.get("suggested") or "balanced")
    default_gates = str(gates.get("suggested") or "full")
    crit_l = criticality.lower()
    if any(k in crit_l for k in ("high", "critical", "tier-0", "tier 0")):
        default_model = "private"
        default_gates = "full"

    if used_fallback:
        meta = _meta(out)
        if out.get("error"):
            meta["model"] = "catalog-fallback"
            meta["warning"] = "LLM unavailable — using category-shaped A3 form from A1/A2"
        return {
            "title": str(profile.get("title") or "Governance & Risk"),
            "lede": str(profile.get("lede") or ""),
            "form_heading": str(profile.get("form_heading") or "Set the rules"),
            "context_line": f"Based on «{title}» · {cat} · A2 {criticality or 'unranked'} · {strat}",
            "sensitive_label": str(sens["label"]),
            "sensitive_hint": str(sens.get("hint") or ""),
            "sensitive_options": default_sens_opts,
            "suggested_sensitive": [],
            "models_label": str(models["label"]),
            "model_options": [[str(a), str(b)] for a, b in models["options"]],
            "suggested_model": default_model,
            "gates_label": str(gates["label"]),
            "gate_options": [[str(a), str(b)] for a, b in gates["options"]],
            "suggested_gates": default_gates,
            "risk_summary": (
                f"A2 criticality «{criticality or 'unset'}» and controls «{', '.join(regs) or 'none'}» "
                f"inform the governance posture for «{title}»"
                + (f" ({req[:120]})" if req else "")
                + "."
            ),
            "evidence_hints": ["execution_policy.yaml"],
            "activity_status": f"A3 ready for {title}",
            "glossary": fallback_glossary[:5],
            **echo,
            **meta,
        }

    sens_opts = _with_none(_norm_opts(parsed.get("sensitive_options"), default_sens_opts))
    allowed_sens = {o[0] for o in sens_opts}
    sug_sens_raw = parsed.get("suggested_sensitive") or []
    sug_sens = (
        [str(x) for x in sug_sens_raw if str(x) in allowed_sens]
        if isinstance(sug_sens_raw, list)
        else []
    )
    model = str(parsed.get("suggested_model") or default_model).strip().lower()
    if model not in {"public", "balanced", "private"}:
        model = default_model
    gate = str(parsed.get("suggested_gates") or default_gates).strip().lower()
    if gate not in {"full", "auto_low"}:
        gate = default_gates

    gloss: list[dict[str, str]] = []
    if isinstance(parsed.get("glossary"), list):
        for item in parsed["glossary"][:5]:
            if not isinstance(item, dict):
                continue
            term = str(item.get("term") or "").strip()
            definition = str(item.get("def") or item.get("definition") or "").strip()
            if term and definition:
                gloss.append({"term": term, "def": definition})
    if len(gloss) < 4:
        gloss = fallback_glossary[:5]

    hints = parsed.get("evidence_hints") if isinstance(parsed.get("evidence_hints"), list) else []
    evidence_hints = [str(h) for h in hints[:6]] or ["execution_policy.yaml"]

    return {
        "title": str(parsed.get("title") or profile.get("title") or "Governance & Risk").strip(),
        "lede": str(parsed.get("lede") or profile.get("lede") or "").strip(),
        "form_heading": str(parsed.get("form_heading") or profile.get("form_heading") or "Set the rules").strip(),
        "context_line": str(
            parsed.get("context_line")
            or f"Based on «{title}» · {cat} · A2 {criticality or 'unranked'} · {strat}"
        ).strip(),
        "sensitive_label": str(parsed.get("sensitive_label") or sens["label"]).strip(),
        "sensitive_hint": str(parsed.get("sensitive_hint") or sens.get("hint") or "").strip(),
        "sensitive_options": sens_opts,
        "suggested_sensitive": sug_sens,
        "models_label": str(parsed.get("models_label") or models["label"]).strip(),
        "model_options": [[str(a), str(b)] for a, b in models["options"]],
        "suggested_model": model,
        "gates_label": str(parsed.get("gates_label") or gates["label"]).strip(),
        "gate_options": [[str(a), str(b)] for a, b in gates["options"]],
        "suggested_gates": gate,
        "risk_summary": str(
            parsed.get("risk_summary")
            or f"Governance posture derived from A1 «{cat}» and A2 criticality «{criticality or 'unset'}»."
        ).strip(),
        "evidence_hints": evidence_hints,
        "activity_status": str(parsed.get("activity_status") or f"A3 ready for {title}").strip(),
        "glossary": gloss,
        **echo,
        **_meta(out),
    }


async def generate_a4_brief(
    project_name: str,
    category_name: str,
    requirement: str,
    strategies: list[str],
    strategy_short: str,
    why_modernize: str,
    enriched_summary: str = "",
    category_id: str = "",
    criticality: str = "",
    regulations: list[str] | None = None,
    code_location: str = "",
) -> dict[str, Any]:
    """LLM-shaped Repository Discovery (A4) form from A1 (+ A2) context."""
    from app.intake.catalog import a4_form_profile

    title = (project_name or "Modernization initiative").strip()
    cat = (category_name or "Legacy estate").strip()
    req = (requirement or "").strip()
    strat = (strategy_short or (strategies[0] if strategies else "Strangler-fig slice")).strip()
    why = (why_modernize or enriched_summary or "").strip()
    strat_line = "; ".join(s for s in strategies if s) or strat
    regs = [str(r) for r in (regulations or []) if r]
    profile = a4_form_profile(category_id)
    sources = profile.get("sources") or {}
    default_source_opts = [[str(a), str(b)] for a, b in sources.get("options") or []]
    default_suggested_sources = [str(x) for x in sources.get("suggested") or []]

    fallback_glossary = [
        {"term": "Repository", "def": "A place where source code, schemas, or documents are stored."},
        {"term": "Copybook", "def": "A shared data layout that many COBOL programs reuse."},
        {"term": "Dependency", "def": "A library, schema, or file another part of the estate needs."},
        {"term": "Inventory", "def": "A list of everything discovery found and how pieces connect."},
        {"term": cat.split(". ", 1)[-1][:40] if cat else "Legacy", "def": f"Focus area locked in A1: {cat}."},
    ]

    prompt = f"""You write the Repository Discovery (A4) screen for a modernization factory UI.
Personalize repository URL examples and missing-dependency hints from THIS A1 (+ A2) context.
Plain English. Do not invent unrelated domains.

Project: {title}
Category id: {category_id or "(unknown)"}
Category: {cat}
A1 requirement: {req or "(custom)"}
A1 strategies: {strat_line}
A1 strategy short: {strat}
A1 why modernize: {why or "(not provided)"}
A2 criticality: {criticality or "(not set)"}
A2 regulations: {", ".join(regs) or "(not set)"}
A2 location hint: {code_location or "(not set)"}
Enriched summary: {(enriched_summary or "")[:350]}

Default source option ids: {[o[0] for o in default_source_opts]}
Default suggested sources: {default_suggested_sources}

Return ONLY valid JSON:
{{
  "title": "Repository discovery",
  "lede": "1-2 sentences matching what discovery will do for THIS category",
  "form_heading": "Where is the old code?",
  "context_line": "short chip from A1 context",
  "repos_label": "Repository URLs — one per line",
  "repos_hint": "plain English hint",
  "repos_suggested": "2-4 example URLs/paths, one per line, shaped for this category",
  "missing_label": "Any missing dependencies you know about?",
  "missing_hint": "plain English hint",
  "missing_suggested": "one short example note or empty string",
  "sources_label": "What should we read?",
  "sources_hint": "Tick every source type…",
  "suggested_sources": ["code", "copybooks"],
  "discovery_summary": "1 sentence on what we will inventory",
  "evidence_hints": ["inventory.json", "dependency_graph.json"],
  "activity_status": "A4 ready",
  "glossary": [{{"term": "Term", "def": "plain English"}}]
}}
Rules:
- repos_suggested must be category-appropriate (git/mainframe/db2/sharepoint/mq/vault as fits)
- suggested_sources subset of default source ids
- Exactly 5 glossary terms
- No markdown"""

    backend = get_backend()
    try:
        import asyncio

        out = await asyncio.wait_for(
            backend.complete("A4-brief", prompt, tier="medium"),
            timeout=10.0,
        )
    except Exception as exc:  # noqa: BLE001
        out = {
            "text": "",
            "error": str(exc),
            "model": "catalog-fallback",
            "tokens_in": 0,
            "tokens_out": 0,
            "cost_usd": 0.0,
        }
    parsed = _parse_json(out.get("text", ""))
    used_fallback = not isinstance(parsed, dict) or bool(out.get("error"))

    allowed_src = {o[0] for o in default_source_opts}
    sug_src: list[str] = []
    if isinstance(parsed, dict):
        raw = parsed.get("suggested_sources") or []
        if isinstance(raw, list):
            sug_src = [str(x) for x in raw if str(x) in allowed_src]
    if not sug_src:
        sug_src = [x for x in default_suggested_sources if x in allowed_src] or list(allowed_src)[:4]

    gloss: list[dict[str, str]] = []
    if isinstance(parsed, dict) and isinstance(parsed.get("glossary"), list):
        for item in parsed["glossary"][:5]:
            if not isinstance(item, dict):
                continue
            term = str(item.get("term") or "").strip()
            definition = str(item.get("def") or item.get("definition") or "").strip()
            if term and definition:
                gloss.append({"term": term, "def": definition})
    if len(gloss) < 4:
        gloss = fallback_glossary[:5]

    hints = (
        parsed.get("evidence_hints")
        if isinstance(parsed, dict) and isinstance(parsed.get("evidence_hints"), list)
        else []
    )
    evidence_hints = [str(h) for h in hints[:6]] or ["inventory.json", "dependency_graph.json"]

    def _p(key: str, fallback: str) -> str:
        if isinstance(parsed, dict):
            return str(parsed.get(key) or "").strip() or fallback
        return fallback

    return {
        "title": _p("title", str(profile.get("title") or "Repository discovery")),
        "lede": _p("lede", str(profile.get("lede") or "")),
        "form_heading": _p("form_heading", str(profile.get("form_heading") or "Where is the old code?")),
        "context_line": _p("context_line", f"Based on «{title}» · {cat} · {strat}"),
        "category_id": category_id,
        "repos_label": _p("repos_label", str(profile.get("repos_label") or "Repository URLs — one per line")),
        "repos_hint": _p("repos_hint", str(profile.get("repos_hint") or "")),
        "repos_suggested": _p("repos_suggested", str(profile.get("repos_suggested") or profile.get("repos_placeholder") or "")),
        "missing_label": _p("missing_label", str(profile.get("missing_label") or "Any missing dependencies you know about?")),
        "missing_hint": _p("missing_hint", str(profile.get("missing_hint") or "")),
        "missing_suggested": _p(
            "missing_suggested",
            str(profile.get("missing_suggested") or profile.get("missing_placeholder") or ""),
        ),
        "sources_label": _p("sources_label", str(sources.get("label") or "What should we read?")),
        "sources_hint": _p("sources_hint", str(sources.get("hint") or "")),
        "source_options": default_source_opts,
        "suggested_sources": sug_src,
        "discovery_summary": _p(
            "discovery_summary",
            f"Inventory «{cat}» sources for «{title}» using strategy «{strat}».",
        ),
        "evidence_hints": evidence_hints,
        "activity_status": _p("activity_status", f"A4 ready for {title}"),
        "glossary": gloss,
        "warning": "LLM unavailable — using category-shaped A4 form" if used_fallback else "",
        **_meta(out),
    }




async def generate_a5_brief(
    project_name: str,
    category_name: str,
    requirement: str,
    strategies: list[str],
    strategy_short: str,
    why_modernize: str,
    enriched_summary: str = "",
    category_id: str = "",
    criticality: str = "",
    regulations: list[str] | None = None,
    code_location: str = "",
    prior_agent_id: str = "",
    prior_agent_name: str = "",
    prior_summary: str = "",
    discovery_repos: list[str] | None = None,
    discovery_sources: list[str] | None = None,
    discovery_missing: str = "",
    path_active_ids: list[str] | None = None,
    edges: int = 0,
    dead_programs: int = 0,
) -> dict[str, Any]:
    """LLM-shaped Legacy Code Analysis (A5) form from A1 + path + prior agent."""
    from app.intake.catalog import a5_form_profile

    title = (project_name or "Modernization initiative").strip()
    cat = (category_name or "Legacy estate").strip()
    req = (requirement or "").strip()
    strat = (strategy_short or (strategies[0] if strategies else "Strangler-fig slice")).strip()
    why = (why_modernize or enriched_summary or "").strip()
    strat_line = "; ".join(s for s in strategies if s) or strat
    regs = [str(r) for r in (regulations or []) if r]
    profile = a5_form_profile(category_id)
    depth = profile.get("depth") or {}
    focus = profile.get("focus") or {}
    default_depth_opts = [[str(a), str(b)] for a, b in depth.get("options") or []]
    default_focus_opts = [[str(a), str(b)] for a, b in focus.get("options") or []]
    default_suggested_depth = str(depth.get("suggested") or "full")
    default_suggested_focus = [str(x) for x in focus.get("suggested") or []]
    repos = [str(x) for x in (discovery_repos or []) if x]
    sources = [str(x) for x in (discovery_sources or []) if x]
    path_ids = [str(x) for x in (path_active_ids or []) if x]
    prior_id = (prior_agent_id or "").strip() or "A4"
    prior_name = (prior_agent_name or "").strip() or "Repository discovery"

    # Map prior discovery sources → focus ids for semantic continuity.
    source_to_focus = {
        "code": "calls",
        "copybooks": "dataflow",
        "jcl": "batch",
        "db": "schema",
        "docs": "calls",
        "config": "risky",
    }
    allowed_focus = {o[0] for o in default_focus_opts}
    continuity_focus = []
    for src in sources:
        fid = source_to_focus.get(src)
        if fid and fid in allowed_focus and fid not in continuity_focus:
            continuity_focus.append(fid)
    if "risky" in allowed_focus and "risky" not in continuity_focus:
        continuity_focus.append("risky")
    if not continuity_focus:
        continuity_focus = [x for x in default_suggested_focus if x in allowed_focus] or list(allowed_focus)[:3]

    fallback_glossary = [
        {"term": "Call graph", "def": "A map of which programs invoke which other programs."},
        {"term": "Entry point", "def": "A program or transaction where work starts — online or batch."},
        {"term": "Circular dependency", "def": "A loop where modules eventually call back into themselves."},
        {"term": "Dynamic CALL", "def": "A program name decided at runtime — harder to analyse statically."},
        {"term": cat.split(". ", 1)[-1][:40] if cat else "Legacy", "def": f"Focus area locked in A1: {cat}."},
    ]

    prompt = f"""You write the Legacy Code Analysis (A5) screen for a modernization factory UI.
Personalize depth/focus options and result copy from A1, the agent path, and the IMMEDIATE PRIOR agent.
Maximum semantic similarity with what the prior agent already finished — do not invent unrelated domains.

Project: {title}
Category id: {category_id or "(unknown)"}
Category: {cat}
A1 requirement: {req or "(custom)"}
A1 strategies: {strat_line}
A1 strategy short: {strat}
A1 why modernize: {why or "(not provided)"}
A2 criticality: {criticality or "(not set)"}
A2 regulations: {", ".join(regs) or "(not set)"}
A2 location: {code_location or "(not set)"}
Path active ids: {path_ids or "(unknown)"}
Prior agent: {prior_id} · {prior_name}
Prior summary: {(prior_summary or "")[:400] or "(none)"}
Discovery repos: {repos[:6] or "(none)"}
Discovery sources: {sources or "(none)"}
Discovery missing deps: {(discovery_missing or "")[:200] or "(none)"}
Dependency edges so far: {edges}
Dead programs noted: {dead_programs}
Enriched summary: {(enriched_summary or "")[:300]}

Default depth ids: {[o[0] for o in default_depth_opts]}
Default focus ids: {[o[0] for o in default_focus_opts]}
Continuity focus from prior sources: {continuity_focus}

Return ONLY valid JSON:
{{
  "title": "Legacy code analysis",
  "lede": "1-2 sentences on deep structural analysis for THIS category",
  "form_heading": "Set the analysis lens",
  "context_line": "short chip tying A1 + prior agent",
  "prior_line": "1 sentence: what we continue from {prior_id}",
  "depth_label": "How deeply should we read the code?",
  "depth_hint": "plain English",
  "suggested_depth": "full",
  "focus_label": "What should analysis prioritise?",
  "focus_hint": "plain English — must reference prior agent work",
  "suggested_focus": ["calls", "dataflow", "risky"],
  "analysis_summary": "1 sentence plan",
  "result_headline": "Structural analysis complete.",
  "result_body": "1-2 sentences for the results banner",
  "evidence_hints": ["ast_index.json", "call_graph.json"],
  "activity_status": "A5 ready",
  "glossary": [{{"term": "Term", "def": "plain English"}}]
}}
Rules:
- suggested_depth one of: full, struct
- suggested_focus subset of default focus ids; prefer continuity focus
- Exactly 5 glossary terms
- No markdown"""

    backend = get_backend()
    try:
        import asyncio

        out = await asyncio.wait_for(
            backend.complete("A5-brief", prompt, tier="medium"),
            timeout=10.0,
        )
    except Exception as exc:  # noqa: BLE001
        out = {
            "text": "",
            "error": str(exc),
            "model": "catalog-fallback",
            "tokens_in": 0,
            "tokens_out": 0,
            "cost_usd": 0.0,
        }
    parsed = _parse_json(out.get("text", ""))
    used_fallback = not isinstance(parsed, dict) or bool(out.get("error"))

    sug_depth = default_suggested_depth
    sug_focus = list(continuity_focus)
    if isinstance(parsed, dict):
        d = str(parsed.get("suggested_depth") or "").strip().lower()
        if d in {"full", "struct"}:
            sug_depth = d
        raw_f = parsed.get("suggested_focus") or []
        if isinstance(raw_f, list):
            picked = [str(x) for x in raw_f if str(x) in allowed_focus]
            if picked:
                sug_focus = picked

    gloss: list[dict[str, str]] = []
    if isinstance(parsed, dict) and isinstance(parsed.get("glossary"), list):
        for item in parsed["glossary"][:5]:
            if not isinstance(item, dict):
                continue
            term = str(item.get("term") or "").strip()
            definition = str(item.get("def") or item.get("definition") or "").strip()
            if term and definition:
                gloss.append({"term": term, "def": definition})
    if len(gloss) < 4:
        gloss = fallback_glossary[:5]

    hints = (
        parsed.get("evidence_hints")
        if isinstance(parsed, dict) and isinstance(parsed.get("evidence_hints"), list)
        else []
    )
    evidence_hints = [str(h) for h in hints[:6]] or ["ast_index.json", "call_graph.json"]
    banner = profile.get("result_banner") or {}

    def _p(key: str, fallback: str) -> str:
        if isinstance(parsed, dict):
            return str(parsed.get(key) or "").strip() or fallback
        return fallback

    prior_line_fb = (
        f"Continues {prior_id} ({prior_name})"
        + (f" — {len(repos)} repo pointer(s), sources {', '.join(sources) or 'unset'}" if repos or sources else "")
        + "."
    )

    return {
        "title": _p("title", str(profile.get("title") or "Legacy code analysis")),
        "lede": _p("lede", str(profile.get("lede") or "")),
        "form_heading": _p("form_heading", str(profile.get("form_heading") or "Set the analysis lens")),
        "context_line": _p("context_line", f"Based on «{title}» · {cat} · prior {prior_id} · {strat}"),
        "prior_line": _p("prior_line", prior_line_fb),
        "category_id": category_id,
        "prior_agent_id": prior_id,
        "prior_agent_name": prior_name,
        "path_active_ids": path_ids,
        "depth_label": _p("depth_label", str(depth.get("label") or "How deeply should we read the code?")),
        "depth_hint": _p("depth_hint", str(depth.get("hint") or "")),
        "depth_options": default_depth_opts,
        "suggested_depth": sug_depth,
        "focus_label": _p("focus_label", str(focus.get("label") or "What should analysis prioritise?")),
        "focus_hint": _p(
            "focus_hint",
            str(focus.get("hint") or "Choose work that continues what the prior agent inventoried."),
        ),
        "focus_options": default_focus_opts,
        "suggested_focus": sug_focus,
        "analysis_summary": _p(
            "analysis_summary",
            f"Deep-read «{cat}» programmes inventoried by {prior_id} for «{title}».",
        ),
        "result_headline": _p("result_headline", str(banner.get("headline") or "Structural analysis complete.")),
        "result_body": _p(
            "result_body",
            str(
                banner.get("body")
                or "We built a map showing exactly how every part of the code connects to every other part."
            ),
        ),
        "discovery_repos": repos,
        "discovery_sources": sources,
        "evidence_hints": evidence_hints,
        "activity_status": _p("activity_status", f"A5 ready for {title}"),
        "glossary": gloss,
        "warning": "LLM unavailable — using category-shaped A5 form" if used_fallback else "",
        **_meta(out),
    }





async def generate_a6_brief(
    project_name: str,
    category_name: str,
    requirement: str,
    strategies: list[str],
    strategy_short: str,
    why_modernize: str,
    enriched_summary: str = "",
    category_id: str = "",
    criticality: str = "",
    regulations: list[str] | None = None,
    code_location: str = "",
    prior_agent_id: str = "",
    prior_agent_name: str = "",
    prior_summary: str = "",
    analysis_focus: list[str] | None = None,
    analysis_depth: str = "",
    discovery_sources: list[str] | None = None,
    path_active_ids: list[str] | None = None,
    parsed_programs: int = 0,
    risky_count: int = 0,
) -> dict[str, Any]:
    """LLM-shaped Business Rule Extraction (A6) from A1 + path + prior agent."""
    from app.intake.catalog import a6_form_profile

    title = (project_name or "Modernization initiative").strip()
    cat = (category_name or "Legacy estate").strip()
    req = (requirement or "").strip()
    strat = (strategy_short or (strategies[0] if strategies else "Strangler-fig slice")).strip()
    why = (why_modernize or enriched_summary or "").strip()
    strat_line = "; ".join(s for s in strategies if s) or strat
    regs = [str(r) for r in (regulations or []) if r]
    profile = a6_form_profile(
        category_id,
        project_name=title,
        requirement=req,
        code_location=code_location,
        strategies=strategies,
    )
    conf = profile.get("confidence") or {}
    scope = profile.get("scope") or {}
    citation = profile.get("citation") or {}
    default_conf_opts = [[str(a), str(b)] for a, b in conf.get("options") or []]
    default_scope_opts = [[str(a), str(b)] for a, b in scope.get("options") or []]
    default_cite_opts = [[str(a), str(b)] for a, b in citation.get("options") or []]
    default_conf = str(conf.get("suggested") or "0.8")
    default_scope = [str(x) for x in scope.get("suggested") or []]
    default_cite = [str(x) for x in citation.get("suggested") or ["cite"]]
    prior_id = (prior_agent_id or "").strip() or "A5"
    prior_name = (prior_agent_name or "").strip() or "Legacy code analysis"
    path_ids = [str(x) for x in (path_active_ids or []) if x]
    focus = [str(x) for x in (analysis_focus or []) if x]
    sources = [str(x) for x in (discovery_sources or []) if x]
    sample_rules = profile.get("sample_rules") or []

    # Continuity: map prior analysis focus / sources → rule scope ids.
    focus_to_scope = {
        "calls": "lifecycle",
        "dataflow": "pricing",
        "risky": "exceptions",
        "batch": "lifecycle",
        "schema": "compliance",
        "code": "pricing",
        "copybooks": "eligibility",
        "jcl": "lifecycle",
        "db": "compliance",
        "docs": "eligibility",
        "config": "exceptions",
    }
    allowed_scope = {o[0] for o in default_scope_opts}
    continuity: list[str] = []
    for key in focus + sources:
        sid = focus_to_scope.get(key)
        if sid and sid in allowed_scope and sid not in continuity:
            continuity.append(sid)
    if not continuity:
        continuity = [x for x in default_scope if x in allowed_scope] or list(allowed_scope)[:3]

    fallback_glossary = [
        {"term": "Business rule", "def": "A plain-English statement of a decision the business makes."},
        {"term": "Confidence", "def": "How sure the factory is that the rule matches the code."},
        {"term": "Citation", "def": "Exact program and line numbers the rule was taken from."},
        {"term": "SME review", "def": "A subject matter expert confirms ambiguous rules before they are trusted."},
        {"term": cat.split(". ", 1)[-1][:40] if cat else "Legacy", "def": f"Focus area locked in A1: {cat}."},
    ]

    prompt = f"""You design the Business Rule Extraction (A6) screen for a modernization factory.
Synthesize labels, suggestions, sample rule titles/statements, and result copy from A1, the movement path,
and the IMMEDIATE PRIOR agent. Maximum semantic similarity with prior finished work. Plain English.

Project: {title}
Category id: {category_id or "(unknown)"}
Category: {cat}
A1 requirement: {req or "(custom)"}
A1 strategies: {strat_line}
A1 strategy short: {strat}
A1 why: {why or "(not provided)"}
A2 criticality: {criticality or "(not set)"}
A2 regulations: {", ".join(regs) or "(not set)"}
A2 location: {code_location or "(not set)"}
Path active ids: {path_ids or "(unknown)"}
Prior agent: {prior_id} · {prior_name}
Prior summary: {(prior_summary or "")[:450] or "(none)"}
Prior analysis focus: {focus or "(none)"}
Prior analysis depth: {analysis_depth or "(none)"}
Discovery sources: {sources or "(none)"}
Programs parsed: {parsed_programs}
Risky constructs noted: {risky_count}
Enriched summary: {(enriched_summary or "")[:300]}

Default confidence ids: {[o[0] for o in default_conf_opts]}
Default scope ids: {[o[0] for o in default_scope_opts]}
Continuity scope from prior: {continuity}
Default sample rule ids: {[r.get("rule_id") for r in sample_rules[:3]]}

Return ONLY valid JSON:
{{
  "title": "Business rule extraction",
  "lede": "1-2 sentences — business intent, not technical behaviour",
  "form_heading": "Set the extraction lens",
  "context_line": "short chip from A1 + prior",
  "prior_line": "1 sentence continuity from {prior_id}",
  "confidence_label": "How certain must the factory be…",
  "confidence_hint": "plain English",
  "suggested_confidence": "0.8",
  "scope_label": "What kinds of business rules…",
  "scope_hint": "must reference prior agent work",
  "suggested_scope": ["pricing", "eligibility"],
  "citation_label": "Requirements for every rule",
  "require_citation": true,
  "extraction_summary": "1 sentence plan",
  "result_headline": "The most important step is done.",
  "result_body": "1-2 sentences for results banner",
  "sample_heading": "EXACT BUSINESS RULES EXTRACTED",
  "sample_rules": [
    {{"rule_id":"BR-001","title":"Validate Eligibility for Insurance","statement":"Eligibility criteria must be checked against predefined parameters during the claims process.","confidence":0.94,"path":"CALC_POLICY_PREMIUM.f90","start":5,"end":15}}
  ],
  "total_rules": 8,
  "review_count": 2,
  "review_headline": "2 rules need human review.",
  "review_body": "These are rules we extracted with less than 90% confidence…",
  "evidence_hints": ["rule_catalogue.json", "ambiguity_queue.json"],
  "activity_status": "A6 ready",
  "glossary": [{{"term":"Term","def":"plain English"}}]
}}
Rules:
- suggested_confidence one of: 0.7, 0.8, 0.9
- suggested_scope subset of default scope ids; prefer continuity
- Provide 8 exact extracted rules with specific code file citations (.f90, .cbl)
- sample_heading must be "EXACT BUSINESS RULES EXTRACTED"
- Exactly 5 glossary terms
- No markdown"""

    backend = get_backend()
    try:
        import asyncio

        out = await asyncio.wait_for(
            backend.complete("A6-brief", prompt, tier="medium"),
            timeout=12.0,
        )
    except Exception as exc:  # noqa: BLE001
        out = {
            "text": "",
            "error": str(exc),
            "model": "catalog-fallback",
            "tokens_in": 0,
            "tokens_out": 0,
            "cost_usd": 0.0,
        }
    parsed = _parse_json(out.get("text", ""))
    used_fallback = not isinstance(parsed, dict) or bool(out.get("error"))

    sug_conf = default_conf
    sug_scope = list(continuity)
    require_cite = True
    samples: list[dict[str, Any]] = []
    if isinstance(parsed, dict):
        c = str(parsed.get("suggested_confidence") or "").strip()
        if c in {"0.7", "0.8", "0.9"}:
            sug_conf = c
        raw_s = parsed.get("suggested_scope") or []
        if isinstance(raw_s, list):
            picked = [str(x) for x in raw_s if str(x) in allowed_scope]
            if picked:
                sug_scope = picked
        if "require_citation" in parsed:
            require_cite = bool(parsed.get("require_citation"))
        raw_rules = parsed.get("sample_rules") or []
        if isinstance(raw_rules, list):
            for item in raw_rules[:8]:
                if not isinstance(item, dict):
                    continue
                rid = str(item.get("rule_id") or "").strip()
                statement = str(item.get("statement") or "").strip()
                if not rid or not statement:
                    continue
                samples.append(
                    {
                        "rule_id": rid,
                        "title": str(item.get("title") or rid).strip(),
                        "statement": statement,
                        "confidence": float(item.get("confidence") or 0.9),
                        "path": str(item.get("path") or "CALC_POLICY_PREMIUM.f90"),
                        "start": int(item.get("start") or 0) or None,
                        "end": int(item.get("end") or 0) or None,
                    }
                )
    if len(samples) < 3:
        samples = [
            {
                "rule_id": str(r.get("rule_id")),
                "title": str(r.get("title") or r.get("rule_id")),
                "statement": str(r.get("statement")),
                "confidence": float(r.get("confidence") or 0.9),
                "path": str(r.get("path") or "CALC_POLICY_PREMIUM.f90"),
                "start": r.get("start"),
                "end": r.get("end"),
            }
            for r in sample_rules[:8]
        ]

    gloss: list[dict[str, str]] = []
    if isinstance(parsed, dict) and isinstance(parsed.get("glossary"), list):
        for item in parsed["glossary"][:5]:
            if not isinstance(item, dict):
                continue
            term = str(item.get("term") or "").strip()
            definition = str(item.get("def") or item.get("definition") or "").strip()
            if term and definition:
                gloss.append({"term": term, "def": definition})
    if len(gloss) < 4:
        gloss = fallback_glossary[:5]

    hints = (
        parsed.get("evidence_hints")
        if isinstance(parsed, dict) and isinstance(parsed.get("evidence_hints"), list)
        else []
    )
    evidence_hints = [str(h) for h in hints[:6]] or ["rule_catalogue.json", "ambiguity_queue.json"]
    banner = profile.get("result_banner") or {}
    total_rules = int(profile.get("total_rules") or len(samples) or 8)
    review_count = int(profile.get("review_count") or 2)
    if isinstance(parsed, dict):
        try:
            total_rules = int(parsed.get("total_rules") or total_rules)
        except (TypeError, ValueError):
            pass
        try:
            review_count = int(parsed.get("review_count") or review_count)
        except (TypeError, ValueError):
            pass

    def _p(key: str, fallback: str) -> str:
        if isinstance(parsed, dict):
            return str(parsed.get(key) or "").strip() or fallback
        return fallback

    thr_pct = int(float(sug_conf) * 100)
    prior_line_fb = (
        f"Continues {prior_id} ({prior_name})"
        + (f" — focus {', '.join(focus)}" if focus else "")
        + (f"; {parsed_programs} programs parsed" if parsed_programs else "")
        + "."
    )

    return {
        "title": _p("title", str(profile.get("title") or "Business rule extraction")),
        "lede": _p("lede", str(profile.get("lede") or "")),
        "form_heading": _p("form_heading", str(profile.get("form_heading") or "Set the extraction lens")),
        "domain_kicker": str(profile.get("domain_kicker") or "Domain B · Understand the old code · Step A6"),
        "context_line": _p("context_line", f"Based on «{title}» · {cat} · prior {prior_id} · {strat}"),
        "prior_line": _p("prior_line", prior_line_fb),
        "category_id": category_id,
        "prior_agent_id": prior_id,
        "prior_agent_name": prior_name,
        "path_active_ids": path_ids,
        "confidence_label": _p("confidence_label", str(conf.get("label") or "")),
        "confidence_hint": _p("confidence_hint", str(conf.get("hint") or "")),
        "confidence_options": default_conf_opts,
        "suggested_confidence": sug_conf,
        "scope_label": _p("scope_label", str(scope.get("label") or "")),
        "scope_hint": _p("scope_hint", str(scope.get("hint") or "")),
        "scope_options": default_scope_opts,
        "suggested_scope": sug_scope,
        "citation_label": _p("citation_label", str(citation.get("label") or "")),
        "citation_options": default_cite_opts,
        "require_citation": require_cite,
        "suggested_citation": default_cite if require_cite else [],
        "extraction_summary": _p(
            "extraction_summary",
            f"Extract «{cat}» business decisions from programs mapped by {prior_id} for «{title}».",
        ),
        "result_headline": _p("result_headline", str(banner.get("headline") or "The most important step is done.")),
        "result_body": _p("result_body", str(banner.get("body") or "")),
        "sample_heading": _p("sample_heading", "EXACT BUSINESS RULES EXTRACTED"),
        "sample_rules": samples,
        "total_rules": total_rules,
        "review_count": review_count,
        "review_headline": _p("review_headline", f"{review_count} rules need human review."),
        "review_body": _p(
            "review_body",
            f"These are rules we extracted with less than {thr_pct}% confidence. "
            "A subject matter expert should confirm them before we treat them as trusted.",
        ),
        "evidence_hints": evidence_hints,
        "activity_status": _p("activity_status", f"A6 ready for {title}"),
        "glossary": gloss,
        "warning": "LLM unavailable — using category-shaped A6 form" if used_fallback else "",
        **_meta(out),
    }


async def generate_a7_brief(
    project_name: str,
    category_name: str,
    requirement: str,
    strategies: list[str],
    strategy_short: str,
    why_modernize: str,
    enriched_summary: str = "",
    category_id: str = "",
    criticality: str = "",
    regulations: list[str] | None = None,
    code_location: str = "",
    prior_agent_id: str = "",
    prior_agent_name: str = "",
    prior_summary: str = "",
    analysis_focus: list[str] | None = None,
    discovery_sources: list[str] | None = None,
    path_active_ids: list[str] | None = None,
    extracted_rules: int = 0,
    programs: int = 0,
) -> dict[str, Any]:
    """LLM-shaped Documentation & Knowledge Graph (A7) from A1 + path + prior agent."""
    from app.intake.catalog import a7_form_profile

    title = (project_name or "Modernization initiative").strip()
    cat = (category_name or "Legacy estate").strip()
    req = (requirement or "").strip()
    strat = (strategy_short or (strategies[0] if strategies else "Strangler-fig slice")).strip()
    why = (why_modernize or enriched_summary or "").strip()
    strat_line = "; ".join(s for s in strategies if s) or strat
    regs = [str(r) for r in (regulations or []) if r]
    profile = a7_form_profile(category_id)
    artifacts = profile.get("artifacts") or {}
    publish = profile.get("publish") or {}
    depth = profile.get("depth") or {}
    default_art_opts = [[str(a), str(b)] for a, b in artifacts.get("options") or []]
    default_pub_opts = [[str(a), str(b)] for a, b in publish.get("options") or []]
    default_depth_opts = [[str(a), str(b)] for a, b in depth.get("options") or []]
    allowed_art = {o[0] for o in default_art_opts}
    allowed_pub = {o[0] for o in default_pub_opts}
    allowed_depth = {o[0] for o in default_depth_opts}
    default_art = [str(x) for x in artifacts.get("suggested") or [] if str(x) in allowed_art]
    default_pub = str(publish.get("suggested") or "markdown")
    if default_pub not in allowed_pub:
        default_pub = next(iter(allowed_pub), "markdown")
    default_depth = str(depth.get("suggested") or "standard")
    if default_depth not in allowed_depth:
        default_depth = next(iter(allowed_depth), "standard")
    prior_id = (prior_agent_id or "").strip() or "A6"
    prior_name = (prior_agent_name or "").strip() or "Business rule extraction"
    path_ids = [str(x) for x in (path_active_ids or []) if x]
    focus = [str(x) for x in (analysis_focus or []) if x]
    sources = [str(x) for x in (discovery_sources or []) if x]
    seed_docs = list(profile.get("documents") or [])
    seed_kg = dict(profile.get("knowledge_graph") or {})

    # Continuity: map prior focus/sources → documentation artifact ids.
    focus_to_art = {
        "calls": "diagrams",
        "dataflow": "dictionary",
        "risky": "overview",
        "batch": "runbooks",
        "schema": "dictionary",
        "code": "modules",
        "copybooks": "modules",
        "jcl": "runbooks",
        "db": "dictionary",
        "docs": "confluence",
        "config": "modules",
        "pricing": "overview",
        "eligibility": "overview",
        "lifecycle": "runbooks",
        "exceptions": "modules",
        "compliance": "dictionary",
    }
    continuity: list[str] = []
    for key in focus + sources:
        aid = focus_to_art.get(key)
        if aid and aid in allowed_art and aid not in continuity:
            continuity.append(aid)
    if "overview" in allowed_art and "overview" not in continuity:
        continuity.insert(0, "overview")
    if not continuity:
        continuity = list(default_art) or list(allowed_art)[:4]

    fallback_glossary = [
        {"term": "Knowledge graph", "def": "A map linking rules, programs, tables, and docs so nothing is orphaned."},
        {"term": "System overview", "def": "A plain-English description of what the estate does and why it matters."},
        {"term": "Sequence diagram", "def": "A picture of how programs call each other for an important journey."},
        {"term": "Documentation conflict", "def": "A place where two sources disagree and a human should decide."},
        {"term": cat.split(". ", 1)[-1][:40] if cat else "Legacy", "def": f"Focus area locked in A1: {cat}."},
    ]

    prompt = f"""You design the Documentation & Knowledge Graph (A7) screen for a modernization factory.
Synthesize labels, suggestions, result metrics, and copy from A1, the movement path,
and the IMMEDIATE PRIOR agent. Maximum semantic similarity with prior finished work. Plain English.

Project: {title}
Category id: {category_id or "(unknown)"}
Category: {cat}
A1 requirement: {req or "(custom)"}
A1 strategies: {strat_line}
A1 strategy short: {strat}
A1 why: {why or "(not provided)"}
A2 criticality: {criticality or "(not set)"}
A2 regulations: {", ".join(regs) or "(not set)"}
A2 location: {code_location or "(not set)"}
Path active ids: {path_ids or "(unknown)"}
Prior agent: {prior_id} · {prior_name}
Prior summary: {(prior_summary or "")[:450] or "(none)"}
Prior analysis focus: {focus or "(none)"}
Discovery sources: {sources or "(none)"}
Extracted rules so far: {extracted_rules}
Programs / modules known: {programs}
Enriched summary: {(enriched_summary or "")[:300]}

Default artifact ids: {[o[0] for o in default_art_opts]}
Continuity artifacts from prior: {continuity}
Default publish ids: {[o[0] for o in default_pub_opts]}
Default depth ids: {[o[0] for o in default_depth_opts]}
Seed document counts: {[{d.get('id'): d.get('value') for d in seed_docs}]}
Seed knowledge graph: {seed_kg}

Return ONLY valid JSON:
{{
  "title": "Documentation & Knowledge Graph",
  "lede": "1-2 sentences matching the snapshot tone",
  "form_heading": "Set the documentation lens",
  "context_line": "short chip from A1 + prior",
  "prior_line": "1 sentence continuity from {prior_id}",
  "artifacts_label": "What documentation should we produce?",
  "artifacts_hint": "must reference prior agent work",
  "suggested_artifacts": ["overview", "modules", "diagrams"],
  "publish_label": "Where should operators find the docs?",
  "suggested_publish": "markdown",
  "depth_label": "How deep should documentation go?",
  "suggested_depth": "standard",
  "doc_plan": "1 sentence plan",
  "result_headline": "The old system now has proper documentation — often for the first time in decades.",
  "result_body": "1-2 sentences for results banner",
  "documents": [
    {{"id":"overview","label":"System overview","value":34,"unit":"pages"}}
  ],
  "knowledge_graph": {{
    "nodes": 12847,
    "relationships": 89412,
    "rules_linked": 187,
    "rules_total": 187,
    "modules_linked": 239,
    "modules_total": 247,
    "conflicts": 7
  }},
  "evidence_hints": ["system_docs.md", "knowledge_graph.json"],
  "activity_status": "A7 ready",
  "glossary": [{{"term":"Term","def":"plain English"}}]
}}
Rules:
- suggested_artifacts subset of default artifact ids; prefer continuity from prior
- suggested_publish one of default publish ids
- suggested_depth one of: summary, standard, deep
- Exactly 6 documents covering overview, modules, diagrams, dictionary, runbooks, confluence
- knowledge_graph numbers must be positive integers; conflicts can be small
- If extracted_rules > 0, rules_linked/rules_total should reflect that scale
- Exactly 5 glossary terms
- No markdown"""

    backend = get_backend()
    try:
        import asyncio

        out = await asyncio.wait_for(
            backend.complete("A7-brief", prompt, tier="medium"),
            timeout=12.0,
        )
    except Exception as exc:  # noqa: BLE001
        out = {
            "text": "",
            "error": str(exc),
            "model": "catalog-fallback",
            "tokens_in": 0,
            "tokens_out": 0,
            "cost_usd": 0.0,
        }
    parsed = _parse_json(out.get("text", ""))
    used_fallback = not isinstance(parsed, dict) or bool(out.get("error"))

    sug_art = list(continuity)
    sug_pub = default_pub
    sug_depth = default_depth
    docs = list(seed_docs)
    kg = dict(seed_kg)
    if isinstance(parsed, dict):
        raw_a = parsed.get("suggested_artifacts") or []
        if isinstance(raw_a, list):
            picked = [str(x) for x in raw_a if str(x) in allowed_art]
            if picked:
                sug_art = picked
        p = str(parsed.get("suggested_publish") or "").strip()
        if p in allowed_pub:
            sug_pub = p
        d = str(parsed.get("suggested_depth") or "").strip()
        if d in allowed_depth:
            sug_depth = d
        raw_docs = parsed.get("documents") or []
        if isinstance(raw_docs, list) and raw_docs:
            built: list[dict[str, Any]] = []
            for item in raw_docs[:6]:
                if not isinstance(item, dict):
                    continue
                did = str(item.get("id") or "").strip()
                label = str(item.get("label") or "").strip()
                if not did or not label:
                    continue
                try:
                    value = int(item.get("value") or 0)
                except (TypeError, ValueError):
                    value = 0
                built.append({
                    "id": did,
                    "label": label,
                    "value": max(0, value),
                    "unit": str(item.get("unit") or "").strip() or "items",
                })
            if len(built) >= 4:
                docs = built
        raw_kg = parsed.get("knowledge_graph")
        if isinstance(raw_kg, dict):
            try:
                kg = {
                    "nodes": int(raw_kg.get("nodes") or kg.get("nodes") or 0),
                    "relationships": int(raw_kg.get("relationships") or kg.get("relationships") or 0),
                    "rules_linked": int(raw_kg.get("rules_linked") or kg.get("rules_linked") or 0),
                    "rules_total": int(raw_kg.get("rules_total") or kg.get("rules_total") or 0),
                    "modules_linked": int(raw_kg.get("modules_linked") or kg.get("modules_linked") or 0),
                    "modules_total": int(raw_kg.get("modules_total") or kg.get("modules_total") or 0),
                    "conflicts": int(raw_kg.get("conflicts") or kg.get("conflicts") or 0),
                }
            except (TypeError, ValueError):
                pass

    if extracted_rules > 0:
        kg["rules_total"] = max(int(kg.get("rules_total") or 0), extracted_rules)
        kg["rules_linked"] = min(int(kg.get("rules_linked") or 0) or extracted_rules, kg["rules_total"])
    if programs > 0:
        kg["modules_total"] = max(int(kg.get("modules_total") or 0), programs)
        kg["modules_linked"] = min(int(kg.get("modules_linked") or 0) or max(programs - 8, 0), kg["modules_total"])

    gloss: list[dict[str, str]] = []
    if isinstance(parsed, dict) and isinstance(parsed.get("glossary"), list):
        for item in parsed["glossary"][:5]:
            if not isinstance(item, dict):
                continue
            term = str(item.get("term") or "").strip()
            definition = str(item.get("def") or item.get("definition") or "").strip()
            if term and definition:
                gloss.append({"term": term, "def": definition})
    if len(gloss) < 4:
        gloss = fallback_glossary[:5]

    hints = (
        parsed.get("evidence_hints")
        if isinstance(parsed, dict) and isinstance(parsed.get("evidence_hints"), list)
        else []
    )
    evidence_hints = [str(h) for h in hints[:6]] or [
        "system_docs.md",
        "sequence_diagrams.mmd",
        "data_dictionary.json",
        "knowledge_graph.json",
    ]
    banner = profile.get("result_banner") or {}

    def _p(key: str, fallback: str) -> str:
        if isinstance(parsed, dict):
            return str(parsed.get(key) or "").strip() or fallback
        return fallback

    prior_line_fb = (
        f"Continues {prior_id} ({prior_name})"
        + (f" — {extracted_rules} rules ready to link" if extracted_rules else "")
        + (f"; {programs} modules known" if programs else "")
        + "."
    )

    return {
        "title": _p("title", str(profile.get("title") or "Documentation & Knowledge Graph")),
        "lede": _p("lede", str(profile.get("lede") or "")),
        "form_heading": _p("form_heading", str(profile.get("form_heading") or "Set the documentation lens")),
        "domain_kicker": str(profile.get("domain_kicker") or "Domain B · Understand the old code · Step A7"),
        "context_line": _p("context_line", f"Based on «{title}» · {cat} · prior {prior_id} · {strat}"),
        "prior_line": _p("prior_line", prior_line_fb),
        "category_id": category_id,
        "prior_agent_id": prior_id,
        "prior_agent_name": prior_name,
        "path_active_ids": path_ids,
        "artifacts_label": _p("artifacts_label", str(artifacts.get("label") or "")),
        "artifacts_hint": _p("artifacts_hint", str(artifacts.get("hint") or "")),
        "artifacts_options": default_art_opts,
        "suggested_artifacts": sug_art,
        "publish_label": _p("publish_label", str(publish.get("label") or "")),
        "publish_options": default_pub_opts,
        "suggested_publish": sug_pub,
        "depth_label": _p("depth_label", str(depth.get("label") or "")),
        "depth_options": default_depth_opts,
        "suggested_depth": sug_depth,
        "doc_plan": _p(
            "doc_plan",
            f"Document «{cat}» using outputs from {prior_id} for «{title}», then link rules and modules.",
        ),
        "result_headline": _p(
            "result_headline",
            str(banner.get("headline") or "The old system now has proper documentation — often for the first time in decades."),
        ),
        "result_body": _p("result_body", str(banner.get("body") or "")),
        "documents": docs,
        "knowledge_graph": kg,
        "evidence_hints": evidence_hints,
        "activity_status": _p("activity_status", f"A7 ready for {title}"),
        "glossary": gloss,
        "warning": "LLM unavailable — using category-shaped A7 form" if used_fallback else "",
        **_meta(out),
    }


async def generate_a9_brief(
    project_name: str,
    category_name: str,
    requirement: str,
    strategies: list[str],
    strategy_short: str,
    why_modernize: str,
    category_id: str = "",
    prior_agent_id: str = "G1",
    prior_agent_name: str = "Discovery Approval",
    path_active_ids: list[str] | None = None,
    *,
    approved_rule_count: int = 0,
    programs: int = 0,
    source_language: str = "",
    target_stack_hint: str = "",
    analysis_headline: str = "",
    project_label: str = "",
    g1_approved: bool = False,
) -> dict[str, Any]:
    """LLM-shaped Domain Decomposition (A9) from A1 + path + discovery/rules context."""
    import asyncio
    import logging

    from app.intake.catalog import a9_form_profile

    log = logging.getLogger(__name__)
    title = (project_name or "Modernization initiative").strip()
    cat = (category_name or "Legacy estate").strip()
    req = (requirement or "").strip()
    strat = (strategy_short or (strategies[0] if strategies else "")).strip()
    why = (why_modernize or "").strip()
    profile = a9_form_profile(category_id)
    shape = profile.get("shape") or {}
    order = profile.get("order") or {}
    shape_opts = [[str(a), str(b)] for a, b in shape.get("options") or []]
    order_opts = [[str(a), str(b)] for a, b in order.get("options") or []]
    allowed_shape = {o[0] for o in shape_opts}
    allowed_order = {o[0] for o in order_opts}
    default_shape = str(shape.get("suggested") or "modular")
    if default_shape not in allowed_shape:
        default_shape = next(iter(allowed_shape), "modular")
    default_order = str(order.get("suggested") or "safe")
    if default_order not in allowed_order:
        default_order = next(iter(allowed_order), "safe")

    path_ids = [str(x) for x in (path_active_ids or []) if x]
    rules_n = max(int(approved_rule_count or 0), 0)
    prog_n = max(int(programs or 0), 0)

    # Continuity: infer shape from A1 strategy / requirement (Fortran→Java, microservices, etc.).
    blob = f"{req} {strat} {why} {source_language} {target_stack_hint}".lower()
    continuity_shape = default_shape
    if any(t in blob for t in ("microservice", "decompose", "separate service", "independent")):
        continuity_shape = "micro" if "micro" in allowed_shape else continuity_shape
    elif any(t in blob for t in ("modular", "module", "clear wall", "monolith with")):
        continuity_shape = "modular" if "modular" in allowed_shape else continuity_shape
    elif any(t in blob for t in ("strangler", "slice", "hybrid", "busiest")):
        continuity_shape = "hybrid" if "hybrid" in allowed_shape else continuity_shape
    elif any(t in blob for t in ("refactor", "java", "fortran", "cobol")):
        continuity_shape = "modular" if "modular" in allowed_shape else continuity_shape

    continuity_order = default_order
    if any(t in blob for t in ("fast", "visible", "pilot", "mvp")):
        continuity_order = "small" if "small" in allowed_order else continuity_order
    elif any(t in blob for t in ("business critical", "revenue", "premium", "pricing")):
        continuity_order = "value" if "value" in allowed_order else continuity_order
    elif any(t in blob for t in ("safe", "risk", "production", "strangler")):
        continuity_order = "safe" if "safe" in allowed_order else continuity_order

    count = {"micro": 6, "modular": 3, "hybrid": 4}.get(continuity_shape, 4)
    first_labels = {
        "safe": "Document production",
        "value": "Premium pricing",
        "small": "Reference data",
    }
    if "fortran" in blob or "cobol" in blob or "legacy" in blob:
        first_labels = {
            "safe": "Reference data",
            "value": "Core compute",
            "small": "Documents",
        }

    default_checks: list[list[str]] = []
    for cid, tmpl in profile.get("checklist_templates") or []:
        default_checks.append([str(cid), str(tmpl)])
    default_checks.extend([
        ["path_ok", f"Confirm this step still belongs on the path for «{cat}»"],
        ["req_ok", f"Confirm scope still matches the A1 requirement: «{(req or title)[:120]}»"],
        ["strat_ok", f"Confirm the modernization strategy still applies: «{strat or 'locked strategy'}»"],
        ["proj_ok", f"Confirm work remains under project «{(project_label or title)[:120]}»"],
    ])

    seed_candidates = []
    for item in profile.get("candidate_services") or []:
        if isinstance(item, (list, tuple)) and len(item) >= 2:
            seed_candidates.append({
                "name": str(item[0]),
                "description": str(item[1]),
                "replaces": [str(x) for x in (item[2] if len(item) > 2 else [])],
            })

    fallback_glossary = [
        {"term": "Domain decomposition", "def": "Cutting a large legacy system into smaller pieces with clear ownership."},
        {"term": "Bounded context", "def": "A piece with its own language, data, and rules that can evolve mostly on its own."},
        {"term": "Strangler", "def": "Replace the old system piece by piece while the old system keeps running."},
        {"term": "Cohesion", "def": "How well the code inside a piece belongs together."},
        {"term": cat.split(". ", 1)[-1][:40] if cat else "Legacy", "def": f"Focus area locked in A1: {cat}."},
    ]

    prompt = f"""You design the Domain decomposition (A9) screen for a modernization factory.
Synthesize form suggestions, checklist labels, proposed bounded contexts, and copy from A1,
the movement path, and prior discovery / rules work. Maximum semantic similarity with prior
finished work and what G2 will later approve. Plain English.

Project: {title}
Category: {cat} ({category_id or "unknown"})
A1 requirement: {req or "(custom)"}
A1 strategy: {strat or "(not set)"}
A1 why: {why or "(not provided)"}
Project label: {project_label or title}
Path active ids: {path_ids or "(unknown)"}
Prior: {prior_agent_id} · {prior_agent_name}
G1 approved: {g1_approved}
Source language: {source_language or "(unknown)"}
Target stack hint: {target_stack_hint or "(unknown)"}
Approved rules: {rules_n}
Programs/modules: {prog_n}
Analysis headline: {analysis_headline or "(none)"}
Continuity suggested shape: {continuity_shape}
Continuity suggested order: {continuity_order}
Default expected piece count for shape: {count}
Seed candidates: {seed_candidates}
Default checklist: {default_checks}

Return ONLY valid JSON:
{{
  "title": "Domain decomposition",
  "lede": "Proposes service or module boundaries from measured dependencies and approved rules — foundational for strangler/slice strategies.",
  "form_heading": "Set the decomposition shape",
  "context_line": "short chip from A1 + strategy + prior",
  "prior_line": "1 sentence continuity from prior agent / rules / language",
  "shape_label": "What shape should the new system be?",
  "suggested_shape": "modular",
  "order_label": "Which piece should we build first?",
  "suggested_order": "safe",
  "decomposition_plan": "1 sentence plan naming shape, piece count, and first slice",
  "checklist_heading": "Operator checklist (optional)",
  "checklist_note": "Combines standard controls with A1 category, requirement, strategy, and path.",
  "checklist": [{{"id":"cuts_ok","label":"Confirm…","required":true}}],
  "result_headline": "This is a proposal. A person decides at the next gate.",
  "result_body": "1-2 sentences for results banner",
  "proposed_contexts": [
    {{"name":"Service","description":"plain English role","replaces":["PROG1"],"cohesion":0.82,"coupling":0.14}}
  ],
  "build_first_label": "Reference data",
  "metrics": [
    {{"id":"pieces","label":"Proposed pieces","value":{count},"unit":""}},
    {{"id":"rules_covered","label":"Rules covered","value":{rules_n},"unit":""}},
    {{"id":"avg_cohesion","label":"Avg cohesion","value":80,"unit":"%"}},
    {{"id":"avg_coupling","label":"Avg coupling","value":16,"unit":"%"}}
  ],
  "evidence_hints": ["domain_model.md", "service_catalogue.json", "adr/0001-boundaries.md"],
  "activity_status": "A9 ready",
  "glossary": [{{"term":"Term","def":"plain English"}}]
}}
Rules:
- suggested_shape one of: micro, modular, hybrid; prefer continuity ({continuity_shape})
- suggested_order one of: safe, value, small; prefer continuity ({continuity_order})
- Exactly 7 checklist items; keep ids from defaults when possible; refine labels with real requirement/strategy/language
- Checklist is optional for Run (UI does not block) but mark each item required=true so progress counts
- proposed_contexts length must match shape: micro=6, modular=3, hybrid=4
- Names and descriptions must echo A1 requirement / strategy (e.g. Fortran→Java refactor language)
- replaces arrays should look like legacy program / module codes when source language is known
- Exactly 5 glossary terms
- No markdown"""

    backend = get_backend()
    out: dict[str, Any] = {
        "text": "",
        "error": "not attempted",
        "model": "catalog-fallback",
        "tokens_in": 0,
        "tokens_out": 0,
        "cost_usd": 0.0,
    }
    for attempt in range(2):
        try:
            out = await asyncio.wait_for(
                backend.complete(
                    "A9-brief",
                    prompt,
                    tier="medium",
                    response_format={"type": "json_object"},
                ),
                timeout=45.0,
            )
            if out.get("text") and not out.get("error"):
                break
            log.warning("A9-brief attempt %s empty/error: %s", attempt + 1, out.get("error"))
        except Exception as exc:  # noqa: BLE001
            log.warning("A9-brief attempt %s failed: %s", attempt + 1, exc)
            out = {
                "text": "",
                "error": str(exc),
                "model": "catalog-fallback",
                "tokens_in": 0,
                "tokens_out": 0,
                "cost_usd": 0.0,
            }

    parsed = _parse_json(out.get("text", ""))
    used_fallback = not isinstance(parsed, dict)

    sug_shape = continuity_shape
    sug_order = continuity_order
    checklist = [{"id": a, "label": b, "required": True} for a, b in default_checks]
    count = {"micro": 6, "modular": 3, "hybrid": 4}.get(sug_shape, 4)
    build_first = first_labels.get(sug_order, "Reference data")
    proposed: list[dict[str, Any]] = []
    for i, seed in enumerate(seed_candidates[:count]):
        proposed.append({
            "name": seed["name"],
            "description": seed["description"],
            "replaces": list(seed.get("replaces") or []),
            "cohesion": round(0.82 - i * 0.03, 2),
            "coupling": round(0.14 + i * 0.02, 2),
        })
    metrics = [
        {"id": "pieces", "label": "Proposed pieces", "value": count, "unit": ""},
        {"id": "rules_covered", "label": "Rules covered", "value": rules_n, "unit": ""},
        {"id": "avg_cohesion", "label": "Avg cohesion", "value": 80, "unit": "%"},
        {"id": "avg_coupling", "label": "Avg coupling", "value": 16, "unit": "%"},
    ]

    if isinstance(parsed, dict):
        s = str(parsed.get("suggested_shape") or "").strip()
        if s in allowed_shape:
            sug_shape = s
            count = {"micro": 6, "modular": 3, "hybrid": 4}.get(sug_shape, 4)
        o = str(parsed.get("suggested_order") or "").strip()
        if o in allowed_order:
            sug_order = o
        bf = str(parsed.get("build_first_label") or "").strip()
        if bf:
            build_first = bf
        else:
            build_first = first_labels.get(sug_order, build_first)

        label_by_id = {a: b for a, b in default_checks}
        raw_checks = parsed.get("checklist") or []
        if isinstance(raw_checks, list):
            refined: dict[str, str] = {}
            for item in raw_checks[:8]:
                if not isinstance(item, dict):
                    continue
                cid = str(item.get("id") or "").strip()
                label = str(item.get("label") or "").strip()
                if cid in label_by_id and label:
                    refined[cid] = label
            if refined:
                checklist = [
                    {"id": a, "label": refined.get(a, b), "required": True}
                    for a, b in default_checks
                ]

        raw_ctx = parsed.get("proposed_contexts") or []
        if isinstance(raw_ctx, list) and raw_ctx:
            built: list[dict[str, Any]] = []
            for i, item in enumerate(raw_ctx[:count]):
                if not isinstance(item, dict):
                    continue
                name = str(item.get("name") or "").strip()
                if not name:
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
                built.append({
                    "name": name,
                    "description": str(item.get("description") or "").strip() or "Proposed bounded context",
                    "replaces": [str(x) for x in replaces if x][:6],
                    "cohesion": round(max(0.0, min(cohesion, 1.0)), 2),
                    "coupling": round(max(0.0, min(coupling, 1.0)), 2),
                })
            if built:
                proposed = built[:count]

        raw_metrics = parsed.get("metrics") or []
        if isinstance(raw_metrics, list) and raw_metrics:
            built_m: list[dict[str, Any]] = []
            for item in raw_metrics[:4]:
                if not isinstance(item, dict):
                    continue
                label = str(item.get("label") or "").strip()
                if not label:
                    continue
                try:
                    value = int(item.get("value") or 0)
                except (TypeError, ValueError):
                    value = 0
                mid = str(item.get("id") or label.lower().replace(" ", "_"))[:40]
                if mid == "pieces":
                    value = max(value, len(proposed) or count)
                elif mid == "rules_covered":
                    value = max(value, rules_n)
                built_m.append({
                    "id": mid,
                    "label": label,
                    "value": max(0, value),
                    "unit": str(item.get("unit") or "").strip(),
                })
            if len(built_m) >= 3:
                metrics = built_m

    # Ensure piece metric matches proposed length.
    for m in metrics:
        if m.get("id") == "pieces":
            m["value"] = len(proposed) or count

    gloss: list[dict[str, str]] = []
    if isinstance(parsed, dict) and isinstance(parsed.get("glossary"), list):
        for item in parsed["glossary"][:5]:
            if not isinstance(item, dict):
                continue
            term = str(item.get("term") or "").strip()
            definition = str(item.get("def") or item.get("definition") or "").strip()
            if term and definition:
                gloss.append({"term": term, "def": definition})
    if len(gloss) < 4:
        gloss = fallback_glossary[:5]

    hints = (
        parsed.get("evidence_hints")
        if isinstance(parsed, dict) and isinstance(parsed.get("evidence_hints"), list)
        else []
    )
    evidence_hints = [str(h) for h in hints[:6]] or [
        "domain_model.md",
        "service_catalogue.json",
        "adr/0001-boundaries.md",
    ]
    banner = profile.get("result_banner") or {}

    def _p(key: str, fallback: str) -> str:
        if isinstance(parsed, dict):
            return str(parsed.get(key) or "").strip() or fallback
        return fallback

    prior_line_fb = (
        f"Continues {prior_agent_id} ({prior_agent_name})"
        + (" — discovery approved" if g1_approved else "")
        + f"; proposing {len(proposed) or count} pieces under «{strat or 'strategy'}»"
        + (f" from {source_language}" if source_language else "")
        + (f" → {target_stack_hint}" if target_stack_hint else "")
        + f"; first slice: {build_first}."
    )

    return {
        "title": _p("title", str(profile.get("title") or "Domain decomposition")),
        "lede": _p("lede", str(profile.get("lede") or "")),
        "form_heading": _p("form_heading", str(profile.get("form_heading") or "Set the decomposition shape")),
        "domain_kicker": str(profile.get("domain_kicker") or "Domain D · Design & build the new · Step A9"),
        "context_line": _p(
            "context_line",
            f"Based on «{title}» · {cat} · {strat or 'strategy'}",
        ),
        "prior_line": _p("prior_line", prior_line_fb),
        "category_id": category_id,
        "prior_agent_id": prior_agent_id,
        "prior_agent_name": prior_agent_name,
        "path_active_ids": path_ids,
        "g1_approved": g1_approved,
        "approved_rule_count": rules_n,
        "programs": prog_n,
        "source_language": source_language,
        "target_stack_hint": target_stack_hint,
        "shape_label": _p("shape_label", str(shape.get("label") or "")),
        "shape_hint": str(shape.get("hint") or ""),
        "shape_options": shape_opts,
        "suggested_shape": sug_shape,
        "order_label": _p("order_label", str(order.get("label") or "")),
        "order_hint": str(order.get("hint") or ""),
        "order_options": order_opts,
        "suggested_order": sug_order,
        "build_first_label": build_first,
        "decomposition_plan": _p(
            "decomposition_plan",
            f"Propose {len(proposed) or count} {sug_shape} pieces under «{strat or 'strategy'}»; build «{build_first}» first.",
        ),
        "checklist_heading": _p("checklist_heading", "Operator checklist (optional)"),
        "checklist_note": _p(
            "checklist_note",
            "Checklist items combine standard controls with your A1 category, requirement, strategy, and the agent & gate map combination.",
        ),
        "checklist": checklist,
        "result_headline": _p(
            "result_headline",
            str(banner.get("headline") or "This is a proposal. A person decides at the next gate."),
        ),
        "result_body": _p("result_body", str(banner.get("body") or "")),
        "proposed_contexts": proposed,
        "metrics": metrics,
        "evidence_hints": evidence_hints,
        "activity_status": _p("activity_status", f"A9 ready for {title}"),
        "glossary": gloss,
        "warning": "LLM unavailable — using category-shaped A9 form" if used_fallback else "",
        **_meta(out),
    }


async def generate_a10_brief(
    project_name: str,
    category_name: str,
    requirement: str,
    strategies: list[str],
    strategy_short: str,
    why_modernize: str,
    enriched_summary: str = "",
    category_id: str = "",
    criticality: str = "",
    regulations: list[str] | None = None,
    code_location: str = "",
    prior_agent_id: str = "",
    prior_agent_name: str = "",
    prior_summary: str = "",
    path_active_ids: list[str] | None = None,
    service_names: list[str] | None = None,
    service_summaries: list[str] | None = None,
    shape: str = "",
    build_first: str = "",
    programs: int = 0,
    rules_total: int = 0,
    kg_nodes: int = 0,
    journeys: int = 0,
    target_stack: str = "",
    source_language: str = "",
    loc: int = 0,
    interfaces: int = 0,
    copybooks: int = 0,
    batch_jobs: int = 0,
    analysis_headline: str = "",
    discovery_sources: list[str] | None = None,
    legacy_stack: str = "",
) -> dict[str, Any]:
    """LLM-shaped Target Architecture (A10) from A1 + path + A9/prior discovery."""
    from app.intake.catalog import a10_form_profile

    title = (project_name or "Modernization initiative").strip()
    cat = (category_name or "Legacy estate").strip()
    req = (requirement or "").strip()
    strat = (strategy_short or (strategies[0] if strategies else "Incremental modernization")).strip()
    why = (why_modernize or enriched_summary or "").strip()
    strat_line = "; ".join(s for s in strategies if s) or strat
    regs = [str(r) for r in (regulations or []) if r]
    profile = a10_form_profile(category_id)
    comms = profile.get("comms") or {}
    depth = profile.get("depth") or {}
    default_comms_opts = [[str(a), str(b)] for a, b in comms.get("options") or []]
    default_depth_opts = [[str(a), str(b)] for a, b in depth.get("options") or []]
    allowed_comms = {o[0] for o in default_comms_opts}
    allowed_depth = {o[0] for o in default_depth_opts}
    default_comms = str(comms.get("suggested") or "mixed")
    if default_comms not in allowed_comms:
        default_comms = next(iter(allowed_comms), "mixed")
    default_depth = str(depth.get("suggested") or "standard")
    if default_depth not in allowed_depth:
        default_depth = next(iter(allowed_depth), "standard")
    prior_id = (prior_agent_id or "").strip() or "A9"
    prior_name = (prior_agent_name or "").strip() or "Domain decomposition"
    path_ids = [str(x) for x in (path_active_ids or []) if x]
    services = [str(x) for x in (service_names or []) if x]
    svc_lines = [str(x) for x in (service_summaries or []) if x]
    seed_choices = list(profile.get("design_choices") or [])
    seed_contracts = list(profile.get("contracts_generated") or [])
    seed_previous = dict(profile.get("previous_architecture") or {})
    sources = [str(x) for x in (discovery_sources or []) if x]
    svc_n = max(len(services), 1)
    lang = (source_language or legacy_stack or "").strip()
    if not lang:
        req_l = req.lower()
        for token in ("fortran", "cobol", "pl/i", "pli", "natural", "java", "c#", "python"):
            if token in req_l:
                lang = token.upper() if token != "pl/i" else "PL/I"
                break
        if not lang:
            lang = "Legacy"

    # Deterministic as-is seed grounded in discovery counts.
    prev_traits = list(seed_previous.get("design_traits") or [])
    if not prev_traits:
        prev_traits = [
            {"label": "System shape", "value": "Monolith / tightly coupled"},
            {"label": "Integration style", "value": "Direct CALL + batch files"},
            {"label": "Authentication", "value": "Platform / shared credentials"},
            {"label": "Data ownership", "value": "Shared tables & copybooks"},
            {"label": "Observability", "value": "Job logs only"},
        ]
    # Inject language / stack into first trait when known.
    if lang and prev_traits:
        first = dict(prev_traits[0])
        if "System shape" in first.get("label", ""):
            first["value"] = f"{lang} monolith / tightly coupled"
            prev_traits[0] = first
        else:
            prev_traits = [{"label": "Runtime stack", "value": lang}, *prev_traits][:5]

    iface_n = interfaces or batch_jobs or max(programs // 8, 0) or 0
    layout_n = copybooks or max(programs // 2, 0) or 0
    prev_metrics = [
        {"id": "programs", "label": "Programs / modules", "value": programs or 0, "unit": ""},
        {"id": "interfaces", "label": "Batch / interface points", "value": iface_n, "unit": ""},
        {
            "id": "ownership",
            "label": "Shared data layouts",
            "value": layout_n,
            "unit": "copybooks / tables",
        },
        {
            "id": "adrs",
            "label": "Documented decisions",
            "value": 0,
            "unit": "on record",
        },
    ]
    # Prefer profile metric labels when present, but ground values.
    seed_metrics = list(seed_previous.get("estate_metrics") or [])
    if seed_metrics:
        by_id = {str(m.get("id")): m for m in seed_metrics if isinstance(m, dict)}
        grounded_prev: list[dict[str, Any]] = []
        for m in prev_metrics:
            base = by_id.get(str(m["id"])) or {}
            grounded_prev.append({
                "id": m["id"],
                "label": str(base.get("label") or m["label"]),
                "value": int(m["value"] or 0),
                "unit": str(base.get("unit") or m["unit"] or ""),
            })
        prev_metrics = grounded_prev

    prev_seed = {
        "headline": str(seed_previous.get("headline") or "As-is architecture captured."),
        "body": str(
            seed_previous.get("body")
            or (
                f"Discovery shows a {lang} estate"
                + (f" with {programs} programs" if programs else "")
                + " still running without explicit service contracts."
            )
        ),
        "design_traits": prev_traits,
        "estate_metrics": prev_metrics,
    }

    # Continuity: strategy / shape → suggested comms.
    strat_l = strat_line.lower()
    shape_l = (shape or "").lower()
    continuity_comms = default_comms
    if "strangler" in strat_l or "incremental" in strat_l or shape_l == "hybrid":
        continuity_comms = "mixed" if "mixed" in allowed_comms else continuity_comms
    elif "api" in strat_l or "facade" in strat_l or shape_l == "modular":
        continuity_comms = "sync" if "sync" in allowed_comms else continuity_comms
    elif "event" in strat_l or "async" in strat_l or shape_l == "micro":
        continuity_comms = "async" if "async" in allowed_comms else continuity_comms

    fallback_glossary = [
        {"term": "Interface agreement", "def": "A contract that says how one service talks to another — APIs, events, auth."},
        {"term": "Bounded context", "def": "A slice of the business with its own language and ownership of data."},
        {"term": "OpenAPI", "def": "A machine-readable description of REST endpoints builders and bridges must obey."},
        {"term": "Architecture decision record", "def": "A short note explaining why a design choice was made."},
        {"term": cat.split(". ", 1)[-1][:40] if cat else "Legacy", "def": f"Focus area locked in A1: {cat}."},
    ]

    prompt = f"""You design the Target Architecture (A10) comparison screen for a modernization factory.
Synthesize BOTH the as-is (previous) architecture from discovery AND the target architecture
from A1 + path + A9. Maximum semantic similarity with prior finished work. Plain English.
Numbers must feel grounded in the estate size and service count.

Project: {title}
Category id: {category_id or "(unknown)"}
Category: {cat}
A1 requirement: {req or "(custom)"}
A1 strategies: {strat_line}
A1 strategy short: {strat}
A1 why: {why or "(not provided)"}
Target stack hint: {target_stack or "(infer from requirement)"}
Legacy stack / language: {lang}
LOC: {loc or "(unknown)"}
Interfaces known: {interfaces}
Copybooks / layouts: {copybooks}
Batch jobs: {batch_jobs}
Analysis headline: {(analysis_headline or "")[:200] or "(none)"}
Discovery sources: {sources or "(none)"}
A2 criticality: {criticality or "(not set)"}
A2 regulations: {", ".join(regs) or "(not set)"}
A2 location: {code_location or "(not set)"}
Path active ids: {path_ids or "(unknown)"}
Prior agent: {prior_id} · {prior_name}
Prior summary: {(prior_summary or "")[:500] or "(none)"}
A9 shape: {shape or "(unknown)"}
A9 build first: {build_first or "(unknown)"}
A9 services ({svc_n}): {services or "(none yet)"}
A9 service details: {svc_lines[:8] or "(none)"}
Programs / modules: {programs}
Rules total: {rules_total}
KG nodes: {kg_nodes}
Runtime journeys: {journeys}
Enriched summary: {(enriched_summary or "")[:280]}

Default comms ids: {[o[0] for o in default_comms_opts]}
Continuity suggested comms: {continuity_comms}
Default depth ids: {[o[0] for o in default_depth_opts]}
Seed previous architecture: {prev_seed}
Seed design choices: {seed_choices}
Seed contract metrics: {seed_contracts}

Return ONLY valid JSON:
{{
  "title": "Target Architecture",
  "lede": "1 sentence matching snapshot tone about how services talk",
  "form_heading": "Set the communication style",
  "context_line": "short chip from A1 + A9 + strategy",
  "prior_line": "1 sentence continuity from {prior_id} / A9 services",
  "comms_label": "How should the pieces talk to each other?",
  "comms_hint": "must reference A9 boundaries and strategy",
  "suggested_comms": "mixed",
  "depth_label": "How deep should contracts go?",
  "suggested_depth": "standard",
  "architecture_plan": "1 sentence plan tied to services and target stack",
  "result_headline": "Target design ready.",
  "result_body": "1-2 sentences: every new service has a specification…",
  "previous_architecture": {{
    "headline": "As-is architecture captured.",
    "body": "1-2 sentences describing the current estate from discovery",
    "design_traits": [
      {{"label":"System shape","value":"{lang} monolith / tightly coupled"}},
      {{"label":"Integration style","value":"Direct CALL + batch files"}},
      {{"label":"Authentication","value":"Platform / shared credentials"}},
      {{"label":"Data ownership","value":"Shared tables & copybooks"}},
      {{"label":"Observability","value":"Job logs only"}}
    ],
    "estate_metrics": [
      {{"id":"programs","label":"Programs / modules","value":{programs or 0},"unit":""}},
      {{"id":"interfaces","label":"Batch / interface points","value":{iface_n},"unit":""}},
      {{"id":"ownership","label":"Shared data layouts","value":{layout_n},"unit":"copybooks / tables"}},
      {{"id":"adrs","label":"Documented decisions","value":0,"unit":"on record"}}
    ]
  }},
  "design_choices": [
    {{"label":"Sync API style","value":"REST + OpenAPI"}},
    {{"label":"Async messaging","value":"Kafka events"}},
    {{"label":"Authentication","value":"OAuth 2.0 + mTLS"}},
    {{"label":"Idempotency","value":"Request-ID header"}},
    {{"label":"Observability","value":"OpenTelemetry"}}
  ],
  "contracts_generated": [
    {{"id":"rest","label":"REST endpoints","value":47,"unit":""}},
    {{"id":"events","label":"Event contracts","value":23,"unit":""}},
    {{"id":"ownership","label":"Data ownership rules","value":148,"unit":"tables mapped"}},
    {{"id":"adrs","label":"Architecture decisions","value":32,"unit":"documented"}}
  ],
  "comparison_deltas": [
    {{"aspect":"System shape","from":"Monolith","to":"{svc_n} bounded services","change":"split"}},
    {{"aspect":"Contracts","from":"Implicit CALL/batch","to":"OpenAPI + events","change":"formalized"}}
  ],
  "evidence_hints": ["contracts/openapi.yaml", "contracts/asyncapi.yaml", "adr/0002-comms.md"],
  "activity_status": "A10 ready",
  "glossary": [{{"term":"Term","def":"plain English"}}]
}}
Rules:
- suggested_comms one of default comms ids; prefer continuity
- suggested_depth one of: standard, deep
- Exactly 5 previous design_traits grounded in discovery language/stack
- Exactly 4 previous estate_metrics; programs/interfaces/layouts MUST reflect provided counts when > 0
- Exactly 5 target design_choices; values must fit strategy, regs, and target stack
- Exactly 4 contracts_generated with positive integers
- Scale REST/events roughly with service count ({svc_n}); ownership with programs/rules when available
- Exactly 4-6 comparison_deltas showing meaningful previous → target changes
- Exactly 5 glossary terms
- No markdown"""

    backend = get_backend()
    try:
        import asyncio

        out = await asyncio.wait_for(
            backend.complete("A10-brief", prompt, tier="medium"),
            timeout=45.0,
        )
    except Exception as exc:  # noqa: BLE001
        out = {
            "text": "",
            "error": str(exc),
            "model": "catalog-fallback",
            "tokens_in": 0,
            "tokens_out": 0,
            "cost_usd": 0.0,
        }
    parsed = _parse_json(out.get("text", ""))
    used_fallback = not isinstance(parsed, dict) or bool(out.get("error"))

    sug_comms = continuity_comms
    sug_depth = default_depth
    choices = list(seed_choices)
    contracts = list(seed_contracts)
    previous = dict(prev_seed)
    deltas: list[dict[str, str]] = []
    if isinstance(parsed, dict):
        c = str(parsed.get("suggested_comms") or "").strip()
        if c in allowed_comms:
            sug_comms = c
        d = str(parsed.get("suggested_depth") or "").strip()
        if d in allowed_depth:
            sug_depth = d
        raw_choices = parsed.get("design_choices") or []
        if isinstance(raw_choices, list) and raw_choices:
            built_c: list[dict[str, str]] = []
            for item in raw_choices[:5]:
                if not isinstance(item, dict):
                    continue
                label = str(item.get("label") or "").strip()
                value = str(item.get("value") or "").strip()
                if label and value:
                    built_c.append({"label": label, "value": value})
            if len(built_c) >= 4:
                choices = built_c
        raw_contracts = parsed.get("contracts_generated") or []
        if isinstance(raw_contracts, list) and raw_contracts:
            built: list[dict[str, Any]] = []
            for item in raw_contracts[:4]:
                if not isinstance(item, dict):
                    continue
                label = str(item.get("label") or "").strip()
                if not label:
                    continue
                try:
                    value = int(item.get("value") or 0)
                except (TypeError, ValueError):
                    value = 0
                built.append({
                    "id": str(item.get("id") or label.lower().replace(" ", "_"))[:40],
                    "label": label,
                    "value": max(0, value),
                    "unit": str(item.get("unit") or "").strip(),
                })
            if len(built) >= 3:
                contracts = built
        raw_prev = parsed.get("previous_architecture")
        if isinstance(raw_prev, dict):
            ph = str(raw_prev.get("headline") or "").strip()
            pb = str(raw_prev.get("body") or "").strip()
            traits: list[dict[str, str]] = []
            for item in (raw_prev.get("design_traits") or [])[:5]:
                if not isinstance(item, dict):
                    continue
                label = str(item.get("label") or "").strip()
                value = str(item.get("value") or "").strip()
                if label and value:
                    traits.append({"label": label, "value": value})
            metrics: list[dict[str, Any]] = []
            for item in (raw_prev.get("estate_metrics") or [])[:4]:
                if not isinstance(item, dict):
                    continue
                label = str(item.get("label") or "").strip()
                if not label:
                    continue
                try:
                    value = int(item.get("value") or 0)
                except (TypeError, ValueError):
                    value = 0
                metrics.append({
                    "id": str(item.get("id") or label.lower().replace(" ", "_"))[:40],
                    "label": label,
                    "value": max(0, value),
                    "unit": str(item.get("unit") or "").strip(),
                })
            body_text = pb or previous["body"]
            if lang and lang.upper() != "COBOL":
                import re

                body_text = re.sub(r"\bCOBOL\b", lang, body_text, flags=re.IGNORECASE)
                body_text = re.sub(r"\bCOBOL monolith\b", f"{lang} monolith", body_text, flags=re.IGNORECASE)

                clean_traits = []
                for t in (traits if len(traits) >= 4 else previous["design_traits"]):
                    if isinstance(t, dict):
                        val = str(t.get("value") or "")
                        val = re.sub(r"\bCOBOL\b", lang, val, flags=re.IGNORECASE)
                        clean_traits.append({**t, "value": val})
                if clean_traits:
                    traits = clean_traits

            previous = {
                "headline": ph or previous["headline"],
                "body": body_text,
                "design_traits": traits if len(traits) >= 4 else previous["design_traits"],
                "estate_metrics": metrics if len(metrics) >= 3 else previous["estate_metrics"],
            }
        raw_deltas = parsed.get("comparison_deltas") or []
        if isinstance(raw_deltas, list):
            for item in raw_deltas[:6]:
                if not isinstance(item, dict):
                    continue
                aspect = str(item.get("aspect") or "").strip()
                frm = str(item.get("from") or "").strip()
                to = str(item.get("to") or "").strip()
                if lang and lang.upper() != "COBOL" and ("COBOL" in frm or "cobol" in frm.lower()):
                    import re

                    frm = re.sub(r"\bCOBOL\b", lang, frm, flags=re.IGNORECASE)
                if aspect and frm and to:
                    deltas.append({
                        "aspect": aspect,
                        "from": frm,
                        "to": to,
                        "change": str(item.get("change") or "").strip(),
                    })

    # Re-ground previous metrics to live discovery counts (never invent away real estate size).
    grounded_prev_metrics: list[dict[str, Any]] = []
    for item in previous.get("estate_metrics") or prev_metrics:
        if not isinstance(item, dict):
            continue
        mid = str(item.get("id") or "")
        try:
            value = int(item.get("value") or 0)
        except (TypeError, ValueError):
            value = 0
        if mid == "programs" and programs:
            value = programs
        elif mid == "interfaces" and (interfaces or batch_jobs or iface_n):
            value = interfaces or batch_jobs or iface_n
        elif mid == "ownership" and (copybooks or layout_n):
            value = copybooks or layout_n
        grounded_prev_metrics.append({
            "id": mid or str(item.get("label") or "metric").lower().replace(" ", "_")[:40],
            "label": str(item.get("label") or mid),
            "value": max(0, value),
            "unit": str(item.get("unit") or "").strip(),
        })
    if grounded_prev_metrics:
        previous["estate_metrics"] = grounded_prev_metrics

    # Ground target metrics to live estate when LLM under/over-shoots.
    if svc_n > 1 or programs or rules_total:
        scale = max(svc_n / 6.0, 0.55)
        if sug_depth == "deep":
            scale *= 1.35
        grounded: list[dict[str, Any]] = []
        for item in contracts:
            vid = str(item.get("id") or "")
            base = int(item.get("value") or 0)
            if vid == "rest":
                base = max(base, svc_n * (10 if sug_comms != "async" else 6))
            elif vid == "events":
                base = max(base, svc_n * (6 if sug_comms != "sync" else 2))
            elif vid == "ownership":
                base = max(base, programs or rules_total or svc_n * 12)
            elif vid == "adrs":
                base = max(base, svc_n * 4 + (8 if sug_depth == "deep" else 4))
            grounded.append({**item, "value": int(round(base * (scale if base < 8 else 1.0)))})
        if grounded:
            contracts = grounded

    if not deltas:
        deltas = [
            {
                "aspect": "System shape",
                "from": f"{lang} monolith",
                "to": f"{svc_n} bounded services",
                "change": "split",
            },
            {
                "aspect": "Integration",
                "from": "Implicit CALL / batch",
                "to": {
                    "sync": "REST + OpenAPI",
                    "async": "Event contracts",
                    "mixed": "REST + events",
                }.get(sug_comms, "Service contracts"),
                "change": "formalized",
            },
            {
                "aspect": "Data ownership",
                "from": f"{layout_n or 'Shared'} layouts",
                "to": "Per-service ownership rules",
                "change": "partitioned",
            },
            {
                "aspect": "Decisions",
                "from": "Mostly undocumented",
                "to": "ADRs for each major choice",
                "change": "recorded",
            },
        ]

    gloss: list[dict[str, str]] = []
    if isinstance(parsed, dict) and isinstance(parsed.get("glossary"), list):
        for item in parsed["glossary"][:5]:
            if not isinstance(item, dict):
                continue
            term = str(item.get("term") or "").strip()
            definition = str(item.get("def") or item.get("definition") or "").strip()
            if term and definition:
                gloss.append({"term": term, "def": definition})
    if len(gloss) < 4:
        gloss = fallback_glossary[:5]

    hints = (
        parsed.get("evidence_hints")
        if isinstance(parsed, dict) and isinstance(parsed.get("evidence_hints"), list)
        else []
    )
    evidence_hints = [str(h) for h in hints[:6]] or [
        "contracts/openapi.yaml",
        "contracts/asyncapi.yaml",
        "adr/0002-comms.md",
        "service_catalogue.json",
    ]
    banner = profile.get("result_banner") or {}

    def _p(key: str, fallback: str) -> str:
        if isinstance(parsed, dict):
            return str(parsed.get(key) or "").strip() or fallback
        return fallback

    svc_preview = ", ".join(services[:4]) if services else "proposed services"
    prior_line_fb = (
        f"Continues {prior_id} ({prior_name}) — {svc_n} bounded context(s): {svc_preview}."
    )

    return {
        "title": _p("title", str(profile.get("title") or "Target Architecture")),
        "lede": _p("lede", str(profile.get("lede") or "")),
        "form_heading": _p("form_heading", str(profile.get("form_heading") or "Set the communication style")),
        "domain_kicker": str(profile.get("domain_kicker") or "Domain D · Design & build the new · Step A10"),
        "context_line": _p(
            "context_line",
            f"Based on «{title}» · {cat} · {prior_id} · {strat}",
        ),
        "prior_line": _p("prior_line", prior_line_fb),
        "category_id": category_id,
        "prior_agent_id": prior_id,
        "prior_agent_name": prior_name,
        "path_active_ids": path_ids,
        "service_names": services,
        "shape": shape,
        "build_first": build_first,
        "comms_label": _p("comms_label", str(comms.get("label") or "")),
        "comms_hint": _p("comms_hint", str(comms.get("hint") or "")),
        "comms_options": default_comms_opts,
        "suggested_comms": sug_comms,
        "depth_label": _p("depth_label", str(depth.get("label") or "")),
        "depth_options": default_depth_opts,
        "suggested_depth": sug_depth,
        "architecture_plan": _p(
            "architecture_plan",
            f"Write interface agreements for {svc_n} A9 services under «{strat}» for «{title}».",
        ),
        "result_headline": _p(
            "result_headline",
            str(banner.get("headline") or "Target design ready."),
        ),
        "result_body": _p("result_body", str(banner.get("body") or "")),
        "previous_architecture": previous,
        "design_choices": choices,
        "contracts_generated": contracts,
        "comparison_deltas": deltas,
        "evidence_hints": evidence_hints,
        "activity_status": _p("activity_status", f"A10 ready for {title}"),
        "glossary": gloss,
        "warning": "LLM unavailable — using category-shaped A10 form" if used_fallback else "",
        **_meta(out),
    }


async def generate_a12_brief(
    project_name: str,
    category_name: str,
    requirement: str,
    strategies: list[str],
    strategy_short: str,
    why_modernize: str,
    category_id: str = "",
    prior_agent_id: str = "G2",
    prior_agent_name: str = "Architecture Approval",
    path_active_ids: list[str] | None = None,
    *,
    service_names: list[str] | None = None,
    shape: str = "",
    build_first: str = "",
    comms: str = "",
    design_choices: list[dict[str, str]] | None = None,
    approved_rule_count: int = 0,
    g2_approved: bool = False,
    data_strategy: str = "",
    legacy_language: str = "",
    target_stack_hint: str = "",
    project_label: str = "",
) -> dict[str, Any]:
    """LLM-shaped Code Generation (A12) from A1 + path + A9–G2 design approval."""
    import asyncio
    import logging

    from app.intake.catalog import a12_form_profile

    log = logging.getLogger(__name__)
    title = (project_name or "Modernization initiative").strip()
    cat = (category_name or "Legacy estate").strip()
    req = (requirement or "").strip()
    strat = (strategy_short or (strategies[0] if strategies else "")).strip()
    why = (why_modernize or "").strip()
    profile = a12_form_profile(category_id)
    stack = profile.get("stack") or {}
    extras = profile.get("extras") or {}
    stack_opts = [[str(a), str(b)] for a, b in stack.get("options") or []]
    extras_opts = [
        [str(o[0]), str(o[1]), str(o[2]) if len(o) > 2 else ""]
        for o in (extras.get("options") or [])
    ]
    allowed_stack = {o[0] for o in stack_opts}
    allowed_extras = {o[0] for o in extras_opts}
    default_stack = str(stack.get("suggested") or "java")
    if default_stack not in allowed_stack:
        default_stack = next(iter(allowed_stack), "java")
    default_extras = [str(x) for x in (extras.get("suggested") or ["provenance", "infra"]) if str(x) in allowed_extras]
    services = [str(x) for x in (service_names or []) if x]
    svc_n = max(len(services), 1)
    path_ids = [str(x) for x in (path_active_ids or []) if x]
    choices = [
        {"label": str(c.get("label") or ""), "value": str(c.get("value") or "")}
        for c in (design_choices or [])
        if isinstance(c, dict) and c.get("label") and c.get("value")
    ][:5]

    # Continuity: infer stack from A1 requirement / strategy / legacy language.
    blob = f"{req} {strat} {why} {legacy_language} {target_stack_hint}".lower()
    continuity_stack = default_stack
    if "java" in blob or "spring" in blob:
        continuity_stack = "java" if "java" in allowed_stack else continuity_stack
    elif "c#" in blob or ".net" in blob or "dotnet" in blob:
        continuity_stack = "dotnet" if "dotnet" in allowed_stack else continuity_stack
    elif "python" in blob or "fastapi" in blob:
        continuity_stack = "python" if "python" in allowed_stack else continuity_stack
    elif legacy_language.lower() in {"fortran", "cobol", "pli", "pl/i", "natural"}:
        continuity_stack = "java" if "java" in allowed_stack else continuity_stack

    rules_n = max(int(approved_rule_count or 0), 0)
    files_seed = svc_n * 34
    default_checks: list[list[str]] = []
    for cid, tmpl in profile.get("checklist_templates") or []:
        default_checks.append([str(cid), str(tmpl)])
    # Path / A1 continuity overlays (match PipelineAgentStep / snapshot UX).
    default_checks.extend([
        ["path_ok", f"Confirm this step still belongs on the path for «{cat}»"],
        ["req_ok", f"Confirm scope still matches the A1 requirement: «{(req or title)[:120]}»"],
        ["strat_ok", f"Confirm the modernization strategy still applies: «{strat or 'locked strategy'}»"],
        ["proj_ok", f"Confirm work remains under project «{(project_label or title)[:120]}»"],
    ])

    fallback_glossary = [
        {"term": "Code generation", "def": "Turning approved architecture and rules into runnable services."},
        {"term": "Provenance", "def": "A note on every method that names the approved rule it implements."},
        {"term": "Traceability", "def": "The ability to walk from generated code back to a signed-off business rule."},
        {"term": "Target stack", "def": "The language and platform chosen for the new services (e.g. Java)."},
        {"term": cat.split(". ", 1)[-1][:40] if cat else "Legacy", "def": f"Focus area locked in A1: {cat}."},
    ]

    prompt = f"""You design the Code generation (A12) screen for a modernization factory.
Synthesize form suggestions, checklist labels, result metrics, and copy from A1,
the movement path, A9–A11 design outputs, and G2 approval. Maximum semantic similarity
with prior finished work. Plain English.

Project: {title}
Category: {cat} ({category_id or "unknown"})
A1 requirement: {req or "(custom)"}
A1 strategy: {strat or "(not set)"}
A1 why: {why or "(not provided)"}
Project label: {project_label or title}
Path active ids: {path_ids or "(unknown)"}
Prior: {prior_agent_id} · {prior_agent_name}
G2 approved: {g2_approved}
Legacy language: {legacy_language or "(unknown)"}
Target stack hint: {target_stack_hint or continuity_stack}
A9 services ({svc_n}): {services or "(none)"}
A9 shape: {shape or "(unknown)"} · build first: {build_first or "(unknown)"}
A10 comms: {comms or "(unknown)"}
A10 design choices: {choices or "(none)"}
A11 data strategy: {data_strategy or "(unknown)"}
Approved rules: {rules_n}
Continuity suggested stack: {continuity_stack}
Default extras: {default_extras}
Default checklist: {default_checks}

Return ONLY valid JSON:
{{
  "title": "Code generation",
  "lede": "Generates new services from approved architecture and rules; every method traces to an approved business rule.",
  "form_heading": "Choose stack and extras",
  "context_line": "short chip from A1 + G2 + stack",
  "prior_line": "1 sentence continuity from G2 / A10 / A9",
  "stack_label": "What should the new code be written in?",
  "suggested_stack": "java",
  "extras_label": "What else should be produced?",
  "suggested_extras": ["provenance", "infra"],
  "generation_plan": "1 sentence: generate N services implementing M rules in stack",
  "checklist_heading": "Operator checklist (optional)",
  "checklist_note": "Combines standard controls with A1 category, requirement, strategy, and path.",
  "checklist": [{{"id":"stack_ok","label":"Confirm…","required":true}}],
  "result_headline": "Code exists but is not trusted yet.",
  "result_body": "1-2 sentences for results banner",
  "generated_metrics": [
    {{"id":"services","label":"Services built","value":{svc_n},"unit":""}},
    {{"id":"files","label":"Source files","value":{files_seed},"unit":""}},
    {{"id":"rule_methods","label":"Rule methods","value":{rules_n},"unit":""}},
    {{"id":"security","label":"Security findings","value":0,"unit":"blocking"}}
  ],
  "sample_services": [{{"name":"Service","stack":"Java","methods":12,"traces_to":"approved rules"}}],
  "sample_artefacts": [
    {{"id":"zip","label":"Services package","path":"generated/services.zip"}},
    {{"id":"pr","label":"Change request","path":"pull_request.json"}},
    {{"id":"sbom","label":"SBOM","path":"sbom.cdx.json"}}
  ],
  "evidence_hints": ["generated/services.zip", "pull_request.json"],
  "activity_status": "A12 ready",
  "glossary": [{{"term":"Term","def":"plain English"}}]
}}
Rules:
- suggested_stack one of: java, dotnet, python; prefer continuity ({continuity_stack})
- suggested_extras subset of provenance, infra; include provenance unless requirement forbids
- Exactly 7 checklist items; keep ids from defaults when possible; refine labels with real services/rules/stack
- Checklist items are mandatory before generation (required=true) — semantic continuity with A1/path/G2
- generated_metrics must use service count {svc_n} and rule count {rules_n} (do not invent away)
- sample_services names should match A9 service names when provided
- Exactly 5 glossary terms
- No markdown"""

    backend = get_backend()
    out: dict[str, Any] = {
        "text": "",
        "error": "not attempted",
        "model": "catalog-fallback",
        "tokens_in": 0,
        "tokens_out": 0,
        "cost_usd": 0.0,
    }
    for attempt in range(2):
        try:
            out = await asyncio.wait_for(
                backend.complete(
                    "A12-brief",
                    prompt,
                    tier="medium",
                    response_format={"type": "json_object"},
                ),
                timeout=45.0,
            )
            if out.get("text") and not out.get("error"):
                break
            log.warning("A12-brief attempt %s empty/error: %s", attempt + 1, out.get("error"))
        except Exception as exc:  # noqa: BLE001
            log.warning("A12-brief attempt %s failed: %s", attempt + 1, exc)
            out = {
                "text": "",
                "error": str(exc),
                "model": "catalog-fallback",
                "tokens_in": 0,
                "tokens_out": 0,
                "cost_usd": 0.0,
            }

    parsed = _parse_json(out.get("text", ""))
    used_fallback = not isinstance(parsed, dict)

    sug_stack = continuity_stack
    sug_extras = list(default_extras) or ["provenance", "infra"]
    checklist = [{"id": a, "label": b, "required": True} for a, b in default_checks]
    metrics = [
        {"id": "services", "label": "Services built", "value": svc_n, "unit": ""},
        {"id": "files", "label": "Source files", "value": files_seed, "unit": ""},
        {"id": "rule_methods", "label": "Rule methods", "value": rules_n, "unit": ""},
        {"id": "security", "label": "Security findings", "value": 0, "unit": "blocking"},
    ]
    sample_services: list[dict[str, Any]] = [
        {
            "name": n,
            "stack": sug_stack.upper() if sug_stack != "dotnet" else ".NET",
            "methods": max(rules_n // svc_n, 1) if svc_n else rules_n,
            "traces_to": "approved rules",
        }
        for n in (services or [f"Service {i+1}" for i in range(svc_n)])
    ]
    artefacts = [
        {"id": "zip", "label": "Services package", "path": "generated/services.zip"},
        {"id": "pr", "label": "Change request", "path": "pull_request.json"},
        {"id": "sbom", "label": "SBOM", "path": "sbom.cdx.json"},
    ]

    if isinstance(parsed, dict):
        s = str(parsed.get("suggested_stack") or "").strip()
        if s in allowed_stack:
            sug_stack = s
        raw_ex = parsed.get("suggested_extras") or []
        if isinstance(raw_ex, list):
            picked = [str(x) for x in raw_ex if str(x) in allowed_extras]
            if picked:
                sug_extras = picked
        label_by_id = {a: b for a, b in default_checks}
        raw_checks = parsed.get("checklist") or []
        if isinstance(raw_checks, list):
            refined: dict[str, str] = {}
            for item in raw_checks[:8]:
                if not isinstance(item, dict):
                    continue
                cid = str(item.get("id") or "").strip()
                label = str(item.get("label") or "").strip()
                if cid in label_by_id and label:
                    refined[cid] = label
            if refined:
                checklist = [
                    {"id": a, "label": refined.get(a, b), "required": True}
                    for a, b in default_checks
                ]
        raw_metrics = parsed.get("generated_metrics") or []
        if isinstance(raw_metrics, list) and raw_metrics:
            built: list[dict[str, Any]] = []
            for item in raw_metrics[:4]:
                if not isinstance(item, dict):
                    continue
                label = str(item.get("label") or "").strip()
                if not label:
                    continue
                try:
                    value = int(item.get("value") or 0)
                except (TypeError, ValueError):
                    value = 0
                mid = str(item.get("id") or label.lower().replace(" ", "_"))[:40]
                if mid == "services":
                    value = max(value, svc_n)
                elif mid == "rule_methods":
                    value = max(value, rules_n)
                elif mid == "files":
                    value = max(value, files_seed)
                built.append({
                    "id": mid,
                    "label": label,
                    "value": max(0, value),
                    "unit": str(item.get("unit") or "").strip(),
                })
            if len(built) >= 3:
                metrics = built
        raw_svc = parsed.get("sample_services") or []
        if isinstance(raw_svc, list) and raw_svc:
            built_s: list[dict[str, Any]] = []
            for item in raw_svc[:8]:
                if not isinstance(item, dict):
                    continue
                name = str(item.get("name") or "").strip()
                if not name:
                    continue
                try:
                    methods = int(item.get("methods") or 0)
                except (TypeError, ValueError):
                    methods = 0
                built_s.append({
                    "name": name,
                    "stack": str(item.get("stack") or sug_stack),
                    "methods": max(methods, 1),
                    "traces_to": str(item.get("traces_to") or "approved rules"),
                })
            if built_s:
                sample_services = built_s
        raw_art = parsed.get("sample_artefacts") or []
        if isinstance(raw_art, list) and raw_art:
            built_a: list[dict[str, str]] = []
            for item in raw_art[:6]:
                if not isinstance(item, dict):
                    continue
                label = str(item.get("label") or "").strip()
                path = str(item.get("path") or "").strip()
                if label and path:
                    built_a.append({
                        "id": str(item.get("id") or label.lower().replace(" ", "_"))[:40],
                        "label": label,
                        "path": path,
                    })
            if built_a:
                artefacts = built_a

    gloss: list[dict[str, str]] = []
    if isinstance(parsed, dict) and isinstance(parsed.get("glossary"), list):
        for item in parsed["glossary"][:5]:
            if not isinstance(item, dict):
                continue
            term = str(item.get("term") or "").strip()
            definition = str(item.get("def") or item.get("definition") or "").strip()
            if term and definition:
                gloss.append({"term": term, "def": definition})
    if len(gloss) < 4:
        gloss = fallback_glossary[:5]

    hints = (
        parsed.get("evidence_hints")
        if isinstance(parsed, dict) and isinstance(parsed.get("evidence_hints"), list)
        else []
    )
    evidence_hints = [str(h) for h in hints[:6]] or [
        "generated/services.zip",
        "pull_request.json",
        "sbom.cdx.json",
    ]
    banner = profile.get("result_banner") or {}

    def _p(key: str, fallback: str) -> str:
        if isinstance(parsed, dict):
            return str(parsed.get(key) or "").strip() or fallback
        return fallback

    if not legacy_language or legacy_language.lower() in ("unknown", "legacy"):
        legacy_language = detect_legacy_language(f"{req} {strat} {why} {title}", default="Legacy")

    stack_display = {"java": "Java", "dotnet": ".NET", "python": "Python"}.get(sug_stack, sug_stack)
    prior_line_fb = (
        f"Continues {prior_agent_id} ({prior_agent_name})"
        + (" — design approved" if g2_approved else "")
        + f"; generating {svc_n} services · {rules_n} approved rules → {stack_display}."
    )

    ret_dict = {
        "title": _p("title", str(profile.get("title") or "Code generation")),
        "lede": _p("lede", str(profile.get("lede") or "")),
        "form_heading": _p("form_heading", str(profile.get("form_heading") or "Choose stack and extras")),
        "domain_kicker": str(profile.get("domain_kicker") or "Domain D · Design & build the new · Step A12"),
        "context_line": _p(
            "context_line",
            f"Based on «{title}» · {cat} · {strat} · {stack_display}",
        ),
        "prior_line": _p("prior_line", prior_line_fb),
        "category_id": category_id,
        "prior_agent_id": prior_agent_id,
        "prior_agent_name": prior_agent_name,
        "path_active_ids": path_ids,
        "service_names": services,
        "g2_approved": g2_approved,
        "approved_rule_count": rules_n,
        "legacy_language": legacy_language,
        "target_stack_hint": target_stack_hint or stack_display,
        "design_choices_summary": choices,
        "stack_label": _p("stack_label", str(stack.get("label") or "")),
        "stack_hint": str(stack.get("hint") or ""),
        "stack_options": stack_opts,
        "suggested_stack": sug_stack,
        "extras_label": _p("extras_label", str(extras.get("label") or "")),
        "extras_hint": str(extras.get("hint") or ""),
        "extras_options": extras_opts,
        "suggested_extras": sug_extras,
        "generation_plan": _p(
            "generation_plan",
            f"Generate {svc_n} A9 services implementing {rules_n} approved rules in {stack_display}.",
        ),
        "checklist_heading": _p("checklist_heading", "Operator checklist (required)"),
        "checklist_note": _p(
            "checklist_note",
            "Confirm every item before generation. Labels combine standard controls with your A1 category, requirement, strategy, and path.",
        ),
        "checklist": checklist,
        "result_headline": _p(
            "result_headline",
            str(banner.get("headline") or "Code exists but is not trusted yet."),
        ),
        "result_body": _p("result_body", str(banner.get("body") or "")),
        "generated_metrics": metrics,
        "sample_services": sample_services,
        "sample_artefacts": artefacts,
        "evidence_hints": evidence_hints,
        "activity_status": _p("activity_status", f"A12 ready for {title}"),
        "glossary": gloss,
        "warning": "LLM unavailable — using category-shaped A12 form" if used_fallback else "",
        **_meta(out),
    }

    if legacy_language and legacy_language.upper() != "COBOL":
        import re
        for k in ("result_headline", "result_body", "generation_plan", "prior_line", "context_line"):
            if k in ret_dict and isinstance(ret_dict[k], str):
                ret_dict[k] = re.sub(r"\bCOBOL\b", legacy_language, ret_dict[k], flags=re.IGNORECASE)

    return ret_dict


async def generate_g0_brief(
    project_name: str,
    category_name: str,
    requirement: str,
    strategies: list[str],
    strategy_short: str,
    why_modernize: str,
    enriched_summary: str = "",
    category_id: str = "",
    criticality: str = "",
    regulations: list[str] | None = None,
    code_location: str = "",
    sensitive_labels: list[str] | None = None,
    model_policy: str = "",
    model_rule: str = "",
    gate_policy: str = "",
    cost_ceiling_usd: float = 250.0,
    app_name: str = "",
    app_loc: int = 0,
    app_programs: int = 0,
    expected_approvers: str = "Application owner + Security",
) -> dict[str, Any]:
    """LLM-shaped Gate 0 Intake Approval from A1 + A2 + A3 context (plain English)."""
    from app.intake.catalog import g0_form_profile

    title = (project_name or "Modernization initiative").strip()
    cat = (category_name or "Legacy estate").strip()
    req = (requirement or "").strip()
    strat = (strategy_short or (strategies[0] if strategies else "Strangler-fig slice")).strip()
    why = (why_modernize or enriched_summary or "").strip()
    strat_line = "; ".join(s for s in strategies if s) or strat
    regs = [str(r) for r in (regulations or []) if r]
    sens_labs = [str(x) for x in (sensitive_labels or []) if x]
    profile = g0_form_profile(category_id)
    default_checks = [[str(a), str(b)] for a, b in profile["checklist"]]
    policy_labels = [str(x) for x in profile.get("policy_labels") or []]

    read_scope = (
        f"{app_name or title} — {app_loc:,} lines, {app_programs} programs"
        if app_loc or app_programs
        else f"{app_name or title} — scope from intake"
    )
    data_handling = model_rule or {
        "public": "Public cloud models allowed",
        "balanced": "Cloud models allowed, inputs masked first",
        "private": "Private / on-premises models only",
    }.get((model_policy or "").lower(), "Data handling not set yet")
    access_line = {
        "public": "Public models only",
        "balanced": "Private + public (balanced)",
        "private": "Private / on-premises only",
    }.get((model_policy or "").lower(), model_policy or "Not set")
    sens_line = ", ".join(sens_labs) if sens_labs else "None marked yet"
    regs_line = ", ".join(regs) if regs else "None listed"
    crit_line = criticality or "Not set"
    spend_line = f"${float(cost_ceiling_usd or 250):,.0f}"

    default_policy = [
        {"label": policy_labels[0] if len(policy_labels) > 0 else "What we may read", "value": read_scope, "source": "A1"},
        {"label": policy_labels[1] if len(policy_labels) > 1 else "How carefully we treat data", "value": f"{sens_line} · {data_handling}", "source": "A3"},
        {"label": policy_labels[2] if len(policy_labels) > 2 else "Which AI models may help", "value": access_line, "source": "A3"},
        {"label": policy_labels[3] if len(policy_labels) > 3 else "Spend ceiling", "value": spend_line, "source": "Factory"},
        {"label": "Business criticality", "value": crit_line, "source": "A2"},
        {"label": "Controls / regulations", "value": regs_line, "source": "A2"},
    ]

    fallback_glossary = [
        {"term": "Intake Approval", "def": "A person confirms scope and rules before the factory reads anything."},
        {"term": "Sensitive data", "def": "Information that must stay off public AI unless you allow it."},
        {"term": "Access policy", "def": "Which AI models may see estate material."},
        {"term": "Rewind", "def": "If you reject, work goes back so agents can fix what you flagged."},
        {"term": cat.split(". ", 1)[-1][:40] if cat else "Legacy", "def": f"Focus area locked in A1: {cat}."},
    ]

    prompt = f"""You write Gate 0 · Intake Approval for a modernization factory UI.
Use ONLY the A1 + A2 + A3 facts below. Plain English for non-technical approvers. No jargon.

Project: {title}
Category id: {category_id or "(unknown)"}
Category: {cat}
A1 requirement: {req or "(custom)"}
A1 strategies: {strat_line}
A1 strategy short: {strat}
A1 why modernize: {why or "(not provided)"}
A2 criticality: {crit_line}
A2 regulations: {regs_line}
A2 location: {code_location or "(not set)"}
A3 sensitive data: {sens_line}
A3 model policy: {access_line}
A3 model rule: {data_handling}
A3 gate policy: {gate_policy or "(not set)"}
Spend ceiling: {spend_line}
Read scope: {read_scope}
Expected approvers: {expected_approvers}
Enriched summary: {(enriched_summary or "")[:350]}

Default checklist ids (keep ids; refine labels to mirror THIS intake):
{[c[0] for c in default_checks]}

Return ONLY valid JSON:
{{
  "title": "Gate 0 · Intake Approval",
  "lede": "1-2 plain sentences on what the approver is deciding for THIS project",
  "approver_heading": "You are the approver",
  "paused_line": "The pipeline has paused. Nothing downstream can happen until you decide. You're reviewing the work produced by Governance & Risk.",
  "expected_approvers": "Application owner + Security",
  "policy_heading": "Approval policy",
  "policy_intro": "One short sentence: these rules come from earlier answers.",
  "policy_items": [{{"label": "short label", "value": "plain value", "source": "A1|A2|A3|Factory"}}],
  "checklist_heading": "Checklist · click each item to confirm",
  "checklist_note": "short note",
  "checklist": [{{"id": "business_case", "label": "plain English confirm", "required": true}}],
  "reject_consequence": "What happens if you reject? …",
  "context_line": "short chip from A1/A2/A3",
  "requirement_summary": "1 plain sentence tying the A1 requirement to this approval",
  "activity_status": "G0 awaiting approval",
  "evidence_hints": ["scope_approval.md"],
  "glossary": [{{"term": "Term", "def": "plain English"}}]
}}
Rules:
- Exactly 4 checklist items; ids from the default list when possible
- 4 to 6 policy_items grounded in the facts above (do not invent numbers)
- requirement_summary must reflect the A1 requirement / category
- Exactly 5 glossary terms
- No markdown"""

    import asyncio
    import logging

    log = logging.getLogger(__name__)
    backend = get_backend()
    out: dict[str, Any] = {
        "text": "",
        "error": "not attempted",
        "model": "catalog-fallback",
        "tokens_in": 0,
        "tokens_out": 0,
        "cost_usd": 0.0,
    }
    # G0 JSON often needs 8–20s; retry once so transient timeouts don't show the A1–A3 fallback banner.
    for attempt in range(2):
        try:
            out = await asyncio.wait_for(
                backend.complete(
                    "G0-brief",
                    prompt,
                    tier="medium",
                    response_format={"type": "json_object"},
                ),
                timeout=45.0,
            )
            if out.get("text") and not out.get("error"):
                break
            log.warning(
                "G0-brief attempt %s returned empty/error: %s",
                attempt + 1,
                out.get("error") or "empty text",
            )
        except Exception as exc:  # noqa: BLE001
            log.warning("G0-brief attempt %s failed: %s", attempt + 1, exc)
            out = {
                "text": "",
                "error": str(exc),
                "model": "catalog-fallback",
                "tokens_in": 0,
                "tokens_out": 0,
                "cost_usd": 0.0,
            }
    parsed = _parse_json(out.get("text", ""))
    used_fallback = not isinstance(parsed, dict)
    if used_fallback:
        log.warning(
            "G0-brief using catalog fallback (error=%s model=%s)",
            out.get("error"),
            out.get("model"),
        )

    # Checklist
    allowed_ids = {c[0] for c in default_checks}
    label_by_id = {c[0]: c[1] for c in default_checks}
    checklist: list[dict[str, Any]] = []
    raw_checks = parsed.get("checklist") if isinstance(parsed, dict) else None
    if isinstance(raw_checks, list):
        for item in raw_checks[:6]:
            if isinstance(item, dict):
                cid = str(item.get("id") or "").strip()
                label = str(item.get("label") or "").strip()
                if not cid:
                    continue
                if cid not in allowed_ids and len(checklist) >= 4:
                    continue
                if cid not in allowed_ids:
                    # map unknown ids onto remaining defaults by order
                    for did in [c[0] for c in default_checks]:
                        if did not in {x["id"] for x in checklist}:
                            cid = did
                            break
                checklist.append({
                    "id": cid,
                    "label": label or label_by_id.get(cid, cid),
                    "required": bool(item.get("required", True)),
                })
            elif isinstance(item, (list, tuple)) and len(item) >= 2:
                cid, label = str(item[0]).strip(), str(item[1]).strip()
                if cid:
                    checklist.append({"id": cid, "label": label or label_by_id.get(cid, cid), "required": True})
    if len(checklist) < 3:
        checklist = [{"id": a, "label": b, "required": True} for a, b in default_checks]

    # Policy items
    policy_items: list[dict[str, str]] = []
    raw_pol = parsed.get("policy_items") if isinstance(parsed, dict) else None
    if isinstance(raw_pol, list):
        for item in raw_pol[:6]:
            if not isinstance(item, dict):
                continue
            label = str(item.get("label") or "").strip()
            value = str(item.get("value") or "").strip()
            source = str(item.get("source") or "").strip() or "Factory"
            if label and value:
                policy_items.append({"label": label, "value": value, "source": source})
    if len(policy_items) < 3:
        policy_items = default_policy

    gloss: list[dict[str, str]] = []
    if isinstance(parsed, dict) and isinstance(parsed.get("glossary"), list):
        for item in parsed["glossary"][:5]:
            if not isinstance(item, dict):
                continue
            term = str(item.get("term") or "").strip()
            definition = str(item.get("def") or item.get("definition") or "").strip()
            if term and definition:
                gloss.append({"term": term, "def": definition})
    if len(gloss) < 4:
        gloss = fallback_glossary[:5]

    hints = parsed.get("evidence_hints") if isinstance(parsed, dict) and isinstance(parsed.get("evidence_hints"), list) else []
    evidence_hints = [str(h) for h in hints[:6]] or ["scope_approval.md"]

    req_summary = ""
    if isinstance(parsed, dict):
        req_summary = str(parsed.get("requirement_summary") or "").strip()
    if not req_summary:
        req_summary = (
            f"You are approving work for «{cat}»"
            + (f" — {req[:120]}" if req else "")
            + f" using strategy «{strat}»."
        )

    return {
        "title": str((parsed or {}).get("title") if isinstance(parsed, dict) else "") or profile["title"],
        "lede": str((parsed or {}).get("lede") if isinstance(parsed, dict) else "") or profile["lede"],
        "approver_heading": str((parsed or {}).get("approver_heading") if isinstance(parsed, dict) else "")
        or profile["approver_heading"],
        "paused_line": str((parsed or {}).get("paused_line") if isinstance(parsed, dict) else "")
        or (
            "The pipeline has paused. Nothing downstream can happen until you decide. "
            "You're reviewing the work produced by Governance & Risk."
        ),
        "expected_approvers": str((parsed or {}).get("expected_approvers") if isinstance(parsed, dict) else "")
        or expected_approvers,
        "policy_heading": str((parsed or {}).get("policy_heading") if isinstance(parsed, dict) else "")
        or "Approval policy",
        "policy_intro": str((parsed or {}).get("policy_intro") if isinstance(parsed, dict) else "")
        or "These rules were built from your earlier answers — nothing new is invented here.",
        "policy_items": policy_items,
        "checklist_heading": str((parsed or {}).get("checklist_heading") if isinstance(parsed, dict) else "")
        or "Checklist · click each item to confirm",
        "checklist_note": str((parsed or {}).get("checklist_note") if isinstance(parsed, dict) else "")
        or profile["checklist_note"],
        "checklist": checklist,
        "reject_consequence": str((parsed or {}).get("reject_consequence") if isinstance(parsed, dict) else "")
        or profile["reject_consequence"],
        "context_line": str((parsed or {}).get("context_line") if isinstance(parsed, dict) else "")
        or f"«{title}» · {cat} · {strat} · {crit_line}",
        "requirement_summary": req_summary,
        "activity_status": str((parsed or {}).get("activity_status") if isinstance(parsed, dict) else "")
        or "G0 awaiting approval",
        "evidence_hints": evidence_hints,
        "glossary": gloss,
        "category_id": category_id,
        "warning": "LLM unavailable — using intake-shaped G0 form" if used_fallback else "",
        **_meta(out),
    }


async def generate_g1_brief(
    project_name: str,
    category_name: str,
    requirement: str,
    strategies: list[str],
    strategy_short: str,
    why_modernize: str,
    category_id: str = "",
    prior_agent_name: str = "Runtime Behaviour Mining",
    expected_approvers: str = "Subject matter expert + architect",
    *,
    programs: int = 0,
    parsed: int = 0,
    parse_failures: int = 0,
    rules_total: int = 0,
    rules_review: int = 0,
    dead_programs: int = 0,
    kg_nodes: int = 0,
    kg_rels: int = 0,
    kg_conflicts: int = 0,
    journeys: int = 0,
    hidden_deps: int = 0,
    never_executed: int = 0,
    docs_produced: int = 0,
    analysis_headline: str = "",
    extraction_headline: str = "",
    sample_rule_statements: list[str] | None = None,
) -> dict[str, Any]:
    """LLM-shaped Gate 1 Discovery Approval from A1 intake + A5–A8 discovery facts."""
    import asyncio
    import logging

    from app.intake.catalog import g1_form_profile

    log = logging.getLogger(__name__)
    title = (project_name or "Modernization initiative").strip()
    cat = (category_name or "Legacy estate").strip()
    req = (requirement or "").strip()
    strat = (strategy_short or (strategies[0] if strategies else "")).strip()
    why = (why_modernize or "").strip()
    profile = g1_form_profile(category_id)
    samples = [str(s).strip() for s in (sample_rule_statements or []) if str(s).strip()][:3]

    default_checks = []
    for cid, tmpl in profile.get("checklist_templates") or []:
        label = str(tmpl).format(
            rules=rules_total or 0,
            programs=programs or 0,
            journeys=journeys or 0,
        )
        default_checks.append([str(cid), label])

    discovery_items = [
        {
            "label": "Code read",
            "value": (
                f"{parsed} of {programs} programs read cleanly"
                if programs
                else f"{parsed} programs read"
            )
            + (f" · {parse_failures} parse issues" if parse_failures else ""),
            "source": "A5",
        },
        {
            "label": "Rules found",
            "value": (
                f"{rules_total} rules"
                + (", every one citing exact code lines" if rules_total else " extracted")
                + (f" · {rules_review} need your judgement" if rules_review else "")
            ),
            "source": "A6",
        },
        {
            "label": "Knowledge graph",
            "value": (
                f"{kg_nodes:,} nodes · {kg_rels:,} relationships"
                + (f" · {kg_conflicts} conflicts" if kg_conflicts else "")
                if kg_nodes or kg_rels
                else f"{docs_produced} documentation artefacts produced"
            ),
            "source": "A7",
        },
        {
            "label": "Runtime behaviour",
            "value": (
                f"{journeys} journeys · {hidden_deps} hidden dependencies · "
                f"{never_executed or dead_programs} never-executed programs"
            ),
            "source": "A8",
        },
    ]
    if analysis_headline:
        discovery_items.append({
            "label": "Code analysis headline",
            "value": analysis_headline[:220],
            "source": "A5",
        })
    if extraction_headline:
        discovery_items.append({
            "label": "Rules headline",
            "value": extraction_headline[:220],
            "source": "A6",
        })

    fallback_glossary = [
        {"term": "Discovery Approval", "def": "Humans confirm the factory understood the old system before redesign."},
        {"term": "Business rule", "def": "A statement of how the estate behaves, grounded in cited code or docs."},
        {"term": "Needs judgement", "def": "A rule the factory extracted but was not confident enough to auto-approve."},
        {"term": "Runtime journey", "def": "A real usage path mined from runtime behaviour, not just static code."},
        {"term": "Rewind", "def": "Rejecting sends work back to Runtime Behaviour Mining so agents can fix gaps."},
    ]

    paused_default = (
        "The pipeline has paused. Nothing downstream can happen until you decide. "
        f"You're reviewing the work produced by {prior_agent_name}."
    )
    req_default = (
        f"You are confirming discovery for «{cat}»"
        + (f" — {req[:140]}" if req else "")
        + (f" using strategy «{strat}»." if strat else ".")
    )

    prompt = f"""You write Gate 1 · Discovery Approval for a modernization factory UI.
Use ONLY the facts below from A1 intake and Agents A5–A8. Plain English for SME + architect. No jargon.

Project: {title}
Category: {cat} ({category_id or "unknown"})
A1 requirement: {req or "(custom)"}
A1 strategy: {strat or "(not set)"}
A1 why modernize: {why or "(not provided)"}
Prior agent under review: {prior_agent_name}

A5 code analysis: {parsed}/{programs} programs parsed, {parse_failures} failures
A5 headline: {analysis_headline or "(none)"}
A6 rules: {rules_total} total, {rules_review} need judgement
A6 headline: {extraction_headline or "(none)"}
Sample rules: {samples or ["(none)"]}
A7 knowledge graph: nodes={kg_nodes}, relationships={kg_rels}, conflicts={kg_conflicts}, docs={docs_produced}
A8 runtime: journeys={journeys}, hidden_deps={hidden_deps}, never_executed={never_executed}, dead_programs={dead_programs}

Default checklist ids (keep ids; refine labels using the REAL counts above):
{[c[0] for c in default_checks]}

Return ONLY valid JSON:
{{
  "title": "Gate 1 · Discovery Approval",
  "lede": "1-2 sentences: most critical gate — confirm understanding before rebuild",
  "approver_heading": "You are the approver",
  "paused_line": "Pipeline paused; reviewing work from {prior_agent_name}.",
  "expected_approvers": "Subject matter expert + architect",
  "evidence_heading": "Discovery evidence · from prior agents",
  "evidence_intro": "One short sentence: these facts come from A5–A8.",
  "discovery_items": [{{"label": "short", "value": "plain fact with numbers", "source": "A5|A6|A7|A8"}}],
  "checklist_heading": "Checklist · click each item to confirm",
  "checklist_note": "short note",
  "checklist": [{{"id": "rules_ok", "label": "plain confirm using real counts", "required": true}}],
  "reject_consequence": "What happens if you reject? …",
  "context_line": "short chip from A1 + discovery",
  "requirement_summary": "1 sentence tying A1 requirement to this discovery approval",
  "activity_status": "G1 awaiting approval",
  "evidence_hints": ["discovery_approval.md"],
  "glossary": [{{"term": "Term", "def": "plain English"}}]
}}
Rules:
- Exactly 4 checklist items; ids from the default list when possible; embed real numbers
- 4 to 6 discovery_items grounded in A5–A8 (do not invent counts)
- requirement_summary must reflect A1
- Exactly 5 glossary terms
- No markdown"""

    backend = get_backend()
    out: dict[str, Any] = {
        "text": "",
        "error": "not attempted",
        "model": "catalog-fallback",
        "tokens_in": 0,
        "tokens_out": 0,
        "cost_usd": 0.0,
    }
    for attempt in range(2):
        try:
            out = await asyncio.wait_for(
                backend.complete(
                    "G1-brief",
                    prompt,
                    tier="medium",
                    response_format={"type": "json_object"},
                ),
                timeout=45.0,
            )
            if out.get("text") and not out.get("error"):
                break
            log.warning("G1-brief attempt %s empty/error: %s", attempt + 1, out.get("error"))
        except Exception as exc:  # noqa: BLE001
            log.warning("G1-brief attempt %s failed: %s", attempt + 1, exc)
            out = {
                "text": "",
                "error": str(exc),
                "model": "catalog-fallback",
                "tokens_in": 0,
                "tokens_out": 0,
                "cost_usd": 0.0,
            }

    parsed_json = _parse_json(out.get("text", ""))
    used_fallback = not isinstance(parsed_json, dict)

    # Checklist must stay confirmative and count-grounded (reference G1 UX).
    # Prefer catalog templates with live A5–A8 numbers; allow LLM to refine
    # wording only when it returns the known ids with a confirm-style label.
    label_by_id = {c[0]: c[1] for c in default_checks}
    checklist: list[dict[str, Any]] = [{"id": a, "label": b, "required": True} for a, b in default_checks]
    raw_checks = parsed_json.get("checklist") if isinstance(parsed_json, dict) else None
    if isinstance(raw_checks, list):
        refined: dict[str, str] = {}
        confirm_words = (
            "sense", "complete", "identified", "gaps", "confirm", "approve",
            "look", "match", "correct", "agree", "right", "clear",
        )
        for item in raw_checks[:6]:
            if not isinstance(item, dict):
                continue
            cid = str(item.get("id") or "").strip()
            label = str(item.get("label") or "").strip()
            if cid in label_by_id and label and any(w in label.lower() for w in confirm_words):
                refined[cid] = label
        if refined:
            checklist = [
                {"id": a, "label": refined.get(a, b), "required": True}
                for a, b in default_checks
            ]

    discovery: list[dict[str, str]] = []
    raw_disc = parsed_json.get("discovery_items") if isinstance(parsed_json, dict) else None
    if isinstance(raw_disc, list):
        for item in raw_disc[:6]:
            if not isinstance(item, dict):
                continue
            label = str(item.get("label") or "").strip()
            value = str(item.get("value") or "").strip()
            source = str(item.get("source") or "").strip() or "Factory"
            if label and value:
                discovery.append({"label": label, "value": value, "source": source})
    if len(discovery) < 3:
        discovery = discovery_items

    gloss: list[dict[str, str]] = []
    if isinstance(parsed_json, dict) and isinstance(parsed_json.get("glossary"), list):
        for item in parsed_json["glossary"][:5]:
            if not isinstance(item, dict):
                continue
            term = str(item.get("term") or "").strip()
            definition = str(item.get("def") or item.get("definition") or "").strip()
            if term and definition:
                gloss.append({"term": term, "def": definition})
    if len(gloss) < 4:
        gloss = fallback_glossary[:5]

    hints = (
        parsed_json.get("evidence_hints")
        if isinstance(parsed_json, dict) and isinstance(parsed_json.get("evidence_hints"), list)
        else []
    )
    evidence_hints = [str(h) for h in hints[:6]] or ["discovery_approval.md"]

    req_summary = ""
    if isinstance(parsed_json, dict):
        req_summary = str(parsed_json.get("requirement_summary") or "").strip()
    if not req_summary:
        req_summary = req_default

    return {
        "title": str((parsed_json or {}).get("title") if isinstance(parsed_json, dict) else "")
        or profile["title"],
        "lede": str((parsed_json or {}).get("lede") if isinstance(parsed_json, dict) else "")
        or profile["lede"],
        "approver_heading": str(
            (parsed_json or {}).get("approver_heading") if isinstance(parsed_json, dict) else ""
        )
        or profile["approver_heading"],
        "paused_line": str((parsed_json or {}).get("paused_line") if isinstance(parsed_json, dict) else "")
        or paused_default,
        "expected_approvers": str(
            (parsed_json or {}).get("expected_approvers") if isinstance(parsed_json, dict) else ""
        )
        or expected_approvers
        or profile["expected_approvers"],
        "evidence_heading": str(
            (parsed_json or {}).get("evidence_heading") if isinstance(parsed_json, dict) else ""
        )
        or profile["evidence_heading"],
        "evidence_intro": str(
            (parsed_json or {}).get("evidence_intro") if isinstance(parsed_json, dict) else ""
        )
        or profile["evidence_intro"],
        "discovery_items": discovery,
        "checklist_heading": str(
            (parsed_json or {}).get("checklist_heading") if isinstance(parsed_json, dict) else ""
        )
        or "Checklist · click each item to confirm",
        "checklist_note": str(
            (parsed_json or {}).get("checklist_note") if isinstance(parsed_json, dict) else ""
        )
        or profile["checklist_note"],
        "checklist": checklist,
        "reject_consequence": str(
            (parsed_json or {}).get("reject_consequence") if isinstance(parsed_json, dict) else ""
        )
        or profile["reject_consequence"],
        "context_line": str((parsed_json or {}).get("context_line") if isinstance(parsed_json, dict) else "")
        or f"«{title}» · {cat} · {strat} · {rules_total} rules",
        "requirement_summary": req_summary,
        "activity_status": str(
            (parsed_json or {}).get("activity_status") if isinstance(parsed_json, dict) else ""
        )
        or "G1 awaiting approval",
        "evidence_hints": evidence_hints,
        "glossary": gloss,
        "category_id": category_id,
        "prior_agent_name": prior_agent_name,
        "warning": "LLM unavailable — using discovery-shaped G1 form from A5–A8" if used_fallback else "",
        **_meta(out),
    }


async def generate_g2_brief(
    project_name: str,
    category_name: str,
    requirement: str,
    strategies: list[str],
    strategy_short: str,
    why_modernize: str,
    category_id: str = "",
    prior_agent_name: str = "Data modernization",
    expected_approvers: str = "Architecture board",
    path_active_ids: list[str] | None = None,
    *,
    service_names: list[str] | None = None,
    service_summaries: list[str] | None = None,
    shape: str = "",
    build_first: str = "",
    comms: str = "",
    contract_depth: str = "",
    contracts_count: int = 0,
    rest_endpoints: int = 0,
    event_contracts: int = 0,
    ownership_rules: int = 0,
    adrs: int = 0,
    design_choices: list[dict[str, str]] | None = None,
    data_strategy: str = "",
    layouts_mapped: int = 0,
    previous_architecture: dict[str, Any] | None = None,
    comparison_deltas: list[dict[str, str]] | None = None,
    result_headline: str = "",
    result_body: str = "",
) -> dict[str, Any]:
    """LLM-shaped Gate 2 Architecture Approval from A1 + path + A9–A11 design facts."""
    import asyncio
    import logging

    from app.intake.catalog import g2_form_profile

    log = logging.getLogger(__name__)
    title = (project_name or "Modernization initiative").strip()
    cat = (category_name or "Legacy estate").strip()
    req = (requirement or "").strip()
    strat = (strategy_short or (strategies[0] if strategies else "")).strip()
    why = (why_modernize or "").strip()
    profile = g2_form_profile(category_id)
    services = [str(x) for x in (service_names or []) if x]
    svc_n = len(services) or 0
    svc_lines = [str(x) for x in (service_summaries or []) if x][:6]
    path_ids = [str(x) for x in (path_active_ids or []) if x]
    choices = [
        {"label": str(c.get("label") or ""), "value": str(c.get("value") or "")}
        for c in (design_choices or [])
        if isinstance(c, dict) and c.get("label") and c.get("value")
    ][:5]
    prev = previous_architecture if isinstance(previous_architecture, dict) else {}
    deltas = [
        {
            "aspect": str(d.get("aspect") or d.get("area") or ""),
            "from": str(d.get("from") or ""),
            "to": str(d.get("to") or ""),
            "change": str(d.get("change") or d.get("why") or ""),
        }
        for d in (comparison_deltas or [])
        if isinstance(d, dict) and (d.get("aspect") or d.get("area")) and d.get("from") and d.get("to")
    ][:6]
    data_label = {
        "dual_write": "dual-write (safest)",
        "dual": "dual-write (safest)",
        "big_bang": "big-bang cutover",
        "bigbang": "big-bang cutover",
    }.get(str(data_strategy or "").lower(), str(data_strategy or "not set") or "not set")

    # Prefer on-path design agents; always end at G2. Names keep the UI readable.
    _design_labels = {
        "A9": "A9 Domain decomposition",
        "A10": "A10 Target architecture",
        "A11": "A11 Data modernization",
        "G2": "G2",
    }
    if path_ids:
        path_design_ids = [x for x in ("A9", "A10", "A11") if x in path_ids]
    else:
        path_design_ids = ["A9", "A10", "A11"]
    # Always include agents that already produced design facts even if path list is thin.
    if svc_n and "A9" not in path_design_ids:
        path_design_ids.insert(0, "A9")
    if (contracts_count or rest_endpoints or result_headline) and "A10" not in path_design_ids:
        path_design_ids.append("A10")
        path_design_ids = list(dict.fromkeys(path_design_ids))
    if (data_strategy or layouts_mapped) and "A11" not in path_design_ids:
        path_design_ids.append("A11")
        path_design_ids = list(dict.fromkeys(path_design_ids))
    if "G2" not in path_design_ids:
        path_design_ids = path_design_ids + ["G2"]
    path_status_label = "Active · on path" if ("G2" in path_ids or not path_ids) else "Eligible"
    movement_line = " -> ".join(_design_labels.get(x, x) for x in path_design_ids)

    default_checks: list[list[str]] = []
    for cid, tmpl in profile.get("checklist_templates") or []:
        try:
            label = str(tmpl).format(
                services=svc_n or "proposed",
                rest=rest_endpoints or max(contracts_count * 3, 0),
                events=event_contracts or 0,
                data_strategy=data_label,
                build_first=build_first or "not set",
                strategy=strat or "selected strategy",
            )
        except (KeyError, ValueError):
            label = str(tmpl)
        default_checks.append([str(cid), label])

    architecture_items = [
        {
            "label": "Proposed pieces",
            "value": (
                f"{svc_n} independent pieces"
                + (f" ({', '.join(services[:4])})" if services else "")
                + (f" · shape={shape}" if shape else "")
            ),
            "source": "A9",
        },
        {
            "label": "Build first",
            "value": build_first or "not set",
            "source": "A9",
        },
        {
            "label": "Interface agreements",
            "value": (
                f"{rest_endpoints or max(contracts_count * 3, 0)} REST"
                + (f" · {event_contracts} events" if event_contracts else "")
                + (f" · comms={comms}" if comms else "")
                + (f" · depth={contract_depth}" if contract_depth else "")
            ),
            "source": "A10",
        },
        {
            "label": "Data strategy",
            "value": (
                data_label
                + (f" · {layouts_mapped} layouts mapped" if layouts_mapped else "")
            ),
            "source": "A11",
        },
    ]
    if ownership_rules or adrs:
        architecture_items.append({
            "label": "Ownership & decisions",
            "value": (
                (f"{ownership_rules} ownership rules" if ownership_rules else "")
                + (" · " if ownership_rules and adrs else "")
                + (f"{adrs} ADRs" if adrs else "")
            ),
            "source": "A10",
        })
    if result_headline:
        architecture_items.append({
            "label": "Target headline",
            "value": result_headline[:220],
            "source": "A10",
        })

    prev_summary = str(prev.get("body") or prev.get("headline") or "").strip()
    prev_traits = prev.get("design_traits") if isinstance(prev.get("design_traits"), list) else []
    if not prev_summary and prev_traits:
        bits = [
            f"{t.get('label')}: {t.get('value')}"
            for t in prev_traits[:3]
            if isinstance(t, dict) and t.get("label") and t.get("value")
        ]
        prev_summary = "; ".join(bits)

    fallback_glossary = [
        {"term": "Architecture Approval", "def": "Humans sign off on service shape, contracts, and data strategy before code is generated."},
        {"term": "Bounded context", "def": "A service slice with clear ownership of behaviour and data."},
        {"term": "Interface agreement", "def": "An OpenAPI or event contract that builders and bridges must obey."},
        {"term": "Distributed monolith", "def": "Many services that still share data and deploy together — the design we must avoid."},
        {"term": "Rewind", "def": "Rejecting sends work back to Data Modernization so design agents can fix gaps."},
    ]

    paused_default = (
        "The pipeline has paused. Nothing downstream can happen until you decide. "
        f"You're reviewing the work produced by {prior_agent_name}."
    )
    req_default = (
        f"You are approving the target architecture for «{cat}»"
        + (f" — {req[:140]}" if req else "")
        + (f" using strategy «{strat}»." if strat else ".")
    )

    prompt = f"""You write Gate 2 (Approve the design) — a human approval gate.
Match the Human Gate layout used at G3: clear title, question lede, A1/path context,
evidence from prior agents, and an 8-item mandatory checklist.

CRITICAL: the title MUST be exactly "Approve the design" — never mention "modernization factory UI", products, or project names in the title.

Use ONLY the facts below from A1 intake, the movement path, and Agents A9–A11.
Plain English for the Architecture board.
Maximum semantic similarity with prior agent execution results and the movement path.
Every checklist item must confirm something those agents actually produced — not generic advice.
Checklist labels must reference real counts / service names / build-first / contracts / data strategy / A1 strategy when available.

Project: {title}
Category: {cat} ({category_id or "unknown"})
A1 requirement: {req or "(custom)"}
A1 strategy: {strat or "(not set)"}
A1 why modernize: {why or "(not provided)"}
Path active ids: {path_ids or "(unknown)"}
Design movement path: {movement_line}
Path status for G2: {path_status_label}
Prior agent under review: {prior_agent_name}

A9 services ({svc_n}): {services or "(none)"}
A9 details: {svc_lines or "(none)"}
A9 shape: {shape or "(unknown)"}
A9 build first: {build_first or "(unknown)"}
A10 comms: {comms or "(unknown)"} · depth: {contract_depth or "(unknown)"}
A10 contracts count: {contracts_count}
A10 metrics: REST={rest_endpoints}, events={event_contracts}, ownership={ownership_rules}, ADRs={adrs}
A10 design choices: {choices or "(none)"}
A10 headline: {result_headline or "(none)"}
A10 body: {(result_body or "")[:220] or "(none)"}
A11 data strategy: {data_label}
A11 layouts mapped: {layouts_mapped}
Previous architecture summary: {prev_summary or "(none)"}
Comparison deltas: {deltas or "(none)"}

Default checklist ids (keep ALL ids; refine labels using REAL service/contract/data/path facts; all required):
{[c[0] for c in default_checks]}
Default checklist labels: {default_checks}

Return ONLY valid JSON:
{{
  "title": "Approve the design",
  "lede": "Do you approve this shape and this build order?",
  "approver_heading": "You are the approver",
  "paused_line": "Changing the design after code is written costs roughly ten times more. Reviewing work from {prior_agent_name}.",
  "expected_approvers": "Architecture board",
  "evidence_heading": "Design evidence · from prior agents",
  "evidence_intro": "One short sentence: these facts come from A9–A11 on the active path.",
  "architecture_items": [{{"label": "short", "value": "plain fact with numbers", "source": "A9|A10|A11"}}],
  "comparison_heading": "Previous → target architecture",
  "comparison_intro": "short intro",
  "previous_summary": "1-2 sentences of as-is architecture from discovery",
  "target_summary": "1-2 sentences of target design from A10",
  "comparison_deltas": [{{"aspect":"System shape","from":"...","to":"...","change":"split"}}],
  "checklist_heading": "Human gate checklist",
  "checklist_note": "Checklist items combine the step's standard controls with your A1 category, requirement, strategy, and the agent & gate map combination.",
  "checklist": [{{"id": "shape_ok", "label": "mandatory confirm using real services/contracts/data/path", "required": true}}],
  "reject_consequence": "What happens if you reject? …",
  "context_line": "short chip from A1 + design path",
  "requirement_summary": "1 sentence tying A1 requirement/strategy to this design approval",
  "path_status_label": "{path_status_label}",
  "movement_path": "{movement_line}",
  "activity_status": "G2 awaiting approval",
  "evidence_hints": ["architecture_approval.md"],
  "glossary": [{{"term": "Term", "def": "plain English"}}]
}}
Rules:
- Exactly 8 checklist items; ids MUST be from the default list; every required=true
- Checklist labels must name real services count / build-first / REST-events / data strategy / path / A1 strategy when available
- Labels must be confirmation statements (approve / confirm / reviewed / clear / sensible / match)
- Keep maximum semantic similarity to A9–A11 outputs and the design movement path ({movement_line})
- architecture_items: exactly these 4 labels with sources A9/A9/A10/A11 — Proposed pieces, Build first, Interface agreements, Data strategy — values must use real numbers (do not invent)
- 3 to 5 comparison_deltas when deltas/previous exist; otherwise omit empty noise
- requirement_summary must reflect A1
- title MUST be exactly "Approve the design"; lede MUST be a short yes/no question
- Do NOT invent movement_path or path_status_label — return the provided values unchanged
- Exactly 5 glossary terms
- No markdown"""

    backend = get_backend()
    out: dict[str, Any] = {
        "text": "",
        "error": "not attempted",
        "model": "catalog-fallback",
        "tokens_in": 0,
        "tokens_out": 0,
        "cost_usd": 0.0,
    }
    for attempt in range(2):
        try:
            out = await asyncio.wait_for(
                backend.complete(
                    "G2-brief",
                    prompt,
                    tier="medium",
                    response_format={"type": "json_object"},
                ),
                timeout=45.0,
            )
            if out.get("text") and not out.get("error"):
                break
            log.warning("G2-brief attempt %s empty/error: %s", attempt + 1, out.get("error"))
        except Exception as exc:  # noqa: BLE001
            log.warning("G2-brief attempt %s failed: %s", attempt + 1, exc)
            out = {
                "text": "",
                "error": str(exc),
                "model": "catalog-fallback",
                "tokens_in": 0,
                "tokens_out": 0,
                "cost_usd": 0.0,
            }

    parsed_json = _parse_json(out.get("text", ""))
    used_fallback = not isinstance(parsed_json, dict)

    label_by_id = {c[0]: c[1] for c in default_checks}
    checklist: list[dict[str, Any]] = [
        {"id": a, "label": b, "required": True} for a, b in default_checks
    ]
    raw_checks = parsed_json.get("checklist") if isinstance(parsed_json, dict) else None
    if isinstance(raw_checks, list):
        refined: dict[str, str] = {}
        confirm_words = (
            "approve", "confirm", "reviewed", "clear", "sensible", "acceptable",
            "match", "cover", "ownership", "boundaries", "security", "agree",
            "path", "delta", "cutover", "build",
        )
        for item in raw_checks[:10]:
            if not isinstance(item, dict):
                continue
            cid = str(item.get("id") or "").strip()
            label = str(item.get("label") or "").strip()
            if cid in label_by_id and label and any(w in label.lower() for w in confirm_words):
                refined[cid] = label
        if refined:
            checklist = [
                {"id": a, "label": refined.get(a, b), "required": True}
                for a, b in default_checks
            ]
    # Hard rule: every G2 checklist item is mandatory (8 items).
    checklist = [{**c, "required": True} for c in checklist]

    arch_items: list[dict[str, str]] = []
    raw_arch = parsed_json.get("architecture_items") if isinstance(parsed_json, dict) else None
    allowed_labels = {str(i["label"]): i for i in architecture_items}
    if isinstance(raw_arch, list):
        refined_arch: list[dict[str, str]] = []
        for item in raw_arch[:8]:
            if not isinstance(item, dict):
                continue
            label = str(item.get("label") or "").strip()
            value = str(item.get("value") or "").strip()
            source = str(item.get("source") or "").strip()
            base = allowed_labels.get(label)
            if not base or not value:
                continue
            # Keep grounded source; only allow refining the value text.
            if len(value) < 4 or "factory ui" in value.lower():
                continue
            refined_arch.append({
                "label": label,
                "value": value[:280],
                "source": base["source"],
            })
        # Prefer full grounded set; accept LLM values only when all base labels refined.
        if len(refined_arch) >= min(4, len(architecture_items)):
            by_label = {r["label"]: r for r in refined_arch}
            arch_items = [
                by_label.get(str(i["label"]), i) for i in architecture_items[:4]
            ]
    if len(arch_items) < 3:
        arch_items = architecture_items[:4]

    out_deltas: list[dict[str, str]] = []
    raw_deltas = parsed_json.get("comparison_deltas") if isinstance(parsed_json, dict) else None
    if isinstance(raw_deltas, list):
        for item in raw_deltas[:6]:
            if not isinstance(item, dict):
                continue
            aspect = str(item.get("aspect") or item.get("area") or "").strip()
            frm = str(item.get("from") or "").strip()
            to = str(item.get("to") or "").strip()
            if aspect and frm and to:
                out_deltas.append({
                    "aspect": aspect,
                    "from": frm,
                    "to": to,
                    "change": str(item.get("change") or item.get("why") or "").strip(),
                })
    if not out_deltas:
        out_deltas = deltas

    gloss: list[dict[str, str]] = []
    if isinstance(parsed_json, dict) and isinstance(parsed_json.get("glossary"), list):
        for item in parsed_json["glossary"][:5]:
            if not isinstance(item, dict):
                continue
            term = str(item.get("term") or "").strip()
            definition = str(item.get("def") or item.get("definition") or "").strip()
            if term and definition:
                gloss.append({"term": term, "def": definition})
    if len(gloss) < 4:
        gloss = fallback_glossary[:5]

    hints = (
        parsed_json.get("evidence_hints")
        if isinstance(parsed_json, dict) and isinstance(parsed_json.get("evidence_hints"), list)
        else []
    )
    evidence_hints = [str(h) for h in hints[:6]] or [
        "architecture_approval.md",
        "contracts/openapi.yaml",
        "adr/0002-comms.md",
    ]

    def _p(key: str, fallback: str) -> str:
        if isinstance(parsed_json, dict):
            return str(parsed_json.get(key) or "").strip() or fallback
        return fallback

    previous_summary = _p("previous_summary", prev_summary or "As-is estate still runs without explicit service contracts.")
    target_summary = _p(
        "target_summary",
        result_body or result_headline or "Target design defines how the new pieces talk and own data.",
    )

    raw_title = _p("title", str(profile.get("title") or "Approve the design"))
    title_l = raw_title.lower()
    if (
        "factory ui" in title_l
        or "modernization factory" in title_l
        or "for modernization" in title_l
        or len(raw_title) > 36
        or not title_l.startswith("approve")
    ):
        safe_title = "Approve the design"
    else:
        safe_title = raw_title

    raw_lede = _p("lede", str(profile.get("lede") or "Do you approve this shape and this build order?"))
    if "factory ui" in raw_lede.lower() or len(raw_lede) > 120:
        safe_lede = "Do you approve this shape and this build order?"
    else:
        safe_lede = raw_lede

    res_dict = {
        "title": safe_title,
        "lede": safe_lede,
        "approver_heading": _p("approver_heading", str(profile.get("approver_heading") or "")),
        "paused_line": _p("paused_line", paused_default),
        "expected_approvers": _p(
            "expected_approvers",
            expected_approvers or str(profile.get("expected_approvers") or "Architecture board"),
        ),
        "evidence_heading": _p("evidence_heading", str(profile.get("evidence_heading") or "")),
        "evidence_intro": _p("evidence_intro", str(profile.get("evidence_intro") or "")),
        "architecture_items": arch_items,
        "comparison_heading": _p(
            "comparison_heading",
            str(profile.get("comparison_heading") or "Previous → target architecture"),
        ),
        "comparison_intro": _p(
            "comparison_intro",
            str(profile.get("comparison_intro") or ""),
        ),
        "previous_summary": previous_summary,
        "target_summary": target_summary,
        "comparison_deltas": out_deltas,
        "checklist_heading": "Human gate checklist",
        "checklist_note": _p(
            "checklist_note",
            str(
                profile.get("checklist_note")
                or (
                    "Checklist items combine the step's standard controls with your A1 category, "
                    "requirement, strategy, and the agent & gate map combination."
                )
            ),
        ),
        "checklist": checklist,
        "reject_consequence": _p(
            "reject_consequence",
            str(profile.get("reject_consequence") or ""),
        ),
        "context_line": (
            f"{cat} · {strat} · {svc_n} services · {data_label}"
            if cat or strat
            else f"{svc_n} services · {data_label}"
        ),
        "requirement_summary": _p("requirement_summary", req_default),
        # Never trust LLM for path chrome — keeps Map status / movement path undistorted.
        "path_status_label": path_status_label,
        "movement_path": movement_line,
        "activity_status": _p("activity_status", "G2 awaiting approval"),
        "evidence_hints": evidence_hints,
        "glossary": gloss,
        "category_id": category_id,
        "prior_agent_name": prior_agent_name,
        "path_active_ids": path_ids,
        "service_names": services,
        "warning": (
            "LLM unavailable — using architecture-shaped G2 form from A9–A11"
            if used_fallback
            else ""
        ),
        **_meta(out),
    }

    legacy_lang = detect_legacy_language(f"{req} {strat} {why} {title}", default="Legacy")
    return sanitize_brief_outputs(res_dict, legacy_lang)


async def generate_g3_brief(
    project_name: str,
    category_name: str,
    requirement: str,
    strategies: list[str],
    strategy_short: str,
    why_modernize: str,
    category_id: str = "",
    prior_agent_name: str = "Integration bridges",
    expected_approvers: str = "Engineering lead",
    path_active_ids: list[str] | None = None,
    *,
    service_names: list[str] | None = None,
    services_built: int = 0,
    rule_methods: int = 0,
    stack: str = "",
    provenance: bool = True,
    security_findings: int = 0,
    bridges: list[str] | None = None,
    source_file_count: int = 0,
    result_headline: str = "",
    result_body: str = "",
) -> dict[str, Any]:
    """LLM-shaped Gate 3 Code Approval from A1 + path + A12–A13 execution facts."""
    import asyncio
    import logging

    from app.intake.catalog import g3_form_profile

    log = logging.getLogger(__name__)
    title = (project_name or "Modernization initiative").strip()
    cat = (category_name or "Legacy estate").strip()
    req = (requirement or "").strip()
    strat = (strategy_short or (strategies[0] if strategies else "")).strip()
    why = (why_modernize or "").strip()
    profile = g3_form_profile(category_id)
    services = [str(x) for x in (service_names or []) if x]
    svc_n = int(services_built or len(services) or 0)
    methods_n = int(rule_methods or 0)
    stack_label = str(stack or "not set")
    bridge_list = [str(x) for x in (bridges or []) if x]
    bridge_label = ", ".join(bridge_list) if bridge_list else "none selected"
    path_ids = [str(x) for x in (path_active_ids or []) if x]
    security_n = int(security_findings or 0)
    security_label = "None found" if security_n <= 0 else f"{security_n} open finding(s)"
    trace_label = (
        "Every method names the rule it implements"
        if provenance
        else "OFF — nobody will know why this code does what it does"
    )

    _code_labels = {
        "A12": "A12 Code generation",
        "A13": "A13 Integration bridges",
        "G3": "G3",
    }
    if path_ids:
        path_code_ids = [x for x in ("A12", "A13") if x in path_ids]
    else:
        path_code_ids = ["A12", "A13"]
    if (svc_n or methods_n or stack_label != "not set") and "A12" not in path_code_ids:
        path_code_ids.insert(0, "A12")
        path_code_ids = list(dict.fromkeys(path_code_ids))
    if bridge_list and "A13" not in path_code_ids:
        path_code_ids.append("A13")
        path_code_ids = list(dict.fromkeys(path_code_ids))
    if "G3" not in path_code_ids:
        path_code_ids = path_code_ids + ["G3"]
    path_status_label = "Active · on path" if ("G3" in path_ids or not path_ids) else "Eligible"
    movement_line = " -> ".join(_code_labels.get(x, x) for x in path_code_ids)

    default_checks: list[list[str]] = []
    for cid, tmpl in profile.get("checklist_templates") or []:
        try:
            label = str(tmpl).format(
                services=svc_n or "proposed",
                methods=methods_n or 0,
                stack=stack_label,
                bridges=bridge_label,
                strategy=strat or "selected strategy",
            )
        except (KeyError, ValueError):
            label = str(tmpl)
        default_checks.append([str(cid), label])

    code_items = [
        {"label": "Services built", "value": str(svc_n), "source": "A12"},
        {"label": "Rule methods written", "value": str(methods_n), "source": "A12"},
        {
            "label": "Security problems",
            "value": security_label,
            "source": "A12",
        },
        {"label": "Traceability", "value": trace_label, "source": "A12"},
    ]
    if stack_label and stack_label != "not set":
        code_items.insert(2, {"label": "Generation stack", "value": stack_label, "source": "A12"})
    if bridge_list or "A13" in path_code_ids:
        code_items.append({"label": "Bridges · A13", "value": bridge_label, "source": "A13"})
    if source_file_count:
        code_items.append({
            "label": "Source files",
            "value": str(source_file_count),
            "source": "A12",
        })
    if result_headline:
        code_items.append({
            "label": "Generation headline",
            "value": result_headline[:220],
            "source": "A12",
        })

    fallback_glossary = [
        {"term": "Code Approval", "def": "A human must approve generated code before it can merge or advance to testing."},
        {"term": "Provenance", "def": "A note on every method naming the approved rule it implements."},
        {"term": "Integration bridge", "def": "A facade so new and old systems can run side by side during cutover."},
        {"term": "Dual-run", "def": "Old and new paths execute together until equivalence is proven."},
        {"term": "Rewind", "def": "Rejecting sends work back to Code generation so agents can fix gaps."},
    ]

    paused_default = (
        "Generated code cannot merge itself. A person must approve. "
        f"You're reviewing the work produced by {prior_agent_name}."
    )
    req_default = (
        f"You are approving generated code for «{cat}»"
        + (f" — {req[:140]}" if req else "")
        + (f" using strategy «{strat}»." if strat else ".")
    )

    prompt = f"""You write Gate 3 (Approve the new code) — a human merge-approval gate.
CRITICAL: the title MUST be exactly "Approve the new code" — never mention "modernization factory UI", products, or project names in the title.

Use ONLY the facts below from A1 intake, the movement path, and Agents A12–A13.
Plain English for the Engineering lead.
Maximum semantic similarity with prior agent execution results and the movement path.
Every checklist item must confirm something those agents actually produced — not generic advice.
Checklist labels must reference real counts / stack / bridges / A1 strategy when available.

Project: {title}
Category: {cat} ({category_id or "unknown"})
A1 requirement: {req or "(custom)"}
A1 strategy: {strat or "(not set)"}
A1 why modernize: {why or "(not provided)"}
Path active ids: {path_ids or "(unknown)"}
Code movement path: {movement_line}
Path status for G3: {path_status_label}
Prior agent under review: {prior_agent_name}

A12 services built: {svc_n}
A12 service names: {services or "(none)"}
A12 rule methods: {methods_n}
A12 stack: {stack_label}
A12 provenance on: {provenance}
A12 security findings: {security_n}
A12 source files: {source_file_count}
A12 headline: {result_headline or "(none)"}
A12 body: {(result_body or "")[:220] or "(none)"}
A13 bridges: {bridge_label}

Default checklist ids (keep ALL ids; refine labels using REAL code/bridge/path facts; all required):
{[c[0] for c in default_checks]}
Default checklist labels: {default_checks}

Return ONLY valid JSON:
{{
  "title": "Approve the new code",
  "lede": "Does this code look right to merge?",
  "approver_heading": "You are the approver",
  "paused_line": "Generated code cannot merge itself. Reviewing work from {prior_agent_name}.",
  "expected_approvers": "Engineering lead",
  "evidence_heading": "Code evidence · from prior agents",
  "evidence_intro": "One short sentence: these facts come from A12–A13 on the active path.",
  "code_items": [{{"label": "Services built", "value": "N", "source": "A12"}}],
  "checklist_heading": "Human gate checklist",
  "checklist_note": "Checklist items combine the step's standard controls with your A1 category, requirement, strategy, and the agent & gate map combination.",
  "checklist": [{{"id": "merge_ok", "label": "mandatory confirm using real services/methods/bridges/path", "required": true}}],
  "reject_consequence": "What happens if you reject? …",
  "context_line": "short chip from A1 + code path",
  "requirement_summary": "1 sentence tying A1 requirement/strategy to this code approval",
  "path_status_label": "{path_status_label}",
  "movement_path": "{movement_line}",
  "activity_status": "G3 awaiting approval",
  "evidence_hints": ["pull_request.json"],
  "glossary": [{{"term": "Term", "def": "plain English"}}]
}}
Rules:
- Exactly {len(default_checks)} checklist items; ids MUST be from the default list; every required=true
- Checklist labels must name real services / methods / stack / bridges / A1 strategy / path when available
- Labels must be confirmation statements (approve / confirm / reviewed / clear / safe / match)
- Keep maximum semantic similarity to A12–A13 outputs and the movement path ({movement_line})
- code_items: use labels Services built, Rule methods written, Security problems, Traceability (plus stack/bridges when known) with sources A12|A13 — do not invent counts
- requirement_summary must reflect A1
- title MUST be exactly "Approve the new code"; lede MUST be a short yes/no merge question
- Do NOT invent movement_path or path_status_label — return the provided values unchanged
- Exactly 5 glossary terms
- No markdown"""

    backend = get_backend()
    out: dict[str, Any] = {
        "text": "",
        "error": "not attempted",
        "model": "catalog-fallback",
        "tokens_in": 0,
        "tokens_out": 0,
        "cost_usd": 0.0,
    }
    for attempt in range(2):
        try:
            out = await asyncio.wait_for(
                backend.complete(
                    "G3-brief",
                    prompt,
                    tier="medium",
                    response_format={"type": "json_object"},
                ),
                timeout=45.0,
            )
            if out.get("text") and not out.get("error"):
                break
            log.warning("G3-brief attempt %s empty/error: %s", attempt + 1, out.get("error"))
        except Exception as exc:  # noqa: BLE001
            log.warning("G3-brief attempt %s failed: %s", attempt + 1, exc)
            out = {
                "text": "",
                "error": str(exc),
                "model": "catalog-fallback",
                "tokens_in": 0,
                "tokens_out": 0,
                "cost_usd": 0.0,
            }

    parsed_json = _parse_json(out.get("text", ""))
    used_fallback = not isinstance(parsed_json, dict)

    label_by_id = {c[0]: c[1] for c in default_checks}
    checklist: list[dict[str, Any]] = [
        {"id": a, "label": b, "required": True} for a, b in default_checks
    ]
    raw_checks = parsed_json.get("checklist") if isinstance(parsed_json, dict) else None
    if isinstance(raw_checks, list):
        refined: dict[str, str] = {}
        confirm_words = (
            "approve", "confirm", "reviewed", "clear", "sensible", "acceptable",
            "match", "safe", "provenance", "bridge", "merge", "trace", "security",
            "stack", "path", "dual",
        )
        for item in raw_checks[:12]:
            if not isinstance(item, dict):
                continue
            cid = str(item.get("id") or "").strip()
            label = str(item.get("label") or "").strip()
            if cid in label_by_id and label and any(w in label.lower() for w in confirm_words):
                if "factory ui" in label.lower():
                    continue
                refined[cid] = label
        if refined:
            checklist = [
                {"id": a, "label": refined.get(a, b), "required": True}
                for a, b in default_checks
            ]
    checklist = [{**c, "required": True} for c in checklist]

    items_out: list[dict[str, str]] = []
    raw_items = None
    if isinstance(parsed_json, dict):
        raw_items = parsed_json.get("code_items") or parsed_json.get("architecture_items")
    allowed = {str(i["label"]): i for i in code_items}
    if isinstance(raw_items, list):
        refined_items: list[dict[str, str]] = []
        for item in raw_items[:8]:
            if not isinstance(item, dict):
                continue
            label = str(item.get("label") or "").strip()
            value = str(item.get("value") or "").strip()
            base = allowed.get(label)
            if not base or not value or "factory ui" in value.lower():
                continue
            refined_items.append({
                "label": label,
                "value": value[:280],
                "source": base["source"],
            })
        if len(refined_items) >= min(4, len(code_items)):
            by_label = {r["label"]: r for r in refined_items}
            items_out = [by_label.get(str(i["label"]), i) for i in code_items[:6]]
    if len(items_out) < 3:
        items_out = code_items[:6]

    gloss: list[dict[str, str]] = []
    if isinstance(parsed_json, dict) and isinstance(parsed_json.get("glossary"), list):
        for item in parsed_json["glossary"][:5]:
            if not isinstance(item, dict):
                continue
            term = str(item.get("term") or "").strip()
            definition = str(item.get("def") or item.get("definition") or "").strip()
            if term and definition:
                gloss.append({"term": term, "def": definition})
    if len(gloss) < 4:
        gloss = fallback_glossary[:5]

    hints = (
        parsed_json.get("evidence_hints")
        if isinstance(parsed_json, dict) and isinstance(parsed_json.get("evidence_hints"), list)
        else []
    )
    evidence_hints = [str(h) for h in hints[:6]] or [
        "pull_request.json",
        "generated/services.zip",
        "sbom.cdx.json",
    ]

    def _p(key: str, fallback: str) -> str:
        if isinstance(parsed_json, dict):
            return str(parsed_json.get(key) or "").strip() or fallback
        return fallback

    raw_title = _p("title", str(profile.get("title") or "Approve the new code"))
    title_l = raw_title.lower()
    if (
        "factory ui" in title_l
        or "modernization factory" in title_l
        or len(raw_title) > 40
        or not title_l.startswith("approve")
    ):
        safe_title = "Approve the new code"
    else:
        safe_title = raw_title

    raw_lede = _p("lede", str(profile.get("lede") or "Does this code look right to merge?"))
    if "factory ui" in raw_lede.lower() or len(raw_lede) > 120:
        safe_lede = "Does this code look right to merge?"
    else:
        safe_lede = raw_lede

    return {
        "title": safe_title,
        "lede": safe_lede,
        "approver_heading": _p("approver_heading", str(profile.get("approver_heading") or "")),
        "paused_line": _p("paused_line", paused_default),
        "expected_approvers": _p(
            "expected_approvers",
            expected_approvers or str(profile.get("expected_approvers") or "Engineering lead"),
        ),
        "evidence_heading": _p("evidence_heading", str(profile.get("evidence_heading") or "")),
        "evidence_intro": _p("evidence_intro", str(profile.get("evidence_intro") or "")),
        "code_items": items_out,
        "checklist_heading": "Human gate checklist",
        "checklist_note": _p(
            "checklist_note",
            str(
                profile.get("checklist_note")
                or (
                    "Checklist items combine the step's standard controls with your A1 category, "
                    "requirement, strategy, and the agent & gate map combination."
                )
            ),
        ),
        "checklist": checklist,
        "reject_consequence": _p(
            "reject_consequence",
            str(profile.get("reject_consequence") or ""),
        ),
        "context_line": (
            f"{cat} · {strat} · {svc_n} services · {methods_n} methods"
            if cat or strat
            else f"{svc_n} services · {methods_n} methods"
        ),
        "requirement_summary": _p("requirement_summary", req_default),
        "path_status_label": path_status_label,
        "movement_path": movement_line,
        "activity_status": _p("activity_status", "G3 awaiting approval"),
        "evidence_hints": evidence_hints,
        "glossary": gloss,
        "category_id": category_id,
        "prior_agent_name": prior_agent_name,
        "path_active_ids": path_ids,
        "service_names": services,
        "warning": (
            "LLM unavailable — using code-shaped G3 form from A12–A13"
            if used_fallback
            else ""
        ),
        **_meta(out),
    }


async def generate_a13_brief(
    project_name: str,
    category_name: str,
    requirement: str,
    strategies: list[str],
    strategy_short: str,
    why_modernize: str,
    category_id: str,
    prior_agent_id: str = "A12",
    prior_agent_name: str = "Code generation",
    path_active_ids: list[str] | None = None,
    *,
    service_names: list[str] | None = None,
    stack: str = "Java",
    comms: str = "mixed",
    data_strategy: str = "dual_write",
    approved_rule_count: int = 0,
    a12_files_count: int = 0,
    a12_headline: str = "",
) -> dict[str, Any]:
    """LLM-shaped Integration Bridges (A13) brief derived from A1 intake, movement path, and A12/design context."""
    import asyncio
    import logging

    log = logging.getLogger(__name__)

    cat = (category_name or "1. Legacy source-code data").strip()
    proj = (project_name or "Convert old Fortran code to new Java based code. The business context or the outcome should be similar").strip()
    req = (requirement or "Modernizing our legacy Fortran code to a Java-based system will improve maintainability, enhance performance, and enable cloud deployment.").strip()
    strat = (strategy_short or (strategies[0] if strategies else "Incremental modernization approach")).strip()
    why = (why_modernize or "").strip()
    path_ids = [str(x) for x in (path_active_ids or []) if x]
    services = [str(x) for x in (service_names or []) if x]
    svc_n = len(services) or 1
    stack_label = stack.capitalize() if stack else "Java"

    req_short = req[:110] + ("…" if len(req) > 110 else "")
    svc_str = ", ".join(services[:3]) if services else "generated services"

    fallback_checklist = [
        {"id": "c1", "label": f"Confirm bridge types match interfaces in requirement «{req_short}»", "required": True},
        {"id": "c2", "label": f"Confirm dual-run strangler facade routing fits strategy «{strat}»", "required": True},
        {"id": "c3", "label": f"Confirm protocol adapters link legacy protocols to new {stack_label} services ({svc_str})", "required": True},
        {"id": "c4", "label": f"Confirm step A13 belongs on active path: {' -> '.join(path_ids[-4:]) if path_ids else 'A12 -> A13'}", "required": True},
        {"id": "c5", "label": f"Confirm partner versioning windows support dual-write execution", "required": True},
        {"id": "c6", "label": f"Confirm cutover runbook scope aligns with «{proj[:80]}»", "required": True},
        {"id": "c7", "label": f"Confirm operational rollback triggers are armed for {stack_label} bridges", "required": True},
    ]

    fallback_glossary = [
        {"term": "Integration Bridge", "def": f"An adapter connecting legacy protocols to new {stack_label} microservices."},
        {"term": "Strangler Facade", "def": "An entry point routing traffic dynamically between legacy and modern services."},
        {"term": "Dual-run Sync", "def": "Replicating live transactions across old and new systems simultaneously."},
        {"term": "Traffic Splitting", "def": "Gradually diverting percentage-based user traffic to newly generated code."},
        {"term": "Cutover Runbook", "def": "Operational guide detailing step-by-step handover and rollback procedures."},
    ]

    prompt = f"""You write Agent A13 · Integration Bridges brief for an AI Modernization Factory UI.
Context of the page must be derived from previous Agent execution results, movement path, and A1 intake with MAXIMUM semantic similarity.

FACTS FROM PREVIOUS AGENTS & INTAKE:
- Project: {proj}
- Category: {cat} ({category_id or "legacy"})
- Requirement: {req}
- Modernization Strategy: {strat}
- Why Modernize: {why or "(not provided)"}
- Agent Movement Path: {path_ids or ["A1", "A2", "A3", "A4", "A5", "A6", "A7", "A9", "A10", "A11", "A12", "A13"]}
- Immediate Prior Step: {prior_agent_id} ({prior_agent_name})
- A9/A12 Generated Services ({svc_n}): {services or ["Policy Core", "Pricing Service"]}
- Target Stack: {stack_label}
- Comms Style (A10): {comms}
- Data Strategy (A11): {data_strategy or "dual_write"}
- Approved Rules Implemented (A12): {approved_rule_count}
- Generated Files Count (A12): {a12_files_count}
- Code Gen Headline (A12): {a12_headline or "Code generated and packaged"}

YOUR TASK:
Return ONLY valid JSON:
{{
  "title": "Integration bridges",
  "lede": "Builds API, file, and messaging bridges so strangler/facade strategies can run side by side with the legacy estate.",
  "cards": {{
    "from_a1": "{cat}",
    "strategy": "{strat}",
    "project": "{proj}",
    "map_status": "Active · on path"
  }},
  "checklist": [
    {{
      "id": "c1",
      "label": "Confirm bridge types match interfaces in requirement: «{req_short}»",
      "required": true
    }}
  ],
  "suggested_bridges": ["api", "file"],
  "result_headline": "Bridges ready — strangler facade routing active between legacy and {stack_label} services.",
  "result_body": "Live call and file exchange adapters generated. Dual-run traffic splitter and cutover runbook ready.",
  "glossary": [
    {{"term": "Integration Bridge", "def": "Adapter connecting legacy protocols to new {stack_label} APIs."}}
  ]
}}

Rules:
- Exactly 6 to 7 checklist items; every item MUST have MAXIMUM semantic similarity with the category («{cat}»), requirement («{req_short}»), strategy («{strat}»), movement path ({prior_agent_id} -> A13), and generated {stack_label} services ({svc_str}).
- Exactly 5 glossary terms relevant to integration bridges & strangler facade.
- suggested_bridges should be a subset of ["api", "file", "mq"].
- No markdown formatting in JSON output."""

    backend = get_backend()
    out: dict[str, Any] = {
        "text": "",
        "error": "not attempted",
        "model": "catalog-fallback",
        "tokens_in": 0,
        "tokens_out": 0,
        "cost_usd": 0.0,
    }

    try:
        out = await asyncio.wait_for(
            backend.complete(
                "A13-brief",
                prompt,
                tier="medium",
                response_format={"type": "json_object"},
            ),
            timeout=30.0,
        )
    except Exception as exc:  # noqa: BLE001
        log.warning("A13-brief failed: %s", exc)
        out = {
            "text": "",
            "error": str(exc),
            "model": "catalog-fallback",
            "tokens_in": 0,
            "tokens_out": 0,
            "cost_usd": 0.0,
        }

    parsed = _parse_json(out.get("text", ""))
    used_fallback = not isinstance(parsed, dict)

    checklist = fallback_checklist
    if isinstance(parsed, dict) and isinstance(parsed.get("checklist"), list) and len(parsed["checklist"]) >= 4:
        raw_c = parsed["checklist"]
        valid_c = []
        for i, item in enumerate(raw_c[:7]):
            if isinstance(item, dict) and item.get("label"):
                valid_c.append({
                    "id": str(item.get("id") or f"c{i+1}"),
                    "label": str(item["label"]).strip(),
                    "required": True,
                })
        if len(valid_c) >= 4:
            checklist = valid_c

    gloss = fallback_glossary
    if isinstance(parsed, dict) and isinstance(parsed.get("glossary"), list) and len(parsed["glossary"]) >= 4:
        valid_g = []
        for item in parsed["glossary"][:5]:
            if isinstance(item, dict) and item.get("term") and item.get("def"):
                valid_g.append({
                    "term": str(item["term"]).strip(),
                    "def": str(item["def"]).strip(),
                })
        if len(valid_g) >= 4:
            gloss = valid_g

    cards = {
        "from_a1": cat,
        "strategy": strat,
        "project": proj,
        "map_status": "Active · on path",
    }
    if isinstance(parsed, dict) and isinstance(parsed.get("cards"), dict):
        parsed_cards = parsed["cards"]
        cards["from_a1"] = str(parsed_cards.get("from_a1") or cat)
        cards["strategy"] = str(parsed_cards.get("strategy") or strat)
        cards["project"] = str(parsed_cards.get("project") or proj)
        cards["map_status"] = str(parsed_cards.get("map_status") or "Active · on path")

    suggested_bridges = ["api", "file"]
    if isinstance(parsed, dict) and isinstance(parsed.get("suggested_bridges"), list):
        sb = [str(b).lower() for b in parsed["suggested_bridges"] if str(b).lower() in {"api", "file", "mq"}]
        if sb:
            suggested_bridges = sb

    result_headline = f"Bridges ready under strategy «{strat}» — strangler facade routing active between legacy and {stack_label} services."
    if isinstance(parsed, dict) and parsed.get("result_headline"):
        result_headline = str(parsed["result_headline"]).strip()

    result_body = f"Live call and file exchange adapters generated for «{proj}». Dual-run traffic splitter and cutover runbook ready."
    if isinstance(parsed, dict) and parsed.get("result_body"):
        result_body = str(parsed["result_body"]).strip()

    return {
        "title": str((parsed or {}).get("title") if isinstance(parsed, dict) else "") or "Integration bridges",
        "lede": str((parsed or {}).get("lede") if isinstance(parsed, dict) else "")
        or "Builds API, file, and messaging bridges so strangler/facade strategies can run side by side with the legacy estate.",
        "cards": cards,
        "checklist": checklist,
        "suggested_bridges": suggested_bridges,
        "result_headline": result_headline,
        "result_body": result_body,
        "glossary": gloss,
        "warning": "LLM unavailable — using context-derived A13 brief" if used_fallback else "",
        **_meta(out),
    }


async def generate_a14_brief(
    project_name: str,
    category_name: str,
    requirement: str,
    strategies: list[str],
    strategy_short: str,
    why_modernize: str,
    category_id: str = "",
    prior_agent_id: str = "G3",
    prior_agent_name: str = "Code Approval",
    path_active_ids: list[str] | None = None,
    *,
    service_names: list[str] | None = None,
    services_built: int = 0,
    rule_methods: int = 0,
    stack: str = "",
    provenance: bool = True,
    bridges: list[str] | None = None,
    source_file_count: int = 0,
    approved_rule_count: int = 0,
    journeys: int = 0,
    g3_approved: bool = False,
    result_headline: str = "",
    result_body: str = "",
) -> dict[str, Any]:
    """LLM-shaped A14 Test generation brief from A1 + path + A12–A13 + G3 facts."""
    import asyncio
    import logging

    from app.intake.catalog import a14_form_profile

    log = logging.getLogger(__name__)
    title = (project_name or "Modernization initiative").strip()
    cat = (category_name or "1. Legacy source-code data").strip()
    req = (requirement or "").strip()
    strat = (strategy_short or (strategies[0] if strategies else "")).strip()
    why = (why_modernize or "").strip()
    profile = a14_form_profile(category_id)
    services = [str(x) for x in (service_names or []) if x]
    svc_n = int(services_built or len(services) or 0)
    methods_n = int(rule_methods or 0)
    stack_label = str(stack or "not set")
    if stack_label == "not set" and services:
        stack_label = "target stack"
    bridge_list = [str(x) for x in (bridges or []) if x]
    bridge_label = ", ".join(bridge_list) if bridge_list else "none selected"
    path_ids = [str(x) for x in (path_active_ids or []) if x]
    rules_n = int(approved_rule_count or 0)
    journeys_n = int(journeys or 0)
    svc_str = ", ".join(services[:4]) if services else f"{svc_n} services" if svc_n else "generated services"
    req_short = req[:110] + ("…" if len(req) > 110 else "")
    proj_short = title[:100] + ("…" if len(title) > 100 else "")

    _labels = {
        "A12": "A12 Code generation",
        "A13": "A13 Integration bridges",
        "G3": "G3 Code Approval",
        "A14": "A14 Test generation",
    }
    if path_ids:
        path_test_ids = [x for x in ("A12", "A13", "G3") if x in path_ids]
    else:
        path_test_ids = ["A12", "A13", "G3"]
    if (svc_n or methods_n or stack_label != "not set") and "A12" not in path_test_ids:
        path_test_ids.insert(0, "A12")
        path_test_ids = list(dict.fromkeys(path_test_ids))
    if bridge_list and "A13" not in path_test_ids:
        path_test_ids.append("A13")
        path_test_ids = list(dict.fromkeys(path_test_ids))
    if "G3" not in path_test_ids:
        path_test_ids = path_test_ids + ["G3"]
    if "A14" not in path_test_ids:
        path_test_ids = path_test_ids + ["A14"]
    path_status_label = "Active · on path" if ("A14" in path_ids or not path_ids) else "Eligible"
    movement_line = " -> ".join(_labels.get(x, x) for x in path_test_ids)

    default_checks: list[list[str]] = []
    for cid, tmpl in profile.get("checklist_templates") or []:
        try:
            label = str(tmpl).format(
                rules=rules_n or "approved",
                journeys=journeys_n or "critical",
                services=svc_str,
                stack=stack_label if stack_label != "not set" else "approved",
                bridges=bridge_label,
                strategy=strat or "selected strategy",
                category=cat,
                requirement=req_short or "A1 requirement",
                project=proj_short or title,
            )
        except (KeyError, ValueError):
            label = str(tmpl)
        default_checks.append([str(cid), label])

    what_to_test_default = [
        {
            "id": "w1",
            "label": "Approved business rules",
            "detail": f"{rules_n or 'N'} approved rules — one unit test per rule (not the generated code)",
            "source": "rules",
        },
        {
            "id": "w2",
            "label": "Critical customer journeys",
            "detail": f"{journeys_n or 'key'} journeys need characterization / parity coverage for G4",
            "source": "journeys",
        },
        {
            "id": "w3",
            "label": "Generated services",
            "detail": f"{svc_str} ({methods_n} rule methods) on stack {stack_label}",
            "source": "A12",
        },
        {
            "id": "w4",
            "label": "Integration bridges / dual-run",
            "detail": f"Bridges ({bridge_label}) need parity checks during dual-run",
            "source": "A13",
        },
        {
            "id": "w5",
            "label": "Edge / boundary cases",
            "detail": "Zeros, negatives, overflow, and awkward inputs that rules specify",
            "source": "A14",
        },
        {
            "id": "w6",
            "label": "Golden legacy expectations",
            "detail": "Capture expected answers from the old system before running new suites",
            "source": "legacy",
        },
    ]

    fallback_glossary = [
        {"term": "Characterization test", "def": "A test that locks current legacy behaviour so the new system must match it."},
        {"term": "Rule-derived test", "def": "A unit test written from an approved business rule, never from generated source alone."},
        {"term": "Parity / equivalence", "def": "Proving the new path returns the same answers as the old path for the same inputs."},
        {"term": "Coverage matrix", "def": "A map from each approved rule to the tests that prove it."},
        {"term": "Golden expectations", "def": "Answers captured from the legacy system used as the ground truth for new tests."},
    ]

    kinds_suggested = list(profile.get("kinds_suggested") or ["unit", "integration", "edge"])
    if journeys_n > 0 and "parity" not in kinds_suggested:
        kinds_suggested = kinds_suggested + ["parity"]

    prompt = f"""You write Agent A14 · Test generation brief for an AI Modernization Factory UI.
CRITICAL: the title MUST be exactly "Test generation" — never mention "modernization factory UI", products, or project names in the title.

Context MUST come from previous agent execution results, the movement path, and A1 intake.
Maximum semantic similarity with A12–A13 outputs, G3 approval, approved rules, and journeys.
Plain English for the operator who will run tests.
Checklist and what_to_test must reference REAL counts / services / bridges / strategy when available.

Project: {title}
Category: {cat} ({category_id or "unknown"})
A1 requirement: {req or "(custom)"}
A1 strategy: {strat or "(not set)"}
A1 why modernize: {why or "(not provided)"}
Path active ids: {path_ids or "(unknown)"}
Test movement path: {movement_line}
Path status for A14: {path_status_label}
Prior step: {prior_agent_id} ({prior_agent_name})
G3 approved: {g3_approved}

A12 services built: {svc_n}
A12 service names: {services or "(none)"}
A12 rule methods: {methods_n}
A12 stack: {stack_label}
A12 provenance on: {provenance}
A12 source files: {source_file_count}
A12 headline: {result_headline or "(none)"}
A12 body: {(result_body or "")[:220] or "(none)"}
A13 bridges: {bridge_label}
Approved rules: {rules_n}
Customer journeys: {journeys_n}

Default checklist ids (keep ALL ids; refine labels using REAL rules/journeys/path/A1 facts):
{[c[0] for c in default_checks]}
Default checklist labels: {default_checks}

Return ONLY valid JSON:
{{
  "title": "Test generation",
  "lede": "Writes test suites from approved rules and journeys so equivalence is proven against intent, not against generated code.",
  "cards": {{
    "from_a1": "{cat}",
    "strategy": "{strat or "selected strategy"}",
    "project": "{title}",
    "map_status": "{path_status_label}"
  }},
  "what_to_test": [{{"id": "w1", "label": "Approved business rules", "detail": "…", "source": "rules"}}],
  "checklist_heading": "OPERATOR CHECKLIST (OPTIONAL)",
  "checklist_note": "Checklist items combine the step's standard controls with your A1 category, requirement, strategy, and the agent & gate map combination.",
  "checklist": [{{"id": "rules_ok", "label": "confirm using real rules/journeys/path", "required": true}}],
  "suggested_kinds": ["unit", "integration", "edge"],
  "result_headline": "short success headline after tests are written",
  "result_body": "1-2 sentences on suites + coverage vs rules",
  "path_status_label": "{path_status_label}",
  "movement_path": "{movement_line}",
  "glossary": [{{"term": "Term", "def": "plain English"}}]
}}
Rules:
- Exactly {len(default_checks)} checklist items; ids MUST be from the default list
- Checklist labels must name real rules / journeys / services / bridges / A1 strategy / path when available
- what_to_test: 5–7 concrete items; do not invent rule/journey counts — use provided numbers
- suggested_kinds subset of ["unit", "integration", "edge", "parity"]
- title MUST be exactly "Test generation"
- Do NOT invent movement_path or path_status_label — return the provided values unchanged
- Exactly 5 glossary terms about testing / parity / characterization
- No markdown"""

    backend = get_backend()
    out: dict[str, Any] = {
        "text": "",
        "error": "not attempted",
        "model": "catalog-fallback",
        "tokens_in": 0,
        "tokens_out": 0,
        "cost_usd": 0.0,
    }
    for attempt in range(2):
        try:
            out = await asyncio.wait_for(
                backend.complete(
                    "A14-brief",
                    prompt,
                    tier="medium",
                    response_format={"type": "json_object"},
                ),
                timeout=45.0,
            )
            if out.get("text") and not out.get("error"):
                break
            log.warning("A14-brief attempt %s empty/error: %s", attempt + 1, out.get("error"))
        except Exception as exc:  # noqa: BLE001
            log.warning("A14-brief attempt %s failed: %s", attempt + 1, exc)
            out = {
                "text": "",
                "error": str(exc),
                "model": "catalog-fallback",
                "tokens_in": 0,
                "tokens_out": 0,
                "cost_usd": 0.0,
            }

    parsed_json = _parse_json(out.get("text", ""))
    used_fallback = not isinstance(parsed_json, dict)

    label_by_id = {c[0]: c[1] for c in default_checks}
    checklist: list[dict[str, Any]] = [
        {"id": a, "label": b, "required": True} for a, b in default_checks
    ]
    raw_checks = parsed_json.get("checklist") if isinstance(parsed_json, dict) else None
    if isinstance(raw_checks, list):
        refined: dict[str, str] = {}
        confirm_words = (
            "confirm", "approve", "match", "cover", "derived", "belongs",
            "applies", "remains", "exercise", "parity", "coverage", "rule",
            "journey", "bridge", "path", "strategy", "project",
        )
        for item in raw_checks[:12]:
            if not isinstance(item, dict):
                continue
            cid = str(item.get("id") or "").strip()
            label = str(item.get("label") or "").strip()
            if cid in label_by_id and label and any(w in label.lower() for w in confirm_words):
                if "factory ui" in label.lower():
                    continue
                refined[cid] = label
        if refined:
            checklist = [
                {"id": a, "label": refined.get(a, b), "required": True}
                for a, b in default_checks
            ]

    what_to_test: list[dict[str, str]] = [dict(x) for x in what_to_test_default]
    raw_wtt = parsed_json.get("what_to_test") if isinstance(parsed_json, dict) else None
    if isinstance(raw_wtt, list):
        refined_w: list[dict[str, str]] = []
        weak = (
            "business rule 1", "business rule 2", "business rule 3",
            "user journey 1", "user journey 2", "user journey 3",
            "test case 1", "test case 2",
        )
        substance = (
            "rule", "journey", "service", "bridge", "parity", "golden",
            "legacy", "edge", "coverage", "g4", "characterization", "method",
        )
        for i, item in enumerate(raw_wtt[:7]):
            if not isinstance(item, dict):
                continue
            label = str(item.get("label") or "").strip()
            detail = str(item.get("detail") or item.get("description") or "").strip()
            blob = f"{label} {detail}".lower()
            if not label or not detail or "factory ui" in blob:
                continue
            if label.lower() in weak or not any(w in blob for w in substance):
                continue
            refined_w.append({
                "id": str(item.get("id") or f"w{i + 1}"),
                "label": label[:120],
                "detail": detail[:280],
                "source": str(item.get("source") or "A14")[:40],
            })
        if len(refined_w) >= 4:
            what_to_test = refined_w

    gloss: list[dict[str, str]] = []
    if isinstance(parsed_json, dict) and isinstance(parsed_json.get("glossary"), list):
        for item in parsed_json["glossary"][:5]:
            if not isinstance(item, dict):
                continue
            term = str(item.get("term") or "").strip()
            definition = str(item.get("def") or item.get("definition") or "").strip()
            if term and definition:
                gloss.append({"term": term, "def": definition})
    if len(gloss) < 4:
        gloss = fallback_glossary[:5]

    suggested_kinds = list(kinds_suggested)
    if isinstance(parsed_json, dict) and isinstance(parsed_json.get("suggested_kinds"), list):
        allowed_kinds = {"unit", "integration", "edge", "parity"}
        sk = [
            str(k).lower()
            for k in parsed_json["suggested_kinds"]
            if str(k).lower() in allowed_kinds
        ]
        if sk:
            suggested_kinds = list(dict.fromkeys(sk))

    cards = {
        "from_a1": cat,
        "strategy": strat or "selected strategy",
        "project": title,
        "map_status": path_status_label,
    }
    if isinstance(parsed_json, dict) and isinstance(parsed_json.get("cards"), dict):
        pc = parsed_json["cards"]
        cards["from_a1"] = str(pc.get("from_a1") or cat)
        cards["strategy"] = str(pc.get("strategy") or strat or cards["strategy"])
        cards["project"] = str(pc.get("project") or title)
        # Never trust LLM for map status — lock to computed
        cards["map_status"] = path_status_label

    def _p(key: str, fallback: str) -> str:
        if isinstance(parsed_json, dict):
            return str(parsed_json.get(key) or "").strip() or fallback
        return fallback

    raw_title = _p("title", str(profile.get("title") or "Test generation"))
    title_l = raw_title.lower()
    if (
        "factory ui" in title_l
        or "modernization factory" in title_l
        or len(raw_title) > 40
        or "test generation" not in title_l
    ):
        safe_title = "Test generation"
    else:
        safe_title = raw_title

    raw_lede = _p("lede", str(profile.get("lede") or ""))
    if "factory ui" in raw_lede.lower() or len(raw_lede) > 200:
        safe_lede = str(profile.get("lede") or "")
    else:
        safe_lede = raw_lede

    result_hl = _p(
        "result_headline",
        f"Test suites drafted from {rules_n or 'approved'} rules — equivalence vs intent, not vs generated code.",
    )
    result_bd = _p(
        "result_body",
        f"Unit/integration/edge suites cover {svc_str} under «{strat or 'strategy'}»; golden legacy expectations captured for G4.",
    )

    return {
        "title": safe_title,
        "lede": safe_lede,
        "cards": cards,
        "what_to_test": what_to_test,
        "what_to_test_heading": str(profile.get("what_to_test_heading") or "WHAT NEEDS TO BE TESTED"),
        "what_to_test_intro": _p(
            "what_to_test_intro",
            str(profile.get("what_to_test_intro") or ""),
        ),
        "checklist_heading": "OPERATOR CHECKLIST (OPTIONAL)",
        "checklist_note": _p(
            "checklist_note",
            str(profile.get("checklist_note") or ""),
        ),
        "checklist": checklist,
        "suggested_kinds": suggested_kinds,
        "kinds_options": profile.get("kinds_options") or [],
        "form_heading": str(profile.get("form_heading") or "SET UP THIS STEP — YOU DECIDE"),
        "kinds_label": str(profile.get("kinds_label") or "WHAT KINDS OF TESTS?"),
        "result_headline": result_hl,
        "result_body": result_bd,
        "path_status_label": path_status_label,
        "movement_path": movement_line,
        "glossary": gloss,
        "category_id": category_id,
        "prior_agent_id": prior_agent_id,
        "prior_agent_name": prior_agent_name,
        "path_active_ids": path_ids,
        "service_names": services,
        "approved_rule_count": rules_n,
        "journeys": journeys_n,
        "g3_approved": g3_approved,
        "warning": (
            "LLM unavailable — using path-shaped A14 form from A12–A13 / G3"
            if used_fallback
            else ""
        ),
        **_meta(out),
    }


async def generate_a16_brief(
    project_name: str,
    category_name: str,
    requirement: str,
    strategies: list[str],
    strategy_short: str,
    why_modernize: str,
    category_id: str = "",
    prior_agent_id: str = "A15",
    prior_agent_name: str = "Failure triage",
    path_active_ids: list[str] | None = None,
    *,
    test_total: int = 0,
    test_failed: int = 0,
    test_coverage_pct: float = 0.0,
    triage_mode: str = "strict",
    failure_breakdown: dict[str, int] | None = None,
    service_names: list[str] | None = None,
    stack: str = "Java",
    approved_rule_count: int = 0,
) -> dict[str, Any]:
    """LLM-shaped A16 Self-healing brief derived from A1 intake, movement path, and A14–A15 test triage results."""
    import asyncio
    import logging

    log = logging.getLogger(__name__)

    cat = (category_name or "1. Legacy source-code data").strip()
    proj = (project_name or "Convert old Fortran code to new Java based code. The business context or the outcome should be similar").strip()
    req = (requirement or "Modernizing our legacy Fortran code to a Java-based system will improve maintainability, enhance performance, and enable cloud deployment.").strip()
    strat = (strategy_short or (strategies[0] if strategies else "Incremental Refactor to Java")).strip()
    why = (why_modernize or "").strip()
    path_ids = [str(x) for x in (path_active_ids or []) if x]
    services = [str(x) for x in (service_names or []) if x]
    svc_n = len(services) or 1
    stack_label = stack.capitalize() if stack else "Java"

    req_short = req[:110] + ("…" if len(req) > 110 else "")
    proj_short = proj[:100] + ("…" if len(proj) > 100 else "")
    svc_str = ", ".join(services[:3]) if services else f"{svc_n} services"

    breakdown = failure_breakdown or {
        "ENV_FLAKE": 1,
        "CODE_DEFECT": 2,
        "TEST_DEFECT": 1,
        "SPEC_GAP": 1,
    }
    total_failures = test_failed or sum(breakdown.values()) or 5

    fallback_checklist = [
        {"id": "c1", "label": "Confirm self-heal attempts stay within safe bounds", "required": True},
        {"id": "c2", "label": "Confirm tests are never weakened to force green", "required": True},
        {"id": "c3", "label": "Confirm healed cases remain auditable for G4", "required": True},
        {"id": "c4", "label": f"Confirm this step still belongs on the path for «{cat}»", "required": True},
        {"id": "c5", "label": f"Confirm scope still matches the A1 requirement: «{req_short}»", "required": True},
        {"id": "c6", "label": f"Confirm the modernization strategy still applies: «{strat}»", "required": True},
        {"id": "c7", "label": f"Confirm work remains under project «{proj_short}»", "required": True},
    ]

    fallback_glossary = [
        {"term": "Self-healing", "def": "Automated repair of code and test defects bounded by strict rule invariant assertions."},
        {"term": "Assertion Protection", "def": "Rule preventing any automated fix from deleting or weakening a test assertion."},
        {"term": "Triage Diagnosis", "def": "Classifying test failures into env flakes, code bugs, test defects, or spec gaps."},
        {"term": "Bounded Repair", "def": "Limiting automated fix attempts (max 3) before escalating to a human engineer."},
        {"term": "Spec Gap Escalation", "def": "Handing unmapped requirement gaps directly to human operators without auto-fixing."},
    ]

    fallback_cases = [
        {
            "id": "h1",
            "failure_class": "CODE_DEFECT",
            "title": f"Null pointer in {services[0] if services else 'PolicyCoreService'}",
            "target": f"src/main/java/services/{services[0] if services else 'PolicyCoreService'}.java",
            "symptom": "NullPointerException on uninitialized strategy parameter",
            "proposed_fix": "Initialize default strategy fallbacks matching A1 requirement",
            "safety_status": "Safe to auto-fix · Assertion check passed",
            "can_auto_heal": True,
        },
        {
            "id": "h2",
            "failure_class": "TEST_DEFECT",
            "title": "Stale mock expectation in RuleUnitTest",
            "target": "src/test/java/rules/RuleUnitTest.java",
            "symptom": "Assertion error due to updated JSON schema contract",
            "proposed_fix": "Synchronize test mock fixture with approved rule schema",
            "safety_status": "Safe to auto-fix · Rule invariant preserved",
            "can_auto_heal": True,
        },
        {
            "id": "h3",
            "failure_class": "ENV_FLAKE",
            "title": "Database connection timeout during startup",
            "target": "tests/integration/DatabaseIntegrationTest.java",
            "symptom": "Connection reset by peer during parallel suite setup",
            "proposed_fix": "Apply bounded exponential retry backoff",
            "safety_status": "Safe to auto-fix · Environment flake",
            "can_auto_heal": True,
        },
        {
            "id": "h4",
            "failure_class": "SPEC_GAP",
            "title": "Unmapped edge case rule for tax calculations",
            "target": f"src/main/java/services/{services[1] if len(services) > 1 else 'TaxService'}.java",
            "symptom": "Missing requirement rule definition for international tax codes",
            "proposed_fix": "Escalate to human operator for rule clarification",
            "safety_status": "Escalate to human · Auto-repair prohibited for spec gaps",
            "can_auto_heal": False,
        },
    ]

    prompt = f"""You write Agent A16 · Self-healing brief for an AI Modernization Factory UI.
Context of the page must be derived from previous Agent execution results (A14 tests, A15 triage), movement path, and A1 intake with MAXIMUM semantic similarity.

FACTS FROM PREVIOUS AGENTS & INTAKE:
- Project: {proj}
- Category: {cat} ({category_id or "legacy"})
- Requirement: {req}
- Modernization Strategy: {strat}
- Why Modernize: {why or "(not provided)"}
- Agent Movement Path: {path_ids or ["A1", "A14", "A15", "A16"]}
- Immediate Prior Step: {prior_agent_id} ({prior_agent_name})
- Target Services ({svc_n}): {services or ["Policy Core", "Pricing Service"]}
- Target Stack: {stack_label}
- Approved Rules Count: {approved_rule_count}
- Total Tests: {test_total or 45}
- Failed Tests: {total_failures}
- Failure Breakdown: {breakdown}

YOUR TASK:
Return ONLY valid JSON:
{{
  "title": "Self-healing",
  "lede": "Applies bounded fixes from triage diagnoses; escalates to humans when attempts are exhausted.",
  "cards": {{
    "from_a1": "{cat}",
    "strategy": "{strat}",
    "project": "{proj}",
    "map_status": "Active · on path"
  }},
  "checklist": [
    {{
      "id": "c1",
      "label": "Confirm self-heal attempts stay within safe bounds",
      "required": true
    }},
    {{
      "id": "c2",
      "label": "Confirm tests are never weakened to force green",
      "required": true
    }},
    {{
      "id": "c3",
      "label": "Confirm healed cases remain auditable for G4",
      "required": true
    }},
    {{
      "id": "c4",
      "label": "Confirm this step still belongs on the path for «{cat}»",
      "required": true
    }},
    {{
      "id": "c5",
      "label": "Confirm scope still matches the A1 requirement: «{req_short}»",
      "required": true
    }},
    {{
      "id": "c6",
      "label": "Confirm the modernization strategy still applies: «{strat}»",
      "required": true
    }},
    {{
      "id": "c7",
      "label": "Confirm work remains under project «{proj_short}»",
      "required": true
    }}
  ],
  "healing_cases": [
    {{
      "id": "h1",
      "failure_class": "CODE_DEFECT",
      "title": "Fix null pointer in {services[0] if services else 'PolicyService'}",
      "target": "src/main/java/services/PolicyService.java",
      "symptom": "NullPointerException on uninitialized strategy parameter",
      "proposed_fix": "Initialize default strategy fallbacks matching requirement",
      "safety_status": "Safe to auto-fix · Assertion check passed",
      "can_auto_heal": true
    }}
  ],
  "suggested_max_attempts": "3",
  "result_headline": "Self-healing complete — bounded repairs applied without weakening test assertions.",
  "result_body": "Fixed code and test defects automatically; environment flakes resolved; spec gaps escalated to operator.",
  "glossary": [
    {{"term": "Self-healing", "def": "Automated repair of code and test defects bounded by strict rule invariant assertions."}}
  ]
}}

Rules:
- Exactly 7 checklist items matching the exact pattern from the snapshot with MAXIMUM semantic similarity to category («{cat}»), requirement («{req_short}»), strategy («{strat}»), and project («{proj_short}»).
- Exactly 4 healing_cases detailing real proposed repairs based on the failure breakdown.
- Exactly 5 glossary terms.
- No markdown formatting in JSON output."""

    backend = get_backend()
    out: dict[str, Any] = {
        "text": "",
        "error": "not attempted",
        "model": "catalog-fallback",
        "tokens_in": 0,
        "tokens_out": 0,
        "cost_usd": 0.0,
    }

    try:
        out = await asyncio.wait_for(
            backend.complete(
                "A16-brief",
                prompt,
                tier="medium",
                response_format={"type": "json_object"},
            ),
            timeout=30.0,
        )
    except Exception as exc:  # noqa: BLE001
        log.warning("A16-brief failed: %s", exc)
        out = {
            "text": "",
            "error": str(exc),
            "model": "catalog-fallback",
            "tokens_in": 0,
            "tokens_out": 0,
            "cost_usd": 0.0,
        }

    parsed = _parse_json(out.get("text", ""))
    used_fallback = not isinstance(parsed, dict)

    checklist = fallback_checklist
    if isinstance(parsed, dict) and isinstance(parsed.get("checklist"), list) and len(parsed["checklist"]) >= 4:
        raw_c = parsed["checklist"]
        valid_c = []
        for i, item in enumerate(raw_c[:7]):
            if isinstance(item, dict) and item.get("label"):
                valid_c.append({
                    "id": str(item.get("id") or f"c{i+1}"),
                    "label": str(item["label"]).strip(),
                    "required": True,
                })
        if len(valid_c) >= 4:
            checklist = valid_c

    gloss = fallback_glossary
    if isinstance(parsed, dict) and isinstance(parsed.get("glossary"), list) and len(parsed["glossary"]) >= 4:
        valid_g = []
        for item in parsed["glossary"][:5]:
            if isinstance(item, dict) and item.get("term") and item.get("def"):
                valid_g.append({
                    "term": str(item["term"]).strip(),
                    "def": str(item["def"]).strip(),
                })
        if len(valid_g) >= 4:
            gloss = valid_g

    healing_cases = fallback_cases
    if isinstance(parsed, dict) and isinstance(parsed.get("healing_cases"), list) and len(parsed["healing_cases"]) >= 2:
        valid_h = []
        for i, item in enumerate(parsed["healing_cases"][:6]):
            if isinstance(item, dict) and item.get("title") and item.get("symptom"):
                valid_h.append({
                    "id": str(item.get("id") or f"h{i+1}"),
                    "failure_class": str(item.get("failure_class") or "CODE_DEFECT"),
                    "title": str(item.get("title")).strip(),
                    "target": str(item.get("target") or "src/main/java/Service.java").strip(),
                    "symptom": str(item.get("symptom")).strip(),
                    "proposed_fix": str(item.get("proposed_fix") or "Apply bounded patch").strip(),
                    "safety_status": str(item.get("safety_status") or "Safe to auto-fix").strip(),
                    "can_auto_heal": bool(item.get("can_auto_heal", True)),
                })
        if len(valid_h) >= 2:
            healing_cases = valid_h

    cards = {
        "from_a1": cat,
        "strategy": strat,
        "project": proj,
        "map_status": "Active · on path",
    }
    if isinstance(parsed, dict) and isinstance(parsed.get("cards"), dict):
        parsed_cards = parsed["cards"]
        cards["from_a1"] = str(parsed_cards.get("from_a1") or cat)
        cards["strategy"] = str(parsed_cards.get("strategy") or strat)
        cards["project"] = str(parsed_cards.get("project") or proj)
        cards["map_status"] = str(parsed_cards.get("map_status") or "Active · on path")

    result_headline = f"Self-healing complete for «{proj_short}» — bounded repairs applied without weakening test assertions."
    if isinstance(parsed, dict) and parsed.get("result_headline"):
        result_headline = str(parsed["result_headline"]).strip()

    result_body = f"Automatic fixes applied for code and test defects under strategy «{strat}». Spec gaps escalated to human operator."
    if isinstance(parsed, dict) and parsed.get("result_body"):
        result_body = str(parsed["result_body"]).strip()

    return {
        "title": str((parsed or {}).get("title") if isinstance(parsed, dict) else "") or "Self-healing",
        "lede": str((parsed or {}).get("lede") if isinstance(parsed, dict) else "")
        or "Applies bounded fixes from triage diagnoses; escalates to humans when attempts are exhausted.",
        "cards": cards,
        "checklist": checklist,
        "healing_cases": healing_cases,
        "failure_breakdown": breakdown,
        "suggested_max_attempts": str((parsed or {}).get("suggested_max_attempts") or "3"),
        "result_headline": result_headline,
        "result_body": result_body,
        "glossary": gloss,
        "warning": "LLM unavailable — using context-derived A16 brief" if used_fallback else "",
        **_meta(out),
    }


async def generate_g4_brief(
    project_name: str,
    category_name: str,
    requirement: str,
    strategies: list[str],
    strategy_short: str,
    why_modernize: str,
    category_id: str = "",
    prior_agent_id: str = "A16",
    prior_agent_name: str = "Self-healing",
    path_active_ids: list[str] | None = None,
    *,
    test_total: int = 14,
    test_failed: int = 0,
    test_coverage_pct: float = 95.0,
    healed_count: int = 3,
    escalated_count: int = 1,
    approved_rule_count: int = 12,
    service_names: list[str] | None = None,
) -> dict[str, Any]:
    """LLM-shaped G4 Testing Approval brief derived from A1 intake, movement path, and A14-A16 test triage results."""
    import asyncio
    import logging

    log = logging.getLogger(__name__)

    cat = (category_name or "1. Legacy source-code data").strip()
    proj = (project_name or "Convert old Fortran code to new Java based code. The business context or the outcome should be similar").strip()
    req = (requirement or "Modernizing the legacy Fortran code to a Java-based system is essential to enhance maintainability, improve integration with contemporary systems, and support cloud deployment.").strip()
    strat = (strategy_short or (strategies[0] if strategies else "Automated Incremental Migration")).strip()
    why = (why_modernize or "").strip()
    path_ids = [str(x) for x in (path_active_ids or []) if x]
    services = [str(x) for x in (service_names or []) if x]

    req_short = req[:110] + ("…" if len(req) > 110 else "")
    proj_short = proj[:100] + ("…" if len(proj) > 100 else "")

    fallback_checklist = [
        {"id": "c1", "label": "Confirm tests are derived from approved rules, not new code alone", "required": True},
        {"id": "c2", "label": f"Confirm {test_coverage_pct:.0f}% rule coverage meets the G4 quality threshold", "required": True},
        {"id": "c3", "label": "Confirm edge cases, negative flows, and boundaries have dedicated assertions", "required": True},
        {"id": "c4", "label": "Confirm self-healing patches (A16) preserve all golden rule checks without weakening", "required": True},
        {"id": "c5", "label": "Confirm test suite is ready to ground the A17 equivalence proof", "required": True},
        {"id": "c6", "label": f"Confirm this gate belongs on the path for «{cat}»", "required": True},
        {"id": "c7", "label": f"Confirm test scope matches A1 requirement: «{req_short}»", "required": True},
        {"id": "c8", "label": f"Confirm testing strategy matches «{strat}»", "required": True},
        {"id": "c9", "label": f"Confirm testing work remains under project «{proj_short}»", "required": True},
    ]

    fallback_glossary = [
        {"term": "Golden Assertions", "def": "Test assertions derived strictly from approved business rules, ensuring new code matches legacy semantics."},
        {"term": "Rule Coverage Threshold", "def": "Percentage of approved specification rules validated by executable tests (minimum 85%, current 95%)."},
        {"term": "Equivalence Grounding", "def": "Sufficient test depth required before Agent A17 can prove side-by-side behavioral equivalence."},
        {"term": "Healed Test Auditability", "def": "Verification that automated A16 repair patches preserved all test assertions without force-greening."},
        {"term": "QA Approval Gate", "def": "Checkpoint G4 where the QA lead validates test thoroughness before characterization testing begins."},
    ]

    prompt = f"""You write Gate G4 · Approve the testing brief for an AI Modernization Factory UI.
Context of the page must be derived from previous Agent execution results (A14 test generation, A15 failure triage, A16 self-healing), movement path, and A1 intake with MAXIMUM semantic similarity.

FACTS FROM PREVIOUS AGENTS & INTAKE:
- Project: {proj}
- Category: {cat} ({category_id or "legacy"})
- Requirement: {req}
- Strategy: {strat}
- Why Modernize: {why or "(not provided)"}
- Agent Movement Path: {path_ids or ["A14", "A15", "A16", "G4"]}
- Immediate Prior Step: {prior_agent_id} ({prior_agent_name})
- Target Services: {services or ["Policy Core Service", "Pricing Service"]}
- Total Tests Written: {test_total or 14}
- Rules Covered %: {test_coverage_pct or 95.0}%
- Self-healed Cases: {healed_count or 3}
- Escalated Cases: {escalated_count or 1}
- Approved Rules Count: {approved_rule_count or 12}

YOUR TASK:
Return ONLY valid JSON:
{{
  "title": "Approve the testing",
  "lede": "Is the testing thorough enough to trust?",
  "approvers": "QA lead",
  "why": "Weak tests here mean the equivalence check proves nothing.",
  "cards": {{
    "from_a1": "{cat}",
    "strategy": "{strat}",
    "requirement": "{req}",
    "map_status": "Active · on path"
  }},
  "test_metrics": [
    {{"label": "Tests written", "value": "{test_total or 14}"}},
    {{"label": "Rules covered by tests", "value": "{test_coverage_pct:.0f}%"}}
  ],
  "checklist": [
    {{
      "id": "c1",
      "label": "Confirm tests are derived from approved rules, not new code alone",
      "required": true
    }},
    {{
      "id": "c2",
      "label": "Confirm {test_coverage_pct:.0f}% rule coverage meets the G4 quality threshold",
      "required": true
    }},
    {{
      "id": "c3",
      "label": "Confirm edge cases, negative flows, and boundaries have dedicated assertions",
      "required": true
    }},
    {{
      "id": "c4",
      "label": "Confirm self-healing patches (A16) preserve all golden rule checks without weakening",
      "required": true
    }},
    {{
      "id": "c5",
      "label": "Confirm test suite is ready to ground the A17 equivalence proof",
      "required": true
    }},
    {{
      "id": "c6",
      "label": "Confirm this gate belongs on the path for «{cat}»",
      "required": true
    }},
    {{
      "id": "c7",
      "label": "Confirm test scope matches A1 requirement: «{req_short}»",
      "required": true
    }},
    {{
      "id": "c8",
      "label": "Confirm testing strategy matches «{strat}»",
      "required": true
    }},
    {{
      "id": "c9",
      "label": "Confirm testing work remains under project «{proj_short}»",
      "required": true
    }}
  ],
  "glossary": [
    {{"term": "Golden Assertions", "def": "Test assertions derived strictly from approved business rules, ensuring new code matches legacy semantics."}}
  ]
}}

Rules:
- Exactly 9 checklist items matching the exact pattern from the snapshot with MAXIMUM semantic similarity.
- Title must be "Approve the testing".
- No markdown formatting in JSON output."""

    backend = get_backend()
    out: dict[str, Any] = {
        "text": "",
        "error": "not attempted",
        "model": "catalog-fallback",
        "tokens_in": 0,
        "tokens_out": 0,
        "cost_usd": 0.0,
    }

    try:
        out = await asyncio.wait_for(
            backend.complete(
                "G4-brief",
                prompt,
                tier="medium",
                response_format={"type": "json_object"},
            ),
            timeout=30.0,
        )
    except Exception as exc:  # noqa: BLE001
        log.warning("G4-brief failed: %s", exc)
        out = {
            "text": "",
            "error": str(exc),
            "model": "catalog-fallback",
            "tokens_in": 0,
            "tokens_out": 0,
            "cost_usd": 0.0,
        }

    parsed = _parse_json(out.get("text", ""))
    used_fallback = not isinstance(parsed, dict)

    checklist = fallback_checklist
    if isinstance(parsed, dict) and isinstance(parsed.get("checklist"), list) and len(parsed["checklist"]) >= 4:
        raw_c = parsed["checklist"]
        valid_c = []
        for i, item in enumerate(raw_c[:9]):
            if isinstance(item, dict) and item.get("label"):
                valid_c.append({
                    "id": str(item.get("id") or f"c{i+1}"),
                    "label": str(item["label"]).strip(),
                    "required": True,
                })
        if len(valid_c) >= 4:
            checklist = valid_c

    gloss = fallback_glossary
    if isinstance(parsed, dict) and isinstance(parsed.get("glossary"), list) and len(parsed["glossary"]) >= 4:
        valid_g = []
        for item in parsed["glossary"][:5]:
            if isinstance(item, dict) and item.get("term") and item.get("def"):
                valid_g.append({
                    "term": str(item["term"]).strip(),
                    "def": str(item["def"]).strip(),
                })
        if len(valid_g) >= 4:
            gloss = valid_g

    cards = {
        "from_a1": cat,
        "strategy": strat,
        "requirement": req,
        "map_status": "Active · on path",
    }
    if isinstance(parsed, dict) and isinstance(parsed.get("cards"), dict):
        parsed_cards = parsed["cards"]
        cards["from_a1"] = str(parsed_cards.get("from_a1") or cat)
        cards["strategy"] = str(parsed_cards.get("strategy") or strat)
        cards["requirement"] = str(parsed_cards.get("requirement") or req)
        cards["map_status"] = str(parsed_cards.get("map_status") or "Active · on path")

    test_metrics = [
        {"label": "Tests written", "value": str(test_total or 14)},
        {"label": "Rules covered by tests", "value": f"{test_coverage_pct:.0f}%"},
    ]
    if isinstance(parsed, dict) and isinstance(parsed.get("test_metrics"), list) and len(parsed["test_metrics"]) >= 2:
        valid_m = []
        for item in parsed["test_metrics"][:4]:
            if isinstance(item, dict) and item.get("label") and item.get("value"):
                valid_m.append({
                    "label": str(item["label"]).strip(),
                    "value": str(item["value"]).strip(),
                })
        if len(valid_m) >= 2:
            test_metrics = valid_m

    return {
        "title": str((parsed or {}).get("title") if isinstance(parsed, dict) else "") or "Approve the testing",
        "lede": str((parsed or {}).get("lede") if isinstance(parsed, dict) else "")
        or "Is the testing thorough enough to trust?",
        "approvers": str((parsed or {}).get("approvers") if isinstance(parsed, dict) else "") or "QA lead",
        "why": str((parsed or {}).get("why") if isinstance(parsed, dict) else "")
        or "Weak tests here mean the equivalence check proves nothing.",
        "cards": cards,
        "test_metrics": test_metrics,
        "checklist": checklist,
        "glossary": gloss,
        "warning": "LLM unavailable — using context-derived G4 brief" if used_fallback else "",
        **_meta(out),
    }


async def generate_a17_brief(
    project_name: str,
    category_name: str,
    requirement: str,
    strategies: list[str],
    strategy_short: str,
    why_modernize: str,
    category_id: str = "",
    prior_agent_id: str = "G4",
    prior_agent_name: str = "Approve the testing",
    path_active_ids: list[str] | None = None,
    *,
    cases_replayed: int = 50000,
    match_rate_pct: float = 99.8,
    explained_diffs: int = 185,
    unexplained_diffs: int = 0,
    service_names: list[str] | None = None,
) -> dict[str, Any]:
    """LLM-shaped A17 Equivalence Check brief derived from A1 intake, movement path, and G4 testing approval results."""
    import asyncio
    import logging

    log = logging.getLogger(__name__)

    cat = (category_name or "1. Legacy source-code data").strip()
    proj = (project_name or "Convert old Fortran code to new Java based code. The business context or the outcome should be similar").strip()
    req = (requirement or "Modernizing the legacy Fortran code to a Java-based system will enhance maintainability, improve integration with contemporary systems, and support cloud deployment.").strip()
    strat = (strategy_short or (strategies[0] if strategies else "Incremental migration with parallel runs")).strip()
    why = (why_modernize or "").strip()
    path_ids = [str(x) for x in (path_active_ids or []) if x]
    services = [str(x) for x in (service_names or []) if x]

    req_short = req[:110] + ("…" if len(req) > 110 else "")
    proj_short = proj[:100] + ("…" if len(proj) > 100 else "")

    fallback_checklist = [
        {"id": "c1", "label": "Confirm replay volume covers business-critical cases from intake", "required": True},
        {"id": "c2", "label": "Confirm PII and sensitive customer data masking is applied before replay", "required": True},
        {"id": "c3", "label": "Confirm field-level comparison tolerances align with approved business rules", "required": True},
        {"id": "c4", "label": f"Confirm this step still belongs on the path for «{cat}»", "required": True},
        {"id": "c5", "label": f"Confirm scope still matches the A1 requirement: «{req_short}»", "required": True},
        {"id": "c6", "label": f"Confirm the modernization strategy still applies: «{strat}»", "required": True},
        {"id": "c7", "label": f"Confirm work remains under project «{proj_short}»", "required": True},
    ]

    fallback_glossary = [
        {"term": "Equivalence Check", "def": "Deterministic side-by-side execution of legacy and new systems on identical inputs."},
        {"term": "PII Masking", "def": "Automated scrubbing of sensitive fields prior to replaying production workloads."},
        {"term": "Field-Level Diffing", "def": "Field-by-field verification of output structures, types, and values."},
        {"term": "Declared Tolerances", "def": "Acceptable variances for floating-point rounding, timestamps, and list sequences."},
        {"term": "Match Rate", "def": "Percentage of replayed cases yielding identical results within declared tolerances."},
    ]

    prompt = f"""You write Agent A17 · Equivalence check brief for an AI Modernization Factory UI.
Context of the page must be derived from previous Agent execution results (A14 tests, A15 triage, A16 self-healing, G4 testing approval), movement path, and A1 intake with MAXIMUM semantic similarity.

FACTS FROM PREVIOUS AGENTS & INTAKE:
- Project: {proj}
- Category: {cat} ({category_id or "legacy"})
- Requirement: {req}
- Modernization Strategy: {strat}
- Why Modernize: {why or "(not provided)"}
- Agent Movement Path: {path_ids or ["A14", "A15", "A16", "G4", "A17"]}
- Immediate Prior Step: {prior_agent_id} ({prior_agent_name})
- Target Services: {services or ["Policy Core Service", "Pricing Service"]}
- Cases Replayed Default: {cases_replayed or 50000}
- Current Match Rate %: {match_rate_pct or 99.8}%
- Explained Differences: {explained_diffs or 185}
- Unexplained Differences: {unexplained_diffs or 0}

YOUR TASK:
Return ONLY valid JSON:
{{
  "title": "Equivalence check",
  "lede": "Replays masked real cases against old and new systems and reports field-level match rate and diffs.",
  "cards": {{
    "from_a1": "{cat}",
    "strategy": "{strat}",
    "project": "{proj}",
    "map_status": "Active · on path"
  }},
  "checklist": [
    {{
      "id": "c1",
      "label": "Confirm replay volume covers business-critical cases from intake",
      "required": true
    }},
    {{
      "id": "c2",
      "label": "Confirm PII and sensitive customer data masking is applied before replay",
      "required": true
    }},
    {{
      "id": "c3",
      "label": "Confirm field-level comparison tolerances align with approved business rules",
      "required": true
    }},
    {{
      "id": "c4",
      "label": "Confirm this step still belongs on the path for «{cat}»",
      "required": true
    }},
    {{
      "id": "c5",
      "label": "Confirm scope still matches the A1 requirement: «{req_short}»",
      "required": true
    }},
    {{
      "id": "c6",
      "label": "Confirm the modernization strategy still applies: «{strat}»",
      "required": true
    }},
    {{
      "id": "c7",
      "label": "Confirm work remains under project «{proj_short}»",
      "required": true
    }}
  ],
  "suggested_volume": "50000",
  "result_headline": "Equivalence check complete — 99.8% field match rate across 50,000 replayed cases.",
  "result_body": "Side-by-side comparison verified zero unexplained divergences. Premium and ledger totals match exactly.",
  "glossary": [
    {{"term": "Equivalence Check", "def": "Deterministic side-by-side execution of legacy and new systems on identical inputs."}}
  ]
}}

Rules:
- Exactly 7 checklist items matching the exact pattern from the snapshot with MAXIMUM semantic similarity to category («{cat}»), requirement («{req_short}»), strategy («{strat}»), and project («{proj_short}»).
- Title must be "Equivalence check".
- No markdown formatting in JSON output."""

    backend = get_backend()
    out: dict[str, Any] = {
        "text": "",
        "error": "not attempted",
        "model": "catalog-fallback",
        "tokens_in": 0,
        "tokens_out": 0,
        "cost_usd": 0.0,
    }

    try:
        out = await asyncio.wait_for(
            backend.complete(
                "A17-brief",
                prompt,
                tier="medium",
                response_format={"type": "json_object"},
            ),
            timeout=30.0,
        )
    except Exception as exc:  # noqa: BLE001
        log.warning("A17-brief failed: %s", exc)
        out = {
            "text": "",
            "error": str(exc),
            "model": "catalog-fallback",
            "tokens_in": 0,
            "tokens_out": 0,
            "cost_usd": 0.0,
        }

    parsed = _parse_json(out.get("text", ""))
    used_fallback = not isinstance(parsed, dict)

    checklist = fallback_checklist
    if isinstance(parsed, dict) and isinstance(parsed.get("checklist"), list) and len(parsed["checklist"]) >= 4:
        raw_c = parsed["checklist"]
        valid_c = []
        for i, item in enumerate(raw_c[:7]):
            if isinstance(item, dict) and item.get("label"):
                valid_c.append({
                    "id": str(item.get("id") or f"c{i+1}"),
                    "label": str(item["label"]).strip(),
                    "required": True,
                })
        if len(valid_c) >= 4:
            checklist = valid_c

    gloss = fallback_glossary
    if isinstance(parsed, dict) and isinstance(parsed.get("glossary"), list) and len(parsed["glossary"]) >= 4:
        valid_g = []
        for item in parsed["glossary"][:5]:
            if isinstance(item, dict) and item.get("term") and item.get("def"):
                valid_g.append({
                    "term": str(item["term"]).strip(),
                    "def": str(item["def"]).strip(),
                })
        if len(valid_g) >= 4:
            gloss = valid_g

    cards = {
        "from_a1": cat,
        "strategy": strat,
        "project": proj,
        "map_status": "Active · on path",
    }
    if isinstance(parsed, dict) and isinstance(parsed.get("cards"), dict):
        parsed_cards = parsed["cards"]
        cards["from_a1"] = str(parsed_cards.get("from_a1") or cat)
        cards["strategy"] = str(parsed_cards.get("strategy") or strat)
        cards["project"] = str(parsed_cards.get("project") or proj)
        cards["map_status"] = str(parsed_cards.get("map_status") or "Active · on path")

    result_headline = f"Equivalence check complete — 99.8% match rate across {cases_replayed:,} replayed cases."
    if isinstance(parsed, dict) and parsed.get("result_headline"):
        result_headline = str(parsed["result_headline"]).strip()

    result_body = f"Side-by-side execution verified legacy and Java systems yield identical outcomes under strategy «{strat}»."
    if isinstance(parsed, dict) and parsed.get("result_body"):
        result_body = str(parsed["result_body"]).strip()

    return {
        "title": str((parsed or {}).get("title") if isinstance(parsed, dict) else "") or "Equivalence check",
        "lede": str((parsed or {}).get("lede") if isinstance(parsed, dict) else "")
        or "Replays masked real cases against old and new systems and reports field-level match rate and diffs.",
        "cards": cards,
        "checklist": checklist,
        "suggested_volume": str((parsed or {}).get("suggested_volume") or "50000"),
        "result_headline": result_headline,
        "result_body": result_body,
        "glossary": gloss,
        "warning": "LLM unavailable — using context-derived A17 brief" if used_fallback else "",
        **_meta(out),
    }


async def generate_g5_brief(
    project_name: str,
    category_name: str,
    requirement: str,
    strategies: list[str],
    strategy_short: str,
    why_modernize: str,
    category_id: str = "",
    prior_agent_id: str = "A17",
    prior_agent_name: str = "Equivalence check",
    path_active_ids: list[str] | None = None,
    *,
    cases_replayed: int = 200000,
    match_rate_pct: float = 100.0,
    unexplained_diffs: int = 0,
    money_totals_status: str = "Premium and ledger totals match exactly",
    service_names: list[str] | None = None,
) -> dict[str, Any]:
    """LLM-shaped G5 Approval Equivalence brief derived from A1 intake, movement path, and A17 equivalence check execution results."""
    import asyncio
    import logging

    log = logging.getLogger(__name__)

    cat = (category_name or "1. Legacy source-code data").strip()
    proj = (project_name or "Convert old Fortran code to new Java based code. The business context or the outcome should be similar").strip()
    req = (requirement or "Modernizing the legacy Fortran code to a Java-based system is essential to enhance maintainability, improve integration with contemporary systems, and support cloud deployment.").strip()
    strat = (strategy_short or (strategies[0] if strategies else "Incremental migration with parallel runs")).strip()
    why = (why_modernize or "").strip()
    path_ids = [str(x) for x in (path_active_ids or []) if x]
    services = [str(x) for x in (service_names or []) if x]

    req_short = req[:110] + ("…" if len(req) > 110 else "")
    proj_short = proj[:100] + ("…" if len(proj) > 100 else "")

    fallback_checklist = [
        {"id": "c1", "label": "I confirm match rate meets the business bar for go-live risk", "required": True},
        {"id": "c2", "label": "I confirm unexplained differences are zero or accepted in writing", "required": True},
        {"id": "c3", "label": "I confirm money / ledger totals (if applicable) match exactly", "required": True},
        {"id": "c4", "label": "I confirm customers will not see wrong answers from this cutover", "required": True},
        {"id": "c5", "label": f"I confirm equivalence replay covered business-critical cases from intake («{cat}»)", "required": True},
        {"id": "c6", "label": "I confirm PII masking was verified before replaying production workloads", "required": True},
        {"id": "c7", "label": f"I confirm scope still matches the A1 requirement: «{req_short}»", "required": True},
        {"id": "c8", "label": f"I confirm the modernization strategy still applies: «{strat}»", "required": True},
        {"id": "c9", "label": f"I confirm work remains under project «{proj_short}»", "required": True},
    ]

    fallback_metrics = [
        {"label": "Cases replayed", "value": f"{cases_replayed:,}"},
        {"label": "Match rate", "value": f"{match_rate_pct:.1f}%"},
        {"label": "Unexplained differences", "value": str(unexplained_diffs)},
        {"label": "Money totals", "value": money_totals_status or "Premium and ledger totals match exactly"},
    ]

    fallback_glossary = [
        {"term": "Equivalence Approval", "def": "Formal sign-off by Business Owner and QA verifying old and new systems produce identical results."},
        {"term": "Zero Unexplained Diffs", "def": "Mandatory requirement that all output differences must be fully explained by approved tolerances."},
        {"term": "Financial Parity", "def": "Exact match across premium, ledger, tax, and currency calculation totals."},
        {"term": "Customer Protection Gate", "def": "Quality gate ensuring cutover introduces zero behavioral regression for end users."},
    ]

    prompt = f"""You write Gate G5 · Approve equivalence brief for an AI Modernization Factory UI.
Context of the page must be derived from previous Agent execution results (A17 Equivalence check, G4 testing approval), movement path, and A1 intake with MAXIMUM semantic similarity.

FACTS FROM PREVIOUS AGENTS & INTAKE:
- Project: {proj}
- Category: {cat} ({category_id or "legacy"})
- Requirement: {req}
- Modernization Strategy: {strat}
- Why Modernize: {why or "(not provided)"}
- Agent Movement Path: {path_ids or ["A14", "A15", "A16", "G4", "A17", "G5"]}
- Immediate Prior Step: {prior_agent_id} ({prior_agent_name})
- Target Services: {services or ["Policy Core Service", "Pricing Service"]}
- Cases Replayed: {cases_replayed:,}
- Match Rate: {match_rate_pct:.1f}%
- Unexplained Differences: {unexplained_diffs}
- Money Totals Status: {money_totals_status}

YOUR TASK:
Return ONLY valid JSON:
{{
  "title": "Approve equivalence",
  "lede": "Does the new system give the same answers as the old one?",
  "approvers": "Business owner, QA",
  "why": "This is the gate that protects your customers.",
  "cards": {{
    "from_a1": "{cat}",
    "strategy": "{strat}",
    "requirement": "{req_short}",
    "map_status": "Active · on path"
  }},
  "equivalence_metrics": [
    {{"label": "Cases replayed", "value": "{cases_replayed:,}"}},
    {{"label": "Match rate", "value": "{match_rate_pct:.1f}%"}},
    {{"label": "Unexplained differences", "value": "{unexplained_diffs}"}},
    {{"label": "Money totals", "value": "{money_totals_status}"}}
  ],
  "checklist": [
    {{"id": "c1", "label": "I confirm match rate meets the business bar for go-live risk", "required": true}},
    {{"id": "c2", "label": "I confirm unexplained differences are zero or accepted in writing", "required": true}},
    {{"id": "c3", "label": "I confirm money / ledger totals (if applicable) match exactly", "required": true}},
    {{"id": "c4", "label": "I confirm customers will not see wrong answers from this cutover", "required": true}},
    {{"id": "c5", "label": "I confirm equivalence replay covered business-critical cases from intake («{cat}»)", "required": true}},
    {{"id": "c6", "label": "I confirm PII masking was verified before replaying production workloads", "required": true}},
    {{"id": "c7", "label": "I confirm scope still matches the A1 requirement: «{req_short}»", "required": true}},
    {{"id": "c8", "label": "I confirm the modernization strategy still applies: «{strat}»", "required": true}},
    {{"id": "c9", "label": "I confirm work remains under project «{proj_short}»", "required": true}}
  ],
  "glossary": [
    {{"term": "Equivalence Approval", "def": "Formal sign-off by Business Owner and QA verifying old and new systems produce identical results."}}
  ]
}}

Rules:
- Title must be "Approve equivalence".
- Sub-heading question must be "Does the new system give the same answers as the old one?".
- Approvers must be "Business owner, QA".
- Why must be "This is the gate that protects your customers.".
- Exactly 9 checklist items starting with the exact items from the snapshot with MAXIMUM semantic similarity.
- No markdown formatting in JSON output."""

    backend = get_backend()
    out: dict[str, Any] = {
        "text": "",
        "error": "not attempted",
        "model": "catalog-fallback",
        "tokens_in": 0,
        "tokens_out": 0,
        "cost_usd": 0.0,
    }

    try:
        out = await asyncio.wait_for(
            backend.complete(
                "G5-brief",
                prompt,
                tier="medium",
                response_format={"type": "json_object"},
            ),
            timeout=30.0,
        )
    except Exception as exc:  # noqa: BLE001
        log.warning("G5-brief failed: %s", exc)
        out = {
            "text": "",
            "error": str(exc),
            "model": "catalog-fallback",
            "tokens_in": 0,
            "tokens_out": 0,
            "cost_usd": 0.0,
        }

    parsed = _parse_json(out.get("text", ""))
    used_fallback = not isinstance(parsed, dict)

    checklist = fallback_checklist
    if isinstance(parsed, dict) and isinstance(parsed.get("checklist"), list) and len(parsed["checklist"]) >= 5:
        raw_c = parsed["checklist"]
        valid_c = []
        for i, item in enumerate(raw_c[:9]):
            if isinstance(item, dict) and item.get("label"):
                valid_c.append({
                    "id": str(item.get("id") or f"c{i+1}"),
                    "label": str(item["label"]).strip(),
                    "required": True,
                })
        if len(valid_c) >= 5:
            checklist = valid_c

    gloss = fallback_glossary
    if isinstance(parsed, dict) and isinstance(parsed.get("glossary"), list) and len(parsed["glossary"]) >= 3:
        valid_g = []
        for item in parsed["glossary"][:5]:
            if isinstance(item, dict) and item.get("term") and item.get("def"):
                valid_g.append({
                    "term": str(item["term"]).strip(),
                    "def": str(item["def"]).strip(),
                })
        if len(valid_g) >= 3:
            gloss = valid_g

    cards = {
        "from_a1": cat,
        "strategy": strat,
        "requirement": req,
        "map_status": "Active · on path",
    }
    if isinstance(parsed, dict) and isinstance(parsed.get("cards"), dict):
        parsed_cards = parsed["cards"]
        cards["from_a1"] = str(parsed_cards.get("from_a1") or cat)
        cards["strategy"] = str(parsed_cards.get("strategy") or strat)
        cards["requirement"] = str(parsed_cards.get("requirement") or req)
        cards["map_status"] = str(parsed_cards.get("map_status") or "Active · on path")

    metrics = fallback_metrics
    if isinstance(parsed, dict) and isinstance(parsed.get("equivalence_metrics"), list) and len(parsed["equivalence_metrics"]) >= 2:
        valid_m = []
        for item in parsed["equivalence_metrics"][:4]:
            if isinstance(item, dict) and item.get("label") and item.get("value"):
                valid_m.append({
                    "label": str(item["label"]).strip(),
                    "value": str(item["value"]).strip(),
                })
        if len(valid_m) >= 2:
            metrics = valid_m

    return {
        "title": str((parsed or {}).get("title") if isinstance(parsed, dict) else "") or "Approve equivalence",
        "lede": str((parsed or {}).get("lede") if isinstance(parsed, dict) else "")
        or "Does the new system give the same answers as the old one?",
        "approvers": str((parsed or {}).get("approvers") if isinstance(parsed, dict) else "") or "Business owner, QA",
        "why": str((parsed or {}).get("why") if isinstance(parsed, dict) else "")
        or "This is the gate that protects your customers.",
        "cards": cards,
        "equivalence_metrics": metrics,
        "checklist": checklist,
        "glossary": gloss,
        "warning": "LLM unavailable — using context-derived G5 brief" if used_fallback else "",
        **_meta(out),
    }


async def generate_a18_brief(
    project_name: str,
    category_name: str,
    requirement: str,
    strategies: list[str],
    strategy_short: str,
    why_modernize: str,
    category_id: str = "",
    prior_agent_id: str = "G5",
    prior_agent_name: str = "Approve equivalence",
    path_active_ids: list[str] | None = None,
    *,
    security_scan_status: str = "Clean — 0 Critical/High findings",
    handover_plan: str = "slow",
    rollback_on_errors: bool = True,
    service_names: list[str] | None = None,
) -> dict[str, Any]:
    """LLM-shaped A18 Security and release brief derived from A1 intake, movement path, and G5 equivalence approval context."""
    import asyncio
    import logging

    log = logging.getLogger(__name__)

    cat = (category_name or "1. Legacy source-code data").strip()
    proj = (project_name or "Convert old Fortran code to new Java based code. The business context or the outcome should be similar").strip()
    req = (requirement or "Modernizing the legacy Fortran code to Java is essential to enhance system performance, maintainability, and scalability.").strip()
    strat = (strategy_short or (strategies[0] if strategies else "Incremental Refactoring Approach")).strip()
    why = (why_modernize or "").strip()
    path_ids = [str(x) for x in (path_active_ids or []) if x]
    services = [str(x) for x in (service_names or []) if x]

    req_short = req[:110] + ("…" if len(req) > 110 else "")
    proj_short = proj[:100] + ("…" if len(proj) > 100 else "")

    fallback_checklist = [
        {"id": "c1", "label": "Confirm security scan scope covers generated services and bridges", "required": True},
        {"id": "c2", "label": "Confirm release stages and rollback triggers are armed", "required": True},
        {"id": "c3", "label": "Confirm operations runbook matches the handover plan", "required": True},
        {"id": "c4", "label": f"Confirm this step still belongs on the path for «{cat}»", "required": True},
        {"id": "c5", "label": f"Confirm scope still matches the A1 requirement: «{req_short}»", "required": True},
        {"id": "c6", "label": f"Confirm the modernization strategy still applies: «{strat}»", "required": True},
        {"id": "c7", "label": f"Confirm work remains under project «{proj_short}»", "required": True},
    ]

    fallback_glossary = [
        {"term": "Security Scan", "def": "Automated SAST, DAST, and secrets scanning across modern codebase and bridges."},
        {"term": "Gradual Handover", "def": "Staged canary deployment shifting traffic progressively (1% → 5% → 20% → 50% → 100%)."},
        {"term": "Rollback Triggers", "def": "Automatic monitoring rules that revert traffic to legacy system if error rates spike."},
        {"term": "SBOM Compliance", "def": "Software Bill of Materials verification ensuring no vulnerable third-party packages."},
    ]

    prompt = f"""You write Agent A18 · Security and release brief for an AI Modernization Factory UI.
Context of the page must be derived from previous Agent execution results (A17 Equivalence check, G5 equivalence approval), movement path, and A1 intake with MAXIMUM semantic similarity.

FACTS FROM PREVIOUS AGENTS & INTAKE:
- Project: {proj}
- Category: {cat} ({category_id or "legacy"})
- Requirement: {req}
- Modernization Strategy: {strat}
- Why Modernize: {why or "(not provided)"}
- Agent Movement Path: {path_ids or ["A14", "A15", "A16", "G4", "A17", "G5", "A18"]}
- Immediate Prior Step: {prior_agent_id} ({prior_agent_name})
- Target Services: {services or ["Policy Core Service", "Pricing Service"]}
- Default Handover Strategy: {handover_plan}
- Automatic Rollback Enabled: {rollback_on_errors}

YOUR TASK:
Return ONLY valid JSON:
{{
  "title": "Security and release",
  "lede": "Runs security scans and drives gradual traffic handover with automatic rollback triggers.",
  "cards": {{
    "from_a1": "{cat}",
    "strategy": "{strat}",
    "project": "{proj}",
    "map_status": "Active · on path"
  }},
  "checklist": [
    {{
      "id": "c1",
      "label": "Confirm security scan scope covers generated services and bridges",
      "required": true
    }},
    {{
      "id": "c2",
      "label": "Confirm release stages and rollback triggers are armed",
      "required": true
    }},
    {{
      "id": "c3",
      "label": "Confirm operations runbook matches the handover plan",
      "required": true
    }},
    {{
      "id": "c4",
      "label": "Confirm this step still belongs on the path for «{cat}»",
      "required": true
    }},
    {{
      "id": "c5",
      "label": "Confirm scope still matches the A1 requirement: «{req_short}»",
      "required": true
    }},
    {{
      "id": "c6",
      "label": "Confirm the modernization strategy still applies: «{strat}»",
      "required": true
    }},
    {{
      "id": "c7",
      "label": "Confirm work remains under project «{proj_short}»",
      "required": true
    }}
  ],
  "suggested_plan": "slow",
  "result_headline": "Security scan clean & gradual release pipeline armed.",
  "result_body": "0 High/Critical security vulnerabilities found. Automatic rollback armed for errors rising above normal.",
  "glossary": [
    {{"term": "Security Scan", "def": "Automated SAST, DAST, and secrets scanning across modern codebase and bridges."}}
  ]
}}

Rules:
- Title must be "Security and release".
- Lede must be "Runs security scans and drives gradual traffic handover with automatic rollback triggers.".
- Exactly 7 checklist items matching the snapshot pattern with MAXIMUM semantic similarity to category («{cat}»), requirement («{req_short}»), strategy («{strat}»), and project («{proj_short}»).
- No markdown formatting in JSON output."""

    backend = get_backend()
    out: dict[str, Any] = {
        "text": "",
        "error": "not attempted",
        "model": "catalog-fallback",
        "tokens_in": 0,
        "tokens_out": 0,
        "cost_usd": 0.0,
    }

    try:
        out = await asyncio.wait_for(
            backend.complete(
                "A18-brief",
                prompt,
                tier="medium",
                response_format={"type": "json_object"},
            ),
            timeout=30.0,
        )
    except Exception as exc:  # noqa: BLE001
        log.warning("A18-brief failed: %s", exc)
        out = {
            "text": "",
            "error": str(exc),
            "model": "catalog-fallback",
            "tokens_in": 0,
            "tokens_out": 0,
            "cost_usd": 0.0,
        }

    parsed = _parse_json(out.get("text", ""))
    used_fallback = not isinstance(parsed, dict)

    checklist = fallback_checklist
    if isinstance(parsed, dict) and isinstance(parsed.get("checklist"), list) and len(parsed["checklist"]) >= 4:
        raw_c = parsed["checklist"]
        valid_c = []
        for i, item in enumerate(raw_c[:7]):
            if isinstance(item, dict) and item.get("label"):
                valid_c.append({
                    "id": str(item.get("id") or f"c{i+1}"),
                    "label": str(item["label"]).strip(),
                    "required": True,
                })
        if len(valid_c) >= 4:
            checklist = valid_c

    gloss = fallback_glossary
    if isinstance(parsed, dict) and isinstance(parsed.get("glossary"), list) and len(parsed["glossary"]) >= 3:
        valid_g = []
        for item in parsed["glossary"][:5]:
            if isinstance(item, dict) and item.get("term") and item.get("def"):
                valid_g.append({
                    "term": str(item["term"]).strip(),
                    "def": str(item["def"]).strip(),
                })
        if len(valid_g) >= 3:
            gloss = valid_g

    cards = {
        "from_a1": cat,
        "strategy": strat,
        "project": proj,
        "map_status": "Active · on path",
    }
    if isinstance(parsed, dict) and isinstance(parsed.get("cards"), dict):
        parsed_cards = parsed["cards"]
        cards["from_a1"] = str(parsed_cards.get("from_a1") or cat)
        cards["strategy"] = str(parsed_cards.get("strategy") or strat)
        cards["project"] = str(parsed_cards.get("project") or proj)
        cards["map_status"] = str(parsed_cards.get("map_status") or "Active · on path")

    result_headline = "Security scan clean & gradual release pipeline armed."
    if isinstance(parsed, dict) and parsed.get("result_headline"):
        result_headline = str(parsed["result_headline"]).strip()

    result_body = f"Verified zero High/Critical vulnerabilities for services under strategy «{strat}». Automatic rollback trigger active."
    if isinstance(parsed, dict) and parsed.get("result_body"):
        result_body = str(parsed["result_body"]).strip()

    return {
        "title": str((parsed or {}).get("title") if isinstance(parsed, dict) else "") or "Security and release",
        "lede": str((parsed or {}).get("lede") if isinstance(parsed, dict) else "")
        or "Runs security scans and drives gradual traffic handover with automatic rollback triggers.",
        "cards": cards,
        "checklist": checklist,
        "suggested_plan": str((parsed or {}).get("suggested_plan") or "slow"),
        "result_headline": result_headline,
        "result_body": result_body,
        "glossary": gloss,
        "warning": "LLM unavailable — using context-derived A18 brief" if used_fallback else "",
        **_meta(out),
    }


async def generate_g6_brief(
    project_name: str,
    category_name: str,
    requirement: str,
    strategies: list[str],
    strategy_short: str,
    why_modernize: str,
    category_id: str = "",
    prior_agent_id: str = "A18",
    prior_agent_name: str = "Security and release",
    path_active_ids: list[str] | None = None,
    *,
    code_scan_status: str = "No high or critical findings",
    dependencies_status: str = "No known vulnerable libraries",
    sbom_status: str = "Generated and signed",
    secrets_status: str = "None found in code or config",
    service_names: list[str] | None = None,
) -> dict[str, Any]:
    """LLM-shaped G6 Approve Security brief derived from A1 intake, movement path, and A18 execution results."""
    import asyncio
    import logging

    log = logging.getLogger(__name__)

    cat = (category_name or "1. Legacy source-code data").strip()
    proj = (project_name or "Convert old Fortran code to new Java based code. The business context or the outcome should be similar").strip()
    req = (requirement or "Modernizing the legacy Fortran code to a Java-based system is essential to enhance maintainability, improve integration with contemporary systems, and support cloud deployment.").strip()
    strat = (strategy_short or (strategies[0] if strategies else "Modular Incremental Conversion")).strip()
    why = (why_modernize or "").strip()
    path_ids = [str(x) for x in (path_active_ids or []) if x]
    services = [str(x) for x in (service_names or []) if x]

    req_short = req[:110] + ("…" if len(req) > 110 else "")
    proj_short = proj[:100] + ("…" if len(proj) > 100 else "")

    fallback_checklist = [
        {"id": "c1", "label": "I confirm no high / critical security findings remain", "required": True},
        {"id": "c2", "label": "I confirm dependency and SBOM posture is acceptable", "required": True},
        {"id": "c3", "label": "I confirm secrets scanning is clean for release candidates", "required": True},
        {"id": "c4", "label": "I confirm security sign-off is independent of business release", "required": True},
        {"id": "c5", "label": f"Confirm this step still belongs on the path for «{cat}»", "required": True},
        {"id": "c6", "label": f"I confirm threat modeling covers target services: «{', '.join(services) if services else 'Policy Core Service, Pricing Service'}»", "required": False},
        {"id": "c7", "label": f"I confirm scope still matches the A1 requirement: «{req_short}»", "required": False},
        {"id": "c8", "label": f"I confirm the modernization strategy still applies: «{strat}»", "required": False},
        {"id": "c9", "label": f"I confirm security review remains aligned under project «{proj_short}»", "required": False},
    ]

    fallback_metrics = [
        {"label": "Code scan", "value": code_scan_status or "No high or critical findings"},
        {"label": "Dependencies", "value": dependencies_status or "No known vulnerable libraries"},
        {"label": "Software bill of materials", "value": sbom_status or "Generated and signed"},
        {"label": "Secrets", "value": secrets_status or "None found in code or config"},
    ]

    fallback_glossary = [
        {"term": "Security Scan", "def": "Automated SAST, DAST, and secrets scanning across modern codebase and bridges."},
        {"term": "Gradual Handover", "def": "Staged canary deployment shifting traffic progressively (1% → 5% → 20% → 50% → 100%)."},
        {"term": "Rollback Triggers", "def": "Automatic monitoring rules that revert traffic to legacy system if error rates spike."},
        {"term": "SBOM Compliance", "def": "Software Bill of Materials verification ensuring no vulnerable third-party packages."},
    ]

    prompt = f"""You write Gate G6 · Approve security brief for an AI Modernization Factory UI.
Context of the page must be derived from previous Agent execution results (A18 Security and release, A17 Equivalence check), movement path, and A1 intake with MAXIMUM semantic similarity.

FACTS FROM PREVIOUS AGENTS & INTAKE:
- Project: {proj}
- Category: {cat} ({category_id or "legacy"})
- Requirement: {req}
- Modernization Strategy: {strat}
- Why Modernize: {why or "(not provided)"}
- Agent Movement Path: {path_ids or ["A14", "A15", "A16", "G4", "A17", "G5", "A18", "G6"]}
- Immediate Prior Step: {prior_agent_id} ({prior_agent_name})
- Target Services: {services or ["Policy Core Service", "Pricing Service"]}
- Code Scan Status: {code_scan_status}
- Dependencies Status: {dependencies_status}
- SBOM Status: {sbom_status}
- Secrets Status: {secrets_status}

YOUR TASK:
Return ONLY valid JSON:
{{
  "title": "Approve security",
  "lede": "Is the new system safe to expose?",
  "approvers": "Security lead",
  "why": "Separate from the business approval on purpose — different people, different question.",
  "cards": {{
    "from_a1": "{cat}",
    "strategy": "{strat}",
    "requirement": "{req_short}",
    "map_status": "Active · on path"
  }},
  "security_metrics": [
    {{"label": "Code scan", "value": "{code_scan_status}"}},
    {{"label": "Dependencies", "value": "{dependencies_status}"}},
    {{"label": "Software bill of materials", "value": "{sbom_status}"}},
    {{"label": "Secrets", "value": "{secrets_status}"}}
  ],
  "checklist": [
    {{"id": "c1", "label": "I confirm no high / critical security findings remain", "required": true}},
    {{"id": "c2", "label": "I confirm dependency and SBOM posture is acceptable", "required": true}},
    {{"id": "c3", "label": "I confirm secrets scanning is clean for release candidates", "required": true}},
    {{"id": "c4", "label": "I confirm security sign-off is independent of business release", "required": true}},
    {{"id": "c5", "label": "Confirm this step still belongs on the path for «{cat}»", "required": true}},
    {{"id": "c6", "label": "I confirm threat modeling covers target services: «{', '.join(services) if services else 'Policy Core Service, Pricing Service'}»", "required": false}},
    {{"id": "c7", "label": "I confirm scope still matches the A1 requirement: «{req_short}»", "required": false}},
    {{"id": "c8", "label": "I confirm the modernization strategy still applies: «{strat}»", "required": false}},
    {{"id": "c9", "label": "I confirm security review remains aligned under project «{proj_short}»", "required": false}}
  ],
  "glossary": [
    {{"term": "Security Scan", "def": "Automated SAST, DAST, and secrets scanning across modern codebase and bridges."}},
    {{"term": "Gradual Handover", "def": "Staged canary deployment shifting traffic progressively (1% → 5% → 20% → 50% → 100%)."}},
    {{"term": "Rollback Triggers", "def": "Automatic monitoring rules that revert traffic to legacy system if error rates spike."}},
    {{"term": "SBOM Compliance", "def": "Software Bill of Materials verification ensuring no vulnerable third-party packages."}}
  ]
}}

Rules:
- Title must be "Approve security".
- Sub-heading question must be "Is the new system safe to expose?".
- Approvers must be "Security lead".
- Why must be "Separate from the business approval on purpose — different people, different question.".
- Include mandatory checklist items (required: true) with highest semantic similarity, and optional checklist items (required: false).
- No markdown formatting in JSON output."""

    backend = get_backend()
    out: dict[str, Any] = {
        "text": "",
        "error": "not attempted",
        "model": "catalog-fallback",
        "tokens_in": 0,
        "tokens_out": 0,
        "cost_usd": 0.0,
    }

    try:
        out = await asyncio.wait_for(
            backend.complete(
                "G6-brief",
                prompt,
                tier="medium",
                response_format={"type": "json_object"},
            ),
            timeout=30.0,
        )
    except Exception as exc:  # noqa: BLE001
        log.warning("G6-brief failed: %s", exc)
        out = {
            "text": "",
            "error": str(exc),
            "model": "catalog-fallback",
            "tokens_in": 0,
            "tokens_out": 0,
            "cost_usd": 0.0,
        }

    parsed = _parse_json(out.get("text", ""))
    used_fallback = not isinstance(parsed, dict)

    checklist = fallback_checklist
    if isinstance(parsed, dict) and isinstance(parsed.get("checklist"), list) and len(parsed["checklist"]) >= 5:
        raw_c = parsed["checklist"]
        valid_c = []
        for i, item in enumerate(raw_c[:9]):
            if isinstance(item, dict) and item.get("label"):
                valid_c.append({
                    "id": str(item.get("id") or f"c{i+1}"),
                    "label": str(item["label"]).strip(),
                    "required": bool(item.get("required", i < 5)),
                })
        if len(valid_c) >= 5:
            checklist = valid_c

    gloss = fallback_glossary
    if isinstance(parsed, dict) and isinstance(parsed.get("glossary"), list) and len(parsed["glossary"]) >= 3:
        valid_g = []
        for item in parsed["glossary"][:5]:
            if isinstance(item, dict) and item.get("term") and item.get("def"):
                valid_g.append({
                    "term": str(item["term"]).strip(),
                    "def": str(item["def"]).strip(),
                })
        if len(valid_g) >= 3:
            gloss = valid_g

    cards = {
        "from_a1": cat,
        "strategy": strat,
        "requirement": req,
        "map_status": "Active · on path",
    }
    if isinstance(parsed, dict) and isinstance(parsed.get("cards"), dict):
        parsed_cards = parsed["cards"]
        cards["from_a1"] = str(parsed_cards.get("from_a1") or cat)
        cards["strategy"] = str(parsed_cards.get("strategy") or strat)
        cards["requirement"] = str(parsed_cards.get("requirement") or req)
        cards["map_status"] = str(parsed_cards.get("map_status") or "Active · on path")

    metrics = fallback_metrics
    if isinstance(parsed, dict) and isinstance(parsed.get("security_metrics"), list) and len(parsed["security_metrics"]) >= 2:
        valid_m = []
        for item in parsed["security_metrics"][:4]:
            if isinstance(item, dict) and item.get("label") and item.get("value"):
                valid_m.append({
                    "label": str(item["label"]).strip(),
                    "value": str(item["value"]).strip(),
                })
        if len(valid_m) >= 2:
            metrics = valid_m

    return {
        "title": str((parsed or {}).get("title") if isinstance(parsed, dict) else "") or "Approve security",
        "lede": str((parsed or {}).get("lede") if isinstance(parsed, dict) else "")
        or "Is the new system safe to expose?",
        "approvers": str((parsed or {}).get("approvers") if isinstance(parsed, dict) else "") or "Security lead",
        "why": str((parsed or {}).get("why") if isinstance(parsed, dict) else "")
        or "Separate from the business approval on purpose — different people, different question.",
        "cards": cards,
        "security_metrics": metrics,
        "checklist": checklist,
        "glossary": gloss,
        "warning": "LLM unavailable — using context-derived G6 brief" if used_fallback else "",
        **_meta(out),
    }


async def generate_g7_brief(
    project_name: str,
    category_name: str,
    requirement: str,
    strategies: list[str],
    strategy_short: str,
    why_modernize: str,
    category_id: str = "",
    prior_agent_id: str = "A18",
    prior_agent_name: str = "Security and release",
    path_active_ids: list[str] | None = None,
    *,
    handover_plan_status: str = "5 stages, smallest first",
    rollback_status: str = "Armed on 1 conditions",
    old_system_status: str = "Stays running and ready to switch back",
    runbook_status: str = "Written and handed to the operations team",
    service_names: list[str] | None = None,
) -> dict[str, Any]:
    """LLM-shaped G7 Approve the release brief derived from A1 intake, movement path, and A18/G6 execution results."""
    import asyncio
    import logging

    log = logging.getLogger(__name__)

    cat = (category_name or "1. Legacy source-code data").strip()
    proj = (project_name or "Convert old Fortran code to new Java based code. The business context or the outcome should be similar").strip()
    req = (requirement or "Modernizing the legacy Fortran code to a Java-based system is essential to enhance maintainability, improve integration with contemporary systems, and support cloud deployment.").strip()
    strat = (strategy_short or (strategies[0] if strategies else "Phased conversion to Java")).strip()
    why = (why_modernize or "").strip()
    path_ids = [str(x) for x in (path_active_ids or []) if x]
    services = [str(x) for x in (service_names or []) if x]

    req_short = req[:110] + ("…" if len(req) > 110 else "")
    proj_short = proj[:100] + ("…" if len(proj) > 100 else "")

    fallback_checklist = [
        {"id": "c1", "label": "I approve the staged handover plan", "required": True},
        {"id": "c2", "label": "I confirm automatic rollback triggers are armed", "required": True},
        {"id": "c3", "label": "I confirm old system stays running and ready to switch back", "required": True},
        {"id": "c4", "label": "I confirm support runbook is handed to operations", "required": True},
        {"id": "c5", "label": f"Confirm this step still belongs on the path for «{cat}»", "required": True},
        {"id": "c6", "label": f"I confirm incident response channels are configured for target services: «{', '.join(services) if services else 'Policy Core Service, Pricing Service'}»", "required": False},
        {"id": "c7", "label": f"I confirm scope still matches the A1 requirement: «{req_short}»", "required": False},
        {"id": "c8", "label": f"I confirm the modernization strategy still applies: «{strat}»", "required": False},
        {"id": "c9", "label": f"I confirm operational readiness review remains aligned under project «{proj_short}»", "required": False},
    ]

    fallback_metrics = [
        {"label": "Handover plan", "value": handover_plan_status or "5 stages, smallest first"},
        {"label": "Automatic rollback", "value": rollback_status or "Armed on 1 conditions"},
        {"label": "Old system", "value": old_system_status or "Stays running and ready to switch back"},
        {"label": "Support runbook", "value": runbook_status or "Written and handed to the operations team"},
    ]

    fallback_glossary = [
        {"term": "Handover Plan", "def": "Staged migration schedule starting with lowest-risk workloads before full traffic cutover."},
        {"term": "Automatic Rollback", "def": "Monitored automated fallback that reverts traffic to the legacy system if error thresholds breach."},
        {"term": "Support Runbook", "def": "Operational documentation for monitoring, error triage, and tier-1/tier-2 incident response."},
        {"term": "Change Authority", "def": "Governance body responsible for authorizing operational deployments and release windows."},
    ]

    prompt = f"""You write Gate G7 · Approve the release brief for an AI Modernization Factory UI.
Context of the page must be derived from previous Agent execution results (A18 Security and release, G6 Approve security), movement path, and A1 intake with MAXIMUM semantic similarity.

FACTS FROM PREVIOUS AGENTS & INTAKE:
- Project: {proj}
- Category: {cat} ({category_id or "legacy"})
- Requirement: {req}
- Modernization Strategy: {strat}
- Why Modernize: {why or "(not provided)"}
- Agent Movement Path: {path_ids or ["A14", "A15", "A16", "G4", "A17", "G5", "A18", "G6", "G7"]}
- Immediate Prior Step: {prior_agent_id} ({prior_agent_name})
- Target Services: {services or ["Policy Core Service", "Pricing Service"]}
- Handover Plan Status: {handover_plan_status}
- Automatic Rollback Status: {rollback_status}
- Old System Status: {old_system_status}
- Support Runbook Status: {runbook_status}

YOUR TASK:
Return ONLY valid JSON:
{{
  "title": "Approve the release",
  "lede": "Are we operationally ready to hand over?",
  "approvers": "Change authority",
  "why": "Approves the handover, not the switch-off.",
  "cards": {{
    "from_a1": "{cat}",
    "strategy": "{strat}",
    "requirement": "{req_short}",
    "map_status": "Active · on path"
  }},
  "release_metrics": [
    {{"label": "Handover plan", "value": "{handover_plan_status}"}},
    {{"label": "Automatic rollback", "value": "{rollback_status}"}},
    {{"label": "Old system", "value": "{old_system_status}"}},
    {{"label": "Support runbook", "value": "{runbook_status}"}}
  ],
  "checklist": [
    {{"id": "c1", "label": "I approve the staged handover plan", "required": true}},
    {{"id": "c2", "label": "I confirm automatic rollback triggers are armed", "required": true}},
    {{"id": "c3", "label": "I confirm old system stays running and ready to switch back", "required": true}},
    {{"id": "c4", "label": "I confirm support runbook is handed to operations", "required": true}},
    {{"id": "c5", "label": "Confirm this step still belongs on the path for «{cat}»", "required": true}},
    {{"id": "c6", "label": "I confirm incident response channels are configured for target services: «{', '.join(services) if services else 'Policy Core Service, Pricing Service'}»", "required": false}},
    {{"id": "c7", "label": "I confirm scope still matches the A1 requirement: «{req_short}»", "required": false}},
    {{"id": "c8", "label": "I confirm the modernization strategy still applies: «{strat}»", "required": false}},
    {{"id": "c9", "label": "I confirm operational readiness review remains aligned under project «{proj_short}»", "required": false}}
  ],
  "glossary": [
    {{"term": "Handover Plan", "def": "Staged migration schedule starting with lowest-risk workloads before full traffic cutover."}},
    {{"term": "Automatic Rollback", "def": "Monitored automated fallback that reverts traffic to the legacy system if error thresholds breach."}},
    {{"term": "Support Runbook", "def": "Operational documentation for monitoring, error triage, and tier-1/tier-2 incident response."}},
    {{"term": "Change Authority", "def": "Governance body responsible for authorizing operational deployments and release windows."}}
  ]
}}

Rules:
- Title must be "Approve the release".
- Sub-heading question must be "Are we operationally ready to hand over?".
- Approvers must be "Change authority".
- Why must be "Approves the handover, not the switch-off.".
- Include mandatory checklist items (required: true) with highest semantic similarity, and optional checklist items (required: false).
- No markdown formatting in JSON output."""

    backend = get_backend()
    out: dict[str, Any] = {
        "text": "",
        "error": "not attempted",
        "model": "catalog-fallback",
        "tokens_in": 0,
        "tokens_out": 0,
        "cost_usd": 0.0,
    }

    try:
        out = await asyncio.wait_for(
            backend.complete(
                "G7-brief",
                prompt,
                tier="medium",
                response_format={"type": "json_object"},
            ),
            timeout=30.0,
        )
    except Exception as exc:  # noqa: BLE001
        log.warning("G7-brief failed: %s", exc)
        out = {
            "text": "",
            "error": str(exc),
            "model": "catalog-fallback",
            "tokens_in": 0,
            "tokens_out": 0,
            "cost_usd": 0.0,
        }

    parsed = _parse_json(out.get("text", ""))
    used_fallback = not isinstance(parsed, dict)

    checklist = fallback_checklist
    if isinstance(parsed, dict) and isinstance(parsed.get("checklist"), list) and len(parsed["checklist"]) >= 5:
        raw_c = parsed["checklist"]
        valid_c = []
        for i, item in enumerate(raw_c[:9]):
            if isinstance(item, dict) and item.get("label"):
                valid_c.append({
                    "id": str(item.get("id") or f"c{i+1}"),
                    "label": str(item["label"]).strip(),
                    "required": bool(item.get("required", i < 5)),
                })
        if len(valid_c) >= 5:
            checklist = valid_c

    gloss = fallback_glossary
    if isinstance(parsed, dict) and isinstance(parsed.get("glossary"), list) and len(parsed["glossary"]) >= 3:
        valid_g = []
        for item in parsed["glossary"][:5]:
            if isinstance(item, dict) and item.get("term") and item.get("def"):
                valid_g.append({
                    "term": str(item["term"]).strip(),
                    "def": str(item["def"]).strip(),
                })
        if len(valid_g) >= 3:
            gloss = valid_g

    cards = {
        "from_a1": cat,
        "strategy": strat,
        "requirement": req,
        "map_status": "Active · on path",
    }
    if isinstance(parsed, dict) and isinstance(parsed.get("cards"), dict):
        parsed_cards = parsed["cards"]
        cards["from_a1"] = str(parsed_cards.get("from_a1") or cat)
        cards["strategy"] = str(parsed_cards.get("strategy") or strat)
        cards["requirement"] = str(parsed_cards.get("requirement") or req)
        cards["map_status"] = str(parsed_cards.get("map_status") or "Active · on path")

    metrics = fallback_metrics
    if isinstance(parsed, dict) and isinstance(parsed.get("release_metrics"), list) and len(parsed["release_metrics"]) >= 2:
        valid_m = []
        for item in parsed["release_metrics"][:4]:
            if isinstance(item, dict) and item.get("label") and item.get("value"):
                valid_m.append({
                    "label": str(item["label"]).strip(),
                    "value": str(item["value"]).strip(),
                })
        if len(valid_m) >= 2:
            metrics = valid_m

    return {
        "title": str((parsed or {}).get("title") if isinstance(parsed, dict) else "") or "Approve the release",
        "lede": str((parsed or {}).get("lede") if isinstance(parsed, dict) else "")
        or "Are we operationally ready to hand over?",
        "approvers": str((parsed or {}).get("approvers") if isinstance(parsed, dict) else "") or "Change authority",
        "why": str((parsed or {}).get("why") if isinstance(parsed, dict) else "")
        or "Approves the handover, not the switch-off.",
        "cards": cards,
        "release_metrics": metrics,
        "checklist": checklist,
        "glossary": gloss,
        "warning": "LLM unavailable — using context-derived G7 brief" if used_fallback else "",
        **_meta(out),
    }


async def generate_g8_brief(
    project_name: str,
    category_name: str,
    requirement: str,
    strategies: list[str],
    strategy_short: str,
    why_modernize: str,
    category_id: str = "",
    prior_agent_id: str = "G7",
    prior_agent_name: str = "Approve the release",
    path_active_ids: list[str] | None = None,
    *,
    time_parallel_status: str = "30 days with no unexplained differences",
    data_reconciled_status: str = "All balances match",
    records_retained_status: str = "Archived per your retention policy",
    recovery_tested_status: str = "Restore from archive proven to work",
    service_names: list[str] | None = None,
) -> dict[str, Any]:
    """LLM-shaped G8 Approve switch-off brief derived from A1 intake, movement path, and G7 release execution results."""
    import asyncio
    import logging

    log = logging.getLogger(__name__)

    cat = (category_name or "1. Legacy source-code data").strip()
    proj = (project_name or "Convert old Fortran code to new Java based code. The business context or the outcome should be similar").strip()
    req = (requirement or "Modernizing the legacy Fortran code to Java is crucial for enhancing operational efficiency.").strip()
    strat = (strategy_short or (strategies[0] if strategies else "Modular transition to Java")).strip()
    why = (why_modernize or "").strip()
    path_ids = [str(x) for x in (path_active_ids or []) if x]
    services = [str(x) for x in (service_names or []) if x]

    req_short = req[:110] + ("…" if len(req) > 110 else "")
    proj_short = proj[:100] + ("…" if len(proj) > 100 else "")

    fallback_checklist = [
        {"id": "c1", "label": "I confirm parallel run duration met business threshold (30 days clean)", "required": True},
        {"id": "c2", "label": "I confirm full data reconciliation and balance match", "required": True},
        {"id": "c3", "label": "I confirm legacy records are archived per retention policy", "required": True},
        {"id": "c4", "label": "I confirm disaster recovery restore from archive is verified", "required": True},
        {"id": "c5", "label": f"Confirm this step still belongs on the path for «{cat}»", "required": True},
        {"id": "c6", "label": f"I confirm business stakeholders signed off on final decommission for «{proj_short}»", "required": False},
        {"id": "c7", "label": f"I confirm scope still matches the A1 requirement: «{req_short}»", "required": False},
        {"id": "c8", "label": f"I confirm the modernization strategy still applies: «{strat}»", "required": False},
        {"id": "c9", "label": f"I confirm final switch-off review remains aligned under project «{proj_short}»", "required": False},
    ]

    fallback_metrics = [
        {"label": "Time running in parallel", "value": time_parallel_status or "30 days with no unexplained differences"},
        {"label": "Data reconciled", "value": data_reconciled_status or "All balances match"},
        {"label": "Records retained", "value": records_retained_status or "Archived per your retention policy"},
        {"label": "Recovery tested", "value": recovery_tested_status or "Restore from archive proven to work"},
    ]

    fallback_glossary = [
        {"term": "Parallel Run", "def": "Period where legacy and modernized systems run side-by-side to verify zero functional discrepancy before decommission."},
        {"term": "Data Reconciliation", "def": "Complete cross-verification that financial, ledger, and transactional states match identically."},
        {"term": "Archive Retention", "def": "Historical data snapshotting and backup compliance before turning off legacy hardware."},
        {"term": "Switch-off Approval", "def": "The final human governance checkpoint authorising full retirement of the legacy system."},
    ]

    prompt = f"""You write Gate G8 · Approve switch-off brief for an AI Modernization Factory UI.
Context of the page must be derived from previous Agent execution results (G7 Approve the release, A18 Security and release), movement path, and A1 intake with MAXIMUM semantic similarity. This is the final human approval gate.

FACTS FROM PREVIOUS AGENTS & INTAKE:
- Project: {proj}
- Category: {cat} ({category_id or "legacy"})
- Requirement: {req}
- Modernization Strategy: {strat}
- Why Modernize: {why or "(not provided)"}
- Agent Movement Path: {path_ids or ["A14", "A15", "A16", "G4", "A17", "G5", "A18", "G6", "G7", "G8"]}
- Immediate Prior Step: {prior_agent_id} ({prior_agent_name})
- Target Services: {services or ["Policy Core Service", "Pricing Service"]}
- Parallel Run Status: {time_parallel_status}
- Data Reconciled Status: {data_reconciled_status}
- Records Retained Status: {records_retained_status}
- Recovery Tested Status: {recovery_tested_status}

YOUR TASK:
Return ONLY valid JSON:
{{
  "title": "Approve switch-off",
  "lede": "May we finally turn the old system off?",
  "approvers": "Business and Operations",
  "why": "The last gate. After this the old system is gone.",
  "cards": {{
    "from_a1": "{cat}",
    "strategy": "{strat}",
    "requirement": "{req_short}",
    "map_status": "Active · on path"
  }},
  "switchoff_metrics": [
    {{"label": "Time running in parallel", "value": "{time_parallel_status}"}},
    {{"label": "Data reconciled", "value": "{data_reconciled_status}"}},
    {{"label": "Records retained", "value": "{records_retained_status}"}},
    {{"label": "Recovery tested", "value": "{recovery_tested_status}"}}
  ],
  "checklist": [
    {{"id": "c1", "label": "I confirm parallel run duration met business threshold (30 days clean)", "required": true}},
    {{"id": "c2", "label": "I confirm full data reconciliation and balance match", "required": true}},
    {{"id": "c3", "label": "I confirm legacy records are archived per retention policy", "required": true}},
    {{"id": "c4", "label": "I confirm disaster recovery restore from archive is verified", "required": true}},
    {{"id": "c5", "label": "Confirm this step still belongs on the path for «{cat}»", "required": true}},
    {{"id": "c6", "label": "I confirm business stakeholders signed off on final decommission for «{proj_short}»", "required": false}},
    {{"id": "c7", "label": "I confirm scope still matches the A1 requirement: «{req_short}»", "required": false}},
    {{"id": "c8", "label": "I confirm the modernization strategy still applies: «{strat}»", "required": false}},
    {{"id": "c9", "label": "I confirm final switch-off review remains aligned under project «{proj_short}»", "required": false}}
  ],
  "glossary": [
    {{"term": "Parallel Run", "def": "Period where legacy and modernized systems run side-by-side to verify zero functional discrepancy before decommission."}},
    {{"term": "Data Reconciliation", "def": "Complete cross-verification that financial, ledger, and transactional states match identically."}},
    {{"term": "Archive Retention", "def": "Historical data snapshotting and backup compliance before turning off legacy hardware."}},
    {{"term": "Switch-off Approval", "def": "The final human governance checkpoint authorising full retirement of the legacy system."}}
  ]
}}

Rules:
- Title must be "Approve switch-off".
- Sub-heading question must be "May we finally turn the old system off?".
- Approvers must be "Business and Operations".
- Why must be "The last gate. After this the old system is gone.".
- Include mandatory checklist items (required: true) with highest semantic similarity, and optional checklist items (required: false).
- No markdown formatting in JSON output."""

    backend = get_backend()
    out: dict[str, Any] = {
        "text": "",
        "error": "not attempted",
        "model": "catalog-fallback",
        "tokens_in": 0,
        "tokens_out": 0,
        "cost_usd": 0.0,
    }

    try:
        out = await asyncio.wait_for(
            backend.complete(
                "G8-brief",
                prompt,
                tier="medium",
                response_format={"type": "json_object"},
            ),
            timeout=30.0,
        )
    except Exception as exc:  # noqa: BLE001
        log.warning("G8-brief failed: %s", exc)
        out = {
            "text": "",
            "error": str(exc),
            "model": "catalog-fallback",
            "tokens_in": 0,
            "tokens_out": 0,
            "cost_usd": 0.0,
        }

    parsed = _parse_json(out.get("text", ""))
    used_fallback = not isinstance(parsed, dict)

    checklist = fallback_checklist
    if isinstance(parsed, dict) and isinstance(parsed.get("checklist"), list) and len(parsed["checklist"]) >= 5:
        raw_c = parsed["checklist"]
        valid_c = []
        for i, item in enumerate(raw_c[:9]):
            if isinstance(item, dict) and item.get("label"):
                valid_c.append({
                    "id": str(item.get("id") or f"c{i+1}"),
                    "label": str(item["label"]).strip(),
                    "required": bool(item.get("required", i < 5)),
                })
        if len(valid_c) >= 5:
            checklist = valid_c

    gloss = fallback_glossary
    if isinstance(parsed, dict) and isinstance(parsed.get("glossary"), list) and len(parsed["glossary"]) >= 3:
        valid_g = []
        for item in parsed["glossary"][:5]:
            if isinstance(item, dict) and item.get("term") and item.get("def"):
                valid_g.append({
                    "term": str(item["term"]).strip(),
                    "def": str(item["def"]).strip(),
                })
        if len(valid_g) >= 3:
            gloss = valid_g

    cards = {
        "from_a1": cat,
        "strategy": strat,
        "requirement": req,
        "map_status": "Active · on path",
    }
    if isinstance(parsed, dict) and isinstance(parsed.get("cards"), dict):
        parsed_cards = parsed["cards"]
        cards["from_a1"] = str(parsed_cards.get("from_a1") or cat)
        cards["strategy"] = str(parsed_cards.get("strategy") or strat)
        cards["requirement"] = str(parsed_cards.get("requirement") or req)
        cards["map_status"] = str(parsed_cards.get("map_status") or "Active · on path")

    metrics = fallback_metrics
    if isinstance(parsed, dict) and isinstance(parsed.get("switchoff_metrics"), list) and len(parsed["switchoff_metrics"]) >= 2:
        valid_m = []
        for item in parsed["switchoff_metrics"][:4]:
            if isinstance(item, dict) and item.get("label") and item.get("value"):
                valid_m.append({
                    "label": str(item["label"]).strip(),
                    "value": str(item["value"]).strip(),
                })
        if len(valid_m) >= 2:
            metrics = valid_m

    return {
        "title": str((parsed or {}).get("title") if isinstance(parsed, dict) else "") or "Approve switch-off",
        "lede": str((parsed or {}).get("lede") if isinstance(parsed, dict) else "")
        or "May we finally turn the old system off?",
        "approvers": str((parsed or {}).get("approvers") if isinstance(parsed, dict) else "") or "Business and Operations",
        "why": str((parsed or {}).get("why") if isinstance(parsed, dict) else "")
        or "The last gate. After this the old system is gone.",
        "cards": cards,
        "switchoff_metrics": metrics,
        "checklist": checklist,
        "glossary": gloss,
        "warning": "LLM unavailable — using context-derived G8 brief" if used_fallback else "",
        **_meta(out),
    }










