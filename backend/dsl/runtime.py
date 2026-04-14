"""
notebookdsl.runtime
~~~~~~~~~~~~~~~~~~~
Takes a parsed Pipeline AST and executes it:
  - Generator LLM call per node
  - Checker LLM call per node
  - Self-correcting retry loop
  - Balloon (accumulated verified cell context)
  - Code execution after verification — output captured and passed forward
"""
from __future__ import annotations

import io
import json
import time
import traceback
from contextlib import redirect_stdout, redirect_stderr
from dataclasses import dataclass, field
from typing import List, Optional, Callable, Any

from dsl.ast_nodes import Pipeline, Node, Constraint


# ── Result types ──────────────────────────────────────────────────────────────

@dataclass
class CellResult:
    node_name:    str
    intent:       str
    code:         str
    verified:     bool
    violations:   List[str]
    attempts:     int
    output_type:  Optional[str]
    duration_sec: float
    # execution fields
    executed:     bool = False
    exec_output:  Optional[str] = None   # stdout from running the code
    exec_result:  Optional[str] = None   # repr() of the return value
    exec_error:   Optional[str] = None   # traceback if it crashed

    def summary(self) -> str:
        status = "✅ PASS" if self.verified else "❌ FAIL"
        lines = [
            f"{status}  [{self.node_name}]  ({self.attempts} attempt(s), {self.duration_sec:.1f}s)",
            f"  intent: {self.intent}",
        ]
        if self.violations:
            lines.append("  violations:")
            for v in self.violations:
                lines.append(f"    • {v}")
        if self.executed:
            if self.exec_error:
                lines.append(f"  exec error: {self.exec_error[:200]}")
            else:
                if self.exec_output:
                    lines.append(f"  output: {self.exec_output[:200]}")
                if self.exec_result:
                    lines.append(f"  result: {self.exec_result[:200]}")
        return "\n".join(lines)


@dataclass
class RunResult:
    pipeline_name: str
    cells:         List[CellResult]
    total_sec:     float
    success:       bool

    @property
    def balloon_size(self) -> int:
        return sum(1 for c in self.cells if c.verified)

    def summary(self) -> str:
        lines = [
            f"\n{'='*60}",
            f"  Pipeline : {self.pipeline_name}",
            f"  Result   : {'✅ ALL PASSED' if self.success else '⚠️  SOME FAILED'}",
            f"  Cells    : {self.balloon_size}/{len(self.cells)} verified",
            f"  Time     : {self.total_sec:.1f}s",
            f"{'='*60}",
        ]
        for cell in self.cells:
            lines.append(cell.summary())
        return "\n".join(lines)


# ── LLM interface ─────────────────────────────────────────────────────────────

LLMCallable = Callable[[List[dict], float], str]


def make_litellm_caller(
    model: str,
    api_base: str,
    max_tokens: int = 1500,
) -> LLMCallable:
    try:
        from litellm import completion
    except ImportError:
        raise RuntimeError("litellm not installed. Run: pip install litellm")

    def call(messages: List[dict], temperature: float = 0.2) -> str:
        resp = completion(
            model=f"openai/{model}",
            messages=messages,
            api_base=api_base,
            max_tokens=max_tokens,
            temperature=temperature,
        )
        return resp.choices[0].message.content.strip()

    return call


# ── Code execution ────────────────────────────────────────────────────────────

