# LLM Notebook Backend

FastAPI backend that connects to your vLLM server using LiteLLM for unified LLM access.

## Setup

### 1. Install Dependencies

```bash
cd backend
pip install -r requirements.txt --break-system-packages
```

### 2. Configure vLLM Connection

Edit `main.py` and update these lines:

```python
VLLM_BASE_URL = "http://your-supercomputer-address:8000/v1"  # Your vLLM server URL
DEFAULT_MODEL = "meta-llama/Llama-2-7b-chat-hf"  # Your model name
```

### 3. Run the Server

```bash
python main.py
```

Or with uvicorn directly:
```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

## API Endpoints

### Health Check
```bash
GET http://localhost:8000/health
```

### Process Text
```bash
POST http://localhost:8000/process
Content-Type: application/json

{
  "text": "I LOVE BALLOONS! Red balloon, blue balloon.",
  "model": "meta-llama/Llama-2-7b-chat-hf"  // optional
}
```

Response:
```json
{
  "original_text": "I LOVE BALLOONS! Red balloon, blue balloon.",
  "translated_text": "i love balloons! red balloon, blue balloon.",
  "balloon_count": 3,
  "balloon_images": ["data:image/svg+xml,...", "..."],
  "processing_time": 1.234
}
```

### List Models
```bash
GET http://localhost:8000/models
```

## API Documentation

Interactive API docs available at:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## Connecting to vLLM

Your vLLM server should be running and accessible. Typical setup:

```bash
# On your supercomputer
python -m vllm.entrypoints.openai.api_server \
    --model meta-llama/Llama-2-7b-chat-hf \
    --port 8000
```

Then update `VLLM_BASE_URL` in `main.py` to point to this server.

## Using LiteLLM

LiteLLM provides a unified interface to switch between different LLMs easily:

```python
# Change model by just updating the model ID
response = completion(
    model="openai/meta-llama/Llama-2-7b-chat-hf",
    messages=[...],
    api_base=VLLM_BASE_URL
)
```

No code changes needed to switch models - just change the model ID!

## Troubleshooting

**LiteLLM not found:**
```bash
pip install litellm --break-system-packages
```

**Can't connect to vLLM:**
- Check if vLLM server is running
- Verify the URL and port
- Check firewall settings

**CORS errors from frontend:**
- Already configured to allow all origins
- For production, update `allow_origins` in main.py
