"""LLM-backed intake synthesis for Factory Administrator (A1).

Synthesizes from a single category selection (trend option or custom title/description).
"""
from __future__ import annotations

import json
import re
from typing import Any

from app.agents.backends import get_backend
from app.intake.catalog import INTAKE_CATEGORIES, resolve_selection


def _parse_json(text: str) -> dict[str, Any] | None:
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
    try:
        data = json.loads(text)
        return data if isinstance(data, dict) else None
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if not match:
            return None
        try:
            data = json.loads(match.group(0))
            return data if isinstance(data, dict) else None
        except json.JSONDecodeError:
            return None


def _fallback(
    project_name: str,
    category_name: str,
    selection: str,
    description: str,
) -> dict[str, Any]:
    focus = description.strip() or selection
    strategy = (
        f"For {project_name}, prioritize «{category_name}» with this requirement: {focus}. "
        f"Inventory current-state evidence, design a strangler slice around this capability, "
        f"prove equivalence with replay, then canary-release with rollback gates."
    )
    reason = (
        f"{project_name} advances modernization by addressing {category_name.lower()} "
        f"risk and unlocking safer delivery of the selected capability."
    )
    return {
        "strategy": strategy,
        "business_reason": reason,
        "enriched_summary": (
            f"Enriched single-category intake for {project_name} focusing on {category_name}: {focus}."
        ),
        "enriched_categories": [
            {
                "id": "focus",
                "name": category_name,
                "selection": selection,
                "enrichment": (
                    description.strip()
                    or f"Capture owners, evidence, and acceptance checks for «{selection}»."
                ),
            }
        ],
        "model": "fallback",
    }


async def synthesize_intake(
    project_name: str,
    selections: list[dict[str, Any]],
    description: str = "",
) -> dict[str, Any]:
    if not selections:
        raise ValueError("Exactly one category selection is required")

    item = selections[0]
    cid = str(item.get("category_id", ""))
    cat = next((c for c in INTAKE_CATEGORIES if c["id"] == cid), None)
    category_name = cat["name"] if cat else cid
    selection = resolve_selection(cid, item.get("choice_id"), item.get("custom_text"))
    desc = (description or item.get("custom_text") or "").strip()
    project = project_name.strip() or selection[:80] or "Modernization initiative"

    prompt = f"""You are a senior enterprise modernization architect.
Project title: {project}
Focus category: {category_name}
Selected requirement: {selection}
Additional description: {desc or "(none — derive from the selected requirement)"}

Synthesize ONLY from this single category selection (do not invent other categories).

Respond with ONLY valid JSON (no markdown):
{{
  "strategy": "2-4 sentence modernization strategy for this selection",
  "business_reason": "exactly one sentence business reason",
  "enriched_summary": "2-3 sentence enriched overview of this intake",
  "enriched_categories": [
    {{
      "id": "{cid}",
      "name": "{category_name}",
      "selection": "the chosen requirement text",
      "enrichment": "one enriched sentence with trend context and next evidence needed"
    }}
  ]
}}

Keep language plain and executive-ready."""

    backend = get_backend()
    out = await backend.complete("A1-intake", prompt, tier="medium")
    parsed = _parse_json(out.get("text", ""))
    if not parsed or "strategy" not in parsed or "business_reason" not in parsed:
        result = _fallback(project, category_name, selection, desc)
        result["tokens_in"] = out.get("tokens_in", 0)
        result["tokens_out"] = out.get("tokens_out", 0)
        result["cost_usd"] = out.get("cost_usd", 0.0)
        result["model"] = out.get("model", result.get("model"))
        return result

    enriched = parsed.get("enriched_categories") or []
    if not isinstance(enriched, list) or not enriched:
        enriched = [
            {
                "id": cid,
                "name": category_name,
                "selection": selection,
                "enrichment": desc
                or f"Enrich «{selection}» with owners and evidence.",
            }
        ]

    return {
        "strategy": str(parsed.get("strategy", "")).strip(),
        "business_reason": str(parsed.get("business_reason", "")).strip(),
        "enriched_summary": str(parsed.get("enriched_summary", "")).strip(),
        "enriched_categories": enriched,
        "tokens_in": out.get("tokens_in", 0),
        "tokens_out": out.get("tokens_out", 0),
        "cost_usd": out.get("cost_usd", 0.0),
        "model": out.get("model", "unknown"),
    }
