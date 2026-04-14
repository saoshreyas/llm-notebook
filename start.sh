#!/bin/bash
# start.sh — starts both backend and frontend in one terminal

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Starting LLM Notebook...${NC}"

# ── Config — edit these ───────────────────────────────────────────────────────
export VLLM_BASE_URL="http://localhost:11434/v1"
export DEFAULT_MODEL="llama3.2"
export OPENAI_API_KEY="ollama"
# ─────────────────────────────────────────────────────────────────────────────

# Get the directory this script lives in
REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$REPO_DIR/backend"
FRONTEND_DIR="$REPO_DIR/frontend"

# ── Start backend ─────────────────────────────────────────────────────────────
echo -e "${BLUE}Starting backend...${NC}"

cd "$BACKEND_DIR"
source venv/bin/activate
uvicorn main:app --port 8000 &
BACKEND_PID=$!
echo -e "${GREEN}Backend running (PID $BACKEND_PID)${NC}"

# ── Start frontend ────────────────────────────────────────────────────────────
echo -e "${BLUE}Starting frontend...${NC}"

cd "$FRONTEND_DIR"
npm run dev &
FRONTEND_PID=$!
echo -e "${GREEN}Frontend running (PID $FRONTEND_PID)${NC}"

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}Both servers are running!${NC}"
echo -e "  Frontend: ${YELLOW}http://localhost:3000${NC}"
echo -e "  Backend:  ${YELLOW}http://localhost:8000${NC}"
echo -e "  API docs: ${YELLOW}http://localhost:8000/docs${NC}"
echo ""
echo -e "Press ${RED}Ctrl+C${NC} to stop both servers."

# Wait and stop both if Ctrl+C is pressed
trap "echo ''; echo -e '${RED}Stopping...${NC}'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" SIGINT SIGTERM
wait
