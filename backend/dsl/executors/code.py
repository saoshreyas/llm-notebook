"""Code steps: LLM generates Python, checker verifies, then exec in shared namespace."""
from __future__ import annotations

import io
import json
import time
import traceback
from contextlib import redirect_stdout, redirect_stderr
from typing import Callable, List, Optional

from dsl.ast_nodes import Constraint, Node
from dsl.executors.context import balloon_summary, input_context
from dsl.prompt_loader import render_template
from dsl.results import CellResult

LLMCallable = Callable[[list, float], str]


def _constraints_text(global_constraints: List[Constraint], node: Node) -> str:
    all_constraints = global_constraints + node.constraints
    return "\n".join(f"  - [{c.severity.upper()}] {c.rule}" for c in all_constraints) \
        or "  (none)"


def _generator_prompt(
    node: Node,
    balloon: List[CellResult],
    global_constraints: List[Constraint],
    prior_violations: Optional[List[str]],
    prior_exec_error: Optional[str],
    shared_namespace: dict,
) -> List[dict]:
    c_text = _constraints_text(global_constraints, node)

    retry_block = ""
    if prior_violations:
        retry_block = (
            "\n⚠️  RETRY — your last attempt failed these checks:\n"
            + "\n".join(f"  • {v}" for v in prior_violations)
            + "\nFix every issue above. Do NOT repeat the same mistakes.\n"
        )

    exec_error_block = ""
    if prior_exec_error:
        trimmed = prior_exec_error[:4000]
        exec_error_block = (
            "\n⚠️  RUNTIME ERROR — the last generated code failed when executed:\n"
            + trimmed
            + "\nFix the code so it runs successfully. Preserve intent and constraints.\n"
        )

    input_hint = ""
    if node.inputs:
        input_hint = (
            f"\nThe following variables are already in scope from prior nodes: "
            f"{', '.join(node.inputs)}. Use these variable names directly — do not redefine them."
        )

    system = render_template("generator_system.j2", node=node)
    user = render_template(
        "generator_user.j2",
        node=node,
        balloon_summary=balloon_summary(balloon),
        inputs_list=", ".join(node.inputs) if node.inputs else "none (first node)",
        input_values=input_context(shared_namespace, node.inputs),
        output_type=node.output_type or "any",
        input_hint=input_hint,
        constraints_text=c_text,
        retry_block=retry_block,
        exec_error_block=exec_error_block,
    ).strip()

    return [
        {"role": "system", "content": system},
        {"role": "user", "content": user},
    ]


def _checker_prompt(
    node: Node,
    code: str,
    balloon: List[CellResult],
    global_constraints: List[Constraint],
) -> List[dict]:
    c_text = _constraints_text(global_constraints, node)
    system = render_template("checker_system.j2")
    user = render_template(
        "checker_user.j2",
        balloon_summary=balloon_summary(balloon),
        node=node,
        code=code,
        constraints_text=c_text,
        output_type=node.output_type or "any",
    ).strip()
    return [
        {"role": "system", "content": system},
        {"role": "user", "content": user},
    ]


def _parse_checker_response(raw: str) -> dict:
    clean = raw.replace("```json", "").replace("```", "").strip()
    try:
        result = json.loads(clean)
        return {
            "passed": bool(result.get("passed", False)),
            "violations": result.get("violations", []),
        }
    except json.JSONDecodeError:
        return {"passed": True, "violations": ["[meta] checker returned non-JSON — soft pass"]}


