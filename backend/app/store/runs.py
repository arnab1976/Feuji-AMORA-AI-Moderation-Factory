"""Run storage. In-memory reference implementation.

Deliberately behind an interface so swapping in the Postgres checkpointer is
a one-file change rather than a refactor.
"""
from __future__ import annotations

import uuid
from typing import Any

from app.core.types import FactoryState, RunStatus


class RunStore:
    def __init__(self) -> None:
        self._runs: dict[str, FactoryState] = {}
        self._params: dict[str, dict[str, dict[str, Any]]] = {}
        self._logs: dict[str, dict[str, list[tuple[str, str]]]] = {}

    def create(self, app_id: str = "polad") -> FactoryState:
        run_id = f"MOD-{uuid.uuid4().hex[:8].upper()}"
        state = FactoryState(run_id=run_id, app_id=app_id, status=RunStatus.CREATED)
        self._runs[run_id] = state
        self._params[run_id] = {}
        self._logs[run_id] = {}
        return state

    def get(self, run_id: str) -> FactoryState:
        if run_id not in self._runs:
            raise KeyError(f"Unknown run {run_id}")
        return self._runs[run_id]

    def save(self, state: FactoryState) -> None:
        self._runs[state.run_id] = state

    def list_runs(self) -> list[dict[str, Any]]:
        return [
            {"run_id": s.run_id, "app_id": s.app_id, "status": s.status,
             "agents_done": len(s.completed_agents),
             "gates_passed": len([g for g in s.gate_decisions if g.decision == "approved"])}
            for s in self._runs.values()
        ]

    def set_params(self, run_id: str, agent_id: str, params: dict[str, Any]) -> None:
        self._params.setdefault(run_id, {})[agent_id] = params

    def get_params(self, run_id: str, agent_id: str) -> dict[str, Any]:
        return self._params.get(run_id, {}).get(agent_id, {})

    def set_log(self, run_id: str, agent_id: str, lines: list[tuple[str, str]]) -> None:
        self._logs.setdefault(run_id, {})[agent_id] = lines

    def get_log(self, run_id: str, agent_id: str) -> list[tuple[str, str]]:
        return self._logs.get(run_id, {}).get(agent_id, [])

    def drop_after(self, run_id: str, keep_agents: list[str]) -> None:
        logs = self._logs.get(run_id, {})
        for agent_id in list(logs):
            if agent_id not in keep_agents:
                logs.pop(agent_id, None)
