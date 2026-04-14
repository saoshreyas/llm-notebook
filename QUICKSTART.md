# Quick Start Guide

Get the LLM Notebook running in under 5 minutes.

## Prerequisites

- **Python 3.10+** with pip
- **Node.js 18+** with npm
- **A vLLM server** (or any OpenAI-compatible endpoint)

## Step 1: Install Dependencies

```bash
./setup.sh
```

This installs Python packages (FastAPI, LiteLLM, etc.) and Node packages (React, Vite, Tailwind, etc.).

## Step 2: Configure Your vLLM Server

```bash
export VLLM_BASE_URL=http://your-vllm-server:8000/v1
export DEFAULT_MODEL=meta-llama/Llama-2-7b-chat-hf
```

Replace with your actual vLLM server address and model name.

## Step 3: Start the Application

**Option A — Both servers at once:**
```bash
./start-all.sh
```

**Option B — Separate terminals:**
```bash
# Terminal 1
./start-backend.sh

# Terminal 2
./start-frontend.sh
```

## Step 4: Open the Notebook

Navigate to **http://localhost:3000** in your browser.

## Step 5: Try It Out

1. Type in the first cell: `I love BALLOONS! Red Balloon, blue BALLOON.`
2. Press **Shift+Enter** — the text gets translated to lowercase (Stage 1)
3. Press **Shift+Enter** again — balloons appear! (Stage 2)

## Data Flow

```
User Input  →  POST /translate  →  LLM lowercases text  →  Shows translated text
            →  POST /interpret  →  Counts "balloon"      →  Shows balloon images
```

## Manual Setup (Without setup.sh)

```bash
# Backend
cd backend
pip install -r requirements.txt
python3 main.py

# Frontend (new terminal)
cd frontend
npm install
npm run dev
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `VLLM_BASE_URL` | `http://localhost:8000/v1` | Your vLLM server URL |
| `DEFAULT_MODEL` | `meta-llama/Llama-2-7b-chat-hf` | Model to use |

## FAQ

**Q: Can I use this without a vLLM server?**
A: The translation stage will fall back to simple `text.lower()` if the LLM is unavailable. Balloon interpretation always works locally.

**Q: What port does the backend use?**
A: Port 8000. The frontend proxies `/api/*` requests to it.

**Q: Can I change the frontend port?**
A: Edit `vite.config.js` — change the `port` under `server`.
