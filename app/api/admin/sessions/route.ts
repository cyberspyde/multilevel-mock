import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/admin/sessions - Get all sessions
export async function GET() {
  try {
    const sessions = await prisma.examSession.findMany({
      include: {
        exam: {
          select: {
            id: true,
            title: true,
            type: true,
          },
        },
        _count: {
          select: {
            speakingAnswers: true,
            writingAnswers: true,
          },
        },
      },
      orderBy: { startedAt: 'desc' },
    });

    return NextResponse.json(sessions);
  } catch (error) {
    console.error('Error fetching sessions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sessions' },
      { status: 500 }
    );
  }
}
