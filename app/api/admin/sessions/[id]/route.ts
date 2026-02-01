import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/admin/sessions/[id] - Get session details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const session = await prisma.examSession.findUnique({
      where: { id },
      include: {
        exam: {
          include: {
            questions: { orderBy: { order: 'asc' } },
            writingPrompts: { orderBy: { order: 'asc' } },
          },
        },
        speakingAnswers: {
          include: { question: true },
          orderBy: { createdAt: 'asc' },
        },
        writingAnswers: {
          include: { prompt: true },
          orderBy: { createdAt: 'asc' },
        },
        aiGrades: true,
        manualGrades: true,
      },
    });

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(session);
  } catch (error) {
    console.error('Error fetching session:', error);
    return NextResponse.json(
      { error: 'Failed to fetch session' },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/sessions/[id] - Delete a session (cascades to answers, grades)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check if session exists
    const session = await prisma.examSession.findUnique({
      where: { id },
      select: {
        id: true,
        studentName: true,
        exam: {
          select: {
            title: true,
          },
        },
      },
    });

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    // Delete session (cascades to speakingAnswers, writingAnswers, aiGrades, manualGrades)
    await prisma.examSession.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: `Session for ${session.studentName} (${session.exam.title}) has been deleted`,
    });
  } catch (error) {
    console.error('Error deleting session:', error);
    return NextResponse.json(
      { error: 'Failed to delete session' },
      { status: 500 }
    );
  }
}
