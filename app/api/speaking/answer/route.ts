import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// User-friendly error messages
const ERROR_MESSAGES = {
  MISSING_PARAMS: 'Session ID and Question ID are required.',
  SESSION_NOT_FOUND: 'Session not found. Please start a new exam.',
  QUESTION_NOT_FOUND: 'Question not found. Please try again.',
  SAVE_FAILED: 'Failed to save your answer. Please try again.',
  ANSWER_EXISTS: 'You have already answered this question.',
};

// POST /api/speaking/answer - Save speaking answer
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, questionId, audioUrl, transcription, duration } = body;

    if (!sessionId || !questionId) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.MISSING_PARAMS },
        { status: 400 }
      );
    }

    // Verify session exists
    const session = await prisma.examSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.SESSION_NOT_FOUND },
        { status: 404 }
      );
    }

    // Verify question exists
    const question = await prisma.speakingQuestion.findUnique({
      where: { id: questionId },
    });

    if (!question) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.QUESTION_NOT_FOUND },
        { status: 404 }
      );
    }

    // Check if answer already exists
    const existingAnswer = await prisma.speakingAnswer.findUnique({
      where: {
        sessionId_questionId: {
          sessionId,
          questionId,
        },
      },
    });

    if (existingAnswer) {
      // Update existing answer instead of creating a new one
      const updatedAnswer = await prisma.speakingAnswer.update({
        where: { id: existingAnswer.id },
        data: {
          audioUrl: audioUrl || existingAnswer.audioUrl,
          transcription: transcription || existingAnswer.transcription,
          duration: duration || existingAnswer.duration,
        },
      });

      console.log(`[Speaking Answer API] Updated existing answer: ${updatedAnswer.id}`);
      return NextResponse.json({
        success: true,
        answer: updatedAnswer,
        updated: true,
      });
    }

    // Create new answer
    const answer = await prisma.speakingAnswer.create({
      data: {
        sessionId,
        questionId,
        audioUrl: audioUrl || null,
        transcription: transcription || null,
        duration: duration || null,
      },
    });

    console.log(`[Speaking Answer API] Created new answer: ${answer.id}`);
    return NextResponse.json({
      success: true,
      answer,
      created: true,
    });
  } catch (error: any) {
    console.error('[Speaking Answer API] Error saving answer:', error);

    // Handle specific Prisma errors
    if (error.code === 'P2003') {
      return NextResponse.json(
        { error: 'Invalid session or question ID.' },
        { status: 400 }
      );
    }

    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: ERROR_MESSAGES.ANSWER_EXISTS },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: ERROR_MESSAGES.SAVE_FAILED },
      { status: 500 }
    );
  }
}
