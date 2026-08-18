# NotebookDSL (.ndsl)

**Terms**

- **Natural language** — Plain English in the notebook (Text mode).
- **DSL (NotebookDSL)** — The translated middle layer: pipelines and nodes with `kind: code` or `kind: llm`. Reviewable and editable before execution.
- **Interpreter** — Runs each node: **code** → generate Python, verify, execute; **llm** → run the node's prompt only.
- **Output** — Per-node results (stdout, return values, LLM text, errors).

**Flow (canonical)**

1. **Translator:** natural language → `.ndsl` (`POST /dsl/nl_to_dsl`). The model chooses `kind: code` vs `kind: llm` per step.
2. **Interpreter:** parse AST → per node dispatch by `kind` (`run_pipeline`). Code nodes use generate/check/exec; LLM nodes call the model with `prompt:`.
3. Optional: re-run merged code via `POST /dsl/execute`.

Direct authoring (DSL mode, CNL) skips step 1; step 2 is unchanged.

**Syntax (indentation-based, 2 spaces)**

- File = one or more `pipeline name:` blocks.
- Under a pipeline: optional `description:`, `config:`, `global:`, and any number of `node name:` blocks.
- Under a node:
  - **`kind: code`** (default) — required `intent: "..."`; generates and runs Python.
  - **`kind: llm`** — required `prompt: "..."`; one LLM call, no code generation.
  - Optional: `input:`, `output:`, `retries:`, `constraint`.

See `examples/demo_mixed_pipeline.ndsl` for a code + LLM pipeline.

**Surfaces (Track A)**

| Surface | File | Notes |
|---------|------|--------|
| NotebookDSL | `.ndsl` | Full syntax |
| CNL | `.cnl` lines | `code name: ...` / `llm name using x: ...` → transpiles to `.ndsl` |

**Agents (Track B)** — `docs/TWO_TRACKS.md`

| Endpoint | Purpose |
|----------|---------|
| `POST /dsl/nl_to_dsl` | Natural language → `.ndsl` |
| `POST /dsl/cnl_to_dsl` | CNL → `.ndsl` (no LLM) |
| `POST /dsl/explain` | Explain pipeline (no run) |
| `POST /dsl/glue` | Wire low-level parts → `.ndsl` |

See `grammar.lark` for the full grammar and `templates/nl_to_dsl_user.j2` for the cheat sheet passed to the NL→DSL model.

**Writing good DSL**

- One **intent** per node: a single, testable responsibility.
- Use **`input:`** to list prior node names so the generator knows what variables exist.
- Put safety rules in **`constraint error:`** (and optional `warning` / `info`).
- Use **`global:`** for rules that apply to every node.
