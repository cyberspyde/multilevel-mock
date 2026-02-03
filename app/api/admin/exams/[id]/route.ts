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
          where: { partId: null }, // Only standalone prompts
          orderBy: { order: 'asc' },
        },
        writingParts: {
          orderBy: { order: 'asc' },
          include: {
            prompts: {
              orderBy: { order: 'asc' },
            },
          },
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
    const { title, description, type, unlockCode, isActive, questions, writingPrompts, writingParts } = body;

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

    // Use the existing exam type to determine which content to update
    const examType = type || existingExam.type;

    // Handle speaking questions update
    if (questions !== undefined && existingExam.type === 'SPEAKING') {
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

    // Handle writing parts and prompts update
    if (existingExam.type === 'WRITING') {
      // Delete existing parts (cascades to their prompts via relation)
      await prisma.writingPart.deleteMany({
        where: { examId: id },
      });

      // Delete standalone prompts (those without a part)
      await prisma.writingPrompt.deleteMany({
        where: { examId: id, partId: null },
      });

      // Create writing parts with their tasks
      if (writingParts && writingParts.length > 0) {
        for (const part of writingParts) {
          const createdPart = await prisma.writingPart.create({
            data: {
              examId: id,
              order: part.order,
              title: part.title,
              description: part.description || null,
              timeLimit: part.timeLimit || null,
            },
          });

          // Create prompts (tasks) for this part
          if (part.prompts && part.prompts.length > 0) {
            await prisma.writingPrompt.createMany({
              data: part.prompts.map((task: any) => ({
                examId: id,
                partId: createdPart.id,
                order: task.order,
                taskNumber: task.taskNumber || null,
                title: task.title,
                prompt: task.prompt,
                wordLimit: task.wordLimit || null,
                timeLimit: task.timeLimit || null,
                instructions: task.instructions || null,
              })),
            });
          }
        }
      }

      // Create standalone prompts (legacy support)
      if (writingPrompts && writingPrompts.length > 0) {
        await prisma.writingPrompt.createMany({
          data: writingPrompts.map((p: any) => ({
            examId: id,
            partId: null,
            order: p.order,
            taskNumber: null,
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
