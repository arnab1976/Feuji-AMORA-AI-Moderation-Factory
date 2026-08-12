"""A12 generated source files — view, download ZIP/individual, push to GitHub."""
from __future__ import annotations

import base64
import io
import json
import os
import re
import urllib.error
import urllib.parse
import urllib.request
import zipfile
from datetime import datetime, timezone
from typing import Any

from app.core.types import FactoryState


def a12_tracking_id(run_id: str) -> str:
    safe = run_id.replace(" ", "-").upper()
    return f"AMORA-A12-{safe}"


def _slug(text: str, fallback: str = "service") -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9]+", "-", (text or "").strip()).strip("-").lower()
    return cleaned or fallback


def _pascal(text: str, fallback: str = "Service") -> str:
    parts = re.findall(r"[A-Za-z0-9]+", text or "")
    if not parts:
        return fallback
    return "".join(p[:1].upper() + p[1:] for p in parts)


def _file_id(path: str) -> str:
    return re.sub(r"[^a-zA-Z0-9]+", "_", path).strip("_").lower() or "file"


def _media_for(path: str) -> str:
    lower = path.lower()
    if lower.endswith(".java"):
        return "text/x-java-source; charset=utf-8"
    if lower.endswith(".cs"):
        return "text/plain; charset=utf-8"
    if lower.endswith(".py"):
        return "text/x-python; charset=utf-8"
    if lower.endswith(".xml"):
        return "application/xml; charset=utf-8"
    if lower.endswith(".json"):
        return "application/json; charset=utf-8"
    if lower.endswith(".md"):
        return "text/markdown; charset=utf-8"
    if lower.endswith(".yml") or lower.endswith(".yaml"):
        return "text/yaml; charset=utf-8"
    if lower.endswith(".dockerfile") or lower.endswith("dockerfile"):
        return "text/plain; charset=utf-8"
    return "text/plain; charset=utf-8"


def _language_for(path: str) -> str:
    lower = path.lower()
    if lower.endswith(".java"):
        return "java"
    if lower.endswith(".cs"):
        return "csharp"
    if lower.endswith(".py"):
        return "python"
    if lower.endswith(".json"):
        return "json"
    if lower.endswith(".xml"):
        return "xml"
    if lower.endswith(".md"):
        return "markdown"
    if lower.endswith((".yml", ".yaml")):
        return "yaml"
    return "text"


def _rule_bits(state: FactoryState) -> list[dict[str, str]]:
    rules = state.approved_rules()
    out: list[dict[str, str]] = []
    for i, rule in enumerate(rules[:12]):
        rid = str(getattr(rule, "rule_id", None) or f"R-{i+1:03d}")
        statement = str(getattr(rule, "statement", None) or getattr(rule, "text", None) or rid)
        out.append({
            "rule_id": rid,
            "statement": statement[:180],
            "method": _pascal(rid.replace("-", " "), f"Rule{i+1}")[:48],
        })
    if not out:
        out = [
            {"rule_id": "R-001", "statement": "Preserve approved business outcome", "method": "ApplyBaseline"},
            {"rule_id": "R-002", "statement": "Reject invalid input combinations", "method": "ValidateInput"},
        ]
    return out


def _service_names(state: FactoryState, params: dict[str, Any] | None = None) -> list[str]:
    params = params or {}
    names: list[str] = []
    sample = params.get("sample_services")
    if isinstance(sample, list):
        for item in sample:
            if isinstance(item, dict) and item.get("name"):
                names.append(str(item["name"]))
    if not names:
        gen = ((state.inventory or {}).get("codegen") or {})
        for item in gen.get("sample_services") or []:
            if isinstance(item, dict) and item.get("name"):
                names.append(str(item["name"]))
        for n in gen.get("service_names") or []:
            if n and str(n) not in names:
                names.append(str(n))
    if not names:
        for ctx in state.service_map or []:
            name = getattr(ctx, "name", None) or (ctx.get("name") if isinstance(ctx, dict) else None)
            if name:
                names.append(str(name))
    return names or ["CoreService"]


