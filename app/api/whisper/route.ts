import { NextRequest, NextResponse } from 'next/server';

// POST /api/whisper - Server-side transcription using local Whisper server
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const formData = await request.formData();
    const audioFile = formData.get('file') as File || formData.get('audio') as File;

    if (!audioFile) {
      console.error('[Whisper API] No audio file provided');
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
    }

    // Validate audio file size (max 50MB)
    const MAX_AUDIO_SIZE = 50 * 1024 * 1024;
    if (audioFile.size > MAX_AUDIO_SIZE) {
      console.error('[Whisper API] Audio file too large:', audioFile.size);
      return NextResponse.json({ error: 'Audio file too large (max 50MB)' }, { status: 400 });
    }

    // Validate audio file size (min 1KB to detect actual audio)
    if (audioFile.size < 1024) {
      console.error('[Whisper API] Audio file too small, possibly empty:', audioFile.size);
      return NextResponse.json({ error: 'Audio file is empty or too small' }, { status: 400 });
    }

    // Get Whisper server configuration
    const whisperApiUrl = (process.env.WHISPER_API_URL || 'http://127.0.0.1:8659').trim();
    const whisperApiKey = process.env.WHISPER_API_KEY || 'local-whisper';

    console.log(`[Whisper API] Forwarding to local Whisper server at ${whisperApiUrl}`);

    // Forward the request to the local Whisper server
    const whisperFormData = new FormData();
    whisperFormData.append('file', audioFile);
    whisperFormData.append('model', 'whisper-1');
    whisperFormData.append('response_format', 'json');

    // Use default retry logic
    let transcription: string = '';
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        console.log(`[Whisper API] Transcription attempt ${attempt}/3...`);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 minute timeout

        const whisperRes = await fetch(`${whisperApiUrl.replace(/\/+$/, '')}/v1/audio/transcriptions`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${whisperApiKey}`,
          },
          body: whisperFormData,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!whisperRes.ok) {
          const errorText = await whisperRes.text();
          throw new Error(`Whisper server error: ${whisperRes.status} - ${errorText}`);
        }

        const data = await whisperRes.json();
        console.log(`[Whisper API] Raw response from whisper server:`, JSON.stringify(data));
        transcription = data.text || '';

        // Empty transcription is valid (silence or inaudible audio)
        if (typeof transcription !== 'string') {
          throw new Error('Invalid transcription result from server');
        }

        // Success!
        console.log(`[Whisper API] Transcription successful on attempt ${attempt}:`, transcription ? transcription.substring(0, 50) + '...' : '(empty)');
        break;

      } catch (error: any) {
        lastError = error;
        console.error(`[Whisper API] Transcription attempt ${attempt} failed:`, error.message);

        if (attempt === 3) {
          break;
        }

        // Retry with exponential backoff for network/timeout errors
        if (
          error.message.includes('timeout') ||
          error.message.includes('fetch') ||
          error.message.includes('network') ||
          error.message.includes('ECONNREFUSED')
        ) {
          const waitTime = 1000 * attempt;
          console.log(`[Whisper API] Retrying after ${waitTime}ms...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        } else {
          // Don't retry on other errors
          break;
        }
      }
    }

    if (lastError && transcription === undefined) {
      throw lastError;
    }

    const duration = Date.now() - startTime;
    console.log(`[Whisper API] Transcription completed in ${duration}ms`);

    return NextResponse.json({
      success: true,
      transcription: (transcription || '').trim(),
      duration
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Transcription failed';
    console.error('[Whisper API] Transcription error:', message, error);

    // Provide helpful error message if Whisper server is not available
    if (message.includes('ECONNREFUSED') || message.includes('fetch failed')) {
      return NextResponse.json({
        error: 'Whisper server is not running. Please start the local Whisper server using: python whisper-server/main.py',
      }, { status: 503 });
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// GET /api/whisper - Check whisper status
export async function GET() {
  try {
    const whisperApiUrl = (process.env.WHISPER_API_URL || 'http://127.0.0.1:8659').trim();

    // Check if Whisper server is running
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

    const healthRes = await fetch(`${whisperApiUrl.replace(/\/+$/, '')}/health`, {
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!healthRes.ok) {
      throw new Error('Whisper server health check failed');
    }

    const healthData = await healthRes.json();

    return NextResponse.json({
      ready: healthData.ready || true,
      service: 'local-whisper-server',
      model: healthData.model || 'unknown',
    });
  } catch (error) {
    console.error('[Whisper API] GET error:', error);
    return NextResponse.json({
      ready: false,
      service: 'local-whisper-server',
      error: 'Whisper server is not running. Start it with: python whisper-server/main.py'
    }, { status: 503 });
  }
}
