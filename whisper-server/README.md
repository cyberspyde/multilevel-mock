# Local Whisper Server Setup

This directory contains a local Whisper transcription server that provides an OpenAI-compatible API using [faster-whisper](https://github.com/SYSTRAN/faster-whisper).

## Quick Start

### 1. Install Python Dependencies

```bash
cd whisper-server
pip install -r requirements.txt
```

### 2. Start the Whisper Server

```bash
python main.py
```

The server will start at `http://127.0.0.1:8659`

### 3. Start Your Next.js App

In a separate terminal:

```bash
npm run dev
```

## Configuration

The Whisper server reads these environment variables (optional):

| Variable | Default | Description |
|----------|---------|-------------|
| `WHISPER_MODEL` | `small` | Model size: `tiny`, `base`, `small`, `medium`, `large-v2`, `large-v3` |
| `WHISPER_DEVICE` | `cpu` | Device: `cpu` or `cuda` (if NVIDIA GPU available) |
| `WHISPER_COMPUTE_TYPE` | `int8` | Precision: `int8` (fastest), `float16`, `float32` (best quality) |

### Model Options

| Model | Size | VRAM | Speed | Quality |
|-------|------|------|-------|---------|
| tiny | ~39MB | ~1GB | Fastest | Lowest |
| base | ~74MB | ~1GB | Fast | Good |
| small | ~244MB | ~2GB | Medium | Better |
| medium | ~769MB | ~3GB | Slow | Best |
| large-v2 | ~1.5GB | ~4GB | Slower | Excellent |
| large-v3 | ~1.5GB | ~4GB | Slower | State of the art |

## API Endpoints

### POST /v1/audio/transcriptions

Transcribe an audio file (OpenAI-compatible).

```bash
curl -X POST http://127.0.0.1:8659/v1/audio/transcriptions \
  -H "Authorization: Bearer local-whisper" \
  -F "file=@audio.webm" \
  -F "model=whisper-1"
```

Response:
```json
{
  "text": "Transcribed text here...",
  "model": "whisper-1",
  "duration": 1234
}
```

### GET /health

Check server health and model status.

```bash
curl http://127.0.0.1:8659/health
```

Response:
```json
{
  "status": "ok",
  "model": "small",
  "ready": true
}
```

## Troubleshooting

### Server won't start

1. Make sure Python 3.8+ is installed: `python --version`
2. Install dependencies: `pip install -r requirements.txt`

### "Whisper server is not running" error

1. Make sure the Whisper server is running in a separate terminal
2. Check that the server is accessible: `curl http://127.0.0.1:8659/health`
3. Verify `WHISPER_API_URL` in `.env.local` matches the server address

### Slow transcription

1. Try a smaller model (`tiny` or `base`)
2. Use `int8` compute type for faster processing
3. If you have an NVIDIA GPU, set `WHISPER_DEVICE=cuda`

## First Run

On the first run, faster-whisper will download the model files. This may take a few minutes depending on your internet connection and the model size.

Models are cached locally in:
- Windows: `C:\Users\<username>\.cache\huggingface\hub\`
- Linux/Mac: `~/.cache/huggingface/hub/`
