# Troubleshooting Guide

## Backend Issues

### "Cannot connect to backend" in the header

The frontend can't reach the FastAPI server.

1. Make sure the backend is running: `./start-backend.sh`
2. Check it's accessible: `curl http://localhost:8000/health`
3. The frontend proxies `/api/*` to `localhost:8000` — make sure port 8000 is free

### "LiteLLM is not installed"

```bash
pip install litellm --break-system-packages
```

Or if you're in a virtual environment:
```bash
pip install litellm
```

### Translation falls back to simple lowercase

This happens when the LLM is unreachable. Check:

1. Your `VLLM_BASE_URL` is correct
2. The vLLM server is running and accessible
3. The model name matches what's deployed

```bash
# Test your vLLM server directly
curl $VLLM_BASE_URL/models
```

## Frontend Issues

### Page is blank / white screen

1. Check the browser console for errors (F12)
2. Make sure `npm install` completed: `cd frontend && npm install`
3. Try restarting Vite: `cd frontend && npx vite`

### Styles look wrong

1. Make sure Tailwind is installed: `cd frontend && npm install`
2. Check that `postcss.config.js` and `tailwind.config.js` exist
3. Clear browser cache (Ctrl+Shift+R)

### Proxy errors (CORS / 404)

The Vite dev server proxies `/api/*` to `localhost:8000`. If you see proxy errors:

1. Make sure the backend is running on port 8000
2. Check `vite.config.js` — the proxy config should be:
   ```js
   proxy: {
     '/api': {
       target: 'http://localhost:8000',
       changeOrigin: true,
       rewrite: (path) => path.replace(/^\/api/, ''),
     },
   }
   ```

## Cell Execution Issues

### Cell stuck on "Translating..."

The LLM request is taking too long or failed silently.

1. Check the backend terminal for error messages
2. Try a shorter input text
3. If the vLLM server is slow, wait — there's no timeout on the frontend

### Balloons don't appear after "Complete"

The interpretation found zero balloons. This means the word "balloon" wasn't in your input text (case-insensitive search). Try:

```
I love balloons! Red balloon, blue balloon.
```

### "Cannot delete last cell"

This is by design. The notebook always keeps at least one cell. You can clear the cell's output instead.

## Environment Variables

| Variable | Default | How to set |
|----------|---------|------------|
| `VLLM_BASE_URL` | `http://localhost:8000/v1` | `export VLLM_BASE_URL=http://your-server:8000/v1` |
| `DEFAULT_MODEL` | `meta-llama/Llama-2-7b-chat-hf` | `export DEFAULT_MODEL=your-model-name` |

## Port Conflicts

| Service | Default Port | How to change |
|---------|-------------|---------------|
| Backend | 8000 | Edit `backend/main.py` — change the `uvicorn.run` port |
| Frontend | 3000 | Edit `frontend/vite.config.js` — change `server.port` |

## Getting Help

1. Check the API docs at http://localhost:8000/docs (Swagger UI)
2. Check browser console (F12) for frontend errors
3. Check the terminal running the backend for Python errors
