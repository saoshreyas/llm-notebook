#!/usr/bin/env python3
"""
Pip-install usage sample:

  pip install -e .
  set OPENROUTER_API_KEY=sk-or-...
  python backend/examples/run_demo.py
"""
from __future__ import annotations

import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

import workflow_dsl  # noqa: F401 — registers language
from notebooklm import interpret

WFL = Path(__file__).with_name("research_agent.wfl")


def main() -> None:
    source = WFL.read_text(encoding="utf-8")
    result = interpret(
        "workflow",
        source,
        inputs={"task": "Explain what a semantic DSL interpreter is in one paragraph."},
        log=print,
    )
    print(result.summary())
    if result.success:
        final = result.namespace.get("result") or result.namespace.get("answer")
        print("\nFinal:", final)
    raise SystemExit(0 if result.success else 1)


if __name__ == "__main__":
    main()
