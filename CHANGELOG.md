# Changelog

## v0.4.0 — Semantic Workflow DSL (6/16 target)

### Architecture
- NotebookLM SDK (`notebooklm`): language registry, balloon context, OpenRouter LiteLLM client, CLI
- Workflow DSL (`workflow_dsl`): Lark grammar with `prompt` / `code` nodes; **semantic interpreter** (no LLM codegen)
- FastAPI thin surface under `/workflow/*`
- Default LLM path: OpenRouter via LiteLLM (`OPENROUTER_API_KEY`)

### UX
- Text mode: NL → editable `.wfl` → interpret
- DSL mode: write `.wfl` → interpret
- Per-node outputs (no hidden generated Python)
- Live syntax check via `/workflow/check_syntax`
- Jupyter-style cells, shortcuts, command bar

### Packaging
- `pip install -e .` → `notebooklm` console script
- `notebooklm app run` / `notebooklm interpret file.wfl`
- Example: `backend/examples/research_agent.wfl`

### Removed
- Balloon SVG demo endpoints (`/translate`, `/interpret`, `/process`)
- Intent → Python codegen runtime (`backend/dsl`)

## Earlier

See git history for balloon-era two-stage demo (v1–v2).
