"""
LLM Notebook Backend
FastAPI server that processes text using LiteLLM to connect to vLLM servers
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import re
import json

# Import LiteLLM for unified LLM interface
try:
    from litellm import completion
    LITELLM_AVAILABLE = True
except ImportError:
    LITELLM_AVAILABLE = False
    print("⚠️  LiteLLM not installed. Run: pip install litellm --break-system-packages")

app = FastAPI(
    title="LLM Notebook API",
    description="Backend for LLM-powered Jupyter-like notebook",
    version="1.0.0"
)

# CORS middleware to allow frontend connections
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuration - Update these to point to your vLLM server
VLLM_BASE_URL = "http://your-supercomputer-address:8000/v1"  # Update this!
DEFAULT_MODEL = "meta-llama/Llama-2-7b-chat-hf"  # Update to your model!

# Request/Response models
class ProcessRequest(BaseModel):
    text: str
    model: Optional[str] = None

class ProcessResponse(BaseModel):
    original_text: str
    translated_text: str
    balloon_count: int
    balloon_images: List[str]
    processing_time: float

class HealthResponse(BaseModel):
    status: str
    litellm_available: bool
    vllm_configured: bool

# Health check endpoint
@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Check if the API and dependencies are working"""
    return {
        "status": "healthy",
        "litellm_available": LITELLM_AVAILABLE,
        "vllm_configured": VLLM_BASE_URL != "http://your-supercomputer-address:8000/v1"
    }

@app.get("/")
async def root():
    """Root endpoint with API information"""
    return {
        "message": "LLM Notebook API",
        "version": "1.0.0",
        "endpoints": {
            "health": "/health",
            "process": "/process",
            "docs": "/docs"
        }
    }

