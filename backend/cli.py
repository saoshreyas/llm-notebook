"""
CLI entrypoint: run the FastAPI app (e.g. after `pip install` / `uv run`).
"""
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path


def main() -> None:
    backend_dir = Path(__file__).resolve().parent
    sys.path.insert(0, str(backend_dir))

    p = argparse.ArgumentParser(
        prog="llm-notebook",
        description="LLM Notebook API — start the HTTP server",
    )
    p.add_argument(
        "--host",
        default=os.environ.get("HOST", "0.0.0.0"),
        help="Bind address (default: 0.0.0.0 or $HOST)",
    )
    p.add_argument(
        "--port",
        type=int,
        default=int(os.environ.get("PORT", "8000")),
        help="Port (default: 8000 or $PORT)",
    )
    args = p.parse_args()

    import uvicorn
    from main import app

    print("LLM Notebook API")
    print(f"  http://{args.host}:{args.port}/docs")
    uvicorn.run(app, host=args.host, port=args.port, log_level="info")


if __name__ == "__main__":
    main()
