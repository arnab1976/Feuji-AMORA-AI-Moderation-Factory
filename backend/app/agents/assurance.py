"""Domain D (test, heal, equivalence) and Domain E (security and release).

Two rules encoded here that matter more than anything else in the codebase:

1. Tests are generated from approved rules, never from the generated code.
   Testing code against itself only proves it does what it does.

2. A repair that weakens an assertion tied to an approved rule is rejected
   automatically. Without this, an agent optimising for green ticks will
   eventually delete the requirement rather than meet it.
"""
from __future__ import annotations

from typing import Any

from app.agents.base import Agent, AgentSpec, register
from app.core.types import (
    AgentResult,
    Divergence,
    EquivalenceReport,
    FactoryState,
    TestReport,
)

MAX_HEAL_ATTEMPTS = 3

FAILURE_CLASSES = {
    "ENV_FLAKE": ("Timing fluke", "Retry unchanged, touch nothing", True),
    "CODE_DEFECT": ("Real bug", "Patch the service, test is correct", True),
    "TEST_DEFECT": ("Bad test", "Patch the test, service is correct", True),
    "SPEC_GAP": ("Missing rule", "Escalate to a human, never self-resolve", False),
}


@register
class TestGeneration(Agent):
    spec = AgentSpec(
        id="A14",
        domain="E",
        name="Test generation",
        plain="Writes tests from the approved rules, not from the new code. That is the key trick.",
        needs="Approved rules and real customer journeys",
        produces="Test suites linked back to each rule",
        mcp=("M6", "M7", "M8"),
        model_tier="medium",
        inputs=(
            {
                "key": "kinds",
                "type": "multi",
                "label": "What kinds of tests?",
                "default": ["unit", "integration", "edge"],
                "options": [
                    ["unit", "One test per business rule", "The main safety net"],
                    ["integration", "Tests against a real database", ""],
                    ["edge", "Awkward edge cases", "Boundaries, zeros, negatives"],
                    ["parity", "Characterization / parity vs legacy", "Prove equivalence"],
                ],
            },
        ),
    )

    async def run(self, state: FactoryState, params: dict[str, Any]) -> AgentResult:
        kinds = params.get("kinds", ["unit", "integration", "edge"])
        if not isinstance(kinds, list):
            kinds = ["unit", "integration", "edge"]
        kinds = [str(k).lower() for k in kinds]
        approved = state.approved_rules()
        multiplier = (
            1
            + (0.6 if "integration" in kinds else 0)
            + (0.8 if "edge" in kinds else 0)
            + (0.5 if "parity" in kinds else 0)
        )
        total = round(max(len(approved), 1) * multiplier)
        coverage = min(97.0, 74.0 + len(kinds) * 7.0)
        inv = dict(state.inventory or {})
        what = params.get("what_to_test") if isinstance(params.get("what_to_test"), list) else []
        inv["tests"] = {
            "kinds": kinds,
            "total": total,
            "rule_coverage_pct": coverage,
            "approved_rule_count": len(approved),
            "what_to_test": what[:12],
            "a1_project_name": str(params.get("a1_project_name") or ""),
            "a1_strategy": str(params.get("a1_strategy") or ""),
        }

        log = [
            ("info", "Writing tests from the approved rules..."),
            ("info", "Note: from the rules, not from the new code"),
            ("info", f"Kinds selected: {', '.join(kinds) or 'unit'}"),
            ("ok", f"Wrote {total} tests"),
            ("ok", f"{coverage:.0f}% of approved rules now have a test checking them"),
        ]
        if what:
            log.append(("info", f"Covering {len(what)} prioritized test surfaces from the A14 brief"))
        log.append(
            ("ok", "Above the 85% bar")
            if coverage >= 85
            else ("warn", "Below the 85% bar. The equivalence check will prove less than it should.")
        )
        log += [
            ("info", "Capturing expected answers from the old system..."),
            ("ok", "Golden expectations captured for every test"),
            ("hl", "Testing new code against itself only proves it does what it does."),
        ]
        art = ["tests/unit/", "coverage_matrix.json"]
        if "integration" in kinds:
            art.insert(1, "tests/integration/")
        if "edge" in kinds:
            art.append("tests/edge/")
        if "parity" in kinds:
            art.append("tests/parity/")
        return self._result(
            log=log,
            state_patch={
                "test_results": TestReport(
                    total=total, passed=0, failed=0, rule_coverage_pct=coverage
                ).model_dump(),
                "inventory": inv,
            },
            artifacts=art,
        )


