import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// POST /api/exams/verify - Verify exam unlock code
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { examId, unlockCode } = body;

    if (!examId || !unlockCode) {
      return NextResponse.json(
        { error: 'examId and unlockCode are required' },
        { status: 400 }
      );
    }

    const exam = await prisma.exam.findUnique({
      where: { id: examId },
      select: {
        id: true,
        unlockCode: true,
        isActive: true,
        title: true,
        type: true,
      },
    });

    if (!exam) {
      return NextResponse.json(
        { error: 'Exam not found' },
        { status: 404 }
      );
    }

    if (!exam.isActive) {
      return NextResponse.json(
        { error: 'Exam is not active' },
        { status: 400 }
      );
    }

    if (exam.unlockCode !== unlockCode.toUpperCase()) {
      return NextResponse.json(
        { error: 'Invalid unlock code' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      exam: {
        id: exam.id,
        title: exam.title,
        type: exam.type,
      },
    });
  } catch (error) {
    console.error('Error verifying exam code:', error);
    return NextResponse.json(
      { error: 'Failed to verify exam code' },
      { status: 500 }
    );
  }
}
