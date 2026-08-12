"""A7 documentation file resolution, download, and Confluence publish helpers."""
from __future__ import annotations

import base64
import json
import os
import re
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from html import escape
from typing import Any

from app.core.types import FactoryState


def a7_tracking_id(run_id: str) -> str:
    """Stable tracking ID tying Confluence pages to this factory run instance."""
    safe = run_id.replace(" ", "-").upper()
    return f"AMORA-A7-{safe}"


def normalize_confluence_base_url(raw: str | None = None) -> str:
    """Normalize wiki root, e.g. strip /home or trailing /display paths."""
    base = (raw or os.getenv("CONFLUENCE_BASE_URL") or "https://confluence.example.com").strip()
    base = base.rstrip("/")
    # Common paste mistakes from Atlassian "home" deep-links
    for suffix in ("/home", "/wiki/home", "/display", "/spaces"):
        if base.lower().endswith(suffix):
            base = base[: -len(suffix)].rstrip("/")
    if base.endswith("/wiki"):
        return base
    # Cloud sites often need /wiki for REST + page links
    if "atlassian.net" in base.lower() and "/wiki" not in base.lower():
        return f"{base}/wiki"
    return base


def confluence_search_url(base_url: str, tracking_id: str) -> str:
    """UI search URL so operators can find the pack by tracking ID."""
    q = urllib.parse.quote(tracking_id)
    return f"{base_url.rstrip('/')}/search?text={q}"


def confluence_space_url(base_url: str, space_key: str) -> str:
    return f"{base_url.rstrip('/')}/spaces/{urllib.parse.quote(space_key)}"


def _site_origin_from_wiki(base_url: str) -> str:
    """https://x.atlassian.net/wiki -> https://x.atlassian.net"""
    base = base_url.rstrip("/")
    return re.sub(r"/wiki$", "", base, flags=re.IGNORECASE)


def resolve_confluence_cloud_id(base_url: str | None = None) -> str:
    """Cloud ID for scoped API tokens (api.atlassian.com gateway)."""
    explicit = (os.getenv("CONFLUENCE_CLOUD_ID") or "").strip()
    if explicit:
        return explicit
    origin = _site_origin_from_wiki(normalize_confluence_base_url(base_url))
    if "atlassian.net" not in origin.lower():
        return ""
    req = urllib.request.Request(
        f"{origin}/_edge/tenant_info",
        headers={"Accept": "application/json"},
        method="GET",
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            info = json.loads(resp.read().decode("utf-8") or "{}")
        return str(info.get("cloudId") or info.get("cloud_id") or "").strip()
    except Exception:  # noqa: BLE001
        return ""


def confluence_rest_roots(base_url: str | None = None) -> list[str]:
    """Candidate REST roots: scoped gateway first, then classic site URL."""
    wiki = normalize_confluence_base_url(base_url)
    roots: list[str] = []
    cloud_id = resolve_confluence_cloud_id(wiki)
    if cloud_id:
        roots.append(f"https://api.atlassian.com/ex/confluence/{cloud_id}/wiki/rest/api")
    roots.append(f"{wiki}/rest/api")
    # de-dupe preserving order
    seen: set[str] = set()
    out: list[str] = []
    for r in roots:
        if r not in seen:
            seen.add(r)
            out.append(r)
    return out


def _format_confluence_http_error(code: int, detail: str) -> str:
    """Turn Tomcat/HTML or scoped-token JSON into an operator-friendly message."""
    text = (detail or "").strip()
    lower = text.lower()
    if "scope does not match" in lower:
        return (
            f"Confluence API {code}: scoped API token is missing Confluence permissions. "
            "Create a classic API token (no scopes) at https://id.atlassian.com/manage-profile/security/api-tokens "
            "OR a scoped token with Confluence write scopes (e.g. write:page:confluence, read:page:confluence, "
            "read:space:confluence), then set CONFLUENCE_API_KEY in backend/.env and restart the API."
        )
    if code == 401 or "unauthorized" in lower:
        return (
            f"Confluence API {code}: authentication failed for CONFLUENCE_EMAIL / CONFLUENCE_API_KEY. "
            "Use the Atlassian account email that owns the token. "
            "Scoped tokens must call api.atlassian.com (handled automatically) and need Confluence scopes; "
            "classic tokens work against your site URL. Regenerate the token if it was revoked."
        )
    if "<html" in lower or "<!doctype" in lower:
        # Avoid dumping Tomcat error pages into the UI
        title = "Unauthorized" if code == 401 else f"HTTP {code}"
        m = re.search(r"<title>(.*?)</title>", text, flags=re.IGNORECASE | re.DOTALL)
        if m:
            title = re.sub(r"\s+", " ", m.group(1)).strip()[:120]
        return f"Confluence API {code}: {title}"
    # Prefer JSON message field when present
    try:
        parsed = json.loads(text)
        if isinstance(parsed, dict):
            msg = parsed.get("message") or parsed.get("errorMessage") or parsed.get("error")
            if msg:
                return f"Confluence API {code}: {msg}"
    except json.JSONDecodeError:
        pass
    compact = re.sub(r"\s+", " ", text)[:280]
    return f"Confluence API {code}: {compact}"


def _content_to_storage_html(title: str, tracking_id: str, content: str, filename: str) -> str:
    body = escape(content or "")
    return (
        f"<h1>{escape(title)}</h1>"
        f"<p><strong>Tracking ID:</strong> {escape(tracking_id)}</p>"
        f"<p><em>Source artefact:</em> {escape(filename)}</p>"
        f"<hr/>"
        f"<pre>{body}</pre>"
    )


def _confluence_request(
    method: str,
    url: str,
    *,
    email: str,
    api_key: str,
    payload: dict[str, Any] | None = None,
) -> dict[str, Any]:
    data = None
    headers = {
        "Accept": "application/json",
        "Authorization": "Basic "
        + base64.b64encode(f"{email}:{api_key}".encode("utf-8")).decode("ascii"),
    }
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=45) as resp:
            raw = resp.read().decode("utf-8")
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(_format_confluence_http_error(exc.code, detail)) from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(f"Confluence unreachable: {exc.reason}") from exc


