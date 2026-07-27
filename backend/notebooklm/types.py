"""
Shared result types and language plugin protocol for NotebookLM.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List, Optional, Protocol, runtime_checkable


@dataclass
class NodeResult:
    """Result of interpreting a single workflow node."""

    node_name: str
    kind: str  # "prompt" | "code"
    success: bool
    attempts: int
    duration_sec: float
    output_name: Optional[str] = None
    output_value: Optional[str] = None  # stringified for API/UI
    stdout: Optional[str] = None
    error: Optional[str] = None
    violations: List[str] = field(default_factory=list)
    prompt_rendered: Optional[str] = None  # for prompt nodes (debug/UI)
    code: Optional[str] = None  # user-authored code for code nodes

    def summary(self) -> str:
        status = "OK" if self.success else "FAIL"
        lines = [
            f"{status}  [{self.node_name}] kind={self.kind} "
            f"({self.attempts} attempt(s), {self.duration_sec:.1f}s)",
        ]
        if self.violations:
            lines.append("  violations:")
            for v in self.violations:
                lines.append(f"    - {v}")
        if self.error:
            lines.append(f"  error: {self.error[:300]}")
        if self.output_value:
            lines.append(f"  output: {self.output_value[:300]}")
        if self.stdout:
            lines.append(f"  stdout: {self.stdout[:300]}")
        return "\n".join(lines)


@dataclass
class RunResult:
    """Result of interpreting a whole workflow / program unit."""

    workflow_name: str
    success: bool
    total_sec: float
    nodes: List[NodeResult] = field(default_factory=list)
    namespace: Dict[str, Any] = field(default_factory=dict)

    @property
    def balloon_size(self) -> int:
        return sum(1 for n in self.nodes if n.success)

    def summary(self) -> str:
        lines = [
            f"\n{'=' * 60}",
            f"  Workflow : {self.workflow_name}",
            f"  Result   : {'ALL PASSED' if self.success else 'SOME FAILED'}",
            f"  Nodes    : {self.balloon_size}/{len(self.nodes)} ok",
            f"  Time     : {self.total_sec:.1f}s",
            f"{'=' * 60}",
        ]
        for node in self.nodes:
            lines.append(node.summary())
        return "\n".join(lines)


@dataclass
class HistoryItem:
    """Prior notebook cell context for NL→DSL and balloon seeding."""

    natural_language: Optional[str] = None
    dsl_source: Optional[str] = None
    summary: Optional[str] = None
    outputs: Optional[Dict[str, str]] = None


@runtime_checkable
class Language(Protocol):
    """Plugin contract: parse source → AST, interpret AST → RunResult."""

    name: str

    def parse(self, source: str) -> Any:
        ...

    def interpret(
        self,
        ast: Any,
        *,
        llm: Callable[[List[dict], float], str],
        inputs: Optional[Dict[str, Any]] = None,
        balloon_seed: Optional[Dict[str, Any]] = None,
        log: Callable[[str], None] = print,
        workflow: Optional[str] = None,
    ) -> RunResult:
        ...

    def check_syntax(self, source: str) -> None:
        """Raise on parse failure; return None on success."""
        ...
