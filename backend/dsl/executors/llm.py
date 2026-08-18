"""LLM steps: run a prompt directly (no Python generation)."""
from __future__ import annotations

import time
from typing import Callable, List, Optional

from dsl.ast_nodes import Constraint, Node
from dsl.executors.context import balloon_summary, input_context
from dsl.results import CellResult

LLMCallable = Callable[[list, float], str]


def _llm_step_messages(
    node: Node,
    balloon: List[CellResult],
    shared_namespace: dict,
    prior_error: Optional[str],
) -> List[dict]:
    retry = ""
    if prior_error:
        retry = f"\n⚠️  Previous attempt failed: {prior_error}\nTry again.\n"

    system = (
        "You are a pipeline step that answers from the given context only. "
        "Be concise and factual. Output plain text unless asked for JSON."
    )
    user_parts = [
        f"=== STEP: {node.name} ===",
        f"Prompt:\n{node.prompt}",
        "",
        balloon_summary(balloon),
        "",
        "=== INPUT VALUES ===",
        input_context(shared_namespace, node.inputs),
        retry,
    ]
    if node.output_type:
        user_parts.append(f"\nExpected output type: {node.output_type}")

    return [
        {"role": "system", "content": system},
        {"role": "user", "content": "\n".join(user_parts).strip()},
    ]


def run_llm_node(
    node: Node,
    balloon: List[CellResult],
    global_constraints: List[Constraint],
    llm: LLMCallable,
    max_retries: int,
    log: Callable[[str], None],
    shared_namespace: dict,
) -> CellResult:
    del global_constraints  # reserved for future prompt-level constraints
    t0 = time.time()
    prior_error: Optional[str] = None
    text = ""

    for attempt in range(1, max_retries + 1):
        log(f"  💬 [{node.name}] LLM prompt... (attempt {attempt}/{max_retries})")
        msgs = _llm_step_messages(node, balloon, shared_namespace, prior_error)
        text = llm(msgs, temperature=0.3 if attempt == 1 else 0.5).strip()

        if not text:
            prior_error = "empty response from model"
            log(f"  ❌ [{node.name}] {prior_error}")
            continue

        shared_namespace[node.name] = text
        log(f"  ✅ [{node.name}] LLM step OK ({len(text)} chars)")

        return CellResult(
            node_name=node.name,
            step_kind="llm",
            intent="",
            prompt=node.prompt,
            code="",
            verified=True,
            violations=[],
            attempts=attempt,
            output_type=node.output_type,
            duration_sec=round(time.time() - t0, 2),
            executed=True,
            exec_output=None,
            exec_result=text[:8000],
            exec_error=None,
        )

    log(f"  ⚠️  [{node.name}] LLM step failed after {max_retries} retries")
    return CellResult(
        node_name=node.name,
        step_kind="llm",
        intent="",
        prompt=node.prompt,
        code="",
        verified=False,
        violations=[prior_error or "LLM step failed"],
        attempts=max_retries,
        output_type=node.output_type,
        duration_sec=round(time.time() - t0, 2),
        executed=False,
        exec_output=None,
        exec_result=text or None,
        exec_error=prior_error,
    )
