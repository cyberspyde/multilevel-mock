import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/admin/exams/[id] - Get single exam with questions/prompts
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const exam = await prisma.exam.findUnique({
      where: { id },
      include: {
        questions: {
          orderBy: { order: 'asc' },
        },
        writingPrompts: {
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!exam) {
      return NextResponse.json(
        { error: 'Exam not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(exam);
  } catch (error) {
    console.error('Error fetching exam:', error);
    return NextResponse.json(
      { error: 'Failed to fetch exam' },
      { status: 500 }
    );
  }
}

// PUT /api/admin/exams/[id] - Update exam
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { title, description, type, unlockCode, isActive, questions, writingPrompts } = body;

    // Check if exam exists
    const existingExam = await prisma.exam.findUnique({
      where: { id },
    });

    if (!existingExam) {
      return NextResponse.json(
        { error: 'Exam not found' },
        { status: 404 }
      );
    }

    // Update exam basic info
    const exam = await prisma.exam.update({
      where: { id },
      data: {
        title: title ?? existingExam.title,
        description: description ?? existingExam.description,
        type: type ?? existingExam.type,
        unlockCode: unlockCode ? unlockCode.toUpperCase() : existingExam.unlockCode,
        isActive: isActive !== undefined ? isActive : existingExam.isActive,
      },
    });

    // Handle speaking questions update
    if (questions !== undefined && type === 'SPEAKING') {
      // Delete existing questions
      await prisma.speakingQuestion.deleteMany({
        where: { examId: id },
      });

      // Create new questions
      if (questions.length > 0) {
        await prisma.speakingQuestion.createMany({
          data: questions.map((q: any) => ({
            examId: id,
            order: q.order,
            format: q.format,
            text: q.text,
            mediaUrl: q.mediaUrl || null,
            timestamp: q.timestamp || null,
            instructions: q.instructions || null,
            readingTimeLimit: q.readingTimeLimit || null,
            answeringTimeLimit: q.answeringTimeLimit || null,
          })),
        });
      }
    }

    // Handle writing prompts update
    if (writingPrompts !== undefined && type === 'WRITING') {
      // Delete existing prompts
      await prisma.writingPrompt.deleteMany({
        where: { examId: id },
      });

      // Create new prompts
      if (writingPrompts.length > 0) {
        await prisma.writingPrompt.createMany({
          data: writingPrompts.map((p: any) => ({
            examId: id,
            order: p.order,
            title: p.title,
            prompt: p.prompt,
            wordLimit: p.wordLimit || null,
            timeLimit: p.timeLimit || null,
            instructions: p.instructions || null,
          })),
        });
      }
    }

    return NextResponse.json(exam);
  } catch (error) {
    console.error('Error updating exam:', error);
    return NextResponse.json(
      { error: 'Failed to update exam' },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/exams/[id] - Delete exam
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.exam.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting exam:', error);
    return NextResponse.json(
      { error: 'Failed to delete exam' },
      { status: 500 }
    );
  }
}
