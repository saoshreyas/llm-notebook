"""
LLM Notebook Backend
FastAPI server: natural language → NotebookDSL (/dsl/nl_to_dsl), then interpreter
(parse → generate → verify → execute via /dsl/run_text). Legacy /translate and /interpret remain.
LiteLLM connects to OpenAI-compatible (vLLM) or provider-prefixed models (e.g. huggingface/...).
"""

import os
import re
import sys
import json
import time
from pathlib import Path
from typing import List, Optional
from urllib.parse import quote

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# ── DSL import (dsl/ folder must live next to this file) ──────────────────────
sys.path.insert(0, str(Path(__file__).parent))

try:
    from dsl.parser import parse_string
    from dsl.prompt_loader import DSL_CHEAT_SHEET, render_template
    from dsl.runtime import run_pipeline, make_litellm_caller
    DSL_AVAILABLE = True
except ImportError as _dsl_err:
    DSL_AVAILABLE = False
    print(f"⚠️  DSL not available: {_dsl_err}")
    print("   Copy the dsl/ folder into your backend/ directory to enable DSL mode.")

try:
    from litellm import completion
    LITELLM_AVAILABLE = True
except ImportError:
    LITELLM_AVAILABLE = False
    print("Warning: LiteLLM not installed. Run: pip install litellm")

