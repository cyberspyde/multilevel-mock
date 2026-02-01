import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// POST /api/admin/sessions/bulk-delete - Bulk delete sessions
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { ids } = body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: 'Invalid request: ids must be a non-empty array' },
        { status: 400 }
      );
    }

    // Delete all sessions (cascades to speakingAnswers, writingAnswers, aiGrades, manualGrades)
    const result = await prisma.examSession.deleteMany({
      where: {
        id: { in: ids },
      },
    });

    return NextResponse.json({
      success: true,
      message: `${result.count} session(s) have been deleted`,
      deletedCount: result.count,
    });
  } catch (error) {
    console.error('Error bulk deleting sessions:', error);
    return NextResponse.json(
      { error: 'Failed to delete sessions' },
      { status: 500 }
    );
  }
}
