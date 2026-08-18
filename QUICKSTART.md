# Quick Start — NotebookLM

## Prerequisites

- Python 3.10+
- Node.js 18+
- An [Ollama Cloud](https://ollama.com/settings/keys) API key

## 1. Configure

Copy `.env.example` → `.env`, or set for the current session:

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

## 2. Install + start (single command)

**Linux / macOS**

```bash
pip install -e .
./setup.sh
./start-all.sh
```

**Windows (PowerShell)**

```powershell
pip install -e .
.\setup.ps1
.\start-all.ps1
```

Open http://localhost:3000 (API docs: http://localhost:8000/docs).

## 3. Manual start (two terminals)

```bash
python start.py
```

Or separately:

```bash
# Terminal 1 — API
notebooklm app run

# Terminal 2 — UI
cd frontend
npm install
npm run dev
```

## 4. Try it

**Text mode:** describe a research agent in plain English → Shift+Enter (DSL) → Shift+Enter (interpret).

**DSL mode:** paste [backend/examples/research_agent.wfl](backend/examples/research_agent.wfl) → Interpret.

**CLI:**

```bash
notebooklm interpret backend/examples/research_agent.wfl --input task="Explain semantic interpreters"
```

## Manual backend start

```bash
cd backend
python main.py
```

## FAQ

**Q: Can I use OpenRouter instead?**  
A: Set `OPENROUTER_API_KEY` and `DEFAULT_MODEL=openrouter/openai/gpt-4o-mini` (leave `OLLAMA_API_KEY` unset).

**Q: Can I use a local vLLM / Ollama server?**  
A: Set `VLLM_BASE_URL=http://host:port/v1` and point `DEFAULT_MODEL` at a model that server serves.

**Q: Where is generated Python?**  
A: Nowhere — the interpreter runs prompt/code nodes directly. Code nodes use the Python you write in the DSL.