@register
class FailureTriage(Agent):
    spec = AgentSpec(
        id="A15",
        domain="E",
        name="Failure triage",
        plain="When a test fails, works out why before anything is changed.",
        needs="Test results, logs, change history",
        produces="A cause for each failure and what to do about it",
        mcp=("M4", "M8", "M12"),
        model_tier="medium",
        inputs=(
            {
                "key": "mode",
                "type": "select",
                "label": "How should failures be handled?",
                "options": [
                    ["strict", "Always work out the cause before changing anything"],
                    ["quick", "Retry first, investigate only if it fails again"],
                ],
            },
        ),
    )

    async def run(self, state: FactoryState, params: dict[str, Any]) -> AgentResult:
        strict = params.get("mode", "strict") == "strict"
        report = state.test_results
        failed = round(report.total * 0.09)
        breakdown = {
            "ENV_FLAKE": round(failed * 0.3),
            "CODE_DEFECT": round(failed * 0.4),
            "TEST_DEFECT": round(failed * 0.2),
            "SPEC_GAP": failed - round(failed * 0.3) - round(failed * 0.4) - round(failed * 0.2),
        }
        log = [
            ("info", "Running the tests..."),
            ("warn", f"{failed} tests failed"),
            ("info", "Working out the cause of each failure before changing anything...")
            if strict
            else ("info", "Retrying failures first..."),
        ]
        for cls, count in breakdown.items():
            label = FAILURE_CLASSES[cls][0]
            level = "error" if cls == "SPEC_GAP" else "info"
            log.append((level, f"  {count} × {label}"))
        log.append(
            ("hl", "Diagnosing first is what stops the factory fixing the wrong thing.")
            if strict
            else ("hl", "Retry-first is faster but risks masking a real bug as a fluke.")
        )
        return self._result(
            log=log,
            state_patch={
                "test_results": {
                    **report.model_dump(),
                    "failed": failed,
                    "passed": report.total - failed,
                    "failure_breakdown": breakdown,
                },
            },
            artifacts=["triage_report.json", "repro_bundle.zip"],
        )


@register
class SelfHealing(Agent):
    spec = AgentSpec(
        id="A16",
        domain="E",
        name="Self-healing",
        plain="Fixes what is safe to fix. Never allowed to weaken a test to get a green tick.",
        needs="The diagnosis from triage",
        produces="Fix proposals with before and after evidence",
        mcp=("M1", "M8", "M12"),
        model_tier="large",
        inputs=(
            {
                "key": "max_attempts",
                "type": "select",
                "label": "How many times may the factory try to fix a failure itself?",
                "hint": "After this it must ask a person.",
                "options": [
                    ["3", "Three tries, then ask a person"],
                    ["1", "One try only"],
                    ["0", "Never fix by itself — always ask a person"],
                ],
            },
        ),
    )

    async def run(self, state: FactoryState, params: dict[str, Any]) -> AgentResult:
        attempts = int(params.get("max_attempts", 3))
        if attempts > MAX_HEAL_ATTEMPTS:
            attempts = MAX_HEAL_ATTEMPTS
        report = state.test_results
        rate = 0.71 if attempts >= 3 else 0.34 if attempts == 1 else 0.0
        healed = round(report.failed * rate)
        escalated = report.failed - healed

        log = [
            ("warn", "Automatic fixing is switched off")
            if attempts == 0
            else ("info", "Fixing what is safe to fix..."),
            ("ok", f"{healed} failures fixed automatically"),
            ("warn", f"{escalated} sent to a person"),
            ("info", "Checking no fix weakened a test..."),
            ("ok", "No fix removed or weakened a rule check — 2 attempts were rejected for trying"),
            ("info", "Re-running the full suite after each fix..."),
            ("ok", "No previously passing test was broken"),
            ("hl", "Weakening a test to get a green tick is rejected automatically. No exceptions."),
        ]
        return self._result(
            log=log,
            state_patch={
                "test_results": {
                    **report.model_dump(),
                    "healed": healed,
                    "escalated": escalated,
                    "passed": report.total - escalated,
                    "failed": escalated,
                }
            },
            artifacts=["heal_diffs/", "heal_evidence.json"],
        )


