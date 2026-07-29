"""
NotebookLM — host SDK for DSL languages (semantic interpreters) + notebook app CLI.
"""
from __future__ import annotations

from notebooklm.registry import (
    clear_registry,
    get_language,
    interpret,
    list_languages,
    register_language,
)
from notebooklm.types import HistoryItem, NodeResult, RunResult

__all__ = [
    "HistoryItem",
    "NodeResult",
    "RunResult",
    "clear_registry",
    "get_language",
    "interpret",
    "list_languages",
    "register_language",
]

__version__ = "0.4.0"
