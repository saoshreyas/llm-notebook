"""
Pure data classes for a parsed .wfl program.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import List, Optional


@dataclass
class Constraint:
    rule: str
    severity: str = "error"  # error | warning | info

    def __str__(self) -> str:
        return f"[{self.severity.upper()}] {self.rule}"


@dataclass
class Config:
    model: Optional[str] = None
    retries: Optional[int] = None
    backend: Optional[str] = None


@dataclass
class Node:
    name: str
    kind: str  # "prompt" | "code"
    prompt: Optional[str] = None
    code: Optional[str] = None
    intent: Optional[str] = None  # documentation only
    inputs: List[str] = field(default_factory=list)
    output_name: Optional[str] = None
    constraints: List[Constraint] = field(default_factory=list)
    retries: Optional[int] = None

    def __str__(self) -> str:
        lines = [f"node {self.name}:", f"  kind: {self.kind}"]
        if self.intent:
            lines.append(f"  intent: {self.intent!r}")
        if self.prompt:
            lines.append(f"  prompt: {self.prompt!r}")
        if self.code:
            lines.append(f"  code: |")
            for ln in self.code.splitlines():
                lines.append(f"    {ln}")
        if self.inputs:
            lines.append(f"  input: {', '.join(self.inputs)}")
        if self.output_name:
            lines.append(f"  output: {self.output_name}")
        for c in self.constraints:
            lines.append(f"  constraint {c.severity}: {c.rule}")
        if self.retries is not None:
            lines.append(f"  retries: {self.retries}")
        return "\n".join(lines)


@dataclass
class Workflow:
    name: str
    description: Optional[str] = None
    config: Config = field(default_factory=Config)
    global_constraints: List[Constraint] = field(default_factory=list)
    nodes: List[Node] = field(default_factory=list)

    def effective_retries(self, node: Node) -> int:
        if node.retries is not None:
            return node.retries
        if self.config.retries is not None:
            return self.config.retries
        return 3

    def effective_model(self) -> Optional[str]:
        return self.config.model

    def __str__(self) -> str:
        lines = [f"workflow {self.name}:"]
        if self.description:
            lines.append(f"  description: {self.description!r}")
        for node in self.nodes:
            for line in str(node).splitlines():
                lines.append("  " + line)
        return "\n".join(lines)


@dataclass
class Program:
    workflows: List[Workflow] = field(default_factory=list)

    def get(self, name: str) -> Optional[Workflow]:
        for w in self.workflows:
            if w.name == name:
                return w
        return None

    def __str__(self) -> str:
        return "\n\n".join(str(w) for w in self.workflows)