def build_a12_source_files(
    state: FactoryState,
    *,
    stack: str = "java",
    extras: list[str] | None = None,
    params: dict[str, Any] | None = None,
) -> dict[str, dict[str, str]]:
    """Build downloadable source artefacts keyed by stable file id."""
    params = params or {}
    extras = extras or ["provenance", "infra"]
    provenance = "provenance" in extras
    infra = "infra" in extras
    stack = (stack or "java").lower()
    if stack not in {"java", "dotnet", "python"}:
        stack = "java"

    services = _service_names(state, params)
    rules = _rule_bits(state)
    project = str(
        params.get("a1_project_name")
        or ((state.inventory or {}).get("intake") or {}).get("project_name")
        or "Modernization initiative"
    )
    strategy = str(
        params.get("a1_strategy")
        or ((state.inventory or {}).get("intake") or {}).get("strategy_short")
        or ""
    )
    requirement = str(params.get("a1_requirement") or "")
    tracking = a12_tracking_id(state.run_id)
    files: dict[str, dict[str, str]] = {}

    def add(path: str, content: str, label: str | None = None) -> None:
        fid = _file_id(path)
        files[fid] = {
            "id": fid,
            "path": path,
            "label": label or path.split("/")[-1],
            "filename": path.split("/")[-1],
            "language": _language_for(path),
            "media_type": _media_for(path),
            "content": content,
        }

    # README + meta artefacts always.
    add(
        "README.md",
        "\n".join([
            f"# {project} — generated services",
            "",
            f"**Tracking:** `{tracking}`",
            f"**Stack:** {stack}",
            f"**Strategy:** {strategy or '(locked at A1)'}",
            "",
            "## Continuity",
            requirement[:400] or "Generated from approved architecture and rules.",
            "",
            "## Services",
            *[f"- {n}" for n in services],
            "",
            "## Provenance",
            "Every rule method names the approved rule it implements." if provenance else "Provenance disabled for this run.",
            "",
            "Code exists but is not trusted yet — testing comes next.",
            "",
        ]),
        "README",
    )
    add(
        "pull_request.json",
        json.dumps(
            {
                "title": f"A12 · generate {stack} services for {project}",
                "body": (
                    f"Generated by Modernization Factory ({tracking}).\n"
                    f"Services: {', '.join(services)}\n"
                    f"Rules: {len(rules)}\n"
                    "Do not merge until Gate G3 / equivalence review."
                ),
                "draft": True,
                "labels": ["codegen", "a12", "needs-review"],
            },
            indent=2,
        ),
        "Change request",
    )
    add(
        "sbom.cdx.json",
        json.dumps(
            {
                "bomFormat": "CycloneDX",
                "specVersion": "1.5",
                "version": 1,
                "metadata": {
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "component": {"type": "application", "name": _slug(project), "version": "0.1.0"},
                    "properties": [
                        {"name": "amora:tracking_id", "value": tracking},
                        {"name": "amora:stack", "value": stack},
                    ],
                },
                "components": [
                    {"type": "library", "name": n, "version": "0.1.0"} for n in services
                ],
            },
            indent=2,
        ),
        "SBOM",
    )

    for svc in services[:6]:
        pkg = _slug(svc)
        cls = _pascal(svc)
        if stack == "java":
            base = f"services/{pkg}/src/main/java/com/amora/{pkg.replace('-', '')}"
            java_pkg = f"com.amora.{pkg.replace('-', '')}"
            rule_methods = []
            for r in rules:
                note = f'    /** Provenance: implements approved rule {r["rule_id"]} — {r["statement"]} */\n' if provenance else ""
                rule_methods.append(
                    f"{note}    public boolean {r['method'][0].lower() + r['method'][1:]}(Map<String, Object> input) {{\n"
                    f'        // Rule {r["rule_id"]}\n'
                    f"        return input != null && !input.isEmpty();\n"
                    f"    }}\n"
                )
            add(
                f"{base}/{cls}Application.java",
                "\n".join([
                    f"package {java_pkg};",
                    "",
                    "import org.springframework.boot.SpringApplication;",
                    "import org.springframework.boot.autoconfigure.SpringBootApplication;",
                    "",
                    "@SpringBootApplication",
                    f"public class {cls}Application {{",
                    "    public static void main(String[] args) {",
                    f"        SpringApplication.run({cls}Application.class, args);",
                    "    }",
                    "}",
                    "",
                ]),
                f"{cls} application",
            )
            add(
                f"{base}/rules/{cls}Rules.java",
                "\n".join([
                    f"package {java_pkg}.rules;",
                    "",
                    "import java.util.Map;",
                    "import org.springframework.stereotype.Service;",
                    "",
                    "@Service",
                    f"public class {cls}Rules {{",
                    f'    // Generated for service «{svc}» under strategy «{strategy or "A1"}»',
                    "",
                    *rule_methods,
                    "}",
                    "",
                ]),
                f"{cls} rules",
            )
            add(
                f"services/{pkg}/pom.xml",
                "\n".join([
                    '<?xml version="1.0" encoding="UTF-8"?>',
                    "<project xmlns=\"http://maven.apache.org/POM/4.0.0\"",
                    "         xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\"",
                    "         xsi:schemaLocation=\"http://maven.apache.org/POM/4.0.0 https://maven.apache.org/xsd/maven-4.0.0.xsd\">",
                    "  <modelVersion>4.0.0</modelVersion>",
                    "  <groupId>com.amora</groupId>",
                    f"  <artifactId>{pkg}</artifactId>",
                    "  <version>0.1.0-SNAPSHOT</version>",
                    f"  <name>{svc}</name>",
                    "  <properties><java.version>17</java.version></properties>",
                    "  <parent>",
                    "    <groupId>org.springframework.boot</groupId>",
                    "    <artifactId>spring-boot-starter-parent</artifactId>",
                    "    <version>3.3.2</version>",
                    "  </parent>",
                    "  <dependencies>",
                    "    <dependency>",
                    "      <groupId>org.springframework.boot</groupId>",
                    "      <artifactId>spring-boot-starter-web</artifactId>",
                    "    </dependency>",
                    "  </dependencies>",
                    "</project>",
                    "",
                ]),
                f"{cls} pom",
            )
            if infra:
                add(
                    f"services/{pkg}/Dockerfile",
                    "\n".join([
                        "FROM eclipse-temurin:17-jre",
                        f"COPY target/{pkg}-0.1.0-SNAPSHOT.jar app.jar",
                        "ENTRYPOINT [\"java\",\"-jar\",\"/app.jar\"]",
                        "",
                    ]),
                    f"{cls} Dockerfile",
                )
        elif stack == "dotnet":
            base = f"services/{pkg}/src/{cls}"
            rule_methods = []
            for r in rules:
                note = f'    /// <summary>Provenance: approved rule {r["rule_id"]} — {r["statement"]}</summary>\n' if provenance else ""
                rule_methods.append(
                    f"{note}    public bool {r['method']}(IDictionary<string, object> input)\n"
                    f"        => input is {{ Count: > 0 }}; // {r['rule_id']}\n"
                )
            add(
                f"{base}/Program.cs",
                "\n".join([
                    "var builder = WebApplication.CreateBuilder(args);",
                    "builder.Services.AddControllers();",
                    f'builder.Services.AddSingleton<{cls}Rules>();',
                    "var app = builder.Build();",
                    "app.MapControllers();",
                    "app.Run();",
                    "",
                ]),
                f"{cls} Program",
            )
            add(
                f"{base}/{cls}Rules.cs",
                "\n".join([
                    "using System.Collections.Generic;",
                    "",
                    f"public sealed class {cls}Rules",
                    "{",
                    *rule_methods,
                    "}",
                    "",
                ]),
                f"{cls} rules",
            )
            add(
                f"{base}/{cls}.csproj",
                "\n".join([
                    '<Project Sdk="Microsoft.NET.Sdk.Web">',
                    "  <PropertyGroup>",
                    "    <TargetFramework>net8.0</TargetFramework>",
                    "    <Nullable>enable</Nullable>",
                    "  </PropertyGroup>",
                    "</Project>",
                    "",
                ]),
                f"{cls} project",
            )
        else:  # python
            base = f"services/{pkg}/app"
            rule_methods = []
            for r in rules:
                note = f'    # Provenance: approved rule {r["rule_id"]} — {r["statement"]}\n' if provenance else ""
                meth = re.sub(r"(?<!^)(?=[A-Z])", "_", r["method"]).lower()
                rule_methods.append(
                    f"{note}    def {meth}(self, payload: dict) -> bool:\n"
                    f'        """Implements {r["rule_id"]}."""\n'
                    f"        return bool(payload)\n"
                )
            add(
                f"{base}/main.py",
                "\n".join([
                    "from fastapi import FastAPI",
                    f"from .rules import {cls}Rules",
                    "",
                    f'app = FastAPI(title="{svc}", version="0.1.0")',
                    f"rules = {cls}Rules()",
                    "",
                    '@app.get("/health")',
                    "def health():",
                    '    return {"status": "ok", "service": "' + svc + '"}',
                    "",
                ]),
                f"{cls} main",
            )
            add(
                f"{base}/rules.py",
                "\n".join([
                    f'"""Rule methods for {svc} — generated by A12 ({tracking})."""',
                    "",
                    f"class {cls}Rules:",
                    *rule_methods,
                    "",
                ]),
                f"{cls} rules",
            )
            add(
                f"services/{pkg}/requirements.txt",
                "fastapi==0.115.0\nuvicorn[standard]==0.30.6\n",
                f"{cls} requirements",
            )
            if infra:
                add(
                    f"services/{pkg}/Dockerfile",
                    "\n".join([
                        "FROM python:3.12-slim",
                        "WORKDIR /app",
                        "COPY requirements.txt .",
                        "RUN pip install --no-cache-dir -r requirements.txt",
                        "COPY app ./app",
                        'CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]',
                        "",
                    ]),
                    f"{cls} Dockerfile",
                )

    return files


