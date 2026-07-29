"""
CLI: `notebooklm app run` and `notebooklm interpret <file.wfl>`.
"""
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path


def _ensure_backend_path() -> Path:
    backend_dir = Path(__file__).resolve().parent.parent
    if str(backend_dir) not in sys.path:
        sys.path.insert(0, str(backend_dir))
    return backend_dir


def _parse_inputs(pairs: list[str] | None) -> dict:
    out: dict = {}
    if not pairs:
        return out
    for item in pairs:
        if "=" not in item:
            raise SystemExit(f"Invalid --input {item!r}; expected key=value")
        k, v = item.split("=", 1)
        out[k.strip()] = v
    return out


def cmd_app_run(args: argparse.Namespace) -> None:
    _ensure_backend_path()
    import uvicorn

    # Register default language
    import workflow_dsl  # noqa: F401

    print("NotebookLM API")
    print(f"  http://{args.host}:{args.port}/docs")
    uvicorn.run(
        "app.main:app",
        host=args.host,
        port=args.port,
        log_level="info",
    )


def cmd_interpret(args: argparse.Namespace) -> None:
    _ensure_backend_path()
    import workflow_dsl  # noqa: F401
    from notebooklm.registry import interpret

    path = Path(args.file)
    if not path.exists():
        raise SystemExit(f"File not found: {path}")
    source = path.read_text(encoding="utf-8")
    inputs = _parse_inputs(args.input)
    result = interpret(
        "workflow",
        source,
        inputs=inputs,
        workflow=args.workflow,
        log=print,
    )
    print(result.summary())
    raise SystemExit(0 if result.success else 1)


def main(argv: list[str] | None = None) -> None:
    from notebooklm.env import load_env

    load_env()

    parser = argparse.ArgumentParser(
        prog="notebooklm",
        description="NotebookLM — semantic DSL notebook host",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    app_p = sub.add_parser("app", help="Application server commands")
    app_sub = app_p.add_subparsers(dest="app_command", required=True)
    run_p = app_sub.add_parser("run", help="Start the FastAPI notebook server")
    run_p.add_argument(
        "--host",
        default=os.environ.get("HOST", "0.0.0.0"),
        help="Bind address (default: 0.0.0.0 or $HOST)",
    )
    run_p.add_argument(
        "--port",
        type=int,
        default=int(os.environ.get("PORT", "8000")),
        help="Port (default: 8000 or $PORT)",
    )
    run_p.set_defaults(func=cmd_app_run)

    # Allow `notebooklm app run` via nested parse: we handle manually below
    interp = sub.add_parser("interpret", help="Run a .wfl workflow file")
    interp.add_argument("file", help="Path to .wfl source")
    interp.add_argument(
        "--input",
        action="append",
        default=[],
        help="Workflow input as key=value (repeatable)",
    )
    interp.add_argument(
        "--workflow",
        default=None,
        help="Workflow name if the file defines more than one",
    )
    interp.set_defaults(func=cmd_interpret)

    args = parser.parse_args(argv)

    # Nested: notebooklm app run
    if args.command == "app":
        if getattr(args, "app_command", None) == "run":
            cmd_app_run(args)
            return
        raise SystemExit("Usage: notebooklm app run [--host] [--port]")

    func = getattr(args, "func", None)
    if func is None:
        parser.print_help()
        raise SystemExit(2)
    func(args)


if __name__ == "__main__":
    main()
