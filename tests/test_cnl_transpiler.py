"""CNL → NotebookDSL transpiler tests."""
from __future__ import annotations

from pathlib import Path

import pytest

from dsl.parser import parse_string
from dsl.translator.cnl import CNLTranspileError, cnl_to_ndsl

EXAMPLES = Path(__file__).resolve().parents[1] / "examples"


def test_cnl_demo_transpiles_and_parses():
    src = (EXAMPLES / "demo.cnl").read_text(encoding="utf-8")
    ndsl = cnl_to_ndsl(src)
    p = parse_string(ndsl).pipelines[0]
    assert p.name == "sales_report"
    assert len(p.nodes) == 3
    assert [n.name for n in p.nodes] == ["build_data", "compute_stats", "explain"]
    assert [n.kind for n in p.nodes] == ["code", "code", "llm"]


def test_cnl_emits_kind_and_inputs():
    src = (EXAMPLES / "demo.cnl").read_text(encoding="utf-8")
    ndsl = cnl_to_ndsl(src)
    assert "kind: code" in ndsl
    assert "kind: llm" in ndsl
    assert "input: build_data" in ndsl
    assert "input: compute_stats" in ndsl

    p = parse_string(ndsl).pipelines[0]
    stats = p.nodes[1]
    assert stats.name == "compute_stats"
    assert stats.kind == "code"
    assert stats.inputs == ["build_data"]


def test_cnl_rejects_missing_pipeline():
    src = "code foo: create a small dict\n"
    with pytest.raises(CNLTranspileError):
        cnl_to_ndsl(src)


def test_cnl_rejects_empty_step_text():
    src = """
pipeline demo
  code x:
"""
    with pytest.raises(CNLTranspileError):
        cnl_to_ndsl(src)