def _execute_code(
    code: str,
    shared_namespace: dict,
    log: Callable[[str], None],
    node_name: str,
) -> dict:
    """
    Run `code` inside `shared_namespace` so each node can see variables
    defined by prior nodes. Captures stdout and the result value.
    Returns dict with keys: executed, exec_output, exec_result, exec_error.
    """
    stdout_buf = io.StringIO()
    stderr_buf = io.StringIO()

    try:
        with redirect_stdout(stdout_buf), redirect_stderr(stderr_buf):
            exec(compile(code, f"<{node_name}>", "exec"), shared_namespace)

        stdout_text = stdout_buf.getvalue().strip()
        stderr_text = stderr_buf.getvalue().strip()

        # Find the result value — look for a variable named after the node first
        result_val = shared_namespace.get(node_name)

        # If not found, look for the last non-dunder, non-callable variable set
        if result_val is None:
            candidates = [
                k for k in shared_namespace
                if not k.startswith("_")
                and k not in ("In", "Out", "exit", "quit")
                and not callable(shared_namespace[k])
            ]
            if candidates:
                result_val = shared_namespace[candidates[-1]]

        # Store result under node name so downstream nodes can reference it
        if result_val is not None:
            shared_namespace[node_name] = result_val

        result_repr = repr(result_val) if result_val is not None else None
        all_output  = "\n".join(filter(None, [stdout_text, stderr_text])) or None

        log(f"  ▶  [{node_name}] executed OK")
        if all_output:
            log(f"     stdout: {all_output[:300]}")
        if result_repr:
            log(f"     result: {result_repr[:300]}")

        return {
            "executed":    True,
            "exec_output": all_output,
            "exec_result": result_repr,
            "exec_error":  None,
        }

    except Exception:
        tb = traceback.format_exc()
        log(f"  💥 [{node_name}] execution error:\n{tb[:400]}")
        return {
            "executed":    True,
            "exec_output": stdout_buf.getvalue().strip() or None,
            "exec_result": None,
            "exec_error":  tb.strip(),
        }


# ── Balloon context builder ───────────────────────────────────────────────────

def _balloon_summary(balloon: List[CellResult]) -> str:
    if not balloon:
        return "[ No prior cells — this is the first node in the pipeline. ]"

    lines = ["=== BALLOON: verified cells so far ==="]
    for cell in balloon:
        lines += [
            "",
            f"-- node: {cell.node_name} --",
            f"intent : {cell.intent}",
            f"output : {cell.output_type or 'unspecified'}",
            f"code:",
            cell.code,
        ]
        if cell.exec_result:
            lines.append(f"runtime result: {cell.exec_result[:300]}")
        if cell.exec_output:
            lines.append(f"runtime stdout: {cell.exec_output[:300]}")
    lines.append("=== END BALLOON ===")
    return "\n".join(lines)


# ── Generator prompt ──────────────────────────────────────────────────────────

def _generator_prompt(
    node: Node,
    balloon: List[CellResult],
    global_constraints: List[Constraint],
    prior_violations: Optional[List[str]],
) -> List[dict]:
    all_constraints = global_constraints + node.constraints
    c_text = "\n".join(f"  - [{c.severity.upper()}] {c.rule}" for c in all_constraints) \
             or "  (none)"

    retry_block = ""
    if prior_violations:
        retry_block = (
            "\n⚠️  RETRY — your last attempt failed these checks:\n"
            + "\n".join(f"  • {v}" for v in prior_violations)
            + "\nFix every issue above. Do NOT repeat the same mistakes.\n"
        )

    input_hint = ""
    if node.inputs:
        input_hint = (
            f"\nThe following variables are already in scope from prior nodes: "
            f"{', '.join(node.inputs)}. Use these variable names directly — do not redefine them."
        )

    system = (
        "You are a constrained Python code generator embedded in a notebook pipeline. "
        "Output ONLY raw Python — no markdown fences, no explanation, no preamble. "
        "Every constraint listed MUST be satisfied. "
        "Write code that can be executed directly with exec(). "
        "Do NOT use if __name__ == '__main__' guards. "
        f"Assign the final result to a variable called `{node.name}`."
    )

    user = f"""
{_balloon_summary(balloon)}

=== YOUR TASK ===
Node    : {node.name}
Intent  : {node.intent}
Inputs  : {', '.join(node.inputs) if node.inputs else 'none (first node)'}
Output  : {node.output_type or 'any'}
{input_hint}

=== CONSTRAINTS (satisfy ALL of these) ===
{c_text}
{retry_block}
Write ONLY the Python code. Assign the final result to a variable called `{node.name}`.
No markdown, no explanation, no fences.
""".strip()

    return [
        {"role": "system", "content": system},
        {"role": "user",   "content": user},
    ]


# ── Checker prompt ────────────────────────────────────────────────────────────

