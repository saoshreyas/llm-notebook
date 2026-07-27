"""
Parse .wfl source → Program AST.
"""
from __future__ import annotations

from pathlib import Path
from typing import Union

from lark import Lark, Transformer, v_args
from lark.indenter import Indenter

from workflow_dsl.ast_nodes import Config, Constraint, Node, Program, Workflow

_GRAMMAR_PATH = Path(__file__).parent / "grammar.lark"


class WFLIndenter(Indenter):
    NL_type = "_NEWLINE"
    OPEN_PAREN_types = []
    CLOSE_PAREN_types = []
    INDENT_type = "_INDENT"
    DEDENT_type = "_DEDENT"
    tab_len = 2


def _unquote(s: str) -> str:
    s = s.strip()
    if (s.startswith('"') and s.endswith('"')) or (
        s.startswith("'") and s.endswith("'")
    ):
        return s[1:-1]
    return s


def _dedent_block(lines: list[str]) -> str:
    """Strip common leading whitespace from multiline | blocks."""
    nonempty = [ln for ln in lines if ln.strip()]
    if not nonempty:
        return "\n".join(lines)
    # Keep relative indent; strip the minimum indent of non-empty lines
    def leading(s: str) -> int:
        return len(s) - len(s.lstrip(" "))

    min_indent = min(leading(ln) for ln in nonempty)
    return "\n".join(
        ln[min_indent:] if len(ln) >= min_indent else ln.lstrip(" ")
        for ln in lines
    ).rstrip("\n")


@v_args(inline=True)
class WFLTransformer(Transformer):
    def start(self, *workflows):
        return Program(workflows=list(workflows))

    def workflow(self, _kw, name, _colon, body):
        w = Workflow(name=str(name))
        for item in body:
            if isinstance(item, tuple) and item[0] == "__desc__":
                w.description = item[1]
            elif isinstance(item, Config):
                w.config = item
            elif isinstance(item, list):
                w.global_constraints = item
            elif isinstance(item, Node):
                w.nodes.append(item)
        return w

    def workflow_body(self, *items):
        return list(items)

    def description_stmt(self, _kw, _colon, s):
        return ("__desc__", _unquote(str(s)))

    def config_block(self, _kw, _colon, *stmts):
        cfg = Config()
        for k, v in stmts:
            if k == "model":
                cfg.model = v
            if k == "retries":
                cfg.retries = v
            if k == "backend":
                cfg.backend = v
        return cfg

    def config_model(self, _kw, _colon, s):
        return ("model", _unquote(str(s)))

    def config_retries(self, _kw, _colon, n):
        return ("retries", int(n))

    def config_backend(self, _kw, _colon, s):
        return ("backend", _unquote(str(s)))

    def global_block(self, _kw, _colon, *constraints):
        return list(constraints)

    def node_block(self, _kw, name, _colon, body):
        fields = {}
        constraints = []
        for item in body:
            if isinstance(item, Constraint):
                constraints.append(item)
            elif isinstance(item, tuple):
                fields[item[0]] = item[1]

        kind = fields.get("kind")
        if not kind:
            # Infer: code present → code; else prompt
            kind = "code" if fields.get("code") else "prompt"

        node = Node(
            name=str(name),
            kind=str(kind),
            prompt=fields.get("prompt"),
            code=fields.get("code"),
            intent=fields.get("intent"),
            inputs=fields.get("input") or [],
            output_name=fields.get("output"),
            constraints=constraints,
            retries=fields.get("retries"),
        )
        if node.kind == "prompt" and not node.prompt:
            raise ValueError(f"Node '{node.name}' kind=prompt requires a prompt:")
        if node.kind == "code" and not node.code:
            raise ValueError(f"Node '{node.name}' kind=code requires a code:")
        if node.kind not in ("prompt", "code"):
            raise ValueError(
                f"Node '{node.name}' has invalid kind '{node.kind}' "
                "(expected prompt or code)"
            )
        return node

    def node_body(self, *stmts):
        return list(stmts)

    def node_stmt(self, item):
        return item

    def kind_stmt(self, _kw, _colon, val):
        return ("kind", str(val))

    def prompt_stmt(self, *args):
        # QSTRING form: (_kw, _colon, qstring)
        # PIPE form:    (_kw, _colon, pipe, body_lines)
        if len(args) == 3:
            _kw, _colon, s = args
            return ("prompt", _unquote(str(s)))
        _kw, _colon, _pipe, body = args
        return ("prompt", body)

    def code_stmt(self, *args):
        if len(args) == 3:
            _kw, _colon, s = args
            return ("code", _unquote(str(s)))
        _kw, _colon, _pipe, body = args
        return ("code", body)

    def block_body(self, *lines):
        raw = [str(ln) for ln in lines]
        return _dedent_block(raw)

    def block_line(self, ctext):
        return str(ctext)

    def intent_stmt(self, _kw, _colon, s):
        return ("intent", _unquote(str(s)))

    def input_stmt(self, _kw, _colon, names):
        return ("input", names)

    def output_stmt(self, _kw, _colon, name):
        return ("output", str(name))

    def retries_stmt(self, _kw, _colon, n):
        return ("retries", int(n))

    def constraint_stmt(self, *args):
        if len(args) == 4:
            _kw, sev, _colon, ctext = args
            severity = str(sev)
        else:
            _kw, _colon, ctext = args
            severity = "error"
        return Constraint(rule=str(ctext).strip(), severity=severity)

    def severity(self, tok):
        return str(tok)

    def namelist(self, *parts):
        return [str(p) for p in parts if str(p) != ","]


def _preprocess(source: str) -> str:
    lines = []
    for line in source.split("\n"):
        if line.strip().startswith("#"):
            continue
        lines.append(line)
    while lines and not lines[0].strip():
        lines.pop(0)
    return "\n".join(lines)


_PARSER: Lark | None = None


def _get_parser() -> Lark:
    global _PARSER
    if _PARSER is None:
        grammar = _GRAMMAR_PATH.read_text(encoding="utf-8")
        _PARSER = Lark(grammar, parser="lalr", postlex=WFLIndenter())
    return _PARSER


def parse_string(source: str) -> Program:
    source = _preprocess(source)
    if not source.endswith("\n"):
        source += "\n"
    tree = _get_parser().parse(source)
    return WFLTransformer().transform(tree)


def parse_file(path: Union[str, Path]) -> Program:
    return parse_string(Path(path).read_text(encoding="utf-8"))


def debug_tree(source: str) -> str:
    source = _preprocess(source)
    if not source.endswith("\n"):
        source += "\n"
    return _get_parser().parse(source).pretty()
