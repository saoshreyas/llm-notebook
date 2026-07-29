"""
Workflow DSL language plugin for NotebookLM.

Registers itself as language name \"workflow\" on import.
"""
from __future__ import annotations

from typing import Any, Callable, Dict, List, Optional

from notebooklm.registry import register_language
from notebooklm.types import RunResult
from workflow_dsl import interpreter as _interp
from workflow_dsl.parser import parse_string
from workflow_dsl.ast_nodes import Program

LLMCallable = Callable[[List[dict], float], str]


class WorkflowLanguage:
    name = "workflow"

    def parse(self, source: str) -> Program:
        return parse_string(source)

    def check_syntax(self, source: str) -> None:
        parse_string(source)

    def interpret(
        self,
        ast: Any,
        *,
        llm: LLMCallable,
        inputs: Optional[Dict[str, Any]] = None,
        balloon_seed: Optional[Dict[str, Any]] = None,
        log: Callable[[str], None] = print,
        workflow: Optional[str] = None,
    ) -> RunResult:
        return _interp.interpret_program(
            ast,
            llm,
            inputs=inputs,
            balloon_seed=balloon_seed,
            log=log,
            workflow=workflow,
        )


register_language(WorkflowLanguage())

__all__ = ["WorkflowLanguage"]
