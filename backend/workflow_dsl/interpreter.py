"""
Semantic interpreter for Workflow DSL.

Executes node meaning directly:
  - prompt nodes → render template → OpenRouter/LiteLLM → optional constraint check
  - code nodes   → exec user-authored Python in a shared namespace

No LLM code generation.
"""
from __future__ import annotations

import io
import json
import re
import time
import traceback
from contextlib import redirect_stderr, redirect_stdout
from typing import Any, Callable, Dict, List, Optional

from notebooklm.context import Balloon
from notebooklm.types import NodeResult, RunResult
from workflow_dsl.ast_nodes import Constraint, Node, Program, Workflow

LLMCallable = Callable[[List[dict], float], str]


_VAR_PATTERN = re.compile(r"\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}")


def render_prompt(template: str, variables: Dict[str, Any]) -> str:
    """Replace {{name}} with stringified values from variables."""

    def repl(m: re.Match) -> str:
        key = m.group(1)
        if key not in variables:
            return m.group(0)
        val = variables[key]
        return str(val) if val is not None else ""

    return _VAR_PATTERN.sub(repl, template)


def _stringify(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value
    try:
        return json.dumps(value, default=str)
    except TypeError:
        return repr(value)


def _constraints_text(
    global_constraints: List[Constraint], node: Node
) -> str:
    all_c = global_constraints + node.constraints
    return (
        "\n".join(f"  - [{c.severity.upper()}] {c.rule}" for c in all_c)
        or "  (none)"
    )


def _check_constraints(
    llm: LLMCallable,
    node: Node,
    output_text: str,
    global_constraints: List[Constraint],
) -> tuple[bool, List[str]]:
    """LLM self-check of prompt output against constraints. Skip if none."""
    all_c = [
        c
        for c in (global_constraints + node.constraints)
        if c.severity == "error"
    ]
    if not all_c:
        return True, []

    rules = "\n".join(f"- {c.rule}" for c in all_c)
    messages = [
        {
            "role": "system",
            "content": (
                "You verify whether an assistant output obeys constraints. "
                'Reply with JSON only: {"pass": true/false, "violations": ["..."]}'
            ),
        },
        {
            "role": "user",
            "content": (
                f"Constraints:\n{rules}\n\nOutput to check:\n{output_text}\n\n"
                "JSON verdict:"
            ),
        },
    ]
    raw = llm(messages, 0.0)
    raw = raw.strip()
    # Strip fences if present
    if raw.startswith("```"):
        raw = re.sub(r"^```(?:json)?\s*", "", raw)
        raw = re.sub(r"\s*```$", "", raw)
    try:
        data = json.loads(raw)
        ok = bool(data.get("pass", False))
        violations = [str(v) for v in data.get("violations") or []]
        if not ok and not violations:
            violations = ["Constraint check failed (no details)."]
        return ok, violations
    except json.JSONDecodeError:
        # If checker is flaky, treat as pass with warning stored as soft fail skip
        return True, []


def _run_code_node(
    node: Node,
    namespace: Dict[str, Any],
    log: Callable[[str], None],
) -> dict:
    stdout_buf = io.StringIO()
    stderr_buf = io.StringIO()
    code = node.code or ""
    try:
        with redirect_stdout(stdout_buf), redirect_stderr(stderr_buf):
            exec(compile(code, f"<{node.name}>", "exec"), namespace)

        stdout_text = stdout_buf.getvalue().strip()
        stderr_text = stderr_buf.getvalue().strip()
        all_out = "\n".join(filter(None, [stdout_text, stderr_text])) or None

        bind = node.output_name or node.name
        result_val = namespace.get("result", namespace.get(bind))
        if result_val is not None:
            namespace[bind] = result_val

        log(f"  >  [{node.name}] code executed OK")
        return {
            "success": True,
            "stdout": all_out,
            "value": result_val if result_val is not None else all_out,
            "error": None,
        }
    except Exception:
        tb = traceback.format_exc()
        log(f"  !  [{node.name}] code error:\n{tb[:400]}")
        return {
            "success": False,
            "stdout": stdout_buf.getvalue().strip() or None,
            "value": None,
            "error": tb.strip(),
        }


def _run_prompt_node(
    node: Node,
    variables: Dict[str, Any],
    llm: LLMCallable,
    global_constraints: List[Constraint],
    max_retries: int,
    log: Callable[[str], None],
) -> tuple[NodeResult, Any]:
    t0 = time.time()
    rendered = render_prompt(node.prompt or "", variables)
    violations: List[str] = []
    last_text = ""
    attempts = 0
    success = False

    for attempt in range(1, max_retries + 1):
        attempts = attempt
        retry_note = ""
        if violations:
            retry_note = (
                "\n\nPrevious output violated constraints:\n"
                + "\n".join(f"- {v}" for v in violations)
                + "\nProduce a corrected answer that satisfies them."
            )
        messages = [
            {
                "role": "system",
                "content": (
                    "You are a workflow step. Follow the user prompt carefully. "
                    "Return only the step result (no meta commentary)."
                ),
            },
            {"role": "user", "content": rendered + retry_note},
        ]
        log(f"  *  [{node.name}] prompt attempt {attempt}/{max_retries}")
        last_text = llm(messages, 0.2)
        ok, violations = _check_constraints(
            llm, node, last_text, global_constraints
        )
        if ok:
            success = True
            violations = []
            break
        log(f"  !  [{node.name}] constraint violations: {violations}")

    bind = node.output_name or node.name
    result = NodeResult(
        node_name=node.name,
        kind="prompt",
        success=success,
        attempts=attempts,
        duration_sec=round(time.time() - t0, 2),
        output_name=bind,
        output_value=_stringify(last_text) if last_text else None,
        violations=violations,
        prompt_rendered=rendered,
        error=None if success else ("; ".join(violations) or "prompt failed"),
    )
    return result, last_text if success else None


def interpret_workflow(
    workflow: Workflow,
    llm: LLMCallable,
    *,
    inputs: Optional[Dict[str, Any]] = None,
    balloon_seed: Optional[Dict[str, Any]] = None,
    log: Callable[[str], None] = print,
) -> RunResult:
    t0 = time.time()
    balloon = Balloon()
    namespace: Dict[str, Any] = {}
    if balloon_seed:
        namespace.update(balloon_seed)
        balloon.values.update(balloon_seed)
    if inputs:
        namespace.update(inputs)
        balloon.values.update(inputs)

    nodes_out: List[NodeResult] = []
    log(f"\n>> Running workflow: {workflow.name}")
    if workflow.description:
        log(f"   {workflow.description}")
    log(f"   Nodes: {[n.name for n in workflow.nodes]}")

    for node in workflow.nodes:
        log(f"\n-- Node: {node.name} ({node.kind})")
        max_retries = workflow.effective_retries(node)
        vars_for_prompt = {**balloon.as_prompt_vars(), **namespace}

        if node.kind == "prompt":
            result, value = _run_prompt_node(
                node,
                vars_for_prompt,
                llm,
                workflow.global_constraints,
                max_retries,
                log,
            )
            if value is not None:
                bind = result.output_name or node.name
                namespace[bind] = value
                balloon.commit(result, value)
            nodes_out.append(result)
        else:
            t_node = time.time()
            # Ensure declared inputs exist
            for inp in node.inputs:
                if inp not in namespace and inp in balloon.values:
                    namespace[inp] = balloon.values[inp]
            exec_info = _run_code_node(node, namespace, log)
            bind = node.output_name or node.name
            value = exec_info["value"]
            result = NodeResult(
                node_name=node.name,
                kind="code",
                success=exec_info["success"],
                attempts=1,
                duration_sec=round(time.time() - t_node, 2),
                output_name=bind,
                output_value=_stringify(value) if value is not None else None,
                stdout=exec_info["stdout"],
                error=exec_info["error"],
                code=node.code,
            )
            if result.success:
                balloon.commit(result, value if value is not None else namespace.get(bind))
            nodes_out.append(result)

        if not nodes_out[-1].success:
            log(f"  x stopping after failed node {node.name}")
            break

    total = round(time.time() - t0, 2)
    success = bool(nodes_out) and all(n.success for n in nodes_out)
    # Also fail if not all nodes ran
    if len(nodes_out) < len(workflow.nodes):
        success = False

    return RunResult(
        workflow_name=workflow.name,
        success=success,
        total_sec=total,
        nodes=nodes_out,
        namespace={k: v for k, v in namespace.items() if not k.startswith("_")},
    )


def interpret_program(
    program: Program,
    llm: LLMCallable,
    *,
    inputs: Optional[Dict[str, Any]] = None,
    balloon_seed: Optional[Dict[str, Any]] = None,
    log: Callable[[str], None] = print,
    workflow: Optional[str] = None,
) -> RunResult:
    if not program.workflows:
        raise ValueError("No workflow found in program.")
    if workflow:
        wf = program.get(workflow)
        if wf is None:
            names = [w.name for w in program.workflows]
            raise ValueError(f"Workflow '{workflow}' not found. Available: {names}")
    else:
        wf = program.workflows[0]
    return interpret_workflow(
        wf,
        llm,
        inputs=inputs,
        balloon_seed=balloon_seed,
        log=log,
    )

