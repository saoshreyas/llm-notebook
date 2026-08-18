"""
NL → Workflow DSL translation with parse-repair loop.
"""
from __future__ import annotations

import os
import re
import time
from functools import lru_cache
from pathlib import Path
from typing import Callable, List, Optional, Tuple

from jinja2 import Environment, FileSystemLoader, select_autoescape

from notebooklm.context import format_notebook_history
from notebooklm.types import HistoryItem
from workflow_dsl.parser import parse_string

_TEMPLATES_DIR = Path(__file__).parent / "templates"

LLMCallable = Callable[[List[dict], float], str]

DSL_CHEAT_SHEET = """\
Example shape (2-space indent):

workflow research_agent:
  description: "plan then answer"
  config:
    retries: 2
  global:
    constraint error: do not invent citations
  node plan:
    kind: prompt
    prompt: "Task: {{task}}. Write a 3-step plan."
    output: plan
  node answer:
    kind: prompt
    prompt: |
      Using this plan, answer the task.
      Plan:
      {{plan}}
      Task: {{task}}
    input: plan
    output: answer
  node format:
    kind: code
    input: answer
    code: |
      result = {"answer": answer, "length": len(answer)}
    output: result

Rules:
- Top-level keyword is `workflow` (not pipeline).
- Each node needs `kind: prompt` or `kind: code`.
- prompt nodes need `prompt:` (quoted string or `|` multiline block).
- code nodes need `code:` with user-authored Python (use `result = ...` to bind).
- `output:` names the variable for later {{templating}} / inputs.
- `input:` lists prior output names.
- Use {{var}} in prompts for substitution.
- Optional: intent: (docs only), constraint error/warning/info, config retries.
- Do NOT set config.model unless the user explicitly asks; the server default is used.
"""


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


def _strip_md_fences(text: str) -> str:
    s = text.strip()
    m = re.search(r"```(?:[\w.-]+\s*\n)?([\s\S]*?)```", s)
    if m:
        return m.group(1).strip()
    return s


def nl_to_dsl(
    text: str,
    llm: LLMCallable,
    *,
    notebook_history: Optional[List[HistoryItem]] = None,
    max_attempts: Optional[int] = None,
) -> Tuple[str, bool, Optional[str], int, float]:
    """
    Returns (dsl_source, parse_ok, parse_error, attempts, processing_time).
    """
    max_parse = max_attempts or max(1, int(os.environ.get("NL_PARSE_MAX_ATTEMPTS", "3")))
    start = time.time()
    system = render_template("nl_to_dsl_system.j2")
    dsl_source = ""
    parse_ok: Optional[bool] = None
    parse_error: Optional[str] = None
    attempts_used = 0
    history_block = format_notebook_history(notebook_history)

    for attempt in range(1, max_parse + 1):
        attempts_used = attempt
        repair = attempt > 1
        user = render_template(
            "nl_to_dsl_user.j2",
            dsl_cheat_sheet=DSL_CHEAT_SHEET,
            history_block=history_block,
            user_text=text.strip(),
            repair_block=repair,
            parse_error=parse_error or "",
            failed_dsl=dsl_source if repair else "",
            parse_attempt=attempt,
            parse_max_attempts=max_parse,
        )
        raw = llm(
            [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            0.2 if attempt == 1 else 0.4,
        )
        dsl_source = _strip_md_fences(raw)
        try:
            parse_string(dsl_source)
            parse_ok = True
            parse_error = None
            break
        except Exception as e:
            parse_ok = False
            parse_error = str(e)

    return (
        dsl_source,
        bool(parse_ok),
        parse_error,
        attempts_used,
        round(time.time() - start, 3),
    )
