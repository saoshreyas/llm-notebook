"""
NotebookLM FastAPI app — thin HTTP over notebooklm + workflow_dsl.
"""
from __future__ import annotations

import os
import sys
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# Ensure backend/ is on path when run as module or script
_BACKEND = Path(__file__).resolve().parent.parent
if str(_BACKEND) not in sys.path:
    sys.path.insert(0, str(_BACKEND))

from notebooklm.env import load_env

load_env()

import workflow_dsl  # noqa: F401 — registers language
from notebooklm.context import balloon_seed_from_history
from notebooklm.llm import (
    DEFAULT_MODEL,
    make_litellm_caller,
    ollama_api_base,
    ollama_configured,
    openrouter_configured,
    resolve_api_key,
    resolve_runtime_model,
    vllm_base_url,
)
from notebooklm.registry import get_language, interpret, list_languages
from notebooklm.types import HistoryItem
from workflow_dsl.nl import nl_to_dsl
from workflow_dsl.parser import parse_string

try:
    from litellm import completion  # noqa: F401

    LITELLM_AVAILABLE = True
except ImportError:
    LITELLM_AVAILABLE = False

app = FastAPI(
    title="NotebookLM API",
    description="NL → Workflow DSL → semantic interpreter (Ollama Cloud / LiteLLM)",
    version="0.4.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Models ────────────────────────────────────────────────────────────────────


class HealthResponse(BaseModel):
    status: str
    litellm_available: bool
    workflow_available: bool
    ollama_configured: bool
    openrouter_configured: bool
    ollama_api_base: Optional[str]
    vllm_base_url: Optional[str]
    default_model: str
    languages: List[str]


class NLHistoryItem(BaseModel):
    natural_language: Optional[str] = None
    dsl_source: Optional[str] = None
    summary: Optional[str] = None
    outputs: Optional[Dict[str, str]] = None


class NLToDSLRequest(BaseModel):
    text: str
    model: Optional[str] = None
    notebook_history: Optional[List[NLHistoryItem]] = None


class NLToDSLResponse(BaseModel):
    dsl_source: str
    processing_time: float
    parse_ok: Optional[bool] = None
    parse_error: Optional[str] = None
    parse_attempts: int = 1


class WorkflowRunRequest(BaseModel):
    source: str
    workflow: Optional[str] = None
    model: Optional[str] = None
    inputs: Optional[Dict[str, Any]] = None
    notebook_history: Optional[List[NLHistoryItem]] = None


class NodeResultModel(BaseModel):
    node_name: str
    kind: str
    success: bool
    attempts: int
    duration_sec: float
    output_name: Optional[str] = None
    output_value: Optional[str] = None
    stdout: Optional[str] = None
    error: Optional[str] = None
    violations: List[str] = Field(default_factory=list)
    prompt_rendered: Optional[str] = None
    code: Optional[str] = None


class WorkflowRunResponse(BaseModel):
    workflow_name: str
    success: bool
    total_sec: float
    balloon_size: int
    nodes: List[NodeResultModel]


class CheckSyntaxRequest(BaseModel):
    source: str


def _history_items(
    raw: Optional[List[NLHistoryItem]],
) -> Optional[List[HistoryItem]]:
    if not raw:
        return None
    return [
        HistoryItem(
            natural_language=h.natural_language,
            dsl_source=h.dsl_source,
            summary=h.summary,
            outputs=h.outputs,
        )
        for h in raw
    ]


def _raise_if_llm_unreachable(exc: BaseException) -> None:
    seen: set[int] = set()
    parts: list[str] = []
    e: Optional[BaseException] = exc
    while e is not None and id(e) not in seen and len(parts) < 10:
        seen.add(id(e))
        parts.append(f"{type(e).__name__}: {e}")
        e = e.__cause__ or e.__context__
    blob = " ".join(parts).lower()
    if "requires a subscription" in blob or "upgrade for access" in blob:
        raise HTTPException(
            status_code=403,
            detail=(
                "This Ollama Cloud model needs a paid plan. "
                "Switch DEFAULT_MODEL in .env to a free-tier model "
                "(e.g. gpt-oss:20b, gemma3:12b) or upgrade at "
                "https://ollama.com/upgrade"
            ),
        ) from exc
    if not any(
        s in blob
        for s in (
            "10061",
            "actively refused",
            "connection refused",
            "connection error",
            "failed to establish",
            "401",
            "unauthorized",
            "invalid api key",
            "authentication",
            "403",
            "forbidden",
        )
    ):
        return
    hint = (
        "Set OLLAMA_API_KEY in repo-root .env (https://ollama.com/settings/keys), "
        "or OPENROUTER_API_KEY / VLLM_BASE_URL."
    )
    raise HTTPException(
        status_code=503,
        detail=f"LLM unreachable or unauthorized. {hint} Original: {parts[0] if parts else exc!r}",
    ) from exc


# ── Routes ────────────────────────────────────────────────────────────────────


@app.get("/health", response_model=HealthResponse)
async def health_check():
    return HealthResponse(
        status="healthy",
        litellm_available=LITELLM_AVAILABLE,
        workflow_available="workflow" in list_languages(),
        ollama_configured=ollama_configured(),
        openrouter_configured=openrouter_configured(),
        ollama_api_base=ollama_api_base() if ollama_configured() else None,
        vllm_base_url=vllm_base_url(),
        default_model=DEFAULT_MODEL,
        languages=list_languages(),
    )


@app.get("/")
async def root():
    return {
        "message": "NotebookLM API",
        "version": "0.4.0",
        "endpoints": {
            "health": "/health",
            "nl_to_dsl": "/workflow/nl_to_dsl",
            "run": "/workflow/run",
            "check_syntax": "/workflow/check_syntax",
            "models": "/models",
            "docs": "/docs",
        },
    }


@app.get("/models")
async def list_models():
    return {
        "default": DEFAULT_MODEL,
        "models": [
            {"id": "gpt-oss:20b", "name": "GPT-OSS 20B (Ollama Cloud, often free)"},
            {"id": "gpt-oss:120b", "name": "GPT-OSS 120B (Ollama Cloud)"},
            {"id": "gemma3:12b", "name": "Gemma 3 12B (Ollama Cloud)"},
            {"id": "glm-4.7", "name": "GLM 4.7 (Ollama Cloud)"},
            {
                "id": "deepseek-v4-flash",
                "name": "DeepSeek V4 Flash (usually paid)",
            },
        ],
        "note": (
            "Default path: OLLAMA_API_KEY in repo-root .env. "
            "Some cloud models require https://ollama.com/upgrade."
        ),
    }


@app.post("/workflow/check_syntax")
async def check_syntax(request: CheckSyntaxRequest):
    try:
        get_language("workflow").check_syntax(request.source)
        return {"ok": True, "error": None}
    except Exception as e:
        return {"ok": False, "error": str(e)}


@app.post("/workflow/nl_to_dsl", response_model=NLToDSLResponse)
async def workflow_nl_to_dsl(request: NLToDSLRequest):
    if not LITELLM_AVAILABLE:
        raise HTTPException(status_code=503, detail="LiteLLM is not installed.")
    if not resolve_api_key() and not vllm_base_url():
        raise HTTPException(
            status_code=503,
            detail="Set OLLAMA_API_KEY in repo-root .env (or OPENROUTER_API_KEY / VLLM_BASE_URL).",
        )

    model = request.model or DEFAULT_MODEL
    try:
        llm = make_litellm_caller(resolve_runtime_model(model))
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e

    try:
        dsl_source, parse_ok, parse_error, attempts, elapsed = nl_to_dsl(
            request.text,
            llm,
            notebook_history=_history_items(request.notebook_history),
        )
    except RuntimeError as e:
        _raise_if_llm_unreachable(e)
        raise HTTPException(status_code=502, detail=str(e)) from e
    except Exception as e:
        _raise_if_llm_unreachable(e)
        raise

    return NLToDSLResponse(
        dsl_source=dsl_source,
        processing_time=elapsed,
        parse_ok=parse_ok,
        parse_error=parse_error,
        parse_attempts=attempts,
    )


@app.post("/workflow/run", response_model=WorkflowRunResponse)
async def workflow_run(request: WorkflowRunRequest):
    if not LITELLM_AVAILABLE:
        raise HTTPException(status_code=503, detail="LiteLLM is not installed.")
    if not resolve_api_key() and not vllm_base_url():
        raise HTTPException(
            status_code=503,
            detail="Set OLLAMA_API_KEY in repo-root .env (or OPENROUTER_API_KEY / VLLM_BASE_URL).",
        )

    try:
        program = parse_string(request.source)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"DSL parse error: {e}") from e

    if not program.workflows:
        raise HTTPException(status_code=400, detail="No workflow found in source.")

    wf = program.workflows[0]
    if request.workflow:
        found = program.get(request.workflow)
        if found is None:
            names = [w.name for w in program.workflows]
            raise HTTPException(
                status_code=404,
                detail=f"Workflow '{request.workflow}' not found. Available: {names}",
            )
        wf = found

    model = request.model or wf.effective_model() or DEFAULT_MODEL
    try:
        llm = make_litellm_caller(resolve_runtime_model(model))
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e

    seed = balloon_seed_from_history(_history_items(request.notebook_history))
    logs: List[str] = []
    try:
        result = interpret(
            "workflow",
            request.source,
            llm=llm,
            inputs=request.inputs,
            balloon_seed=seed,
            log=logs.append,
            workflow=request.workflow,
        )
    except Exception as e:
        _raise_if_llm_unreachable(e)
        raise

    return WorkflowRunResponse(
        workflow_name=result.workflow_name,
        success=result.success,
        total_sec=result.total_sec,
        balloon_size=result.balloon_size,
        nodes=[
            NodeResultModel(
                node_name=n.node_name,
                kind=n.kind,
                success=n.success,
                attempts=n.attempts,
                duration_sec=n.duration_sec,
                output_name=n.output_name,
                output_value=n.output_value,
                stdout=n.stdout,
                error=n.error,
                violations=n.violations,
                prompt_rendered=n.prompt_rendered,
                code=n.code,
            )
            for n in result.nodes
        ],
    )


def create_app() -> FastAPI:
    return app
