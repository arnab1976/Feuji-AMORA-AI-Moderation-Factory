"""Run storage with JSON file persistence & auto-healing for unknown run IDs.
"""
from __future__ import annotations

import json
import uuid
from pathlib import Path
from typing import Any

from app.core.types import FactoryState, RunStatus


class RunStore:
    def __init__(self, persistence_file: str | None = None) -> None:
        self._runs: dict[str, FactoryState] = {}
        self._params: dict[str, dict[str, dict[str, Any]]] = {}
        self._logs: dict[str, dict[str, list[tuple[str, str]]]] = {}
        self._file_path = Path(persistence_file) if persistence_file else Path(__file__).resolve().parent / ".runs_cache.json"
        self._load()

    def _persist(self) -> None:
        try:
            data = {
                "runs": {run_id: state.model_dump(mode="json") for run_id, state in self._runs.items()},
                "params": self._params,
                "logs": self._logs,
            }
            self._file_path.write_text(json.dumps(data, indent=2, default=str), encoding="utf-8")
        except Exception:
            pass

    def _load(self) -> None:
        if not self._file_path.exists():
            return
        try:
            raw = json.loads(self._file_path.read_text(encoding="utf-8"))
            runs_raw = raw.get("runs", {})
            for run_id, state_dict in runs_raw.items():
                self._runs[run_id] = FactoryState.model_validate(state_dict)
            self._params = raw.get("params", {})
            self._logs = raw.get("logs", {})
        except Exception:
            pass

    def create(self, app_id: str = "polad") -> FactoryState:
        run_id = f"MOD-{uuid.uuid4().hex[:8].upper()}"
        state = FactoryState(run_id=run_id, app_id=app_id, status=RunStatus.CREATED)
        self._runs[run_id] = state
        self._params[run_id] = {}
        self._logs[run_id] = {}
        self._persist()
        return state

    def get(self, run_id: str) -> FactoryState:
        if run_id not in self._runs:
            state = FactoryState(run_id=run_id, app_id="polad", status=RunStatus.RUNNING)
            self._runs[run_id] = state
            self._params[run_id] = {}
            self._logs[run_id] = {}
            self._persist()
            return state
        return self._runs[run_id]

    def save(self, state: FactoryState) -> None:
        self._runs[state.run_id] = state
        self._persist()

    def list_runs(self) -> list[dict[str, Any]]:
        return [
            {"run_id": s.run_id, "app_id": s.app_id, "status": s.status,
             "agents_done": len(s.completed_agents),
             "gates_passed": len([g for g in s.gate_decisions if g.decision == "approved"])}
            for s in self._runs.values()
        ]

    def set_params(self, run_id: str, agent_id: str, params: dict[str, Any]) -> None:
        self._params.setdefault(run_id, {})[agent_id] = params
        self._persist()

    def get_params(self, run_id: str, agent_id: str) -> dict[str, Any]:
        return self._params.get(run_id, {}).get(agent_id, {})

    def set_log(self, run_id: str, agent_id: str, lines: list[tuple[str, str]]) -> None:
        self._logs.setdefault(run_id, {})[agent_id] = lines
        self._persist()

    def get_log(self, run_id: str, agent_id: str) -> list[tuple[str, str]]:
        return self._logs.get(run_id, {}).get(agent_id, [])

    def drop_after(self, run_id: str, keep_agents: list[str]) -> None:
        logs = self._logs.get(run_id, {})
        for agent_id in list(logs):
            if agent_id not in keep_agents:
                logs.pop(agent_id, None)
        self._persist()
