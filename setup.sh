#!/usr/bin/env bash
set -Eeuo pipefail

echo "========================================"
echo "  LLM Notebook - Production Launcher"
echo "========================================"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"
VENV_DIR="$ROOT_DIR/venv"

BACKEND_PID=""
FRONTEND_PID=""

# ─────────────────────────────────────────
# Cleanup on exit (CRITICAL)
# ─────────────────────────────────────────
cleanup() {
  echo ""
  echo "Shutting down services..."

  [[ -n "${BACKEND_PID}" ]] && kill "$BACKEND_PID" 2>/dev/null || true
  [[ -n "${FRONTEND_PID}" ]] && kill "$FRONTEND_PID" 2>/dev/null || true

  echo "Done."
}
trap cleanup EXIT INT TERM

# ─────────────────────────────────────────
# Preflight checks
# ─────────────────────────────────────────
command -v python3 >/dev/null || { echo "python3 missing"; exit 1; }
command -v node >/dev/null || { echo "node missing (install v18+)"; exit 1; }
command -v npm >/dev/null || { echo "npm missing"; exit 1; }

echo "✓ System dependencies OK"

# ─────────────────────────────────────────
# Python environment (REAL FIX)
# ─────────────────────────────────────────
echo "Setting up Python environment..."

if [[ ! -d "$VENV_DIR" ]]; then
  python3 -m venv "$VENV_DIR"
fi

source "$VENV_DIR/bin/activate"

python -m pip install --upgrade pip -q
python -m pip install -r "$ROOT_DIR/requirements.txt" -q

echo "✓ Backend dependencies ready"

# ─────────────────────────────────────────
# Frontend dependencies
# ─────────────────────────────────────────
echo "Setting up frontend..."

cd "$FRONTEND_DIR"

if [[ ! -d "node_modules" ]]; then
  npm install
fi

echo "✓ Frontend dependencies ready"

# ─────────────────────────────────────────
# Start backend (stable uvicorn config)
# ─────────────────────────────────────────
echo "Starting backend..."

cd "$BACKEND_DIR"

# IMPORTANT: adjust if your entry file differs
if [[ -f "main.py" ]]; then
  BACKEND_CMD="main:app"
elif [[ -f "app.py" ]]; then
  BACKEND_CMD="app:app"
else
  echo "ERROR: Cannot find backend entry point (main.py/app.py)"
  exit 1
fi

uvicorn "$BACKEND_CMD" \
  --host 127.0.0.1 \
  --port 8000 \
  --reload &
BACKEND_PID=$!

# ─────────────────────────────────────────
# Start frontend (Vite stable mode)
# ─────────────────────────────────────────
echo "Starting frontend..."

cd "$FRONTEND_DIR"

npm run dev -- --host 127.0.0.1 --port 3000 &
FRONTEND_PID=$!

# ─────────────────────────────────────────
# Ready state
# ─────────────────────────────────────────
echo ""
echo "========================================"
echo "  🚀 SYSTEM RUNNING"
echo "========================================"
echo "Frontend → http://localhost:3000"
echo "Backend  → http://localhost:8000"
echo "Docs     → http://localhost:8000/docs"
echo "========================================"
echo ""

wait "$BACKEND_PID" "$FRONTEND_PID"