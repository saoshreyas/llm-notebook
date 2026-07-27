# Quick Start — NotebookLM

## Prerequisites

- Python 3.10+
- Node.js 18+
- An [OpenRouter](https://openrouter.ai/) API key

## 1. Install

```bash
pip install -e .
cd frontend && npm install && cd ..
```

## 2. Configure

```bash
# Windows PowerShell
$env:OPENROUTER_API_KEY="sk-or-..."
$env:DEFAULT_MODEL="openrouter/openai/gpt-4o-mini"
```

Or copy `.env.example` and export the variables in your shell.

## 3. Run

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

**Q: Can I use a local vLLM server?**  
A: Set `VLLM_BASE_URL=http://host:port/v1` and point `DEFAULT_MODEL` at a model that server serves.

**Q: Where is generated Python?**  
A: Nowhere — the interpreter runs prompt/code nodes directly. Code nodes use the Python you write in the DSL.