def ensure_a12_files(
    state: FactoryState,
    *,
    persist: Any | None = None,
    force: bool = False,
) -> dict[str, dict[str, str]]:
    """Return generated source files; rebuild from codegen metadata when missing."""
    inventory = state.inventory or {}
    codegen = dict(inventory.get("codegen") or {})
    files = codegen.get("source_files") or {}
    if isinstance(files, dict) and files and not force:
        return files

    stack = str(codegen.get("stack") or (state.generated or {}).get("stack") or "java")
    extras = codegen.get("extras") or (state.generated or {}).get("extras") or ["provenance", "infra"]
    if not isinstance(extras, list):
        extras = ["provenance", "infra"]
    files = build_a12_source_files(
        state,
        stack=stack,
        extras=[str(x) for x in extras],
        params={
            "a1_project_name": codegen.get("a1_project_name") or "",
            "a1_strategy": codegen.get("a1_strategy") or "",
            "a1_requirement": codegen.get("a1_requirement") or "",
            "sample_services": codegen.get("sample_services") or [],
        },
    )
    codegen["source_files"] = files
    codegen["source_file_count"] = len(files)
    codegen["tracking_id"] = a12_tracking_id(state.run_id)
    inventory["codegen"] = codegen
    state.inventory = inventory
    if state.generated is None or not isinstance(state.generated, dict):
        state.generated = {}
    state.generated = {**state.generated, **{k: v for k, v in codegen.items() if k != "source_files"}}
    state.generated["source_file_count"] = len(files)
    if persist is not None:
        persist.save(state)
    return files


