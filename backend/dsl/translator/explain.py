"""Explain a parsed pipeline in plain English (agent track — no execution)."""
from __future__ import annotations

from dsl.ast_nodes import Program
from dsl.prompt_loader import render_template


def ast_summary(program: Program) -> str:
    lines: list[str] = []
    for p in program.pipelines:
        lines.append(f"pipeline {p.name}")
        if p.description:
            lines.append(f"  description: {p.description}")
        if p.global_constraints:
            lines.append("  global constraints:")
            for c in p.global_constraints:
                lines.append(f"    - [{c.severity}] {c.rule}")
        for n in p.nodes:
            lines.append(f"  node {n.name} (kind={n.kind})")
            if n.kind == "llm":
                lines.append(f"    prompt: {n.prompt}")
            else:
                lines.append(f"    intent: {n.intent}")
            if n.inputs:
                lines.append(f"    inputs: {', '.join(n.inputs)}")
            if n.output_type:
                lines.append(f"    output: {n.output_type}")
            for c in n.constraints:
                lines.append(f"    constraint [{c.severity}]: {c.rule}")
        lines.append("")
    return "\n".join(lines).strip()


def build_explain_messages(program: Program, audience: str = "mixed") -> list[dict]:
    summary = ast_summary(program)
    system = render_template("explain_system.j2")
    user = render_template(
        "explain_user.j2",
        ast_summary=summary,
        audience=audience,
    ).strip()
    return [
        {"role": "system", "content": system},
        {"role": "user", "content": user},
    ]
