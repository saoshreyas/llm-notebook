# NotebookDSL (.ndsl)

**Terms**

- **Natural language** — What the user types in plain English (goals, data, constraints).
- **DSL (NotebookDSL)** — A small, reviewable program: named pipelines, nodes, `intent` lines, and optional `constraint` rules. It is *not* arbitrary Python; the interpreter turns each node into code.
- **Output** — Runtime results: stdout, the node’s return value, and errors with tracebacks. The interpreter reports *where* execution failed (node name and Python traceback).

**Flow**

1. Optional: an LLM turns natural language into `.ndsl` text (`POST /dsl/nl_to_dsl`).
2. The parser builds an AST; the **interpreter** (`run_pipeline`) generates Python per node, verifies it, runs it, and on failure feeds **checker violations** or **execution tracebacks** back into the model (react loop).
3. You can run merged, user-edited code again via `POST /dsl/execute`.

**Syntax (indentation-based, 2 spaces)**

- File = one or more `pipeline name:` blocks.
- Under a pipeline: optional `description:`, `config:`, `global:`, and any number of `node name:` blocks.
- Under a node: required `intent: "..."`; optional `input:`, `output:`, `retries:`, `constraint`.

See `grammar.lark` for the full grammar and `templates/nl_to_dsl_user.j2` for the cheat sheet passed to the NL→DSL model.

**Writing good DSL**

- One **intent** per node: a single, testable responsibility.
- Use **`input:`** to list prior node names so the generator knows what variables exist.
- Put safety rules in **`constraint error:`** (and optional `warning` / `info`).
- Use **`global:`** for rules that apply to every node.
