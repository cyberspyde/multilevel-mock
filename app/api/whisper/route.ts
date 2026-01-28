import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Dynamically import whisper for server-side transcription
let transcribeAudio: ((audioBlob: Blob) => Promise<string>) | null = null;

async function initializeWhisper() {
    if (!transcribeAudio) {
        try {
            const whisperModule = await import('@/services/whisper');
            transcribeAudio = whisperModule.transcribeAudio;
        } catch (error) {
            console.error('Failed to initialize Whisper on server:', error);
            throw new Error('Whisper initialization failed');
        }
    }
    return transcribeAudio;
}

// POST /api/whisper - Server-side transcription
export async function POST(request: NextRequest) {
    try {
        // Check if server-side whisper is enabled
        const config = await prisma.adminConfig.findUnique({
            where: { key: 'whisper_mode' }
        });

        if (config?.value !== 'server') {
            return NextResponse.json(
                { error: 'Server-side Whisper is not enabled. Please use client-side transcription.' },
                { status: 400 }
            );
        }

        const formData = await request.formData();
        const audioFile = formData.get('audio') as File;

        if (!audioFile) {
            return NextResponse.json(
                { error: 'No audio file provided' },
                { status: 400 }
            );
        }

        // Convert File to Blob
        const arrayBuffer = await audioFile.arrayBuffer();
        const audioBlob = new Blob([arrayBuffer], { type: audioFile.type });

        // Initialize and run Whisper
        const transcribe = await initializeWhisper();
        if (!transcribe) {
            return NextResponse.json(
                { error: 'Failed to initialize Whisper' },
                { status: 500 }
            );
        }

        console.log(`[Server Whisper] Transcribing audio file: ${audioFile.name}, size: ${audioFile.size} bytes`);
        const startTime = Date.now();

        const transcription = await transcribe(audioBlob);

        const duration = Date.now() - startTime;
        console.log(`[Server Whisper] Transcription completed in ${duration}ms`);

        return NextResponse.json({
            success: true,
            transcription,
            duration,
        });

    } catch (error: any) {
        console.error('[Server Whisper] Error:', error);
        return NextResponse.json(
            { error: error.message || 'Transcription failed' },
            { status: 500 }
        );
    }
}

// GET /api/whisper - Check whisper mode and status
export async function GET() {
    try {
        const config = await prisma.adminConfig.findUnique({
            where: { key: 'whisper_mode' }
        });

        return NextResponse.json({
            mode: config?.value || 'client',
            serverAvailable: true, // We could add a health check here
        });

    } catch (error) {
        console.error('[Server Whisper] Error checking status:', error);
        return NextResponse.json({
            mode: 'client',
            serverAvailable: false,
        });
    }
}
