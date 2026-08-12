"""Agent reasoning backends.

MockBackend is the default: deterministic, no API keys, works offline.

Live backends call OpenAI or Anthropic when FACTORY_BACKEND=live.
"""
from __future__ import annotations

import hashlib
import logging
import os
from functools import lru_cache
from pathlib import Path
from typing import Any

from app.agents.base import AgentBackend

logger = logging.getLogger(__name__)

_ENV_PATH = Path(__file__).resolve().parents[2] / ".env"


def _ensure_env() -> None:
    try:
        from dotenv import load_dotenv

        load_dotenv(_ENV_PATH, override=False)
    except Exception:  # pragma: no cover
        pass


_ensure_env()


def _tier_models() -> dict[str, str]:
    return {
        "small": os.getenv("MODEL_SMALL", os.getenv("OPENAI_MODEL", "gpt-4o-mini")),
        "medium": os.getenv("MODEL_MEDIUM", os.getenv("OPENAI_MODEL", "gpt-4o-mini")),
        "large": os.getenv("MODEL_LARGE", os.getenv("OPENAI_MODEL", "gpt-4o-mini")),
    }


TIER_COST_PER_1K = {"small": 0.001, "medium": 0.004, "large": 0.018}


class MockBackend(AgentBackend):
    """Deterministic. Same input, same output, every time."""

    async def complete(
        self, agent_id: str, prompt: str, *, tier: str = "medium", **kw: Any
    ) -> dict[str, Any]:
        seed = int(hashlib.sha256(f"{agent_id}:{prompt}".encode()).hexdigest()[:8], 16)
        tokens_in = 1200 + seed % 4000
        tokens_out = 400 + seed % 1200
        cost = round((tokens_in + tokens_out) / 1000 * TIER_COST_PER_1K.get(tier, 0.004), 4)
        return {
            "text": f"[mock:{agent_id}] {prompt[:80]}",
            "tokens_in": tokens_in,
            "tokens_out": tokens_out,
            "cost_usd": cost,
            "model": f"mock-{tier}",
        }


class OpenAIBackend(AgentBackend):
    """Calls OpenAI Chat Completions. Requires OPENAI_API_KEY."""

    def __init__(self) -> None:
        try:
            from openai import AsyncOpenAI
        except ImportError as exc:  # pragma: no cover
            raise RuntimeError(
                "LLM_PROVIDER=openai requires the openai package. "
                "pip install openai"
            ) from exc
        key = os.environ.get("OPENAI_API_KEY", "").strip().strip('"').strip("'")
        if not key or key.startswith("sk-REPLACE"):
            raise RuntimeError("OPENAI_API_KEY is missing. Set it in backend/.env")
        # Default SDK timeout can be too aggressive under Windows/proxy load for long JSON briefs.
        self._client = AsyncOpenAI(api_key=key, timeout=90.0)

    async def complete(
        self, agent_id: str, prompt: str, *, tier: str = "medium", **kw: Any
    ) -> dict[str, Any]:
        models = _tier_models()
        model = models.get(tier, models["medium"])
        create_kwargs: dict[str, Any] = {
            "model": model,
            "max_tokens": 4096,
            "messages": [{"role": "user", "content": prompt}],
        }
        if kw.get("response_format"):
            create_kwargs["response_format"] = kw["response_format"]
        try:
            resp = await self._client.chat.completions.create(**create_kwargs)
        except Exception as exc:
            # Quota / rate-limit / network must not crash the UI — callers use catalog fallbacks.
            logger.warning("OpenAI complete failed for %s (%s): %s", agent_id, model, exc)
            return {
                "text": "",
                "tokens_in": 0,
                "tokens_out": 0,
                "cost_usd": 0.0,
                "model": f"{model}-fallback",
                "error": str(exc),
            }
        choice = resp.choices[0].message.content or ""
        usage = resp.usage
        tin = getattr(usage, "prompt_tokens", 0) or 0
        tout = getattr(usage, "completion_tokens", 0) or 0
        return {
            "text": choice,
            "tokens_in": tin,
            "tokens_out": tout,
            "cost_usd": round((tin + tout) / 1000 * TIER_COST_PER_1K.get(tier, 0.004), 4),
            "model": model,
        }


class AnthropicBackend(AgentBackend):
    """Calls Anthropic Messages API. Requires ANTHROPIC_API_KEY."""

    def __init__(self) -> None:
        try:
            from anthropic import AsyncAnthropic
        except ImportError as exc:  # pragma: no cover
            raise RuntimeError(
                "LLM_PROVIDER=anthropic requires the anthropic package. "
                "pip install anthropic"
            ) from exc
        self._client = AsyncAnthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

    async def complete(
        self, agent_id: str, prompt: str, *, tier: str = "medium", **kw: Any
    ) -> dict[str, Any]:
        models = _tier_models()
        model = models.get(tier, models["medium"])
        try:
            resp = await self._client.messages.create(
                model=model,
                max_tokens=4096,
                messages=[{"role": "user", "content": prompt}],
            )
        except Exception as exc:
            logger.warning("Anthropic complete failed for %s (%s): %s", agent_id, model, exc)
            return {
                "text": "",
                "tokens_in": 0,
                "tokens_out": 0,
                "cost_usd": 0.0,
                "model": f"{model}-fallback",
                "error": str(exc),
            }
        text = "".join(b.text for b in resp.content if getattr(b, "type", "") == "text")
        tin, tout = resp.usage.input_tokens, resp.usage.output_tokens
        return {
            "text": text,
            "tokens_in": tin,
            "tokens_out": tout,
            "cost_usd": round((tin + tout) / 1000 * TIER_COST_PER_1K.get(tier, 0.004), 4),
            "model": model,
        }


@lru_cache(maxsize=1)
def get_backend() -> AgentBackend:
    """Return a singleton backend. Falls back to mock if live credentials fail."""
    mode = os.getenv("FACTORY_BACKEND", "mock").strip().lower()
    if mode != "live":
        return MockBackend()

    provider = os.getenv("LLM_PROVIDER", "openai").strip().lower()
    try:
        if provider == "anthropic":
            backend: AgentBackend = AnthropicBackend()
        else:
            backend = OpenAIBackend()
        logger.info("Using live backend provider=%s", provider)
        return backend
    except Exception as exc:
        logger.warning(
            "Live backend (%s) unavailable (%s). Falling back to mock so the run can continue.",
            provider,
            exc,
        )
        return MockBackend()
