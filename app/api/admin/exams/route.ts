import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/admin/exams - Get all exams
export async function GET() {
  try {
    const exams = await prisma.exam.findMany({
      include: {
        _count: {
          select: {
            questions: true,
            writingPrompts: true,
            sessions: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(exams);
  } catch (error) {
    console.error('Error fetching exams:', error);
    return NextResponse.json(
      { error: 'Failed to fetch exams' },
      { status: 500 }
    );
  }
}

// POST /api/admin/exams - Create new exam
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, description, type, unlockCode } = body;

    if (!title || !description || !type || !unlockCode) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const exam = await prisma.exam.create({
      data: {
        title,
        description,
        type,
        unlockCode: unlockCode.toUpperCase(),
      },
    });

    return NextResponse.json(exam);
  } catch (error) {
    console.error('Error creating exam:', error);
    return NextResponse.json(
      { error: 'Failed to create exam' },
      { status: 500 }
    );
  }
}