def select_confluence_api_root(email: str, api_key: str, base_url: str | None = None) -> str:
    """Pick the REST root that accepts this token (scoped gateway vs classic site)."""
    roots = confluence_rest_roots(base_url)
    errors: list[Exception] = []
    for root in roots:
        try:
            _confluence_request(
                "GET",
                f"{root}/user/current",
                email=email,
                api_key=api_key,
            )
            return root
        except Exception as exc:  # noqa: BLE001
            errors.append(exc)
    if not errors:
        raise RuntimeError("No Confluence REST API root configured")
    # Prefer scoped-token guidance when present
    for exc in errors:
        msg = str(exc)
        if "missing Confluence permissions" in msg or "scope does not match" in msg.lower():
            raise RuntimeError(msg) from exc
    raise RuntimeError(str(errors[0])) from errors[0]


def _page_web_url(base_url: str, page: dict[str, Any], space_key: str) -> str:
    links = page.get("_links") or {}
    webui = str(links.get("webui") or "").strip()
    base = base_url.rstrip("/")
    if webui:
        if webui.startswith("http"):
            return webui
        if webui.startswith("/wiki"):
            # base already ends with /wiki
            root = re.sub(r"/wiki$", "", base)
            return f"{root}{webui}"
        return f"{base}{webui if webui.startswith('/') else '/' + webui}"
    page_id = str(page.get("id") or "")
    if page_id:
        return f"{base}/spaces/{urllib.parse.quote(space_key)}/pages/{page_id}"
    return confluence_space_url(base, space_key)


