"""
Language plugin registry for NotebookLM.
"""
from __future__ import annotations

from typing import Any, Callable, Dict, List, Optional

from notebooklm.types import Language, RunResult

_REGISTRY: Dict[str, Language] = {}


def register_language(language: Language) -> Language:
    """Register (or replace) a language plugin by its `.name`."""
    if not getattr(language, "name", None):
        raise ValueError("Language plugin must define a non-empty `.name`")
    _REGISTRY[language.name] = language
    return language


def get_language(name: str) -> Language:
    if name not in _REGISTRY:
        available = sorted(_REGISTRY) or ["(none)"]
        raise KeyError(
            f"Language '{name}' is not registered. Available: {', '.join(available)}"
        )
    return _REGISTRY[name]


def list_languages() -> List[str]:
    return sorted(_REGISTRY)


def interpret(
    language: str,
    source: str,
    *,
    llm: Optional[Callable[[List[dict], float], str]] = None,
    inputs: Optional[Dict[str, Any]] = None,
    balloon_seed: Optional[Dict[str, Any]] = None,
    log: Callable[[str], None] = print,
    workflow: Optional[str] = None,
) -> RunResult:
    """
    Parse + semantically interpret `source` with the named language.

    If `llm` is omitted, uses the default OpenRouter/LiteLLM caller from notebooklm.llm.
    """
    lang = get_language(language)
    if llm is None:
        from notebooklm.llm import make_default_llm_caller

        llm = make_default_llm_caller()
    ast = lang.parse(source)
    return lang.interpret(
        ast,
        llm=llm,
        inputs=inputs,
        balloon_seed=balloon_seed,
        log=log,
        workflow=workflow,
    )


def clear_registry() -> None:
    """Test helper: wipe all registered languages."""
    _REGISTRY.clear()
