"""Hash-chained evidence ledger.

Every agent action and gate decision writes one append-only entry. Each entry
hashes the previous entry's hash, so tampering with any historical record
breaks verification for everything after it.
"""
from __future__ import annotations

import hashlib
import json
from dataclasses import asdict, dataclass, field
from datetime import datetime
from typing import Any


@dataclass
class LedgerEntry:
    seq: int
    run_id: str
    actor: str
    action: str
    payload: dict[str, Any]
    prev_hash: str
    hash: str = ""
    at: str = field(default_factory=lambda: datetime.utcnow().isoformat())

    def compute_hash(self) -> str:
        body = json.dumps(
            {
                "seq": self.seq, "run_id": self.run_id, "actor": self.actor,
                "action": self.action, "payload": self.payload,
                "prev_hash": self.prev_hash, "at": self.at,
            },
            sort_keys=True, default=str,
        )
        return hashlib.sha256(body.encode()).hexdigest()


class Ledger:
    """In-memory by default. Swap for the Postgres-backed one in production."""

    def __init__(self) -> None:
        self._entries: list[LedgerEntry] = []

    def record(self, run_id: str, actor: str, action: str, payload: dict[str, Any]) -> LedgerEntry:
        prev = self._entries[-1].hash if self._entries else "0" * 64
        entry = LedgerEntry(
            seq=len(self._entries) + 1, run_id=run_id, actor=actor,
            action=action, payload=payload, prev_hash=prev,
        )
        entry.hash = entry.compute_hash()
        self._entries.append(entry)
        return entry

    def for_run(self, run_id: str) -> list[dict[str, Any]]:
        return [asdict(e) for e in self._entries if e.run_id == run_id]

    def verify(self) -> tuple[bool, int | None]:
        """Returns (intact, first_broken_seq)."""
        prev = "0" * 64
        for entry in self._entries:
            if entry.prev_hash != prev or entry.compute_hash() != entry.hash:
                return False, entry.seq
            prev = entry.hash
        return True, None
