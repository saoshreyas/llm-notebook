"""Load repo-root .env into process environment (no-op if missing)."""
from __future__ import annotations

from pathlib import Path


def load_env() -> None:
    try:
        from dotenv import load_dotenv
    except ImportError:
        return
    # notebooklm/ -> backend/ -> repo root
    root = Path(__file__).resolve().parents[2]
    load_dotenv(root / ".env", override=False)
