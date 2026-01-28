import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// POST /api/writing/autosave - Auto-save writing answer
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, promptId, content } = body;

    if (!sessionId || !promptId || content === undefined) {
      return NextResponse.json(
        { error: 'sessionId, promptId, and content are required' },
        { status: 400 }
      );
    }

    // Calculate word count
    const wordCount = content.trim().split(/\s+/).filter((w: string) => w.length > 0).length;

    // Upsert writing answer
    const answer = await prisma.writingAnswer.upsert({
      where: {
        sessionId_promptId: {
          sessionId,
          promptId,
        },
      },
      update: {
        content,
        wordCount,
        lastSavedAt: new Date(),
      },
      create: {
        sessionId,
        promptId,
        content,
        wordCount,
      },
    });

    return NextResponse.json({
      success: true,
      answer: {
        id: answer.id,
        wordCount: answer.wordCount,
        lastSavedAt: answer.lastSavedAt,
      },
    });
  } catch (error) {
    console.error('Error auto-saving writing answer:', error);
    return NextResponse.json(
      { error: 'Failed to auto-save answer' },
      { status: 500 }
    );
  }
}
