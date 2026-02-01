"""
Local Whisper Server
An OpenAI-compatible Whisper API server using faster-whisper.

Usage:
    1. Install dependencies: pip install fastapi uvicorn python-multipart faster-whisper
    2. Run server: python main.py
    3. Server will be available at http://127.0.0.1:8000

Environment Variables (optional):
    - WHISPER_MODEL: Model size (tiny, base, small, medium, large-v2, large-v3)
    - WHISPER_DEVICE: Device to use (cpu, cuda)
    - WHISPER_COMPUTE_TYPE: Compute type (int8, float16, float32)
"""

import os
import time
import uuid
from typing import Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from faster_whisper import WhisperModel

# Configuration
MODEL_SIZE = os.getenv("WHISPER_MODEL", "small")
DEVICE = os.getenv("WHISPER_DEVICE", "cpu")
COMPUTE_TYPE = os.getenv("WHISPER_COMPUTE_TYPE", "int8")

# Global model instance
whisper_model = None


class TranscriptionResponse(BaseModel):
    text: str
    model: str
    duration: float


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load model on startup."""
    global whisper_model

    print(f"[Whisper Server] Loading Whisper model: {MODEL_SIZE}...")
    print(f"[Whisper Server] Device: {DEVICE}, Compute type: {COMPUTE_TYPE}")

    try:
        whisper_model = WhisperModel(
            MODEL_SIZE,
            device=DEVICE,
            compute_type=COMPUTE_TYPE,
        )
        print(f"[Whisper Server] Model loaded successfully!")
    except Exception as e:
        print(f"[Whisper Server] Failed to load model: {e}")
        # Continue anyway, will fail on first request

    yield

    # Cleanup
    whisper_model = None
    print("[Whisper Server] Model unloaded.")


app = FastAPI(
    title="Local Whisper Server",
    description="OpenAI-compatible Whisper API using faster-whisper",
    version="1.0.0",
    lifespan=lifespan,
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "ok",
        "model": MODEL_SIZE,
        "ready": whisper_model is not None,
    }


@app.get("/v1/models")
async def list_models():
    """List available models (OpenAI-compatible)."""
    return {
        "object": "list",
        "data": [
            {
                "id": "whisper-1",
                "object": "model",
                "created": int(time.time()),
                "owned_by": "local",
            }
        ],
    }


@app.post("/v1/audio/transcriptions", response_model=TranscriptionResponse)
async def transcribe_audio(
    file: UploadFile = File(...),
    model: str = Form(default="whisper-1"),
    response_format: str = Form(default="json"),
    language: Optional[str] = Form(default=None),
    timestamp_granularities: Optional[str] = Form(default=None),
):
    """
    Transcribe audio file (OpenAI-compatible endpoint).

    Args:
        file: Audio file to transcribe
        model: Model name (ignored, uses configured model)
        response_format: Response format (only json supported)
        language: Language code (auto-detect if not specified)
        timestamp_granularities: Include timestamps (not supported)

    Returns:
        TranscriptionResponse with text, model, and duration
    """
    if whisper_model is None:
        raise HTTPException(
            status_code=503,
            detail="Whisper model not loaded. Please wait for server to initialize."
        )

    # Validate file size (max 100MB)
    content = await file.read()
    if len(content) > 100 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 100MB)")

    if len(content) < 1024:
        raise HTTPException(status_code=400, detail="File too small (may be empty)")

    # Save to temp file for faster-whisper
    temp_filename = f"/tmp/whisper_{uuid.uuid4().hex}.{file.filename.split('.')[-1]}"

    try:
        with open(temp_filename, "wb") as f:
            f.write(content)

        start_time = time.time()

        # Transcribe
        segments, info = whisper_model.transcribe(
            temp_filename,
            language=language,
            beam_size=5,
            vad_filter=True,
            vad_parameters={
                "min_silence_duration_ms": 100,
            }
        )

        # Combine all segments
        transcription_text = " ".join([segment.text for segment in segments]).strip()

        duration = time.time() - start_time

        print(f"[Whisper Server] Transcription completed in {duration:.2f}s: {transcription_text[:50]}...")

        return TranscriptionResponse(
            text=transcription_text,
            model=model,
            duration=round(duration * 1000),  # Convert to ms
        )

    except Exception as e:
        print(f"[Whisper Server] Transcription error: {e}")
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")

    finally:
        # Clean up temp file
        if os.path.exists(temp_filename):
            os.remove(temp_filename)


@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """Global exception handler."""
    return JSONResponse(
        status_code=500,
        content={"error": str(exc)},
    )


if __name__ == "__main__":
    import uvicorn

    print("=" * 60)
    print("Local Whisper Server")
    print("=" * 60)
    print(f"Model: {MODEL_SIZE}")
    print(f"Device: {DEVICE}")
    print(f"Compute Type: {COMPUTE_TYPE}")
    print("=" * 60)
    print("Starting server at http://127.0.0.1:8659")
    print("=" * 60)

    uvicorn.run(
        app,
        host="127.0.0.1",
        port=8659,
        log_level="info",
    )
