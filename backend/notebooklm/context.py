"""
Balloon / notebook context: accumulated node outputs across a run (and prior cells).
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from notebooklm.types import HistoryItem, NodeResult


@dataclass
class Balloon:
    """Accumulated successful node outputs (name → value)."""

    values: Dict[str, Any] = field(default_factory=dict)
    history: List[NodeResult] = field(default_factory=list)

    def commit(self, result: NodeResult, value: Any = None) -> None:
        if not result.success:
            return
        self.history.append(result)
        name = result.output_name or result.node_name
        if value is not None:
            self.values[name] = value
        elif result.output_value is not None:
            self.values[name] = result.output_value

    def as_prompt_vars(self) -> Dict[str, Any]:
        return dict(self.values)

    def summary_text(self) -> str:
        if not self.history:
            return "[ No prior nodes — this is the first node. ]"
        lines = ["=== BALLOON: prior node outputs ==="]
        for node in self.history:
            lines += [
                "",
                f"-- node: {node.node_name} ({node.kind}) --",
            ]
            if node.output_name:
                lines.append(f"bound as: {node.output_name}")
            if node.output_value:
                lines.append(f"value: {node.output_value[:500]}")
            if node.stdout:
                lines.append(f"stdout: {node.stdout[:300]}")
        lines.append("=== END BALLOON ===")
        return "\n".join(lines)


def format_notebook_history(history: Optional[List[HistoryItem]]) -> str:
    if not history:
        return "(no prior cells — this is the first request.)"
    parts: List[str] = []
    for i, h in enumerate(history, 1):
        bits = [f"--- prior cell {i} ---"]
        if h.natural_language:
            bits.append(f"Natural language: {h.natural_language}")
        if h.dsl_source:
            bits.append(f"Workflow DSL (.wfl):\n{h.dsl_source}")
        if h.summary:
            bits.append(f"Notes: {h.summary}")
        if h.outputs:
            bits.append("Outputs:")
            for k, v in h.outputs.items():
                bits.append(f"  {k}: {v[:300]}")
        parts.append("\n".join(bits))
    return "\n\n".join(parts)


def balloon_seed_from_history(
    history: Optional[List[HistoryItem]],
) -> Dict[str, Any]:
    """Flatten prior cell outputs into an initial balloon namespace."""
    seed: Dict[str, Any] = {}
    if not history:
        return seed
    for h in history:
        if h.outputs:
            seed.update(h.outputs)
    return seed
