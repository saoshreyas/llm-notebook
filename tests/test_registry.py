"""Registry / public API tests."""
from __future__ import annotations

import workflow_dsl  # noqa: F401
from notebooklm import interpret, list_languages


def test_workflow_registered():
    assert "workflow" in list_languages()


def test_interpret_api_with_mock(monkeypatch):
    from notebooklm import registry

    src = """
workflow t:
  node n:
    kind: code
    code: |
      result = 1 + 1
    output: result
"""

    def fake_llm(*_a, **_k):
        raise AssertionError("LLM should not be called for code-only workflow")

    # code-only: interpret still builds default llm if None — pass mock to avoid network
    result = interpret("workflow", src, llm=fake_llm, log=lambda *_: None)
    assert result.success
    assert result.namespace["result"] == 2
