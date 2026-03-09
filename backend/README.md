# Backend — FastAPI + LiteLLM

Two-stage text processing API that connects to a vLLM server.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/translate` | Stage 1: Send text, get lowercase version via LLM |
| `POST` | `/interpret` | Stage 2: Count "balloon" occurrences, get SVG images |
| `POST` | `/process` | Legacy: Both stages in one call |
| `GET` | `/health` | Backend + vLLM status check |
| `GET` | `/models` | List available models |
| `GET` | `/docs` | Interactive Swagger UI |

## Setup

```bash
pip install -r requirements.txt
export VLLM_BASE_URL=http://your-server:8000/v1
export DEFAULT_MODEL=meta-llama/Llama-2-7b-chat-hf
python3 main.py
```

## API Examples

### Translate (Stage 1)

```bash
curl -X POST http://localhost:8000/translate \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello WORLD with BALLOONS!"}'
```

Response:
```json
{
  "original_text": "Hello WORLD with BALLOONS!",
  "translated_text": "hello world with balloons!",
  "processing_time": 0.523
}
```

### Interpret (Stage 2)

```bash
curl -X POST http://localhost:8000/interpret \
  -H "Content-Type: application/json" \
  -d '{"text": "hello world with balloons!"}'
```

Response:
```json
{
  "text": "hello world with balloons!",
  "balloon_count": 1,
  "balloon_images": ["data:image/svg+xml,..."],
  "processing_time": 0.102
}
```

## Dependencies

- `fastapi` — Web framework
- `uvicorn` — ASGI server
- `pydantic` — Data validation
- `litellm` — Unified LLM interface (connects to vLLM)
- `python-multipart` — Form data support

## LLM Fallback

If the vLLM server is unreachable, translation falls back to Python's built-in `str.lower()`. Balloon SVG generation uses hardcoded colors as fallback.
