"""MCP tool gateway.

Agents never hold credentials to your live systems. They ask the gateway, the
gateway checks whether that agent declared that server, and every call is
logged with which agent asked and why.

Two enforcement points that matter:

  * allow-list — an agent can only reach servers listed in its AgentSpec.mcp.
    Declaring is not the same as being trusted; the check happens at call time.

  * access level — a READ server rejects any tool whose name is not in its
    read-only tool list, even for an agent that declared it.
"""
from __future__ import annotations

import time
from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any, Protocol

from app.core.types import AccessLevel


class MCPError(RuntimeError):
    pass


class NotAllowed(MCPError):
    """Agent tried to reach a server it did not declare."""


class ToolNotPermitted(MCPError):
    """Tool is not available at this server's access level."""


@dataclass(frozen=True)
class MCPServer:
    id: str
    name: str
    plain: str  # plain-English description for the dashboard
    access: AccessLevel
    tools: tuple[str, ...]
    endpoint: str | None = None  # None = built-in stub


SERVERS: dict[str, MCPServer] = {
    s.id: s
    for s in [
        MCPServer("M1", "Source control", "Reads your code repositories",
                  AccessLevel.READ,
                  ("read_repo", "list_branches", "diff", "open_pull_request")),
        MCPServer("M2", "Mainframe", "Reads mainframe program libraries",
                  AccessLevel.READ,
                  ("read_pds_member", "read_jcl", "read_copybook", "compile_listing")),
        MCPServer("M3", "Database", "Reads database structure, never customer data",
                  AccessLevel.READ,
                  ("read_schema", "describe_table", "approved_query")),
        MCPServer("M4", "Observability", "Reads production logs and traces",
                  AccessLevel.READ,
                  ("query_logs", "query_traces", "query_metrics")),
        MCPServer("M5", "Security scanners", "Runs security and quality checks",
                  AccessLevel.READ,
                  ("semgrep", "trivy", "gitleaks", "syft")),
        MCPServer("M6", "Knowledge store", "Stores and searches everything learned",
                  AccessLevel.WRITE,
                  ("graph_query", "graph_write", "vector_search", "vector_upsert")),
        MCPServer("M7", "Build", "Compiles the generated code",
                  AccessLevel.SANDBOX,
                  ("maven", "gradle", "dotnet_build", "cobol_compile")),
        MCPServer("M8", "Test runner", "Runs the test suites",
                  AccessLevel.SANDBOX,
                  ("junit", "pytest", "xunit", "pact_verify")),
        MCPServer("M9", "Documentation", "Publishes readable documentation",
                  AccessLevel.WRITE,
                  ("generate_diagram", "publish_docs")),
        MCPServer("M10", "CI/CD", "Moves approved builds forward",
                  AccessLevel.APPROVAL,
                  ("start_pipeline", "pipeline_status", "promote_artifact")),
        MCPServer("M11", "Kubernetes", "Deploys and rolls back services",
                  AccessLevel.APPROVAL,
                  ("deploy_manifest", "rollout_status", "rollback")),
        MCPServer("M12", "Ticketing", "Raises work for people to pick up",
                  AccessLevel.WRITE,
                  ("create_issue", "update_issue", "request_review")),
    ]
}

# Tools that mutate something outside the sandbox. At APPROVAL level these
# require a passed gate; the gateway refuses them otherwise.
GATED_TOOLS = {"deploy_manifest", "rollback", "promote_artifact", "open_pull_request"}


@dataclass
class CallRecord:
    run_id: str
    agent_id: str
    server_id: str
    tool: str
    allowed: bool
    reason: str = ""
    latency_ms: float = 0.0
    at: float = field(default_factory=time.time)


class ToolHandler(Protocol):
    def __call__(self, tool: str, **kwargs: Any) -> Any: ...


class MCPGateway:
    def __init__(
        self,
        allow_list: dict[str, tuple[str, ...]],
        handlers: dict[str, ToolHandler] | None = None,
        gate_check: Callable[[str], bool] | None = None,
    ) -> None:
        """
        allow_list: agent_id -> declared server ids, from AgentSpec.mcp
        handlers:   server_id -> callable, absent means built-in stub
        gate_check: returns True if the named gate has been approved
        """
        self.allow_list = allow_list
        self.handlers = handlers or {}
        self.gate_check = gate_check or (lambda _gate: False)
        self.audit: list[CallRecord] = []

    def servers_for(self, agent_id: str) -> list[MCPServer]:
        return [SERVERS[s] for s in self.allow_list.get(agent_id, ()) if s in SERVERS]

    def call(
        self, *, run_id: str, agent_id: str, server_id: str, tool: str, **kwargs: Any
    ) -> Any:
        started = time.perf_counter()

        if server_id not in SERVERS:
            self._record(run_id, agent_id, server_id, tool, False, "unknown server", started)
            raise MCPError(f"Unknown MCP server {server_id}")

        declared = self.allow_list.get(agent_id, ())
        if server_id not in declared:
            self._record(run_id, agent_id, server_id, tool, False, "not in allow-list", started)
            raise NotAllowed(
                f"Agent {agent_id} did not declare {server_id}. "
                f"Declared: {', '.join(declared) or 'none'}"
            )

        server = SERVERS[server_id]
        if tool not in server.tools:
            self._record(run_id, agent_id, server_id, tool, False, "tool not on server", started)
            raise ToolNotPermitted(f"{server_id} does not expose {tool}")

        if server.access == AccessLevel.APPROVAL and tool in GATED_TOOLS:
            if not self.gate_check("G7"):
                self._record(run_id, agent_id, server_id, tool, False,
                             "release gate not approved", started)
                raise ToolNotPermitted(
                    f"{tool} requires an approved release gate before it can run"
                )

        handler = self.handlers.get(server_id)
        result = handler(tool, **kwargs) if handler else _stub(server, tool, **kwargs)
        self._record(run_id, agent_id, server_id, tool, True, "", started)
        return result

    def _record(
        self, run_id: str, agent_id: str, server_id: str, tool: str,
        allowed: bool, reason: str, started: float,
    ) -> None:
        self.audit.append(
            CallRecord(
                run_id=run_id, agent_id=agent_id, server_id=server_id, tool=tool,
                allowed=allowed, reason=reason,
                latency_ms=round((time.perf_counter() - started) * 1000, 2),
            )
        )


def _stub(server: MCPServer, tool: str, **kwargs: Any) -> dict[str, Any]:
    """Built-in stub so the whole pipeline runs with no external systems."""
    return {"server": server.id, "tool": tool, "stub": True, "args": kwargs}


def build_allow_list() -> dict[str, tuple[str, ...]]:
    from app.agents import load_all  # local import avoids a cycle

    load_all()
    from app.agents.base import all_specs

    return {spec.id: spec.mcp for spec in all_specs()}
