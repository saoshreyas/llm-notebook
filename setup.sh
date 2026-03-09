#!/usr/bin/env bash
set -euo pipefail

echo "========================================"
echo "  LLM Notebook - Setup"
echo "========================================"
echo ""

# ── Preflight checks ──────────────────────────────────────────────

command -v python3 >/dev/null 2>&1 || { echo "ERROR: python3 is required."; exit 1; }
command -v node    >/dev/null 2>&1 || { echo "ERROR: node is required (v18+)."; exit 1; }
command -v npm     >/dev/null 2>&1 || { echo "ERROR: npm is required."; exit 1; }

echo "✓ python3 $(python3 --version 2>&1 | awk '{print $2}')"
echo "✓ node    $(node --version)"
echo "✓ npm     $(npm --version)"
echo ""

# ── Backend ────────────────────────────────────────────────────────

echo "── Installing backend dependencies ──"
cd "$(dirname "$0")/backend"
pip install -r requirements.txt --break-system-packages -q 2>/dev/null \
  || pip install -r requirements.txt -q
echo "✓ Backend dependencies installed"
cd ..
echo ""

# ── Frontend ───────────────────────────────────────────────────────

echo "── Installing frontend dependencies ──"
cd frontend
npm install --silent
echo "✓ Frontend dependencies installed"
cd ..
echo ""

# ── Convenience scripts ───────────────────────────────────────────

cat > start-backend.sh << 'SCRIPT'
#!/usr/bin/env bash
cd "$(dirname "$0")/backend"
echo "Starting backend on http://localhost:8000 ..."
python3 main.py
SCRIPT
chmod +x start-backend.sh

cat > start-frontend.sh << 'SCRIPT'
#!/usr/bin/env bash
cd "$(dirname "$0")/frontend"
echo "Starting frontend on http://localhost:3000 ..."
npx vite --host 0.0.0.0 --port 3000
SCRIPT
chmod +x start-frontend.sh

cat > start-all.sh << 'SCRIPT'
#!/usr/bin/env bash
echo "Starting LLM Notebook (backend + frontend) ..."
cd "$(dirname "$0")"

# Start backend in background
bash start-backend.sh &
BACKEND_PID=$!

# Start frontend in foreground
bash start-frontend.sh
FRONTEND_STATUS=$?

# Cleanup
kill $BACKEND_PID 2>/dev/null
exit $FRONTEND_STATUS
SCRIPT
chmod +x start-all.sh

echo "✓ Created start-backend.sh"
echo "✓ Created start-frontend.sh"
echo "✓ Created start-all.sh"
echo ""

# ── Done ───────────────────────────────────────────────────────────

echo "========================================"
echo "  Setup complete!"
echo "========================================"
echo ""
echo "Quick start:"
echo "  1. Configure your vLLM server:"
echo "       export VLLM_BASE_URL=http://your-server:8000/v1"
echo "       export DEFAULT_MODEL=your-model-name"
echo ""
echo "  2. Start everything:"
echo "       ./start-all.sh"
echo ""
echo "  3. Open http://localhost:3000"
echo ""
echo "Or start separately:"
echo "  Terminal 1: ./start-backend.sh"
echo "  Terminal 2: ./start-frontend.sh"
echo ""
