"""Application entry point."""
from __future__ import annotations

# Load .env before any app imports that read os.environ.
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env", override=False)

import logging
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.agents import load_all
from app.api.routes import router

logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))

load_all()

app = FastAPI(
    title="Modernization Factory",
    version="0.1.0",
    description=(
        "18 agents, 9 human gates, 12 MCP servers. "
        "Runs against mock backends by default — no API keys required."
    ),
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api")


@app.get("/")
def root() -> dict[str, str]:
    """Point browsers at the UI and docs — the API itself lives under /api."""
    return {
        "service": "Modernization Factory API",
        "status": "ok",
        "ui": "http://127.0.0.1:5188",
        "docs": "http://127.0.0.1:8000/docs",
        "health": "http://127.0.0.1:8000/health",
    }


@app.get("/health")
def health() -> dict[str, str]:
    return {
        "status": "ok",
        "backend": os.getenv("FACTORY_BACKEND", "mock"),
        "llm_provider": os.getenv("LLM_PROVIDER", "openai"),
        "openai_key_set": "yes" if os.getenv("OPENAI_API_KEY", "").strip() else "no",
    }