app = FastAPI(
    title="LLM Notebook API",
    description="Two-stage text processing: Translation + Balloon Interpretation + NotebookDSL",
    version="2.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

VLLM_BASE_URL = os.environ.get("VLLM_BASE_URL", "http://localhost:8000/v1")
DEFAULT_MODEL = os.environ.get(
    "DEFAULT_MODEL",
    "meta-llama/Llama-2-7b-chat-hf",
)


def _optional_llm_api_key() -> Optional[str]:
    return (
        os.environ.get("HUGGINGFACE_API_KEY")
        or os.environ.get("HF_TOKEN")
        or os.environ.get("OPENAI_API_KEY")
    )


def _litellm_api_key() -> str:
    """LiteLLM's OpenAI client requires a non-empty key; local vLLM ignores placeholders."""
    return _optional_llm_api_key() or "dummy"


def _strip_md_fences(text: str) -> str:
    s = text.strip()
    m = re.search(r"```(?:[\w.-]+\s*\n)?([\s\S]*?)```", s)
    if m:
        return m.group(1).strip()
    return s


def _raise_if_llm_unreachable(exc: BaseException) -> None:
    """
    OpenAI/LiteLLM report connection failures as long chains. Map them to 503
    so the client sees a clear 'start vLLM / fix VLLM_BASE_URL' message.
    """
    seen: set[int] = set()
    parts: list[str] = []
    e: Optional[BaseException] = exc
    while e is not None and id(e) not in seen and len(parts) < 10:
        seen.add(id(e))
        parts.append(f"{type(e).__name__}: {e}")
        e = e.__cause__ or e.__context__
    blob = " ".join(parts).lower()
    if not any(
        s in blob
        for s in (
            "10061",
            "actively refused",
            "connection refused",
            "connection error",
            "failed to establish",
            "name or service not known",
            "nodename nor servname",
            "temporary failure in name resolution",
        )
    ):
        return
    raise HTTPException(
        status_code=503,
        detail=(
            f"Cannot reach the LLM server at {VLLM_BASE_URL}. "
            "Start an OpenAI-compatible server (e.g. vLLM) on that host and port, "
            "or set VLLM_BASE_URL to match it (vLLM chat API is usually …/v1). "
            f"Original: {parts[0] if parts else exc!r}"
        ),
    ) from exc


# ── Request / Response Models ──────────────────────────────────────────────────

class TranslateRequest(BaseModel):
    text: str
    model: Optional[str] = None

class TranslateResponse(BaseModel):
    original_text: str
    translated_text: str
    processing_time: float

class InterpretRequest(BaseModel):
    text: str
    model: Optional[str] = None

class InterpretResponse(BaseModel):
    text: str
    balloon_count: int
    balloon_images: List[str]
    processing_time: float

class HealthResponse(BaseModel):
    status: str
    litellm_available: bool
    dsl_available: bool
    vllm_configured: bool
    vllm_base_url: str
    default_model: str

# DSL models
class DSLTextRequest(BaseModel):
    source:   str
    pipeline: Optional[str] = None
    model:    Optional[str] = None

class DSLCellResult(BaseModel):
    node_name:    str
    intent:       str
    code:         str
    verified:     bool
    violations:   List[str]
    attempts:     int
    output_type:  Optional[str]
    duration_sec: float
    executed:     bool = False
    exec_output:  Optional[str] = None
    exec_result:  Optional[str] = None
    exec_error:   Optional[str] = None

class DSLRunResponse(BaseModel):
    pipeline_name: str
    success:       bool
    total_sec:     float
    balloon_size:  int
    cells:         List[DSLCellResult]


class NLHistoryItem(BaseModel):
    """Prior notebook cells for NL→DSL context."""
    natural_language: Optional[str] = None
    dsl_source:       Optional[str] = None
    summary:          Optional[str] = None


class NLToDSLRequest(BaseModel):
    text:               str
    model:              Optional[str] = None
    notebook_history:   Optional[List[NLHistoryItem]] = None


class NLToDSLResponse(BaseModel):
    dsl_source:       str
    processing_time:  float
    parse_ok:         Optional[bool] = None
    parse_error:      Optional[str] = None
    parse_attempts:   int = 1  # LLM calls until parse succeeded or max retries


def _format_notebook_history(history: Optional[List[NLHistoryItem]]) -> str:
    if not history:
        return "(no prior cells — this is the first request.)"
    parts: List[str] = []
    for i, h in enumerate(history, 1):
        bits = [f"--- prior cell {i} ---"]
        if h.natural_language:
            bits.append(f"Natural language: {h.natural_language}")
        if h.dsl_source:
            bits.append(f"DSL (.ndsl):\n{h.dsl_source}")
        if h.summary:
            bits.append(f"Notes: {h.summary}")
        parts.append("\n".join(bits))
    return "\n\n".join(parts)


# ── Health ─────────────────────────────────────────────────────────────────────

@app.get("/health", response_model=HealthResponse)
async def health_check():
    return HealthResponse(
        status="healthy",
        litellm_available=LITELLM_AVAILABLE,
        dsl_available=DSL_AVAILABLE,
        vllm_configured=(
            VLLM_BASE_URL != "http://localhost:8000/v1"
            or os.environ.get("VLLM_BASE_URL") is not None
        ),
        vllm_base_url=VLLM_BASE_URL,
        default_model=DEFAULT_MODEL,
    )

@app.get("/")
async def root():
    return {
        "message": "LLM Notebook API v2.1",
        "endpoints": {
            "health":     "/health",
            "translate":  "/translate",
            "interpret":  "/interpret",
            "dsl_run":      "/dsl/run_text",
            "dsl_nl":       "/dsl/nl_to_dsl",
            "dsl_check":    "/dsl/check_syntax",
            "dsl_execute":  "/dsl/execute",
            "models":       "/models",
            "docs":       "/docs",
        },
    }


# ── Original two-stage endpoints (UNCHANGED) ───────────────────────────────────

@app.post("/translate", response_model=TranslateResponse)
async def translate_text(request: TranslateRequest):
    """Stage 1: Translate input text to lowercase via LLM."""
    start = time.time()
    if not LITELLM_AVAILABLE:
        raise HTTPException(status_code=503, detail="LiteLLM is not installed.")
    model_name = request.model or DEFAULT_MODEL
    try:
        response = completion(
            model=f"openai/{model_name}",
            messages=[{
                "role": "user",
                "content": (
                    "Convert the following text to lowercase. "
                    "Return ONLY the lowercased text with no extra commentary:\n\n"
                    f"{request.text}"
                ),
            }],
            api_base=VLLM_BASE_URL,
            api_key=_litellm_api_key(),
            max_tokens=1024,
            temperature=0.0,
        )
        translated = response.choices[0].message.content.strip()
    except Exception:
        translated = request.text.lower()
    return TranslateResponse(
        original_text=request.text,
        translated_text=translated,
        processing_time=round(time.time() - start, 3),
    )


@app.post("/interpret", response_model=InterpretResponse)
async def interpret_text(request: InterpretRequest):
    """Stage 2: Count 'balloon' occurrences and generate balloon images."""
    start = time.time()
    balloon_count = len(re.findall(r"balloon", request.text, re.IGNORECASE))
    balloon_images: List[str] = []
    if balloon_count > 0:
        colors = _get_balloon_colors(balloon_count, request.model)
        for i in range(balloon_count):
            color = colors[i % len(colors)]
            svg = _balloon_svg(color, i)
            balloon_images.append(f"data:image/svg+xml,{quote(svg)}")
    return InterpretResponse(
        text=request.text,
        balloon_count=balloon_count,
        balloon_images=balloon_images,
        processing_time=round(time.time() - start, 3),
    )


@app.get("/models")
async def list_models():
    return {
        "models": [
            {"id": "meta-llama/Llama-2-7b-chat-hf",      "name": "Llama 2 7B Chat"},
            {"id": "mistralai/Mistral-7B-Instruct-v0.2",  "name": "Mistral 7B Instruct"},
        ],
        "default": DEFAULT_MODEL,
    }


# Legacy /process
class ProcessRequest(BaseModel):
    text: str
    model: Optional[str] = None

class ProcessResponse(BaseModel):
    original_text: str
    translated_text: str
    balloon_count: int
    balloon_images: List[str]
    processing_time: float

@app.post("/process", response_model=ProcessResponse)
async def process_text(request: ProcessRequest):
    """Legacy endpoint that runs both stages."""
    t = await translate_text(TranslateRequest(text=request.text, model=request.model))
    i = await interpret_text(InterpretRequest(text=t.translated_text, model=request.model))
    return ProcessResponse(
        original_text=request.text,
        translated_text=t.translated_text,
        balloon_count=i.balloon_count,
        balloon_images=i.balloon_images,
        processing_time=round(t.processing_time + i.processing_time, 3),
    )


# ── NEW: DSL endpoints ─────────────────────────────────────────────────────────

@app.post("/dsl/run_text", response_model=DSLRunResponse)
async def run_dsl_text(request: DSLTextRequest):
    """
    Accept raw .ndsl source from the frontend textarea.
    Parse it, run the generate→verify loop, return all cell results.
    """
    if not DSL_AVAILABLE:
        raise HTTPException(
            status_code=503,
            detail="DSL not available. Copy the dsl/ folder into backend/.",
        )
    if not LITELLM_AVAILABLE:
        raise HTTPException(status_code=503, detail="LiteLLM is not installed.")

    # Parse
    try:
        program = parse_string(request.source)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"DSL parse error: {e}")

    if not program.pipelines:
        raise HTTPException(status_code=400, detail="No pipeline found in source.")

    # Select pipeline
    if request.pipeline:
        pipeline = program.get(request.pipeline)
        if pipeline is None:
            names = [p.name for p in program.pipelines]
            raise HTTPException(
                status_code=404,
                detail=f"Pipeline '{request.pipeline}' not found. Available: {names}",
            )
    else:
        pipeline = program.pipelines[0]

    # Build LLM caller
    model = request.model or pipeline.config.model or DEFAULT_MODEL
    try:
        llm = make_litellm_caller(
            model=model,
            api_base=VLLM_BASE_URL,
            api_key=_optional_llm_api_key(),
        )
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))

    # Run
    logs: List[str] = []
    try:
        result = run_pipeline(pipeline, llm, log=logs.append)
    except Exception as e:
        _raise_if_llm_unreachable(e)
        raise

    return DSLRunResponse(
        pipeline_name=result.pipeline_name,
        success=result.success,
        total_sec=result.total_sec,
        balloon_size=result.balloon_size,
        cells=[
            DSLCellResult(
                node_name=c.node_name,
                intent=c.intent,
                code=c.code,
                verified=c.verified,
                violations=c.violations,
                attempts=c.attempts,
                output_type=c.output_type,
                duration_sec=c.duration_sec,
                executed=c.executed,
                exec_output=c.exec_output,
                exec_result=c.exec_result,
                exec_error=c.exec_error,
            )
            for c in result.cells
        ],
    )


