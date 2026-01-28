import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// POST /api/writing/submit - Submit writing answer
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, promptId, content } = body;

    if (!sessionId || !promptId || !content) {
      return NextResponse.json(
        { error: 'sessionId, promptId, and content are required' },
        { status: 400 }
      );
    }

    const wordCount = content.trim().split(/\s+/).filter((w: string) => w.length > 0).length;

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
        submittedAt: new Date(),
      },
      create: {
        sessionId,
        promptId,
        content,
        wordCount,
        submittedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      answer,
    });
  } catch (error) {
    console.error('Error submitting writing answer:', error);
    return NextResponse.json(
      { error: 'Failed to submit answer' },
      { status: 500 }
    );
  }
}
