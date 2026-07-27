#!/usr/bin/env bash
set -euo pipefail

echo "========================================"
echo "  NotebookLM - Setup"
echo "========================================"
echo ""

command -v python3 >/dev/null 2>&1 || { echo "ERROR: python3 is required."; exit 1; }
command -v node    >/dev/null 2>&1 || { echo "ERROR: node is required (v18+)."; exit 1; }
command -v npm     >/dev/null 2>&1 || { echo "ERROR: npm is required."; exit 1; }

echo "python3 $(python3 --version 2>&1 | awk '{print $2}')"
echo "node    $(node --version)"
echo "npm     $(npm --version)"
echo ""

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

echo "-- Installing Python package (editable) --"
pip install -e . -q 2>/dev/null || pip install -e . --no-deps -q
pip install -r backend/requirements.txt -q 2>/dev/null || true
echo "OK: Python package"
echo ""

echo "-- Installing frontend dependencies --"
cd frontend
npm install --silent
echo "OK: Frontend"
cd "$ROOT"
echo ""

cat > start-backend.sh << 'SCRIPT'
#!/usr/bin/env bash
cd "$(dirname "$0")"
echo "Starting NotebookLM API on http://localhost:8000 ..."
python3 -m notebooklm app run
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
echo "Starting NotebookLM (backend + frontend) ..."
cd "$(dirname "$0")"
bash start-backend.sh &
BACKEND_PID=$!
bash start-frontend.sh
FRONTEND_STATUS=$?
kill $BACKEND_PID 2>/dev/null
exit $FRONTEND_STATUS
SCRIPT
chmod +x start-all.sh

echo "Created start-backend.sh / start-frontend.sh / start-all.sh"
echo ""
echo "Quick start:"
echo "  1. export OPENROUTER_API_KEY=sk-or-..."
echo "     export DEFAULT_MODEL=openrouter/openai/gpt-4o-mini"
echo "  2. ./start-all.sh"
echo "  3. Open http://localhost:3000"
echo ""
echo "CLI demo:"
echo "  notebooklm interpret backend/examples/research_agent.wfl --input task='...'"
echo ""
