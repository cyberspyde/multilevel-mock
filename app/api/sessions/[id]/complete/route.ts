import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// POST /api/sessions/[id]/complete - Mark session as completed
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const session = await prisma.examSession.update({
      where: { id },
      data: {
        completedAt: new Date(),
      },
      include: {
        exam: true,
      },
    });

    return NextResponse.json(session);
  } catch (error) {
    console.error('Error completing session:', error);
    return NextResponse.json(
      { error: 'Failed to complete session' },
      { status: 500 }
    );
  }
}