# Main processing endpoint
@app.post("/process", response_model=ProcessResponse)
async def process_text(request: ProcessRequest):
    """
    Process text through two phases:
    1. Translation to lowercase using LLM
    2. Balloon interpretation - generate images for each 'balloon' mention
    """
    import time
    start_time = time.time()

    if not LITELLM_AVAILABLE:
        raise HTTPException(
            status_code=503,
            detail="LiteLLM not available. Please install: pip install litellm"
        )

    try:
        # Phase 1: Translate to lowercase using LLM
        translated_text = await translate_to_lowercase(request.text, request.model)
        
        # Phase 2: Count balloons and generate images
        balloon_count = count_balloons(translated_text)
        balloon_images = await generate_balloon_images(balloon_count, request.model) if balloon_count > 0 else []
        
        processing_time = time.time() - start_time
        
        return ProcessResponse(
            original_text=request.text,
            translated_text=translated_text,
            balloon_count=balloon_count,
            balloon_images=balloon_images,
            processing_time=round(processing_time, 3)
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Processing error: {str(e)}")

async def translate_to_lowercase(text: str, model: Optional[str] = None) -> str:
    """
    Use LLM to translate text to lowercase
    This demonstrates LLM integration even for simple tasks
    """
    model_name = model or DEFAULT_MODEL
    
    # For demo purposes, you can also just do text.lower() here
    # But we'll show how to call the LLM properly
    
    try:
        # Using LiteLLM to call vLLM server
        response = completion(
            model=f"openai/{model_name}",  # LiteLLM format for custom endpoints
            messages=[{
                "role": "user",
                "content": f"Convert this text to lowercase. Return ONLY the lowercase text, nothing else:\n\n{text}"
            }],
            api_base=VLLM_BASE_URL,
            max_tokens=500,
            temperature=0.1
        )
        
        result = response.choices[0].message.content.strip()
        return result
    
    except Exception as e:
        print(f"LLM translation error: {e}")
        # Fallback to simple lowercase if LLM fails
        return text.lower()

def count_balloons(text: str) -> int:
    """Count occurrences of 'balloon' in text (case-insensitive)"""
    matches = re.findall(r'balloon', text, re.IGNORECASE)
    return len(matches)

async def generate_balloon_images(count: int, model: Optional[str] = None) -> List[str]:
    """
    Generate balloon SVG images using LLM
    Returns list of SVG data URIs
    """
    model_name = model or DEFAULT_MODEL
    
    # For reliability, we'll generate SVGs locally with LLM-suggested colors
    try:
        # Ask LLM for color suggestions
        response = completion(
            model=f"openai/{model_name}",
            messages=[{
                "role": "user",
                "content": f"Suggest {count} vibrant, distinct balloon colors. Return ONLY a JSON array of hex color codes like [\"#FF6B6B\", \"#4ECDC4\"]. No other text."
            }],
            api_base=VLLM_BASE_URL,
            max_tokens=200,
            temperature=0.7
        )
        
        result = response.choices[0].message.content.strip()
        # Clean up response and parse JSON
        result = result.replace('```json', '').replace('```', '').strip()
        colors = json.loads(result)
    
    except Exception as e:
        print(f"Color generation error: {e}, using defaults")
        # Fallback colors
        colors = ['#FF6B6B', '#4ECDC4', '#FFE66D', '#95E1D3', '#A8E6CF', 
                  '#FF8B94', '#C7CEEA', '#FFB6C1', '#87CEEB', '#FFA07A']
    
    # Generate SVG data URIs
    balloon_images = []
    for i in range(count):
        color = colors[i % len(colors)]
        svg = generate_balloon_svg(color, i)
        data_uri = f"data:image/svg+xml,{svg}"
        balloon_images.append(data_uri)
    
    return balloon_images

def generate_balloon_svg(color: str, index: int) -> str:
    """Generate a single balloon SVG with the given color"""
    from urllib.parse import quote
    
    # Darken color for gradient
    darker_color = adjust_brightness(color, -20)
    
    svg = f'''
    <svg width="100" height="140" xmlns="http://www.w3.org/2000/svg">
        <defs>
            <linearGradient id="grad{index}" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:{color};stop-opacity:1" />
                <stop offset="100%" style="stop-color:{darker_color};stop-opacity:1" />
            </linearGradient>
            <filter id="shadow{index}">
                <feGaussianBlur in="SourceAlpha" stdDeviation="3"/>
                <feOffset dx="0" dy="4" result="offsetblur"/>
                <feComponentTransfer>
                    <feFuncA type="linear" slope="0.3"/>
                </feComponentTransfer>
                <feMerge>
                    <feMergeNode/>
                    <feMergeNode in="SourceGraphic"/>
                </feMerge>
            </filter>
        </defs>
        <ellipse cx="50" cy="50" rx="38" ry="45" fill="url(#grad{index})" stroke="#333" stroke-width="2" filter="url(#shadow{index})"/>
        <path d="M 50 95 Q 45 115 50 130" stroke="#666" stroke-width="2.5" fill="none" stroke-linecap="round"/>
        <ellipse cx="35" cy="35" rx="10" ry="12" fill="white" opacity="0.7"/>
        <ellipse cx="32" cy="32" rx="5" ry="6" fill="white" opacity="0.9"/>
        <path d="M 48 130 L 46 132 L 50 133 L 54 132 L 52 130" fill="#333" opacity="0.6"/>
    </svg>
    '''
    
    return quote(svg.strip())

def adjust_brightness(hex_color: str, percent: int) -> str:
    """Adjust hex color brightness by percentage"""
    hex_color = hex_color.lstrip('#')
    r, g, b = int(hex_color[0:2], 16), int(hex_color[2:4], 16), int(hex_color[4:6], 16)
    
    r = max(0, min(255, r + int(255 * percent / 100)))
    g = max(0, min(255, g + int(255 * percent / 100)))
    b = max(0, min(255, b + int(255 * percent / 100)))
    
    return f"#{r:02x}{g:02x}{b:02x}"

# Model management endpoints
@app.get("/models")
async def list_models():
    """List available models (you can customize this based on your vLLM setup)"""
    return {
        "models": [
            {
                "id": "meta-llama/Llama-2-7b-chat-hf",
                "name": "Llama 2 7B Chat",
                "description": "Meta's Llama 2 7B parameter chat model"
            },
            {
                "id": "mistralai/Mistral-7B-Instruct-v0.2",
                "name": "Mistral 7B Instruct",
                "description": "Mistral's 7B instruction-tuned model"
            }
            # Add your available models here
        ],
        "default": DEFAULT_MODEL
    }

if __name__ == "__main__":
    import uvicorn
    
    print("🚀 Starting LLM Notebook Backend...")
    print(f"📡 vLLM Server: {VLLM_BASE_URL}")
    print(f"🤖 Default Model: {DEFAULT_MODEL}")
    print("📖 API Docs: http://localhost:8000/docs")
    
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")
