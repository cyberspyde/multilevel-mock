import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/exams - Get all active exams
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') as 'SPEAKING' | 'WRITING' | null;

    const where = type ? { type, isActive: true } : { isActive: true };

    const exams = await prisma.exam.findMany({
      where,
      select: {
        id: true,
        title: true,
        description: true,
        type: true,
        isActive: true,
        createdAt: true,
        _count: {
          select: {
            questions: true,
            writingPrompts: true,
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