def ensure_a7_files(
    state: FactoryState,
    *,
    persist: Any | None = None,
) -> dict[str, dict[str, str]]:
    """Return downloadable A7 files; rebuild from documentation metadata if missing."""
    from app.agents.discovery import _a7_document_files

    inventory = state.inventory or {}
    documentation = dict(inventory.get("documentation") or {})
    files = documentation.get("files") or {}
    if isinstance(files, dict) and files:
        return files

    documents = documentation.get("documents") or []
    kg = documentation.get("knowledge_graph") or {}
    if not documents or not isinstance(documents, list):
        documents = [
            {"id": "overview", "label": "System overview", "value": 34, "unit": "pages", "produced": True},
            {"id": "modules", "label": "Module details", "value": 247, "unit": "pages", "produced": True},
            {"id": "diagrams", "label": "Architectural diagrams", "value": 89, "unit": "pages", "produced": True},
            {"id": "dictionary", "label": "Technical dictionary", "value": 148, "unit": "pages", "produced": True},
            {"id": "runbooks", "label": "Runbooks for operations", "value": 63, "unit": "pages", "produced": True},
            {"id": "confluence", "label": "Confluence documentation", "value": 581, "unit": "pages", "produced": True},
        ]
        documentation["documents"] = documents

    intake = inventory.get("intake") or {}
    app = inventory.get("app") or {}
    a7_params: dict[str, Any] = {}
    if persist is not None and hasattr(persist, "get_params"):
        a7_params = persist.get_params(state.run_id, "A7") or {}

    project = str(
        intake.get("project_name")
        or app.get("name")
        or app.get("project_name")
        or state.app_id
        or "initiative"
    )
    tracking_id = str(documentation.get("tracking_id") or a7_tracking_id(state.run_id))
    files = _a7_document_files(
        project=project,
        category_id=str(documentation.get("category_id") or intake.get("category_id") or ""),
        prior=str(documentation.get("prior_agent_id") or a7_params.get("prior_agent_id") or "prior agent"),
        publish=str(documentation.get("publish") or a7_params.get("publish") or "markdown"),
        depth=str(documentation.get("depth") or a7_params.get("depth") or "standard"),
        documents=documents,
        kg=kg if isinstance(kg, dict) else {},
        headline=str(documentation.get("result_headline") or a7_params.get("result_headline") or ""),
        body=str(documentation.get("result_body") or a7_params.get("result_body") or ""),
        requirement=str(a7_params.get("a1_requirement") or intake.get("why_modernize") or ""),
        strategy=str(a7_params.get("a1_strategy") or intake.get("strategy_short") or ""),
        tracking_id=tracking_id,
        run_id=state.run_id,
    )

    documentation["files"] = files
    documentation["tracking_id"] = tracking_id
    inventory["documentation"] = documentation
    state.inventory = inventory
    if persist is not None and hasattr(persist, "save"):
        persist.save(state)
    return files


