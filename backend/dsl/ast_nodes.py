"""
notebookdsl.ast
~~~~~~~~~~~~~~~
Pure data classes representing a parsed .ndsl program.
No LLM logic here — this is just structure.
"""
from __future__ import annotations
from dataclasses import dataclass, field
from typing import List, Optional


@dataclass
class Constraint:
    rule: str
    severity: str = "error"   # "error" | "warning" | "info"

    def __str__(self):
        return f"[{self.severity.upper()}] {self.rule}"


@dataclass
class Config:
    model:   Optional[str] = None
    retries: Optional[int] = None
    backend: Optional[str] = None


@dataclass
class Node:
    name:        str
    kind:        str = "code"     # "code" | "llm"
    intent:      str = ""
    prompt:      Optional[str] = None   # required when kind == "llm"
    inputs:      List[str]       = field(default_factory=list)
    output_type: Optional[str]   = None
    constraints: List[Constraint] = field(default_factory=list)
    retries:     Optional[int]   = None   # overrides pipeline-level config

    def __str__(self):
        lines = [f"node {self.name}:"]
        lines.append(f"  kind:    {self.kind}")
        if self.kind == "llm":
            if self.prompt:
                lines.append(f"  prompt:  {self.prompt!r}")
        elif self.intent:
            lines.append(f"  intent:  {self.intent!r}")
        if self.inputs:
            lines.append(f"  input:   {', '.join(self.inputs)}")
        if self.output_type:
            lines.append(f"  output:  {self.output_type}")
        for c in self.constraints:
            lines.append(f"  constraint {c.severity}: {c.rule}")
        if self.retries is not None:
            lines.append(f"  retries: {self.retries}")
        return "\n".join(lines)


@dataclass
class Pipeline:
    name:               str
    description:        Optional[str]      = None
    config:             Config             = field(default_factory=Config)
    global_constraints: List[Constraint]   = field(default_factory=list)
    nodes:              List[Node]         = field(default_factory=list)

    def effective_retries(self, node: Node) -> int:
        """Node-level retries override pipeline config; default is 3."""
        if node.retries is not None:
            return node.retries
        if self.config.retries is not None:
            return self.config.retries
        return 3

    def effective_model(self) -> Optional[str]:
        return self.config.model

    def __str__(self):
        lines = [f"pipeline {self.name}:"]
        if self.description:
            lines.append(f"  description: {self.description!r}")
        if self.global_constraints:
            lines.append("  global:")
            for c in self.global_constraints:
                lines.append(f"    constraint {c.severity}: {c.rule}")
        for node in self.nodes:
            for line in str(node).splitlines():
                lines.append("  " + line)
        return "\n".join(lines)


@dataclass
class Program:
    """A .ndsl file can contain multiple pipelines."""
    pipelines: List[Pipeline] = field(default_factory=list)

    def get(self, name: str) -> Optional[Pipeline]:
        for p in self.pipelines:
            if p.name == name:
                return p
        return None
