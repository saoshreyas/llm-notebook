# 🚀 LLM Notebook - Full-Stack Application

A production-ready Jupyter-style notebook interface powered by LLMs. Built with FastAPI backend, React frontend, and designed to work with vLLM servers.

## 📋 Features

- **Translation Phase**: Uses LLM to convert text to lowercase
- **Interpretation Phase**: Detects "balloon" mentions and generates colorful balloon images
- **Multiple Cells**: Add, run, and delete notebook cells like Jupyter
- **Live API Status**: Real-time backend connection monitoring
- **Beautiful UI**: Dark theme with smooth animations
- **Keyboard Shortcuts**: Shift+Enter to run cells

## 🏗️ Architecture

```
┌─────────────────┐      ┌──────────────────┐      ┌─────────────────┐
│  React Frontend │ ───▶ │  FastAPI Backend │ ───▶ │  vLLM Server    │
│  (Port 3000)    │ HTTP │  (Port 8000)     │ HTTP │  (Supercomputer)│
└─────────────────┘      └──────────────────┘      └─────────────────┘
     Vite + shadcn         LiteLLM Integration      Your LLM Models
```

## 💰 Cost: 100% FREE

- ✅ All code is open source
- ✅ Runs on your own infrastructure
- ✅ Uses your vLLM server (no API fees)
- ✅ No subscriptions or paywalls

## 🚀 Quick Start

### Prerequisites

- Python 3.8+ (for backend)
- Node.js 18+ (for frontend)
- Access to a vLLM server running on your supercomputer

### 1. Setup Backend

```bash
# Navigate to backend
cd backend

# Install dependencies
pip install -r requirements.txt --break-system-packages

# Configure your vLLM connection
# Edit main.py and update:
# VLLM_BASE_URL = "http://your-supercomputer:8000/v1"
# DEFAULT_MODEL = "meta-llama/Llama-2-7b-chat-hf"

# Run the server
python main.py
```

Backend will be available at `http://localhost:8000`

API Docs: `http://localhost:8000/docs`

### 2. Setup Frontend

```bash
# Navigate to frontend (in a new terminal)
cd frontend

# Install dependencies
npm install

# Run development server
npm run dev
```

Frontend will be available at `http://localhost:3000`

### 3. Access the App

Open `http://localhost:3000` in your browser and start using the notebook!

## 📖 Usage

1. **Enter Text**: Type or paste text in a cell
2. **Run Cell**: Click "Run" or press `Shift+Enter`
3. **View Results**: See lowercase translation and balloon images
4. **Add Cells**: Click "+ Add New Cell" at the bottom
5. **Try It**: Use text like `"I LOVE BALLOONS! Red balloon, blue balloon."`

## 🔧 Configuration

### Backend Configuration

Edit `backend/main.py`:

```python
# Point to your vLLM server
VLLM_BASE_URL = "http://your-supercomputer-address:8000/v1"

# Specify your model
DEFAULT_MODEL = "meta-llama/Llama-2-7b-chat-hf"
```

### Frontend Configuration

Frontend automatically connects to backend via proxy. If needed, edit `frontend/vite.config.js`.

## 🎨 Customization

### Change Colors

Edit `frontend/src/index.css`:

```css
:root {
  --primary: 174 100% 42%;    /* Teal accent */
  --secondary: 352 88% 71%;   /* Coral accent */
  --accent: 45 100% 70%;      /* Yellow accent */
}
```

### Add More Models

Edit `backend/main.py` in the `/models` endpoint to list your available models.

### Modify Processing Logic

Edit the `process_text` function in `backend/main.py` to add new phases or change behavior.

## 🔌 Setting Up vLLM (Your Supercomputer)

If you haven't set up vLLM yet, here's how:

```bash
# On your supercomputer
pip install vllm

# Run vLLM server with your model
python -m vllm.entrypoints.openai.api_server \
    --model meta-llama/Llama-2-7b-chat-hf \
    --port 8000 \
    --host 0.0.0.0
```

Then point your backend's `VLLM_BASE_URL` to this server.

## 📚 Tech Stack

### Backend
- **FastAPI** - Modern Python web framework
- **LiteLLM** - Unified interface for all LLM providers
- **Pydantic** - Data validation
- **Uvicorn** - ASGI server

### Frontend
- **React 18** - UI library
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Utility-first styling
- **shadcn/ui** - Component system
- **Lucide React** - Icon library

## 🐛 Troubleshooting

### Backend won't start

```bash
# Check Python version
python --version  # Should be 3.8+

# Reinstall dependencies
pip install -r requirements.txt --break-system-packages --force-reinstall
```

### Frontend won't start

```bash
# Clear node modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

### Can't connect to vLLM

1. Check if vLLM server is running
2. Verify the URL and port in `backend/main.py`
3. Check firewall settings
4. Test with: `curl http://your-vllm-server:8000/v1/models`

### API shows "unhealthy"

- Make sure backend is running: `python backend/main.py`
- Check backend logs for errors
- Visit `http://localhost:8000/health` directly

## 🎓 Learning Resources

Based on your meeting notes, here are relevant topics to explore:

### LiteLLM
- Unified interface for switching between LLMs
- Just change the `model` parameter, no code changes needed
- Docs: https://docs.litellm.ai/

### vLLM
- High-performance LLM serving
- Optimized for throughput and latency
- Docs: https://docs.vllm.ai/

### Lark Parser (For Advanced Features)
- Build custom DSLs and parsers in Python
- Great for adding notebook-specific syntax
- Docs: https://lark-parser.readthedocs.io/

### FastAPI
- Async Python web framework
- Automatic API documentation
- Docs: https://fastapi.tiangolo.com/

### React + shadcn/ui
- Modern UI development
- Reusable component patterns
- Docs: https://ui.shadcn.com/

## 🚧 Future Enhancements

Ideas based on your meeting notes:

1. **Custom Language Parsing** - Use Lark to build a custom notebook language
2. **Multiple LLM Support** - Switch models per cell
3. **Code Execution** - Add Python/JavaScript execution cells
4. **Data Visualization** - Integrate Plotly/D3.js
5. **Collaborative Editing** - Multi-user support
6. **Persistent Storage** - Save notebooks to disk

## 📝 License

MIT License - Feel free to use, modify, and distribute!

## 🤝 Contributing

This is a learning project! Feel free to:
- Add new features
- Improve the UI
- Optimize performance
- Add tests
- Write documentation

## 💡 Tips

- Use `Shift+Enter` to run cells quickly
- Check `/docs` endpoint for interactive API testing
- Monitor backend logs for debugging
- Use browser DevTools to inspect frontend behavior

## 📞 Need Help?

- Check the README files in `backend/` and `frontend/` folders
- Visit the API docs at `http://localhost:8000/docs`
- Review your mentor's notes on vLLM, LiteLLM, and Lark
- Test individual components separately

---

**Built with ❤️ for learning LLM integration, full-stack development, and modern web technologies.**
