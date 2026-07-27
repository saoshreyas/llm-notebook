"""Semantic interpreter tests with mocked LLM."""
from __future__ import annotations

from workflow_dsl.interpreter import interpret_program, render_prompt
from workflow_dsl.parser import parse_string


def test_render_prompt_substitution():
    out = render_prompt("Hi {{name}} — {{missing}}", {"name": "Ada"})
    assert out == "Hi Ada — {{missing}}"


def test_prompt_then_code_with_mock_llm():
    src = """
workflow demo:
  node greet:
    kind: prompt
    prompt: "Say hi to {{task}}"
    output: greeting
  node upper:
    kind: code
    input: greeting
    code: |
      result = greeting.upper()
    output: result
"""
    program = parse_string(src)

    def llm(messages, temperature=0.2):
        # Return a fixed completion; ignore constraint checker JSON path if any
        user = messages[-1]["content"]
        if "JSON" in user or "Constraints" in user:
            return '{"pass": true, "violations": []}'
        return "hello from mock"

    result = interpret_program(
        program,
        llm,
        inputs={"task": "world"},
        log=lambda *_: None,
    )
    assert result.success
    assert result.nodes[0].kind == "prompt"
    assert result.nodes[0].output_value == "hello from mock"
    assert result.namespace["greeting"] == "hello from mock"
    assert result.namespace["result"] == "HELLO FROM MOCK"


def test_constraint_retry_once():
    src = """
workflow demo:
  config:
    retries: 2
  node n:
    kind: prompt
    prompt: "answer"
    output: n
    constraint error: must say ok
"""
    program = parse_string(src)
    calls = {"n": 0}

    def llm(messages, temperature=0.2):
        user = messages[-1]["content"]
        if "JSON" in messages[0]["content"] or "verify" in messages[0]["content"].lower():
            # First check fails, second passes
            calls["n"] += 1
            if calls["n"] == 1:
                return '{"pass": false, "violations": ["missing ok"]}'
            return '{"pass": true, "violations": []}'
        return "ok answer"

    result = interpret_program(program, llm, log=lambda *_: None)
    assert result.success
    assert result.nodes[0].attempts == 2


def test_balloon_handoff():
    src = """
workflow demo:
  node a:
    kind: prompt
    prompt: "A"
    output: a
  node b:
    kind: prompt
    prompt: "B sees {{a}}"
    input: a
    output: b
"""
    program = parse_string(src)
    seen = []

    def llm(messages, temperature=0.2):
        if "verify" in messages[0]["content"].lower() or "JSON" in messages[0]["content"]:
            return '{"pass": true, "violations": []}'
        content = messages[-1]["content"]
        seen.append(content)
        if content.startswith("A"):
            return "alpha"
        return "beta"

    result = interpret_program(program, llm, log=lambda *_: None)
    assert result.success
    assert any("alpha" in s for s in seen)
    assert result.namespace["b"] == "beta"