def _execute_code(
    code: str,
    shared_namespace: dict,
    log: Callable[[str], None],
    node_name: str,
) -> dict:
    stdout_buf = io.StringIO()
    stderr_buf = io.StringIO()

    try:
        with redirect_stdout(stdout_buf), redirect_stderr(stderr_buf):
            exec(compile(code, f"<{node_name}>", "exec"), shared_namespace)

        stdout_text = stdout_buf.getvalue().strip()
        stderr_text = stderr_buf.getvalue().strip()

        result_val = shared_namespace.get(node_name)
        if result_val is None:
            candidates = [
                k for k in shared_namespace
                if not k.startswith("_")
                and k not in ("In", "Out", "exit", "quit")
                and not callable(shared_namespace[k])
            ]
            if candidates:
                result_val = shared_namespace[candidates[-1]]

        if result_val is not None:
            shared_namespace[node_name] = result_val

        result_repr = repr(result_val) if result_val is not None else None
        all_output = "\n".join(filter(None, [stdout_text, stderr_text])) or None

        log(f"  ▶  [{node_name}] executed OK")
        if all_output:
            log(f"     stdout: {all_output[:300]}")
        if result_repr:
            log(f"     result: {result_repr[:300]}")

        return {
            "executed": True,
            "exec_output": all_output,
            "exec_result": result_repr,
            "exec_error": None,
        }

    except Exception:
        tb = traceback.format_exc()
        log(f"  💥 [{node_name}] execution error:\n{tb[:400]}")
        return {
            "executed": True,
            "exec_output": stdout_buf.getvalue().strip() or None,
            "exec_result": None,
            "exec_error": tb.strip(),
        }


def run_code_node(
    node: Node,
    balloon: List[CellResult],
    global_constraints: List[Constraint],
    llm: LLMCallable,
    max_retries: int,
    log: Callable[[str], None],
    shared_namespace: dict,
) -> CellResult:
    violations: List[str] = []
    prior_exec_error: Optional[str] = None
    code = ""
    t0 = time.time()

    for attempt in range(1, max_retries + 1):
        log(f"  🔧 [{node.name}] generating code... (attempt {attempt}/{max_retries})")

        gen_msgs = _generator_prompt(
            node=node,
            balloon=balloon,
            global_constraints=global_constraints,
            prior_violations=violations if attempt > 1 else None,
            prior_exec_error=prior_exec_error,
            shared_namespace=shared_namespace,
        )
        code = llm(gen_msgs, temperature=0.2 if attempt == 1 else 0.45)

        if "```" in code:
            code = "\n".join(
                line for line in code.splitlines()
                if not line.strip().startswith("```")
            ).strip()

        log(f"  🔍 [{node.name}] checking...")

        chk_msgs = _checker_prompt(
            node=node,
            code=code,
            balloon=balloon,
            global_constraints=global_constraints,
        )
        check = _parse_checker_response(llm(chk_msgs, temperature=0.0))
        violations = check["violations"]

        if not check["passed"]:
            prior_exec_error = None

        if check["passed"]:
            log(f"  ✅ [{node.name}] verified on attempt {attempt} — executing...")

            exec_info = _execute_code(
                code=code,
                shared_namespace=shared_namespace,
                log=log,
                node_name=node.name,
            )

            if exec_info.get("exec_error"):
                prior_exec_error = exec_info["exec_error"]
                log(f"  🔁 [{node.name}] execution failed — retrying with traceback feedback...")
                continue

            prior_exec_error = None
            return CellResult(
                node_name=node.name,
                step_kind="code",
                intent=node.intent,
                code=code,
                verified=True,
                violations=[],
                attempts=attempt,
                output_type=node.output_type,
                duration_sec=round(time.time() - t0, 2),
                **exec_info,
            )

        log(f"  ❌ [{node.name}] violations: {violations}")

    log(f"  ⚠️  [{node.name}] exhausted {max_retries} retries — not executed")
    exec_tail: dict = {"executed": False}
    if prior_exec_error:
        exec_tail = {
            "executed": True,
            "exec_output": None,
            "exec_result": None,
            "exec_error": prior_exec_error,
        }
        if violations:
            violations = list(violations) + ["[runtime] execution failed after max retries"]
        else:
            violations = ["[runtime] execution failed after max retries"]
    return CellResult(
        node_name=node.name,
        step_kind="code",
        intent=node.intent,
        code=code,
        verified=False,
        violations=violations,
        attempts=max_retries,
        output_type=node.output_type,
        duration_sec=round(time.time() - t0, 2),
        **exec_tail,
    )
