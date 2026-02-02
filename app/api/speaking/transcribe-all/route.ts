import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

const TRANSCRIBE_TIMEOUT = 120000; // 2 minutes per transcription
const MAX_RETRIES = 3;

// Helper function to transcribe a single answer with retry
async function transcribeAnswer(
  answer: any,
  serverUrl: string,
  retryCount: number = 0
): Promise<{ success: boolean; answerId: string; questionId: string; transcription?: string | null; error?: string }> {
  try {
    console.log(`[Transcribe-All] Processing answer ${answer.id} (attempt ${retryCount + 1}/${MAX_RETRIES})`);
    console.log(`[Transcribe-All] Audio URL: ${answer.audioUrl}`);

    // Validate audio URL exists
    if (!answer.audioUrl) {
      return { success: false, answerId: answer.id, questionId: answer.questionId, error: 'No audio URL' };
    }

    // Extract file path from URL (format: /api/upload?file=/uploads/audio/...)
    let filePath: string | null = null;
    if (answer.audioUrl.includes('/api/upload?file=')) {
      const urlObj = new URL(answer.audioUrl, 'http://localhost');
      filePath = urlObj.searchParams.get('file');
    }

    if (!filePath) {
      const error = `Could not extract file path from URL: ${answer.audioUrl}`;
      console.error(`[Transcribe-All] ${error}`);
      return { success: false, answerId: answer.id, questionId: answer.questionId, error };
    }

    // Construct full file path
    // Remove leading slash from filePath to avoid path.join treating it as absolute
    const relativePath = filePath.startsWith('/') ? filePath.substring(1) : filePath;
    const fullPath = path.join(process.cwd(), 'public', relativePath);
    console.log(`[Transcribe-All] Full file path: ${fullPath}`);

    // Check if file exists
    if (!existsSync(fullPath)) {
      const error = `Audio file not found on disk at: ${fullPath}`;
      console.error(`[Transcribe-All] ${error}`);
      return { success: false, answerId: answer.id, questionId: answer.questionId, error };
    }

    // Read file directly from disk
    const audioBuffer = await readFile(fullPath);
    console.log(`[Transcribe-All] File size: ${audioBuffer.length} bytes`);

    // Validate we got actual audio data
    if (audioBuffer.length < 1024) {
      const error = `Audio file too small (${audioBuffer.length} bytes) - may be empty or corrupted`;
      console.error(`[Transcribe-All] ${error} for answer ${answer.id}`);
      return { success: false, answerId: answer.id, questionId: answer.questionId, error };
    }

    // Determine MIME type from file extension
    const ext = path.extname(fullPath).toLowerCase();
    let mimeType = 'audio/webm';
    if (ext === '.ogg') mimeType = 'audio/ogg';
    else if (ext === '.m4a') mimeType = 'audio/mp4';
    else if (ext === '.mp3') mimeType = 'audio/mpeg';
    else if (ext === '.wav') mimeType = 'audio/wav';

    // Create a File object from the buffer
    const audioFile = new File([audioBuffer], path.basename(fullPath), { type: mimeType });

    // Send to whisper API for transcription
    const formData = new FormData();
    formData.append('audio', audioFile, path.basename(fullPath));

    const whisperController = new AbortController();
    const whisperTimeoutId = setTimeout(() => whisperController.abort(), TRANSCRIBE_TIMEOUT);

    console.log(`[Transcribe-All] Sending to whisper API at: ${serverUrl}/api/whisper`);

    const whisperRes = await fetch(`${serverUrl}/api/whisper`, {
      method: 'POST',
      body: formData,
      signal: whisperController.signal,
    });
    clearTimeout(whisperTimeoutId);

    console.log(`[Transcribe-All] Whisper API response status: ${whisperRes.status}`);

    if (!whisperRes.ok) {
      let errorDetails = 'Unknown error';
      try {
        const errorData = await whisperRes.json();
        errorDetails = errorData.error || whisperRes.statusText;
      } catch {
        errorDetails = await whisperRes.text().catch(() => 'Could not read error response');
      }
      const error = `Whisper API error (${whisperRes.status}): ${errorDetails}`;
      console.error(`[Transcribe-All] ${error} for answer ${answer.id}`);
      return { success: false, answerId: answer.id, questionId: answer.questionId, error };
    }

    const whisperData = await whisperRes.json();
    console.log(`[Transcribe-All] Whisper API response:`, whisperData);

    // Handle empty transcription gracefully - use placeholder for silent/inaudible audio
    const transcription = whisperData.transcription?.trim() || '[No speech detected]';

    // Update answer with transcription
    await prisma.speakingAnswer.update({
      where: { id: answer.id },
      data: { transcription },
    });

    console.log(`[Transcribe-All] Successfully transcribed answer ${answer.id}:`, transcription.substring(0, 50) + '...');

    return {
      success: true,
      answerId: answer.id,
      questionId: answer.questionId,
      transcription,
    };

  } catch (error: any) {
    const errorMsg = error?.message || error?.toString() || 'Unknown error';
    console.error(`[Transcribe-All] Error transcribing answer ${answer.id}:`, errorMsg, error);

    // Retry logic for network/timeout errors
    if (retryCount < MAX_RETRIES - 1) {
      const shouldRetry =
        errorMsg.includes('timeout') ||
        errorMsg.includes('fetch') ||
        errorMsg.includes('network') ||
        errorMsg.includes('ECONNREFUSED') ||
        errorMsg.includes('ECONNRESET');

      if (shouldRetry) {
        console.log(`[Transcribe-All] Retrying answer ${answer.id} after ${1000 * (retryCount + 1)}ms...`);
        await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
        return transcribeAnswer(answer, serverUrl, retryCount + 1);
      }
    }

    return {
      success: false,
      answerId: answer.id,
      questionId: answer.questionId,
      error: errorMsg,
    };
  }
}

// POST /api/speaking/transcribe-all - Transcribe all answers for a session
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId } = body;

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required.' }, { status: 400 });
    }

    // Server-side whisper is always enabled (client-side removed)
    console.log(`[Transcribe-All] Starting transcription for session ${sessionId}`);

    // Get session with answers that need transcription
    const session = await prisma.examSession.findUnique({
      where: { id: sessionId },
      include: {
        speakingAnswers: {
          where: {
            transcription: null,
            audioUrl: { not: null },
          },
          include: { question: true },
        },
      },
    });

    if (!session) {
      return NextResponse.json({ error: 'Session not found.' }, { status: 404 });
    }

    if (session.speakingAnswers.length === 0) {
      console.log(`[Transcribe-All] No answers need transcription for session ${sessionId}`);
      return NextResponse.json({
        success: true,
        processed: 0,
        results: [],
      });
    }

    // Use localhost for server-side API calls (not the public URL)
    // For production, you can use the internal service URL
    const port = process.env.PORT || '3000';
    const serverUrl = `http://localhost:${port}`;
    const results = [];

    console.log(`[Transcribe-All] Processing ${session.speakingAnswers.length} answers...`);
    console.log(`[Transcribe-All] Using server URL: ${serverUrl}`);

    // Transcribe each answer sequentially (to avoid overwhelming the system)
    for (const answer of session.speakingAnswers) {
      const result = await transcribeAnswer(answer, serverUrl);
      results.push(result);
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    console.log(`[Transcribe-All] Completed: ${successCount} success, ${failureCount} failures`);

    return NextResponse.json({
      success: true,
      processed: results.length,
      successCount,
      failureCount,
      results,
    });

  } catch (error: any) {
    const errorMsg = error?.message || 'Failed to transcribe answers';
    console.error('[Transcribe-All] Fatal error:', errorMsg, error);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
