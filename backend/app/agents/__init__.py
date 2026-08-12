"""Agent package. Importing the submodules populates the registry."""
from __future__ import annotations

_LOADED = False


def load_all() -> None:
    """Import every agent module so the @register decorators fire."""
    global _LOADED
    if _LOADED:
        return
    from app.agents import assurance, discovery, engineering  # noqa: F401

    _LOADED = True


__all__ = ["load_all"]