@app.post("/dsl/nl_to_dsl", response_model=NLToDSLResponse)
async def nl_to_dsl(request: NLToDSLRequest):
    """
    Translate natural language into NotebookDSL (.ndsl) source.
    The interpreter (parse + run_pipeline) runs separately — this endpoint
    only produces the DSL text.
    """
    if not DSL_AVAILABLE:
        raise HTTPException(
            status_code=503,
            detail="DSL not available. Copy the dsl/ folder into backend/.",
        )
    if not LITELLM_AVAILABLE:
        raise HTTPException(status_code=503, detail="LiteLLM is not installed.")

    model = request.model or DEFAULT_MODEL
    start = time.time()
    try:
        llm = make_litellm_caller(
            model=model,
            api_base=VLLM_BASE_URL,
            api_key=_optional_llm_api_key(),
        )
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))

    max_parse = max(1, int(os.environ.get("NL_PARSE_MAX_ATTEMPTS", "3")))
    system = render_template("nl_to_dsl_system.j2")
    dsl_source = ""
    parse_ok: Optional[bool] = None
    parse_error: Optional[str] = None
    attempts_used = 0

    for attempt in range(1, max_parse + 1):
        attempts_used = attempt
        repair = attempt > 1
        user = render_template(
            "nl_to_dsl_user.j2",
            dsl_cheat_sheet=DSL_CHEAT_SHEET,
            history_block=_format_notebook_history(request.notebook_history),
            user_text=request.text.strip(),
            repair_block=repair,
            parse_error=parse_error or "",
            failed_dsl=dsl_source if repair else "",
            parse_attempt=attempt,
            parse_max_attempts=max_parse,
        )
        try:
            raw = llm(
                [
                    {"role": "system", "content": system},
                    {"role": "user",   "content": user},
                ],
                temperature=0.2 if attempt == 1 else 0.4,
            )
        except Exception as e:
            _raise_if_llm_unreachable(e)
            raise
        dsl_source = _strip_md_fences(raw)
        try:
            parse_string(dsl_source)
            parse_ok = True
            parse_error = None
            break
        except Exception as e:
            parse_ok = False
            parse_error = str(e)

    return NLToDSLResponse(
        dsl_source=dsl_source,
        processing_time=round(time.time() - start, 3),
        parse_ok=parse_ok,
        parse_error=parse_error,
        parse_attempts=attempts_used,
    )


