# Workflow DSL — agentic workflow language for NotebookLM

**Terms**

- **Natural language** — Plain-English goals the user types in the notebook.
- **Workflow DSL (`.wfl`)** — Indentation-based programs: `workflow` → `node` blocks with `kind: prompt` or `kind: code`.
- **Semantic interpreter** — Parses with Lark and *does what the DSL means*: prompt nodes call the LLM; code nodes run user-authored Python. No LLM code generation.
- **Output** — Per-node results (text / values / stdout / errors) accumulated in the balloon for later nodes.

**Flow**

1. Optional: LLM turns natural language into `.wfl` (`POST /workflow/nl_to_dsl`).
2. Interpreter runs each node in order (prompt → OpenRouter; code → `exec`).
3. Constraint self-check may retry prompt nodes.

See `grammar.lark` and the cheat sheet in `nl.py`.
