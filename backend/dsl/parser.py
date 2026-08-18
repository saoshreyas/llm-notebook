"""
notebookdsl.parser
~~~~~~~~~~~~~~~~~~
Reads .ndsl source text -> Program AST.

Usage:
    from dsl.parser import parse_file, parse_string, debug_tree

    program  = parse_file("my_pipeline.ndsl")
    pipeline = program.pipelines[0]
"""
from __future__ import annotations

from pathlib import Path
from typing import Union

from lark import Lark, Transformer, v_args
from lark.indenter import Indenter

from dsl.ast_nodes import Program, Pipeline, Node, Constraint, Config

_GRAMMAR_PATH = Path(__file__).parent / "grammar.lark"


# ── Indentation handler ───────────────────────────────────────────────────────

class NDSLIndenter(Indenter):
    NL_type           = "_NEWLINE"
    OPEN_PAREN_types  = []
    CLOSE_PAREN_types = []
    INDENT_type       = "_INDENT"
    DEDENT_type       = "_DEDENT"
    tab_len           = 2


# ── Tree -> AST transformer ───────────────────────────────────────────────────

@v_args(inline=True)
class NDSLTransformer(Transformer):

    # program
    def start(self, *pipelines):
        return Program(pipelines=list(pipelines))

    # pipeline
    def pipeline(self, _kw, name, _colon, body):
        p = Pipeline(name=str(name))
        for item in body:
            if isinstance(item, tuple) and item[0] == "__desc__":
                p.description = item[1]
            elif isinstance(item, Config):
                p.config = item
            elif isinstance(item, list):          # global constraints
                p.global_constraints = item
            elif isinstance(item, Node):
                p.nodes.append(item)
        return p

    def pipeline_body(self, *items):
        return list(items)

    # description
    def description_stmt(self, _kw, _colon, s):
        return ("__desc__", _unquote(str(s)))

    # config block
    def config_block(self, _kw, _colon, *stmts):
        cfg = Config()
        for k, v in stmts:
            if k == "model":   cfg.model   = v
            if k == "retries": cfg.retries = v
            if k == "backend": cfg.backend = v
        return cfg

    def config_model(self, _kw, _colon, s):   return ("model",   _unquote(str(s)))
    def config_retries(self, _kw, _colon, n): return ("retries", int(n))
    def config_backend(self, _kw, _colon, s): return ("backend", _unquote(str(s)))

    # global block -> list of Constraint
    def global_block(self, _kw, _colon, *constraints):
        return list(constraints)

    # node block
    def node_block(self, _kw, name, _colon, body):
        n = Node(name=str(name))
        for item in body:
            if isinstance(item, Constraint):
                n.constraints.append(item)
            elif isinstance(item, tuple):
                k = item[0]
                if   k == "kind":    n.kind         = item[1]
                elif k == "intent":  n.intent       = item[1]
                elif k == "prompt": n.prompt       = item[1]
                elif k == "input":   n.inputs       = item[1]
                elif k == "output":  n.output_type  = item[1]
                elif k == "retries": n.retries      = item[1]
        if n.kind not in ("code", "llm"):
            raise ValueError(f"Node '{n.name}': kind must be 'code' or 'llm', got {n.kind!r}")
        if n.kind == "llm":
            if not n.prompt:
                raise ValueError(f"Node '{n.name}' (kind: llm) requires a 'prompt:' statement")
        elif not n.intent:
            raise ValueError(f"Node '{n.name}' (kind: code) requires an 'intent:' statement")
        return n

    def node_body(self, *stmts):  return list(stmts)
    def node_stmt(self, item):    return item

    # node field statements
    def kind_stmt(self, _kw, _colon, kind_val):
        return ("kind", str(kind_val))

    def prompt_stmt(self, _kw, _colon, s):
        return ("prompt", _unquote(str(s)))

    def intent_stmt(self, _kw, _colon, s):
        return ("intent", _unquote(str(s)))

    def input_stmt(self, _kw, _colon, names):
        return ("input", names)

    def output_stmt(self, _kw, _colon, s):
        return ("output", _unquote(str(s)))

    def retries_stmt(self, _kw, _colon, n):
        return ("retries", int(n))

    # constraint  (two variants: with and without severity)
    def constraint_stmt(self, *args):
        # with severity:    (_kw, severity_str, _colon, ctext)
        # without severity: (_kw, _colon, ctext)
        if len(args) == 4:
            _kw, sev, _colon, ctext = args
            severity = str(sev)
        else:
            _kw, _colon, ctext = args
            severity = "error"
        return Constraint(rule=str(ctext).strip(), severity=severity)

    def severity(self, tok): return str(tok)

    # namelist -> list of strings
    def namelist(self, *parts):
        # parts may include COMMA tokens between names — filter to NAME only
        return [str(p) for p in parts if str(p) != ","]


# ── helpers ───────────────────────────────────────────────────────────────────

def _unquote(s: str) -> str:
    """Strip surrounding double or single quotes."""
    s = s.strip()
    if (s.startswith('"') and s.endswith('"')) or \
       (s.startswith("'") and s.endswith("'")):
        return s[1:-1]
    return s


def _preprocess(source: str) -> str:
    """
    Remove all comment-only lines (lines whose first non-whitespace char is #).
    The LALR contextual lexer emits _NEWLINE tokens for comment lines even
    after the COMMENT terminal is marked %ignore, which causes parse errors.
    Also strips leading blank lines before the first pipeline keyword.
    """
    lines = []
    for line in source.split("\n"):
        if line.strip().startswith("#"):
            continue          # drop comment-only lines entirely
        lines.append(line)
    # Drop leading blank lines
    while lines and not lines[0].strip():
        lines.pop(0)
    return "\n".join(lines)


# ── Public API ────────────────────────────────────────────────────────────────

_PARSER: Lark | None = None


def _get_parser() -> Lark:
    global _PARSER
    if _PARSER is None:
        grammar = _GRAMMAR_PATH.read_text()
        _PARSER = Lark(
            grammar,
            parser="lalr",
            postlex=NDSLIndenter(),
        )
    return _PARSER


def parse_string(source: str) -> Program:
    """Parse an NDSL source string and return a Program AST."""
    source = _preprocess(source)
    if not source.endswith("\n"):
        source += "\n"
    tree = _get_parser().parse(source)
    return NDSLTransformer().transform(tree)


def parse_file(path: Union[str, Path]) -> Program:
    """Parse a .ndsl file and return a Program AST."""
    return parse_string(Path(path).read_text())


def debug_tree(source: str) -> str:
    """Return the raw Lark parse tree (for debugging)."""
    source = _preprocess(source)
    if not source.endswith("\n"):
        source += "\n"
    return _get_parser().parse(source).pretty()
