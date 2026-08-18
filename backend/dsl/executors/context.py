"""Shared balloon / namespace helpers for all step kinds."""
from __future__ import annotations

from typing import List

from dsl.results import CellResult


def balloon_summary(balloon: List[CellResult]) -> str:
    if not balloon:
        return "[ No prior cells — this is the first node in the pipeline. ]"

    lines = ["=== BALLOON: verified cells so far ==="]
    for cell in balloon:
        kind = cell.step_kind
        lines += [
            "",
            f"-- node: {cell.node_name} ({kind}) --",
        ]
        if kind == "llm":
            lines.append(f"prompt : {cell.prompt or ''}")
        else:
            lines.append(f"intent : {cell.intent}")
        lines.append(f"output : {cell.output_type or 'unspecified'}")
        if kind == "code" and cell.code:
            lines.append("code:")
            lines.append(cell.code)
        if cell.exec_result:
            lines.append(f"runtime result: {cell.exec_result[:2000]}")
        if cell.exec_output:
            lines.append(f"runtime stdout: {cell.exec_output[:2000]}")
    lines.append("=== END BALLOON ===")
    return "\n".join(lines)


def input_context(shared_namespace: dict, inputs: List[str]) -> str:
    if not inputs:
        return "(no explicit inputs — use balloon context only)"
    lines = []
    for name in inputs:
        if name in shared_namespace:
            val = shared_namespace[name]
            lines.append(f"  {name} = {repr(val)[:4000]}")
        else:
            lines.append(f"  {name} = <not in scope yet>")
    return "\n".join(lines) if lines else "(inputs listed but empty)"
