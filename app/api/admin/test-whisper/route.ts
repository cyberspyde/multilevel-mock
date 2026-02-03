import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const audioFile = formData.get('audio') as File;

    if (!audioFile) {
      return NextResponse.json(
        { error: 'No audio file provided' },
        { status: 400 }
      );
    }

    const startTime = Date.now();

    // Forward to Whisper API
    const whisperFormData = new FormData();
    whisperFormData.append('file', audioFile);
    whisperFormData.append('response_format', 'json');
    whisperFormData.append('timestamp_granularities', 'word');

    const whisperApiUrl = (process.env.WHISPER_API_URL || 'http://127.0.0.1:8659').trim().replace(/\/+$/, '');
    const whisperRes = await fetch(`${whisperApiUrl}/v1/audio/transcriptions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.WHISPER_API_KEY || 'dummy-key'}`,
      },
      body: whisperFormData,
    });

    const duration = Date.now() - startTime;

    if (!whisperRes.ok) {
      const errorText = await whisperRes.text();
      return NextResponse.json({
        success: false,
        error: `Whisper API error: ${whisperRes.status} - ${errorText}`,
        duration,
      });
    }

    const data = await whisperRes.json();

    return NextResponse.json({
      success: true,
      transcription: data.text,
      duration,
      model: data.model || 'whisper-1',
    });

  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message || 'Connection failed',
    });
  }
}
