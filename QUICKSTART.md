# Quick Start — NotebookLM

## Prerequisites

- Python 3.10+
- Node.js 18+
- An [Ollama Cloud](https://ollama.com/settings/keys) API key

## 1. Install

```bash
pip install -e .
cd frontend && npm install && cd ..
```

## 2. Configure

Put your key in the repo-root **`.env`** file (already created; gitignored):

```env
OLLAMA_API_KEY=your_key_here
DEFAULT_MODEL=gpt-oss:20b
OLLAMA_API_BASE=https://ollama.com
```

Or set them in the shell:

```powershell
$env:OLLAMA_API_KEY="your_key_here"
$env:DEFAULT_MODEL="gpt-oss:20b"
```

Create a key at https://ollama.com/settings/keys

## 3. Run

```bash
python start.py
```

Or separately:

```bash
# Terminal 1 — API
notebooklm app run

# Terminal 2 — UI
cd frontend
npm run dev
```

Open http://localhost:3000

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
