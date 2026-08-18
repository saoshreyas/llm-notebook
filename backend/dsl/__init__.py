"""
notebookdsl
~~~~~~~~~~~
A DSL for constrained LLM code generation.

Quick start:
    from dsl import parse_file, run_pipeline, make_litellm_caller

    program  = parse_file("my_pipeline.ndsl")
    pipeline = program.pipelines[0]
    llm      = make_litellm_caller(model="mistral-7b", api_base="http://...")
    result   = run_pipeline(pipeline, llm)
    print(result.summary())
"""

from dsl.parser  import parse_file, parse_string, debug_tree
from dsl.runtime import run_pipeline, make_litellm_caller
from dsl.results import RunResult, CellResult
from dsl.ast_nodes import Program, Pipeline, Node, Constraint, Config

__all__ = [
    "parse_file", "parse_string", "debug_tree",
    "run_pipeline", "make_litellm_caller",
    "RunResult", "CellResult",
    "Program", "Pipeline", "Node", "Constraint", "Config",
]