@app.post("/dsl/check_syntax")
async def check_dsl_syntax(request: DSLTextRequest):
    """
    Validate .ndsl syntax without calling the LLM.
    Called by the frontend on-the-fly as the user types.
    """
    if not DSL_AVAILABLE:
        raise HTTPException(status_code=503, detail="DSL not available.")
    try:
        program = parse_string(request.source)
        return {
            "valid": True,
            "pipelines": [
                {
                    "name":               p.name,
                    "nodes":              [n.name for n in p.nodes],
                    "global_constraints": len(p.global_constraints),
                }
                for p in program.pipelines
            ],
        }
    except Exception as e:
        return {"valid": False, "error": str(e)}


class DSLExecuteRequest(BaseModel):
    code: str   # the (possibly user-edited) code to run

class DSLExecuteResponse(BaseModel):
    output: Optional[str]   # combined stdout
    error:  Optional[str]   # traceback if it crashed


@app.post("/dsl/execute", response_model=DSLExecuteResponse)
async def execute_dsl_code(request: DSLExecuteRequest):
    """
    Stage 2: Execute the generated (and possibly user-edited) code.
    Runs in an isolated namespace, captures stdout and errors.
    """
    import io
    import traceback
    from contextlib import redirect_stdout, redirect_stderr

    stdout_buf = io.StringIO()
    stderr_buf = io.StringIO()
    namespace  = {}

    try:
        with redirect_stdout(stdout_buf), redirect_stderr(stderr_buf):
            exec(compile(request.code, "<dsl_execute>", "exec"), namespace)

        stdout_text = stdout_buf.getvalue().strip()
        stderr_text = stderr_buf.getvalue().strip()

        # Collect any non-dunder, non-callable values as extra output
        results = []
        for k, v in namespace.items():
            if not k.startswith("_") and not callable(v):
                results.append(f"{k} = {repr(v)}")

        parts = list(filter(None, [stdout_text, stderr_text]))
        if results:
            parts.append("\n".join(results))

        return DSLExecuteResponse(
            output="\n\n".join(parts) if parts else None,
            error=None,
        )

    except Exception:
        tb = traceback.format_exc()
        return DSLExecuteResponse(
            output=stdout_buf.getvalue().strip() or None,
            error=tb.strip(),
        )


