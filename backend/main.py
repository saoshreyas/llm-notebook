"""
Back-compat entry: `python main.py` from backend/ starts the NotebookLM API.
Prefer: `notebooklm app run`
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

_BACKEND = Path(__file__).resolve().parent
if str(_BACKEND) not in sys.path:
    sys.path.insert(0, str(_BACKEND))

from app.main import app  # noqa: E402

__all__ = ["app"]

if __name__ == "__main__":
    import uvicorn

    host = os.environ.get("HOST", "0.0.0.0")
    port = int(os.environ.get("PORT", "8080"))
    print("NotebookLM API")
    print(f"  http://{host}:{port}/docs")
    uvicorn.run(app, host=host, port=port, log_level="info")
