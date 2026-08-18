"""
notebookdsl.runtime
~~~~~~~~~~~~~~~~~~~
Orchestrates a parsed Pipeline: dispatches each node to code or LLM executors.
"""
from __future__ import annotations

import os
import time
from typing import Callable, List, Optional

from dsl.ast_nodes import Pipeline
from dsl.executors import run_code_node, run_llm_node
from dsl.results import CellResult, RunResult

LLMCallable = Callable[[List[dict], float], str]


def format_litellm_model(model: str) -> str:
    if "/" not in model:
        return f"openai/{model}"
    if model.startswith(
        ("huggingface/", "anthropic/", "openai/", "groq/", "together_ai/", "mistral/")
    ):
        return model
    return f"openai/{model}"


def make_litellm_caller(
    model: str,
    api_base: str,
    max_tokens: int = 1500,
    api_key: Optional[str] = None,
    timeout: float = 120.0,
) -> LLMCallable:
    try:
        from litellm import completion
    except ImportError:
        raise RuntimeError("litellm not installed. Run: pip install litellm")

    if not (api_base or "").strip():
        raise RuntimeError(
            "VLLM_BASE_URL is not set. Export your OpenAI-compatible LLM URL "
            "(e.g. http://localhost:8001/v1) before calling the translator or interpreter."
        )

    litellm_model = format_litellm_model(model)

    resolved_key = (
        api_key
        or os.environ.get("OPENAI_API_KEY")
        or os.environ.get("HUGGINGFACE_API_KEY")
        or os.environ.get("HF_TOKEN")
        or "dummy"
    )

    def call(messages: List[dict], temperature: float = 0.2) -> str:
        kwargs = {
            "model": litellm_model,
            "messages": messages,
            "api_base": api_base,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "api_key": resolved_key,
            "timeout": timeout,
        }
        resp = completion(**kwargs)
        return resp.choices[0].message.content.strip()

    return call


def run_pipeline(
    pipeline: Pipeline,
    llm: LLMCallable,
    log: Callable[[str], None] = print,
    model_override: Optional[str] = None,
) -> RunResult:
    """
    Execute a parsed Pipeline:
      - kind: code  → generate → verify → execute
      - kind: llm   → direct prompt call; result stored in shared namespace
      Verified cells enter the balloon for downstream steps.
    """
    del model_override
    t0 = time.time()
    balloon: List[CellResult] = []
    cells: List[CellResult] = []
    shared_namespace: dict = {}

    log(f"\n🚀 Running pipeline: {pipeline.name}")
    if pipeline.description:
        log(f"   {pipeline.description}")
    log(f"   Nodes: {[f'{n.name}({n.kind})' for n in pipeline.nodes]}")

    for node in pipeline.nodes:
        log(f"\n📦 Node: {node.name} [{node.kind}]")
        max_retries = pipeline.effective_retries(node)

        if node.kind == "llm":
            result = run_llm_node(
                node=node,
                balloon=balloon,
                global_constraints=pipeline.global_constraints,
                llm=llm,
                max_retries=max_retries,
                log=log,
                shared_namespace=shared_namespace,
            )
        else:
            result = run_code_node(
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

    total = round(time.time() - t0, 2)
    success = all(c.verified for c in cells)

    return RunResult(
        pipeline_name=pipeline.name,
        cells=cells,
        total_sec=total,
        success=success,
    )
