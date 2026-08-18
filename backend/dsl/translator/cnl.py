"""
CNL → NotebookDSL (.ndsl)

Ergonomic line-oriented surface syntax (no indentation). Example:

  pipeline sales_report
    code load_data: create a small dict with sample revenue numbers
    code stats using load_data: compute mean revenue
    llm explain using stats: two sentences for my advisor

Transpiles to standard .ndsl with kind: code | llm.
"""
from __future__ import annotations

import re
from typing import List, Tuple

_PIPELINE = re.compile(r"^\s*pipeline\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*$", re.I)
_STEP = re.compile(
    r"^\s*(code|llm)\s+([a-zA-Z_][a-zA-Z0-9_]*)"
    r"(?:\s+using\s+([a-zA-Z_][a-zA-Z0-9_,\s]*))?"
    r"\s*:\s*(.+?)\s*$",
    re.I,
)


class CNLTranspileError(ValueError):
    pass


def _quote(s: str) -> str:
    return '"' + s.replace("\\", "\\\\").replace('"', '\\"') + '"'


def _parse_inputs(raw: str | None) -> List[str]:
    if not raw:
        return []
    return [p.strip() for p in raw.split(",") if p.strip()]


def cnl_to_ndsl(source: str) -> str:
    lines = source.splitlines()
    pipeline_name: str | None = None
    steps: List[Tuple[str, str, List[str], str]] = []  # kind, name, inputs, text

    for i, line in enumerate(lines, 1):
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue

        m_pipe = _PIPELINE.match(line)
        if m_pipe:
            if pipeline_name:
                raise CNLTranspileError(f"Line {i}: only one pipeline per CNL document")
            pipeline_name = m_pipe.group(1)
            continue

        m_step = _STEP.match(line)
        if m_step:
            kind = m_step.group(1).lower()
            name = m_step.group(2)
            inputs = _parse_inputs(m_step.group(3))
            text = m_step.group(4).strip()
            if not text:
                raise CNLTranspileError(f"Line {i}: step description cannot be empty")
            steps.append((kind, name, inputs, text))
            continue

        raise CNLTranspileError(
            f"Line {i}: expected 'pipeline NAME', 'code NAME: ...', or 'llm NAME: ...'"
        )

    if not pipeline_name:
        raise CNLTranspileError("Missing 'pipeline NAME' line")
    if not steps:
        raise CNLTranspileError("Pipeline has no steps (add 'code ...:' or 'llm ...:' lines)")

    out: List[str] = [f"pipeline {pipeline_name}:", ""]
    for kind, name, inputs, text in steps:
        out.append(f"  node {name}:")
        out.append(f"    kind: {kind}")
        if kind == "llm":
            out.append(f"    prompt: {_quote(text)}")
        else:
            out.append(f"    intent: {_quote(text)}")
        if inputs:
            out.append(f"    input: {', '.join(inputs)}")
        out.append("")

    return "\n".join(out).rstrip() + "\n"
