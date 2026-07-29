# NotebookLM

Jupyter-style notebook for **agentic workflows**: natural language → **Workflow DSL (`.wfl`)** → **semantic interpreter** (Ollama Cloud via LiteLLM).

Prompt nodes call the LLM. Code nodes run **your** Python. There is no LLM code-generation step.

```
Natural language
       ↓
  Workflow DSL (.wfl)
       ↓
 Semantic interpreter  →  effects & output
```

## Quick start

### 1. Configure Ollama Cloud

Copy `.env.example` → `.env` and set your [Ollama Cloud API key](https://ollama.com/settings/keys):

```env
OLLAMA_API_KEY=your-ollama-key
OPENAI_API_KEY=your-ollama-key
VLLM_BASE_URL=https://ollama.com/v1
DEFAULT_MODEL=gpt-oss:20b
```

Or export in the shell for the current session:

**Linux / macOS**

```bash
export OLLAMA_API_KEY="your-ollama-key"
export OPENAI_API_KEY="$OLLAMA_API_KEY"
export VLLM_BASE_URL="https://ollama.com/v1"
export DEFAULT_MODEL="gpt-oss:20b"
```

**Windows (PowerShell)**

```powershell
$env:OLLAMA_API_KEY="your-ollama-key"
$env:OPENAI_API_KEY=$env:OLLAMA_API_KEY
$env:VLLM_BASE_URL="https://ollama.com/v1"
$env:DEFAULT_MODEL="gpt-oss:20b"
```

### 2. Install + single-command startup

**Linux / macOS**

```bash
pip install -e .
./setup.sh          # install deps + create start-*.sh
./start-all.sh      # backend + frontend
```

**Windows (PowerShell)**

```powershell
pip install -e .
.\setup.ps1         # install deps + create start-*.ps1
.\start-all.ps1     # backend + frontend
```

Then open:

- UI → http://localhost:3000
- API docs → http://localhost:8000/docs

`setup.sh` / `setup.ps1` create `start-all` plus separate backend/frontend starters. After setup, use **`./start-all.sh`** or **`.\start-all.ps1`** as the one-command startup.

### Manual start (two terminals)

Works the same on Linux and Windows once the package is installed:

```bash
# Terminal 1 — API
notebooklm app run
# or: python -m notebooklm app run

# Terminal 2 — UI
cd frontend
npm install
npm run dev
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
| `notebooklm` | SDK: registry, balloon context, LiteLLM client (Ollama Cloud), CLI |
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
| `OLLAMA_API_KEY` | Ollama Cloud API key ([create one](https://ollama.com/settings/keys)) |
| `OPENAI_API_KEY` | Same key as above (LiteLLM OpenAI-compatible path reads this) |
| `VLLM_BASE_URL` | `https://ollama.com/v1` for Ollama Cloud |
| `DEFAULT_MODEL` | e.g. `gpt-oss:20b` |
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
