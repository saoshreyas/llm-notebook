"""
LLM Notebook Backend
FastAPI server with two-stage processing: Translation (lowercase) and Interpretation (balloon counting)
Connects to vLLM servers via LiteLLM.
"""

import os
import re
import json
import time
from typing import List, Optional
from urllib.parse import quote

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

try:
    from litellm import completion
    LITELLM_AVAILABLE = True
except ImportError:
    LITELLM_AVAILABLE = False
    print("Warning: LiteLLM not installed. Run: pip install litellm")

app = FastAPI(
    title="LLM Notebook API",
    description="Two-stage text processing: Translation + Balloon Interpretation",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

VLLM_BASE_URL = os.environ.get("VLLM_BASE_URL", "http://localhost:8000/v1")
DEFAULT_MODEL = os.environ.get("DEFAULT_MODEL", "meta-llama/Llama-2-7b-chat-hf")


# ── Request / Response Models ──────────────────────────────────────────────

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
    vllm_configured: bool
    vllm_base_url: str
    default_model: str


# ── Endpoints ──────────────────────────────────────────────────────────────

@app.get("/health", response_model=HealthResponse)
async def health_check():
    return HealthResponse(
        status="healthy",
        litellm_available=LITELLM_AVAILABLE,
        vllm_configured=VLLM_BASE_URL != "http://localhost:8000/v1"
            or os.environ.get("VLLM_BASE_URL") is not None,
        vllm_base_url=VLLM_BASE_URL,
        default_model=DEFAULT_MODEL,
    )


@app.get("/")
async def root():
    return {
        "message": "LLM Notebook API v2.0",
        "endpoints": {
            "health": "/health",
            "translate": "/translate",
            "interpret": "/interpret",
            "models": "/models",
            "docs": "/docs",
        },
    }


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
            max_tokens=1024,
            temperature=0.0,
        )
        translated = response.choices[0].message.content.strip()
    except Exception as exc:
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
            {"id": "meta-llama/Llama-2-7b-chat-hf", "name": "Llama 2 7B Chat"},
            {"id": "mistralai/Mistral-7B-Instruct-v0.2", "name": "Mistral 7B Instruct"},
        ],
        "default": DEFAULT_MODEL,
    }


# Keep the old /process endpoint for backwards compatibility
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


# ── Helpers ────────────────────────────────────────────────────────────────

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

    print("Starting LLM Notebook Backend v2.0")
    print(f"  vLLM Server : {VLLM_BASE_URL}")
    print(f"  Model       : {DEFAULT_MODEL}")
    print(f"  API Docs    : http://localhost:8000/docs")
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")