def build_a12_zip(files: dict[str, dict[str, str]]) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        for meta in files.values():
            if not isinstance(meta, dict):
                continue
            path = str(meta.get("path") or meta.get("filename") or "file.txt")
            content = str(meta.get("content") or "")
            zf.writestr(path, content.encode("utf-8"))
    return buf.getvalue()


def github_auth_configured() -> bool:
    return bool((os.getenv("GITHUB_TOKEN") or os.getenv("GH_TOKEN") or "").strip())


def _github_token(override: str | None = None) -> str:
    if override and override.strip():
        return override.strip()
    return (os.getenv("GITHUB_TOKEN") or os.getenv("GH_TOKEN") or "").strip()


def _gh_json(method: str, url: str, token: str, body: dict[str, Any] | None = None) -> tuple[int, Any]:
    data = None if body is None else json.dumps(body).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        method=method,
        headers={
            "Accept": "application/vnd.github+json",
            "Authorization": f"Bearer {token}",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "amora-modernization-factory",
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=45) as resp:
            raw = resp.read().decode("utf-8") or "{}"
            return resp.status, json.loads(raw) if raw.strip() else {}
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        try:
            payload = json.loads(detail) if detail else {"message": str(exc)}
        except json.JSONDecodeError:
            payload = {"message": detail or str(exc)}
        return exc.code, payload


def parse_repo_slug(raw: str, default_owner: str = "") -> tuple[str, str]:
    text = (raw or "").strip().rstrip("/")
    if text.startswith("https://github.com/"):
        text = text[len("https://github.com/") :]
    if text.startswith("http://github.com/"):
        text = text[len("http://github.com/") :]
    if text.endswith(".git"):
        text = text[:-4]
    if "/" in text:
        owner, name = text.split("/", 1)
        return owner.strip(), name.strip()
    if default_owner:
        return default_owner, text
    raise ValueError("Repository must look like owner/name")


