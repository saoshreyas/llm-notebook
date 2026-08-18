# Two tracks (current focus)

## Canonical pipeline (what the system is for)

```
Natural language  →  Translator (agent)  →  NotebookDSL (.ndsl)
                                              ↓
                                         Interpreter (per node)
                                              ↓
                         kind: code ──► generate Python → verify → run
                         kind: llm  ──► LLM call (prompt only)
                                              ↓
                                         Unified output
```

**Text mode** is the primary path: type plain English → **NL → DSL** → run again for **interpreter**.

The DSL is the **contract in the middle**: reviewable, editable, and typed so each step is either executable code or an LLM call—not an opaque script.

**DSL mode** skips the first translator step when you already have (or paste) `.ndsl` or CNL; the interpreter step is the same.

---

## Track A — Clean DSL (for you and power users)

| Surface | Who | What |
|---------|-----|------|
| **NotebookDSL** (`.ndsl`) | Programmers | Full syntax after translation (or hand-written) |
| **CNL** | Everyone | Shorter lines → same `.ndsl` before interpret |

**Step kinds (what the interpreter does):**

- `kind: code` + `intent:` → generate Python, verify, run
- `kind: llm` + `prompt:` → one LLM call; result in pipeline output

The **NL → DSL translator** should emit the right `kind:` per step (compute vs summarize/explain).

API: `POST /dsl/nl_to_dsl`, `POST /dsl/cnl_to_dsl`, `POST /dsl/check_syntax`

---

## Track B — Agents (less scary, around the same artifact)

| Agent | API | When |
|-------|-----|------|
| NL → DSL | `POST /dsl/nl_to_dsl` | **Step 1** — natural language → `.ndsl` |
| Explain | `POST /dsl/explain` | Understand DSL without running |
| Glue | `POST /dsl/glue` | Wire low-level parts → `.ndsl` before interpret |

Agents produce or explain **DSL**; only the **interpreter** runs code or LLM steps.

---

## LangGraph (later)

[LangGraph](https://langchain-ai.github.io/langgraph/) can orchestrate: NL → DSL → (optional explain) → interpret. Not required for local work.

## Deferred

- HPC / cluster steps, large realistic demos
