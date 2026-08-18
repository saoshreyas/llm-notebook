"""Pipeline run result types (shared by runtime and executors)."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import List, Optional


@dataclass
class CellResult:
    node_name:    str
    step_kind:    str = "code"          # "code" | "llm"
    intent:       str = ""
    prompt:       Optional[str] = None  # set for llm steps
    code:         str = ""
    verified:     bool = False
    violations:   List[str] = field(default_factory=list)
    attempts:     int = 0
    output_type:  Optional[str] = None
    duration_sec: float = 0.0
    executed:     bool = False
    exec_output:  Optional[str] = None
    exec_result:  Optional[str] = None
    exec_error:   Optional[str] = None

    def summary(self) -> str:
        status = "✅ PASS" if self.verified else "❌ FAIL"
        kind = self.step_kind.upper()
        lines = [
            f"{status}  [{self.node_name}] ({kind})  ({self.attempts} attempt(s), {self.duration_sec:.1f}s)",
        ]
        if self.step_kind == "llm":
            lines.append(f"  prompt: {(self.prompt or '')[:120]}")
        else:
            lines.append(f"  intent: {self.intent}")
        if self.violations:
            lines.append("  violations:")
            for v in self.violations:
                lines.append(f"    • {v}")
        if self.executed:
            if self.exec_error:
                lines.append(f"  exec error: {self.exec_error[:200]}")
            else:
                if self.exec_output:
                    lines.append(f"  output: {self.exec_output[:200]}")
                if self.exec_result:
                    lines.append(f"  result: {self.exec_result[:200]}")
        return "\n".join(lines)


@dataclass
class RunResult:
    pipeline_name: str
    cells:         List[CellResult]
    total_sec:     float
    success:       bool

    @property
    def balloon_size(self) -> int:
        return sum(1 for c in self.cells if c.verified)

    def summary(self) -> str:
        lines = [
            f"\n{'='*60}",
            f"  Pipeline : {self.pipeline_name}",
            f"  Result   : {'✅ ALL PASSED' if self.success else '⚠️  SOME FAILED'}",
            f"  Cells    : {self.balloon_size}/{len(self.cells)} verified",
            f"  Time     : {self.total_sec:.1f}s",
            f"{'='*60}",
        ]
        for cell in self.cells:
            lines.append(cell.summary())
        return "\n".join(lines)
