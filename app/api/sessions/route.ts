import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// User-friendly error messages
const ERROR_MESSAGES = {
  MISSING_PARAMS: 'Please provide exam ID, your name, and the unlock code.',
  EXAM_NOT_FOUND: 'Exam not found. Please check the exam ID and try again.',
  EXAM_INACTIVE: 'This exam is currently inactive. Please contact your administrator.',
  INVALID_CODE: 'Incorrect unlock code. Please check with your teacher.',
  SESSION_ID_REQUIRED: 'Session ID is required.',
  SESSION_NOT_FOUND: 'Session not found. Please start a new exam.',
  CREATE_FAILED: 'Failed to create exam session. Please try again.',
  FETCH_FAILED: 'Failed to fetch session data. Please try again.',
};

// POST /api/sessions - Create a new exam session
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { examId, studentName, unlockCode } = body;

    if (!examId || !studentName || !unlockCode) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.MISSING_PARAMS },
        { status: 400 }
      );
    }

    // Validate student name
    if (studentName.trim().length < 2) {
      return NextResponse.json(
        { error: 'Please enter your full name (at least 2 characters).' },
        { status: 400 }
      );
    }

    // Verify exam exists and code matches
    const exam = await prisma.exam.findUnique({
      where: { id: examId },
    });

    if (!exam) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.EXAM_NOT_FOUND },
        { status: 404 }
      );
    }

    if (!exam.isActive) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.EXAM_INACTIVE },
        { status: 403 }
      );
    }

    if (exam.unlockCode !== unlockCode.toUpperCase()) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.INVALID_CODE },
        { status: 401 }
      );
    }

    // Create session
    const session = await prisma.examSession.create({
      data: {
        examId,
        studentName: studentName.trim(),
        unlockCode: unlockCode.toUpperCase(),
      },
      include: {
        exam: {
          select: {
            id: true,
            title: true,
            type: true,
          },
        },
      },
    });

    return NextResponse.json(session);
  } catch (error: unknown) {
    // Handle unique constraint violations
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
      return NextResponse.json(
        { error: 'A session with this information already exists.' },
        { status: 409 }
      );
    }

    return NextResponse.json({ error: ERROR_MESSAGES.CREATE_FAILED }, { status: 500 });
  }
}

// GET /api/sessions - Get session by ID
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('id');

    if (!sessionId) {
      return NextResponse.json({ error: ERROR_MESSAGES.SESSION_ID_REQUIRED }, { status: 400 });
    }

    const session = await prisma.examSession.findUnique({
      where: { id: sessionId },
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
      return NextResponse.json({ error: ERROR_MESSAGES.SESSION_NOT_FOUND }, { status: 404 });
    }

    return NextResponse.json(session);
  } catch {
    return NextResponse.json({ error: ERROR_MESSAGES.FETCH_FAILED }, { status: 500 });
  }
}
