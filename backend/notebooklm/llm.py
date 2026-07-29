"""
LiteLLM client — OpenRouter by default; optional OpenAI-compatible (vLLM) override.
"""
from __future__ import annotations

import os
from typing import Callable, List, Optional

LLMCallable = Callable[[List[dict], float], str]

DEFAULT_MODEL = os.environ.get(
    "DEFAULT_MODEL",
    "openrouter/openai/gpt-oss-20b:free",
)


def format_litellm_model(model: str) -> str:
    """
    Normalize model ids for LiteLLM.

    - Already prefixed (openrouter/, openai/, huggingface/, …) → keep
    - Bare id with VLLM_BASE_URL set → openai/{model} for local servers
    - Bare id otherwise → openrouter/{model}
    """
    if "/" in model and model.split("/", 1)[0] in (
        "openrouter",
        "openai",
        "huggingface",
        "anthropic",
        "groq",
        "together_ai",
        "mistral",
        "azure",
    ):
        return model
    if os.environ.get("VLLM_BASE_URL"):
        if model.startswith("openai/"):
            return model
        return f"openai/{model}" if "/" not in model or not model.startswith("openai/") else model
    if model.startswith("openrouter/"):
        return model
    return f"openrouter/{model}"


def resolve_api_key() -> Optional[str]:
    return (
        os.environ.get("OPENROUTER_API_KEY")
        or os.environ.get("OPENAI_API_KEY")
        or os.environ.get("HUGGINGFACE_API_KEY")
        or os.environ.get("HF_TOKEN")
    )


def openrouter_configured() -> bool:
    return bool(os.environ.get("OPENROUTER_API_KEY"))


def vllm_base_url() -> Optional[str]:
    return os.environ.get("VLLM_BASE_URL")


def make_litellm_caller(
    model: str,
    *,
    api_base: Optional[str] = None,
    api_key: Optional[str] = None,
    max_tokens: int = 2048,
) -> LLMCallable:
    try:
        from litellm import completion
    except ImportError as e:
        raise RuntimeError("litellm not installed. Run: pip install litellm") from e

    litellm_model = format_litellm_model(model)
    base = api_base if api_base is not None else vllm_base_url()
    key = api_key if api_key is not None else resolve_api_key()

    # OpenAI-compatible local servers need a non-empty key; OpenRouter needs a real one.
    if not key:
        if base:
            key = "dummy"
        else:
            key = "dummy"  # LiteLLM may still fail without OPENROUTER_API_KEY

    def call(messages: List[dict], temperature: float = 0.2) -> str:
        kwargs = {
            "model": litellm_model,
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "api_key": key,
        }
        if base:
            kwargs["api_base"] = base
        resp = completion(**kwargs)
        return resp.choices[0].message.content.strip()

    return call


def make_default_llm_caller(model: Optional[str] = None) -> LLMCallable:
    return make_litellm_caller(model or DEFAULT_MODEL)