def push_a12_to_github(
    state: FactoryState,
    *,
    repo: str,
    branch: str = "main",
    private: bool = True,
    create_if_missing: bool = True,
    commit_message: str = "",
    token: str | None = None,
    persist: Any | None = None,
) -> dict[str, Any]:
    """Push generated A12 files to GitHub using a UI-supplied or env GITHUB_TOKEN."""
    resolved = _github_token(token)
    if not resolved:
        raise RuntimeError(
            "GitHub token is required. Paste a fine-grained or classic PAT "
            "(repo / Contents: Read and write) in the GitHub token field, then try again."
        )

    files = ensure_a12_files(state, persist=persist)
    if not files:
        raise RuntimeError("No generated source files to push — run Agent A12 first.")

    status, me = _gh_json("GET", "https://api.github.com/user", resolved)
    if status >= 400:
        raise RuntimeError(f"GitHub auth failed ({status}): {me.get('message') or me}")
    login = str(me.get("login") or "").strip()
    owner, name = parse_repo_slug(repo, default_owner=login)
    if not owner or not name:
        raise ValueError("Repository must look like owner/name")

    api_repo = f"https://api.github.com/repos/{urllib.parse.quote(owner)}/{urllib.parse.quote(name)}"
    status, repo_info = _gh_json("GET", api_repo, resolved)
    created = False
    if status == 404:
        if not create_if_missing:
            raise RuntimeError(f"Repository {owner}/{name} was not found.")
        create_url = "https://api.github.com/user/repos"
        if owner.lower() != login.lower():
            create_url = f"https://api.github.com/orgs/{urllib.parse.quote(owner)}/repos"
        status, repo_info = _gh_json(
            "POST",
            create_url,
            resolved,
            {
                "name": name,
                "private": bool(private),
                "description": f"AMORA A12 generated code ({a12_tracking_id(state.run_id)})",
                "auto_init": True,
            },
        )
        if status >= 400:
            raise RuntimeError(f"Could not create repo {owner}/{name}: {repo_info.get('message') or repo_info}")
        created = True
    elif status >= 400:
        raise RuntimeError(f"Could not read repo {owner}/{name}: {repo_info.get('message') or repo_info}")

    default_branch = str(branch or repo_info.get("default_branch") or "main")
    msg = commit_message.strip() or (
        f"chore(a12): publish generated services ({a12_tracking_id(state.run_id)})"
    )
    pushed: list[dict[str, str]] = []
    errors: list[str] = []

    for meta in files.values():
        if not isinstance(meta, dict):
            continue
        path = str(meta.get("path") or "")
        content = str(meta.get("content") or "")
        if not path:
            continue
        enc_path = "/".join(urllib.parse.quote(part) for part in path.split("/"))
        content_url = f"{api_repo}/contents/{enc_path}"
        sha = None
        get_status, existing = _gh_json(
            "GET",
            f"{content_url}?ref={urllib.parse.quote(default_branch)}",
            resolved,
        )
        if get_status == 200 and isinstance(existing, dict):
            sha = existing.get("sha")
        body: dict[str, Any] = {
            "message": msg,
            "content": base64.b64encode(content.encode("utf-8")).decode("ascii"),
            "branch": default_branch,
        }
        if sha:
            body["sha"] = sha
        put_status, put_result = _gh_json("PUT", content_url, resolved, body)
        if put_status >= 400:
            errors.append(f"{path}: {put_result.get('message') or put_result}")
            continue
        html = ""
        if isinstance(put_result, dict):
            content_obj = put_result.get("content") or {}
            if isinstance(content_obj, dict):
                html = str(content_obj.get("html_url") or "")
        pushed.append({"path": path, "url": html})

    if errors and not pushed:
        raise RuntimeError("GitHub push failed: " + "; ".join(errors[:3]))

    html_url = str(repo_info.get("html_url") or f"https://github.com/{owner}/{name}")
    record = {
        "published": True,
        "created_repo": created,
        "owner": owner,
        "repo": name,
        "full_name": f"{owner}/{name}",
        "branch": default_branch,
        "html_url": html_url,
        "tree_url": f"{html_url}/tree/{default_branch}",
        "file_count": len(pushed),
        "files": pushed,
        "errors": errors,
        "tracking_id": a12_tracking_id(state.run_id),
        "published_at": datetime.now(timezone.utc).isoformat(),
        "auth_configured": True,
        "token_source": "ui" if (token and token.strip()) else "env",
        "commit_message": msg,
    }

    inventory = state.inventory or {}
    codegen = dict(inventory.get("codegen") or {})
    codegen["github_publish"] = record
    inventory["codegen"] = codegen
    state.inventory = inventory
    if persist is not None:
        persist.save(state)
    return record