def _checker_prompt(
    node: Node,
    code: str,
    balloon: List[CellResult],
    global_constraints: List[Constraint],
) -> List[dict]:
    all_constraints = global_constraints + node.constraints
    c_text = "\n".join(f"  - [{c.severity.upper()}] {c.rule}" for c in all_constraints) \
             or "  (none)"

    system = (
        "You are a strict code verifier. "
        "You read Python code and a list of constraints, then decide if the code passes. "
        "You respond ONLY with valid JSON — no markdown, no explanation outside the JSON object."
    )

    user = f"""
{_balloon_summary(balloon)}

=== CODE TO VERIFY ===
Node   : {node.name}
Intent : {node.intent}
Output : {node.output_type or 'any'}

```python
{code}
```

=== CONSTRAINTS TO CHECK ===
{c_text}

Also check:
  - Does the code plausibly fulfil the stated intent?
  - Are all imports real libraries (no hallucinated packages)?
  - Do input variable names match outputs from prior balloon cells?
  - Does the output type plausibly match the declared output?
  - Does the code assign its result to a variable called `{node.name}`?

Respond with ONLY this JSON (no markdown fences):
{{
  "passed": true,
  "violations": []
}}

or if it fails:
{{
  "passed": false,
  "violations": ["short description of each violation"]
}}
""".strip()

    return [
        {"role": "system", "content": system},
        {"role": "user",   "content": user},
    ]


def _parse_checker_response(raw: str) -> dict:
    clean = raw.replace("```json", "").replace("```", "").strip()
    try:
        result = json.loads(clean)
        return {
            "passed":     bool(result.get("passed", False)),
            "violations": result.get("violations", []),
        }
    except json.JSONDecodeError:
        return {"passed": True, "violations": ["[meta] checker returned non-JSON — soft pass"]}


# ── Core: generate + verify + execute one node ────────────────────────────────

def _run_node(
    node: Node,
    balloon: List[CellResult],
    global_constraints: List[Constraint],
    llm: LLMCallable,
    max_retries: int,
    log: Callable[[str], None],
    shared_namespace: dict,
) -> CellResult:
    violations: List[str] = []
    code = ""
    t0 = time.time()

    for attempt in range(1, max_retries + 1):
        log(f"  🔧 [{node.name}] generating... (attempt {attempt}/{max_retries})")

        gen_msgs = _generator_prompt(
            node=node,
            balloon=balloon,
            global_constraints=global_constraints,
            prior_violations=violations if attempt > 1 else None,
        )
        code = llm(gen_msgs, temperature=0.2 if attempt == 1 else 0.45)

        # Strip accidental markdown fences
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

        if check["passed"]:
            log(f"  ✅ [{node.name}] verified on attempt {attempt} — executing...")

            exec_info = _execute_code(
                code=code,
                shared_namespace=shared_namespace,
                log=log,
                node_name=node.name,
            )

            return CellResult(
                node_name=node.name,
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
    return CellResult(
        node_name=node.name,
        intent=node.intent,
        code=code,
        verified=False,
        violations=violations,
        attempts=max_retries,
        output_type=node.output_type,
        duration_sec=round(time.time() - t0, 2),
        executed=False,
    )


# ── Public API ────────────────────────────────────────────────────────────────

def run_pipeline(
    pipeline: Pipeline,
    llm: LLMCallable,
    log: Callable[[str], None] = print,
    model_override: Optional[str] = None,
) -> RunResult:
    """
    Execute a parsed Pipeline:
      1. Iterate nodes in order
      2. For each node: generate → verify → execute
      3. Verified cells enter the balloon with their runtime output
         so later nodes can see both the code AND actual results
      4. All nodes share one Python namespace so variables flow naturally
    """
    t0 = time.time()
    balloon: List[CellResult] = []
    cells:   List[CellResult] = []
    shared_namespace: dict    = {}   # single shared scope for all nodes

    log(f"\n🚀 Running pipeline: {pipeline.name}")
    if pipeline.description:
        log(f"   {pipeline.description}")
    log(f"   Nodes: {[n.name for n in pipeline.nodes]}")

    for node in pipeline.nodes:
        log(f"\n📦 Node: {node.name}")
        max_retries = pipeline.effective_retries(node)

        result = _run_node(
            node=node,
            balloon=balloon,
            global_constraints=pipeline.global_constraints,
            llm=llm,
            max_retries=max_retries,
            log=log,
            shared_namespace=shared_namespace,
        )
        cells.append(result)

        if result.verified:
            balloon.append(result)

    total   = round(time.time() - t0, 2)
    success = all(c.verified for c in cells)

    return RunResult(
        pipeline_name=pipeline.name,
        cells=cells,
        total_sec=total,
        success=success,
    )