#!/bin/bash

echo "🚀 LLM Notebook - Automated Setup Script"
echo "=========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Python is installed
echo -e "${BLUE}Checking Python installation...${NC}"
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}❌ Python3 is not installed. Please install Python 3.8+ first.${NC}"
    exit 1
fi

PYTHON_VERSION=$(python3 --version | cut -d' ' -f2)
echo -e "${GREEN}✓ Python $PYTHON_VERSION found${NC}"

# Check if Node.js is installed
echo -e "${BLUE}Checking Node.js installation...${NC}"
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed. Please install Node.js 18+ first.${NC}"
    exit 1
fi

NODE_VERSION=$(node --version)
echo -e "${GREEN}✓ Node.js $NODE_VERSION found${NC}"
echo ""

# Setup Backend
echo -e "${BLUE}📦 Setting up Backend...${NC}"
cd backend

echo "Installing Python dependencies..."
pip install -r requirements.txt --break-system-packages

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Backend dependencies installed${NC}"
else
    echo -e "${RED}❌ Failed to install backend dependencies${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}⚠️  IMPORTANT: Configure your vLLM server${NC}"
echo "Edit backend/main.py and update:"
echo "  - VLLM_BASE_URL"
echo "  - DEFAULT_MODEL"
echo ""

cd ..

# Setup Frontend
echo -e "${BLUE}📦 Setting up Frontend...${NC}"
cd frontend

echo "Installing Node dependencies..."
npm install

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Frontend dependencies installed${NC}"
else
    echo -e "${RED}❌ Failed to install frontend dependencies${NC}"
    exit 1
fi

cd ..

# Create convenience scripts
echo ""
echo -e "${BLUE}Creating convenience scripts...${NC}"

# Start backend script
cat > start-backend.sh << 'EOF'
#!/bin/bash
cd backend
echo "🚀 Starting Backend on http://localhost:8000"
echo "📖 API Docs: http://localhost:8000/docs"
python main.py
EOF

chmod +x start-backend.sh

# Start frontend script
cat > start-frontend.sh << 'EOF'
#!/bin/bash
cd frontend
echo "🚀 Starting Frontend on http://localhost:3000"
npm run dev
EOF

chmod +x start-frontend.sh

# Start both script
cat > start-all.sh << 'EOF'
#!/bin/bash
echo "🚀 Starting LLM Notebook (Backend + Frontend)"
echo "Backend: http://localhost:8000"
echo "Frontend: http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop all servers"
echo ""

# Start backend in background
cd backend
python main.py &
BACKEND_PID=$!
cd ..

# Give backend time to start
sleep 3

# Start frontend in background
cd frontend
npm run dev &
FRONTEND_PID=$!
cd ..

# Wait for user interrupt
trap "kill $BACKEND_PID $FRONTEND_PID; exit" INT
wait
EOF

chmod +x start-all.sh

echo -e "${GREEN}✓ Convenience scripts created${NC}"

# Final instructions
echo ""
echo -e "${GREEN}=========================================="
echo "✅ Setup Complete!"
echo -e "==========================================${NC}"
echo ""
echo -e "${BLUE}Next Steps:${NC}"
echo ""
echo "1. Configure your vLLM server in backend/main.py"
echo ""
echo "2. Start the application:"
echo "   ${GREEN}./start-all.sh${NC}          # Start both backend and frontend"
echo "   ${GREEN}./start-backend.sh${NC}      # Start backend only"
echo "   ${GREEN}./start-frontend.sh${NC}     # Start frontend only"
echo ""
echo "3. Open http://localhost:3000 in your browser"
echo ""
echo -e "${YELLOW}📚 Documentation:${NC}"
echo "   - Main README: README.md"
echo "   - Backend docs: backend/README.md"
echo "   - Frontend docs: frontend/README.md"
echo "   - API docs: http://localhost:8000/docs (after starting backend)"
echo ""
echo -e "${GREEN}Happy coding! 🎉${NC}"
