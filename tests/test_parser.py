"""Parser tests for Workflow DSL."""
from __future__ import annotations

import pytest

from workflow_dsl.parser import parse_string


VALID = """
workflow demo:
  description: "hi"
  config:
    retries: 1
  node a:
    kind: prompt
    prompt: "Hello {{task}}"
    output: a
  node b:
    kind: code
    input: a
    code: |
      result = a.upper()
    output: result
"""


def test_parse_valid_workflow():
    prog = parse_string(VALID)
    assert len(prog.workflows) == 1
    w = prog.workflows[0]
    assert w.name == "demo"
    assert w.description == "hi"
    assert w.config.retries == 1
    assert len(w.nodes) == 2
    assert w.nodes[0].kind == "prompt"
    assert w.nodes[0].prompt == "Hello {{task}}"
    assert w.nodes[1].kind == "code"
    assert "result = a.upper()" in (w.nodes[1].code or "")


def test_parse_infers_kind_from_prompt():
    src = """
workflow x:
  node only:
    prompt: "just this"
    output: only
"""
    w = parse_string(src).workflows[0]
    assert w.nodes[0].kind == "prompt"


def test_parse_rejects_prompt_without_text():
    src = """
workflow x:
  node bad:
    kind: prompt
    output: bad
"""
    with pytest.raises(Exception):
        parse_string(src)


def test_parse_multiline_prompt():
    src = """
workflow x:
  node n:
    kind: prompt
    prompt: |
      line one
      line two {{task}}
    output: n
"""
    n = parse_string(src).workflows[0].nodes[0]
    assert "line one" in n.prompt
    assert "line two {{task}}" in n.prompt


def test_invalid_syntax():
    with pytest.raises(Exception):
        parse_string("not a workflow\n")
