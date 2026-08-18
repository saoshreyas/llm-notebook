"""
Load and render Jinja2 prompt templates for the DSL runtime and NL→DSL translation.
"""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from jinja2 import Environment, FileSystemLoader, select_autoescape

_TEMPLATES_DIR = Path(__file__).parent / "templates"


@lru_cache(maxsize=1)
def _env() -> Environment:
    return Environment(
        loader=FileSystemLoader(str(_TEMPLATES_DIR)),
        autoescape=select_autoescape(enabled_extensions=()),
        trim_blocks=True,
        lstrip_blocks=True,
    )


def render_template(name: str, **kwargs) -> str:
    return _env().get_template(name).render(**kwargs)


# Minimal grammar hints for NL→DSL (full docs: dsl/README.md)
DSL_CHEAT_SHEET = """\
Example shape (2-space indent under pipeline and nodes):

pipeline my_work:
  description: "what this does"
  config:
    retries: 3
    model: "meta-llama/Llama-2-7b-chat-hf"
  global:
    constraint error: never use subprocess or eval
  node step_a:
    kind: code
    intent: "plain English description of this step"
    output: "str"
    constraint error: handle errors gracefully
  node step_b:
    kind: code
    intent: "next step using prior result"
    input: step_a
    output: "dict"
  node explain:
    kind: llm
    prompt: "Summarize step_b for a non-technical reader"
    input: step_b

Step kinds:
  kind: code — requires intent: (generates and runs Python)
  kind: llm  — requires prompt: (direct LLM call; default kind is code if omitted)

Keywords: pipeline, node, kind, description, config, model, retries, global, intent, prompt, input, output, constraint (+ optional severity: error, warning, info).
"""
