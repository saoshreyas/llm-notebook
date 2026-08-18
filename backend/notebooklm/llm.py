"""
LiteLLM client — Ollama Cloud by default; OpenRouter / local OpenAI-compatible optional.
"""
from __future__ import annotations

import os
from typing import Any, Callable, List, Optional

LLMCallable = Callable[[List[dict], float], str]

OLLAMA_API_BASE_DEFAULT = "https://ollama.com"

DEFAULT_MODEL = os.environ.get(
    "DEFAULT_MODEL",
    "gpt-oss:20b",
)

_KNOWN_PREFIXES = (
    "openrouter",
    "openai",
    "ollama",
    "ollama_chat",
    "huggingface",
    "anthropic",
    "groq",
    "together_ai",
    "mistral",
    "azure",
)


def ollama_api_base() -> str:
    return (
        os.environ.get("OLLAMA_API_BASE")
        or os.environ.get("OLLAMA_HOST")
        or OLLAMA_API_BASE_DEFAULT
    ).rstrip("/")


def ollama_configured() -> bool:
    return bool(os.environ.get("OLLAMA_API_KEY"))


def openrouter_configured() -> bool:
    return bool(os.environ.get("OPENROUTER_API_KEY"))


def vllm_base_url() -> Optional[str]:
    return os.environ.get("VLLM_BASE_URL") or os.environ.get("OPENAI_API_BASE")


def resolve_api_key() -> Optional[str]:
    return (
        os.environ.get("OLLAMA_API_KEY")
        or os.environ.get("OPENROUTER_API_KEY")
        or os.environ.get("OPENAI_API_KEY")
        or os.environ.get("HUGGINGFACE_API_KEY")
        or os.environ.get("HF_TOKEN")
    )


def format_litellm_model(model: str) -> str:
    """
    Normalize model ids for LiteLLM.

    - Already prefixed (ollama_chat/, openrouter/, openai/, …) → keep
      (unless remapped by resolve_runtime_model)
    - OLLAMA_API_KEY set → ollama_chat/{model} (Ollama Cloud / remote host)
    - VLLM_BASE_URL / OPENAI_API_BASE set → openai/{model}
    - else → openrouter/{model}
    """
    raw = (model or "").strip()
    if not raw:
        return raw

    prefix = raw.split("/", 1)[0]
    if prefix in _KNOWN_PREFIXES:
        # Bare "ollama/foo" generate endpoint; prefer chat for NL/workflows.
        if prefix == "ollama":
            return "ollama_chat/" + raw.split("/", 1)[1]
        return raw

    if ollama_configured() and not vllm_base_url():
        return f"ollama_chat/{raw}"
    if vllm_base_url():
        return f"openai/{raw}"
    if raw.startswith("openrouter/"):
        return raw
    return f"openrouter/{raw}"


def resolve_runtime_model(requested: Optional[str] = None) -> str:
    """
    Pick the model actually used for NL→DSL / interpret.

    Workflow DSL often embeds `config.model: "openrouter/…"` from old examples.
    If OpenRouter is not configured but Ollama (or vLLM) is, fall back to
    DEFAULT_MODEL so runs do not 401 against OpenRouter.
    """
    model = (requested or "").strip() or DEFAULT_MODEL
    prefix = model.split("/", 1)[0]

    if prefix == "openrouter" and not openrouter_configured():
        if ollama_configured() or vllm_base_url():
            return DEFAULT_MODEL

    if (
        prefix in ("ollama", "ollama_chat")
        and not ollama_configured()
        and openrouter_configured()
    ):
        return DEFAULT_MODEL

    return model


def _as_text(value: Any) -> Optional[str]:
    if value is None:
        return None
    if isinstance(value, str):
        s = value.strip()
        return s or None
    if isinstance(value, list):
        parts: List[str] = []
        for item in value:
            if isinstance(item, str):
                parts.append(item)
            elif isinstance(item, dict):
                text = item.get("text") or item.get("content")
                if isinstance(text, str):
                    parts.append(text)
            else:
                text = getattr(item, "text", None) or getattr(item, "content", None)
                if isinstance(text, str):
                    parts.append(text)
        joined = "".join(parts).strip()
        return joined or None
    return str(value).strip() or None


def extract_message_text(message: Any) -> str:
    """
    Pull assistant text from a LiteLLM/OpenAI message.

    Reasoning models (e.g. gpt-oss) often return content=None and put the
    usable answer in reasoning / reasoning_content, or exhaust max_tokens on
    thinking so both are empty.
    """
    for attr in ("content", "reasoning_content", "reasoning"):
        text = _as_text(getattr(message, attr, None))
        if text:
            return text

    extra = getattr(message, "model_extra", None) or {}
    if isinstance(extra, dict):
        for key in ("reasoning_content", "reasoning", "content"):
            text = _as_text(extra.get(key))
            if text:
                return text

    if isinstance(message, dict):
        for key in ("content", "reasoning_content", "reasoning"):
            text = _as_text(message.get(key))
            if text:
                return text

    raise RuntimeError(
        "LLM returned empty content (common with free/reasoning models when "
        "thinking uses all max_tokens, or the provider rate-limits). "
        "Retry, raise max_tokens, or set DEFAULT_MODEL to a non-reasoning chat model."
    )


def make_litellm_caller(
    model: str,
    *,
    api_base: Optional[str] = None,
    api_key: Optional[str] = None,
    max_tokens: int = 4096,
) -> LLMCallable:
    try:
        from litellm import completion
    except ImportError as e:
        raise RuntimeError("litellm not installed. Run: pip install litellm") from e

    litellm_model = format_litellm_model(model)
    key = api_key if api_key is not None else resolve_api_key()

    if api_base is not None:
        base: Optional[str] = api_base
    elif vllm_base_url():
        base = vllm_base_url()
    elif litellm_model.startswith("ollama_chat/") or litellm_model.startswith("ollama/"):
        base = ollama_api_base()
    else:
        base = None

    # Local OpenAI-compatible servers accept any non-empty key.
    if not key:
        key = "dummy"

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
        choice = resp.choices[0]
        return extract_message_text(choice.message)

    return call


def make_default_llm_caller(model: Optional[str] = None) -> LLMCallable:
    return make_litellm_caller(model or DEFAULT_MODEL)