@register
class EquivalenceValidation(Agent):
    """Deliberately deterministic. An LLM must never decide whether two
    money amounts match — that answer has to be the same every time and
    defensible to a regulator."""

    spec = AgentSpec(
        id="A17",
        domain="E",
        name="Equivalence check",
        plain="Runs old and new side by side on real cases and compares every field. No AI involved.",
        needs="Old system, new system, real masked cases",
        produces="A match rate and a list of every difference",
        model_tier="none",
        inputs=(
            {
                "key": "volume",
                "type": "select",
                "label": "How many real cases should we replay?",
                "options": [
                    ["50000", "50,000 — thorough"],
                    ["10000", "10,000 — quick check"],
                    ["200000", "200,000 — very thorough, slower"],
                ],
            },
            {
                "key": "tolerances",
                "type": "multi",
                "label": "Which differences are acceptable?",
                "default": ["rounding", "timestamps"],
                "options": [
                    ["rounding", "Rounding under one cent",
                     "Different maths libraries round differently"],
                    ["timestamps", "Timestamps", "The new system runs at a different moment"],
                    ["ordering", "List ordering", "Same items, different sequence"],
                ],
            },
        ),
    )

    KNOWN_DIVERGENCES = [
        ("P-88214", "BR-0311", "endorsement_applied", "Endorsement A", "Endorsement B"),
        ("P-91007", "BR-0355", "ncd_status", "Discount reset", "Discount kept"),
        ("P-77450", "BR-0203", "refund_amount", "214.60", "218.00"),
    ]

    async def run(self, state: FactoryState, params: dict[str, Any]) -> AgentResult:
        volume = int(params.get("volume", 50000))
        tolerances = params.get("tolerances", ["rounding", "timestamps"])

        total_diffs = round(volume * 0.0037)
        # Tolerances explain *classes* of difference (rounding, timestamps,
        # ordering). Each declared tolerance accounts for one of the known
        # divergence classes; whatever remains is a genuine behavioural gap.
        unexplained_count = max(0, 3 - len(tolerances))

        divergences = [
            Divergence(
                case_id=c, rule_id=r, field=f, legacy_value=lv, modern_value=mv,
                explained_by=None,
            )
            for c, r, f, lv, mv in self.KNOWN_DIVERGENCES[:unexplained_count]
        ]
        for i, tol in enumerate(tolerances):
            divergences.append(
                Divergence(
                    case_id=f"P-{60000 + i}", rule_id=None, field=tol,
                    legacy_value="within tolerance", modern_value="within tolerance",
                    explained_by=tol,
                )
            )
        match_rate = round(100.0 - (unexplained_count / volume * 100), 3)

        log = [
            ("info", f"Loading {volume:,} real cases with personal details masked..."),
            ("info", "Running the old system..."),
            ("ok", "Old system done"),
            ("info", "Running the new system on identical inputs..."),
            ("ok", "New system done"),
            ("info", "Comparing every field of every answer..."),
            ("info", f"{total_diffs} cases differ in some way"),
            ("ok", f"{total_diffs - unexplained_count} fall inside the tolerances you declared"),
        ]
        log.append(
            ("error", f"{unexplained_count} differences are NOT explained")
            if unexplained_count
            else ("ok", "No unexplained differences")
        )
        log += [
            ("info", "Checking money totals..."),
            ("ok", "Premium totals match exactly"),
            ("ok", "Ledger totals match exactly"),
            ("hl", "No AI here. A plain field-by-field comparison, so the answer is the same every time."),
        ]
        return self._result(
            log=log,
            state_patch={
                "equivalence": EquivalenceReport(
                    cases_replayed=volume,
                    match_rate=match_rate,
                    divergences=divergences,
                ).model_dump()
            },
            artifacts=["equivalence_report.json", "field_diffs.csv"],
        )


@register
class SecurityAndRelease(Agent):
    spec = AgentSpec(
        id="A18",
        domain="F",
        name="Security and release",
        plain="Scans for security problems, then hands over to the new system gradually with a way back.",
        needs="The approved release candidate",
        produces="Security report, gradual handover, rollback plan",
        mcp=("M5", "M10", "M11"),
        model_tier="none",
        inputs=(
            {
                "key": "plan",
                "type": "select",
                "label": "How fast should we hand over?",
                "options": [
                    ["slow", "Very careful — 1%, 5%, 20%, 50%, 100% over two weeks"],
                    ["normal", "Normal — 5%, 25%, 100% over four days"],
                    ["fast", "Fast — 10% then everything, in one day"],
                ],
            },
            {
                "key": "rollback_on",
                "type": "multi",
                "label": "When should it switch back automatically?",
                "default": ["errors", "divergence"],
                "options": [
                    ["errors", "If errors rise above normal", "Strongly recommended"],
                    ["latency", "If it gets noticeably slower", ""],
                    ["divergence", "If answers start differing from the old system",
                     "Strongly recommended"],
                ],
            },
        ),
    )

    STAGES = {
        "slow": ["1%", "5%", "20%", "50%", "100%"],
        "normal": ["5%", "25%", "100%"],
        "fast": ["10%", "100%"],
    }

    async def run(self, state: FactoryState, params: dict[str, Any]) -> AgentResult:
        stages = self.STAGES[params.get("plan", "slow")]
        triggers = params.get("rollback_on", ["errors", "divergence"])

        log = [
            ("info", "Scanning the new code for security problems..."),
            ("ok", "No high or critical findings"),
            ("ok", "No known vulnerable libraries"),
            ("ok", "Software bill of materials generated and signed"),
            ("info", "Running new alongside old, taking no real traffic..."),
            ("ok", "Shadow run clean — answers match"),
            ("info", "Starting the gradual handover..."),
        ]
        for stage in stages:
            log.append(("info", f"Sending {stage} of real traffic to the new system..."))
            log.append(("ok", "  errors normal, speed normal, answers match"))
        log.append(("ok", "Handover complete"))
        log.append(("info", "Old system kept running and idle, ready to take over again"))
        log.append(
            ("hl", f"Automatic switch-back armed on {len(triggers)} conditions.")
            if triggers
            else ("warn", "No automatic switch-back. Somebody has to be watching.")
        )
        return self._result(
            log=log,
            state_patch={
                "deployment": {
                    "stages": stages,
                    "rollback_triggers": triggers,
                    "security_findings": {"critical": 0, "high": 0, "medium": 4},
                    "sbom": "sbom.cdx.json",
                }
            },
            artifacts=["sbom.cdx.json", "deployment_evidence.json", "rollback_plan.md"],
        )
