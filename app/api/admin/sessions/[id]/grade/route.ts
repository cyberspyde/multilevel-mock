import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// POST /api/admin/sessions/[id]/grade - Save manual grade for a session
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sessionId } = await params;
    const body = await request.json();
    const { score, feedback, summary, gradedBy } = body;

    if (score === undefined || !feedback || !summary) {
      return NextResponse.json(
        { error: 'score, feedback, and summary are required' },
        { status: 400 }
      );
    }

    // Check if session exists
    const session = await prisma.examSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    // Create or update manual grade (upsert since it's unique per session)
    const grade = await prisma.manualGrade.upsert({
      where: { sessionId },
      update: {
        summary,
        feedback,
        score,
        gradedBy: gradedBy || 'admin',
        updatedAt: new Date(),
      },
      create: {
        sessionId,
        summary,
        feedback,
        score,
        gradedBy: gradedBy || 'admin',
      },
    });

    // Update session to mark as manually graded
    await prisma.examSession.update({
      where: { id: sessionId },
      data: {
        isManuallyGraded: true,
      },
    });

    return NextResponse.json(grade);
  } catch (error) {
    console.error('Error saving manual grade:', error);
    return NextResponse.json(
      { error: 'Failed to save manual grade' },
      { status: 500 }
    );
  }
}