def publish_a7_confluence(
    state: FactoryState,
    permissions: list[str],
    *,
    persist: Any | None = None,
) -> dict[str, Any]:
    """Publish produced A7 documents to Confluence with instance tracking + live page URLs."""
    files = ensure_a7_files(state, persist=persist)
    inventory = state.inventory or {}
    documentation = dict(inventory.get("documentation") or {})
    tracking_id = str(documentation.get("tracking_id") or a7_tracking_id(state.run_id))

    perms = {p.strip().lower() for p in permissions if p}
    if not perms:
        perms = {"read", "write", "admin"}

    base_url = normalize_confluence_base_url()
    space_key = (os.getenv("CONFLUENCE_SPACE_KEY") or "AMORA").strip() or "AMORA"
    confluence_email = (os.getenv("CONFLUENCE_EMAIL") or "").strip().strip('"').strip("'")
    confluence_api_key = (os.getenv("CONFLUENCE_API_KEY") or "").strip().strip('"').strip("'")
    auth_configured = bool(confluence_api_key and confluence_email)
    intake = inventory.get("intake") or {}
    project = str(intake.get("project_name") or state.app_id or "initiative")

    perm_matrix = {
        "read": "read" in perms or "admin" in perms,
        "write": "write" in perms or "admin" in perms,
        "admin": "admin" in perms,
    }

    search_url = confluence_search_url(base_url, tracking_id)
    space_url = confluence_space_url(base_url, space_key)
    pack_title = f"{tracking_id} · {project} documentation"
    pack_url = search_url
    parent_confluence_id: str | None = None
    api_error: str | None = None
    live = False
    api_root_used: str | None = None

    pages: list[dict[str, Any]] = []

    if auth_configured:
        try:
            # Reload .env so freshly pasted tokens are picked up without a full process restart
            try:
                from dotenv import load_dotenv
                from pathlib import Path

                load_dotenv(Path(__file__).resolve().parents[2] / ".env", override=True)
                confluence_email = (os.getenv("CONFLUENCE_EMAIL") or confluence_email).strip().strip('"').strip("'")
                confluence_api_key = (
                    (os.getenv("CONFLUENCE_API_KEY") or confluence_api_key).strip().strip('"').strip("'")
                )
                space_key = (os.getenv("CONFLUENCE_SPACE_KEY") or space_key).strip() or space_key
                base_url = normalize_confluence_base_url()
            except Exception:  # noqa: BLE001
                pass

            api_root = select_confluence_api_root(confluence_email, confluence_api_key, base_url)
            api_root_used = api_root
            parent_body = (
                f"<h1>{escape(pack_title)}</h1>"
                f"<p><strong>Tracking ID:</strong> {escape(tracking_id)}</p>"
                f"<p><strong>Run ID:</strong> {escape(state.run_id)}</p>"
                f"<p><strong>Project:</strong> {escape(project)}</p>"
                f"<p><strong>Permissions:</strong> "
                f"Read={'yes' if perm_matrix['read'] else 'no'}, "
                f"Write={'yes' if perm_matrix['write'] else 'no'}, "
                f"Admin={'yes' if perm_matrix['admin'] else 'no'}</p>"
                f"<p>Child pages below hold the generated documentation artefacts. "
                f"Search Confluence for <code>{escape(tracking_id)}</code> to find this pack.</p>"
            )
            parent = _confluence_request(
                "POST",
                f"{api_root}/content",
                email=confluence_email,
                api_key=confluence_api_key,
                payload={
                    "type": "page",
                    "title": pack_title[:255],
                    "space": {"key": space_key},
                    "body": {
                        "storage": {
                            "value": parent_body,
                            "representation": "storage",
                        }
                    },
                },
            )
            parent_confluence_id = str(parent.get("id") or "") or None
            pack_url = _page_web_url(base_url, parent, space_key)
            live = True

            for doc_id, meta in files.items():
                if not isinstance(meta, dict):
                    continue
                label = str(meta.get("label") or doc_id)
                filename = str(meta.get("filename") or f"{doc_id}.txt")
                child_title = f"{tracking_id} · {label}"[:255]
                storage = _content_to_storage_html(
                    child_title,
                    tracking_id,
                    str(meta.get("content") or ""),
                    filename,
                )
                child_payload: dict[str, Any] = {
                    "type": "page",
                    "title": child_title,
                    "space": {"key": space_key},
                    "body": {
                        "storage": {
                            "value": storage,
                            "representation": "storage",
                        }
                    },
                }
                if parent_confluence_id:
                    child_payload["ancestors"] = [{"id": parent_confluence_id}]
                child = _confluence_request(
                    "POST",
                    f"{api_root}/content",
                    email=confluence_email,
                    api_key=confluence_api_key,
                    payload=child_payload,
                )
                pages.append({
                    "doc_id": doc_id,
                    "label": label,
                    "filename": filename,
                    "page_id": str(child.get("id") or f"{tracking_id}-{doc_id}"),
                    "url": _page_web_url(base_url, child, space_key),
                    "permissions": dict(perm_matrix),
                })
        except Exception as exc:  # noqa: BLE001
            api_error = str(exc)
            live = False
            pages = []

    if not pages:
        # Staged / fallback links — still open Confluence search by tracking ID
        for doc_id, meta in files.items():
            if not isinstance(meta, dict):
                continue
            slug = doc_id.replace("_", "-")
            page_id = f"{tracking_id}-{slug}"
            pages.append({
                "doc_id": doc_id,
                "label": meta.get("label") or doc_id,
                "filename": meta.get("filename") or f"{doc_id}.txt",
                "page_id": page_id,
                "url": search_url,
                "permissions": dict(perm_matrix),
            })
        if not pack_url:
            pack_url = search_url

    published_at = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    status = "published" if live else ("staged" if not api_error else "error")
    note_parts = [
        f"Documents tagged with tracking ID {tracking_id}.",
        "Open the Confluence pack link or search by tracking ID to review stored docs.",
    ]
    if api_error:
        note_parts.append(f"Live publish failed ({api_error}). Showing search links by tracking ID.")
    elif not auth_configured:
        note_parts.append(
            "Set CONFLUENCE_EMAIL and CONFLUENCE_API_KEY in backend/.env to push live pages."
        )

    record: dict[str, Any] = {
        "tracking_id": tracking_id,
        "run_id": state.run_id,
        "agent_id": "A7",
        "project": project,
        "space_key": space_key,
        "base_url": base_url,
        "published_at": published_at,
        "permissions_requested": sorted(perms),
        "permissions": perm_matrix,
        "pages": pages,
        "page_count": len(pages),
        "status": status,
        "published": live or bool(pages),
        "auth_configured": auth_configured,
        "auth_email_set": bool(confluence_email),
        "pack_url": pack_url,
        "search_url": search_url,
        "space_url": space_url,
        "parent_page_id": parent_confluence_id,
        "live": live,
        "api_root": api_root_used,
        "api_error": api_error,
        "note": " ".join(note_parts),
    }

    documentation["confluence_publish"] = record
    documentation["tracking_id"] = tracking_id
    inventory["documentation"] = documentation
    state.inventory = inventory
    if persist is not None and hasattr(persist, "save"):
        persist.save(state)
    return record
