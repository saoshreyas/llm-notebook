"""Parser tests for NotebookDSL (.ndsl)."""
from __future__ import annotations

from pathlib import Path

import pytest

from dsl.parser import parse_file, parse_string

EXAMPLES = Path(__file__).resolve().parents[1] / "examples"


def test_parse_mixed_pipeline_example():
    prog = parse_file(EXAMPLES / "demo_mixed_pipeline.ndsl")
    assert len(prog.pipelines) == 1
    p = prog.pipelines[0]
    assert p.name == "sales_summary"
    assert len(p.nodes) == 3

    build_data, compute_stats, explain = p.nodes
    assert build_data.name == "build_data"
    assert build_data.kind == "code"
    assert compute_stats.name == "compute_stats"
    assert compute_stats.kind == "code"
    assert compute_stats.inputs == ["build_data"]
    assert explain.name == "explain"
    assert explain.kind == "llm"
    assert explain.prompt
    assert explain.inputs == ["compute_stats"]


def test_parse_config_and_global_constraints():
    src = """
pipeline demo:
  description: "hi"
  config:
    retries: 2
  global:
    constraint error: never use subprocess or eval
  node a:
    kind: code
    intent: "make a small dict"
"""
    p = parse_string(src).pipelines[0]
    assert p.name == "demo"
    assert p.description == "hi"
    assert p.config.retries == 2
    assert len(p.global_constraints) == 1
    assert p.global_constraints[0].severity == "error"
    assert "subprocess" in p.global_constraints[0].rule
    assert p.nodes[0].kind == "code"
    assert p.nodes[0].intent == "make a small dict"


def test_parse_rejects_llm_without_prompt():
    src = """
pipeline x:
  node bad:
    kind: llm
    input: a
"""
    with pytest.raises(Exception):
        parse_string(src)


def test_parse_rejects_code_without_intent():
    src = """
pipeline x:
  node bad:
    kind: code
    output: "dict"
"""
    with pytest.raises(Exception):
        parse_string(src)


def test_parse_strips_comment_lines():
    src = """
# comment before pipeline
pipeline demo:
  # comment inside pipeline
  node a:
    kind: code
    intent: "ok"
"""
    p = parse_string(src).pipelines[0]
    assert p.name == "demo"
    assert len(p.nodes) == 1
    assert p.nodes[0].intent == "ok"
