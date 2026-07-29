# NotebookLM

Jupyter-style notebook for **agentic workflows**: natural language → **Workflow DSL (`.wfl`)** → **semantic interpreter** (OpenRouter via LiteLLM).

Prompt nodes call the LLM. Code nodes run **your** Python. There is no LLM code-generation step.

```
Natural language
       ↓
  Workflow DSL (.wfl)
       ↓
 Semantic interpreter  →  effects & output
```

## Quick start

```bash
# 1. Install (from repo root)
pip install -e .

# 2. Configure OpenRouter
#    copy .env.example → set OPENROUTER_API_KEY

set OPENROUTER_API_KEY=sk-or-...
set DEFAULT_MODEL=openrouter/openai/gpt-4o-mini

# 3. API
notebooklm app run
# or: python -m notebooklm app run
# → http://localhost:8000/docs

# 4. Frontend (separate terminal)
cd frontend
npm install
npm run dev
# → http://localhost:3000
```

### Headless demo

```bash
notebooklm interpret backend/examples/research_agent.wfl --input task="What is a semantic DSL?"
# or
python backend/examples/run_demo.py
```

### Library API

```python
import workflow_dsl  # registers the language
from notebooklm import interpret

result = interpret(
    "workflow",
    open("my_agent.wfl").read(),
    inputs={"task": "..."},
)
print(result.summary())
```

## Package layout

| Package | Role |
|---------|------|
| `notebooklm` | SDK: registry, balloon context, OpenRouter client, CLI |
| `workflow_dsl` | Grammar, Lark parser, semantic interpreter, NL→DSL |
| `app` | FastAPI HTTP surface |
| `frontend` | React Jupyter-style UI |

**DSL developer** owns `workflow_dsl`. **Platform developer** owns `notebooklm` + `app` + UI.

## Cell flow (UI)

| Mode | Shift+Enter #1 | Shift+Enter #2 |
|------|----------------|----------------|
| Text | NL → editable `.wfl` | Interpret |
| DSL | Interpret `.wfl` | — |

## API

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/workflow/nl_to_dsl` | Natural language → `.wfl` |
| `POST` | `/workflow/run` | Semantic interpret |
| `POST` | `/workflow/check_syntax` | Lark parse only |
| `GET` | `/health` | Status |
| `GET` | `/models` | Suggested models |

## Environment

| Variable | Description |
|----------|-------------|
| `OPENROUTER_API_KEY` | OpenRouter API key (default path) |
| `DEFAULT_MODEL` | e.g. `openrouter/openai/gpt-4o-mini` |
| `VLLM_BASE_URL` | Optional local OpenAI-compatible base URL |
| `NL_PARSE_MAX_ATTEMPTS` | NL→DSL parse-repair attempts (default 3) |

## Workflow DSL sketch

```text
workflow research_agent:
  node plan:
    kind: prompt
    prompt: "Task: {{task}}. Write a 3-step plan."
    output: plan
  node format:
    kind: code
    input: plan
    code: |
      result = plan.upper()
    output: result
```

See [backend/workflow_dsl/README.md](backend/workflow_dsl/README.md) and [backend/examples/research_agent.wfl](backend/examples/research_agent.wfl).

## License

MIT