# ── Helpers (UNCHANGED) ────────────────────────────────────────────────────────

FALLBACK_COLORS = [
    "#FF6B6B", "#4ECDC4", "#FFE66D", "#95E1D3", "#A8E6CF",
    "#FF8B94", "#C7CEEA", "#FFB6C1", "#87CEEB", "#FFA07A",
]

def _get_balloon_colors(count: int, model: Optional[str] = None) -> List[str]:
    if not LITELLM_AVAILABLE:
        return FALLBACK_COLORS
    model_name = model or DEFAULT_MODEL
    try:
        resp = completion(
            model=f"openai/{model_name}",
            messages=[{
                "role": "user",
                "content": (
                    f"Suggest {count} vibrant balloon colors. "
                    'Return ONLY a JSON array of hex codes like ["#FF6B6B","#4ECDC4"]. No other text.'
                ),
            }],
            api_base=VLLM_BASE_URL,
            api_key=_litellm_api_key(),
            max_tokens=200,
            temperature=0.7,
        )
        raw = resp.choices[0].message.content.strip()
        raw = raw.replace("```json", "").replace("```", "").strip()
        return json.loads(raw)
    except Exception:
        return FALLBACK_COLORS


def _balloon_svg(color: str, index: int) -> str:
    darker = _adjust_brightness(color, -25)
    return f"""<svg width="100" height="140" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g{index}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:{color};stop-opacity:1"/>
      <stop offset="100%" style="stop-color:{darker};stop-opacity:1"/>
    </linearGradient>
    <filter id="s{index}">
      <feGaussianBlur in="SourceAlpha" stdDeviation="3"/>
      <feOffset dx="0" dy="4" result="offsetblur"/>
      <feComponentTransfer><feFuncA type="linear" slope="0.3"/></feComponentTransfer>
      <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <ellipse cx="50" cy="50" rx="38" ry="45" fill="url(#g{index})" stroke="#333" stroke-width="2" filter="url(#s{index})"/>
  <path d="M50 95 Q45 115 50 130" stroke="#666" stroke-width="2.5" fill="none" stroke-linecap="round"/>
  <ellipse cx="35" cy="35" rx="10" ry="12" fill="white" opacity="0.7"/>
  <ellipse cx="32" cy="32" rx="5" ry="6" fill="white" opacity="0.9"/>
  <path d="M48 130 L46 132 L50 133 L54 132 L52 130" fill="#333" opacity="0.6"/>
</svg>"""


def _adjust_brightness(hex_color: str, percent: int) -> str:
    h = hex_color.lstrip("#")
    r = max(0, min(255, int(h[0:2], 16) + int(255 * percent / 100)))
    g = max(0, min(255, int(h[2:4], 16) + int(255 * percent / 100)))
    b = max(0, min(255, int(h[4:6], 16) + int(255 * percent / 100)))
    return f"#{r:02x}{g:02x}{b:02x}"


if __name__ == "__main__":
    import uvicorn
    print("Starting LLM Notebook Backend v2.1 + DSL")
    print(f"  vLLM Server : {VLLM_BASE_URL}")
    print(f"  Model       : {DEFAULT_MODEL}")
    print(f"  DSL         : {'✓ available' if DSL_AVAILABLE else '✗ not found — copy dsl/ into backend/'}")
    print(f"  API Docs    : http://localhost:8000/docs")
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")