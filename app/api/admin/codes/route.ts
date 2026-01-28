import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET all AI codes
export async function GET() {
  try {
    const codes = await prisma.aICode.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(codes);
  } catch (error) {
    console.error('Error fetching AI codes:', error);
    return NextResponse.json(
      { error: 'Failed to fetch AI codes' },
      { status: 500 }
    );
  }
}

// POST create new AI code
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { maxUses, expiresAt } = body;

    // Generate a unique code
    const code = generateAICode();

    const aiCode = await prisma.aICode.create({
      data: {
        code,
        maxUses: maxUses ? parseInt(maxUses) : null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
    });

    return NextResponse.json(aiCode);
  } catch (error) {
    console.error('Error creating AI code:', error);
    return NextResponse.json(
      { error: 'Failed to create AI code' },
      { status: 500 }
    );
  }
}

// DELETE AI code
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Code ID is required' },
        { status: 400 }
      );
    }

    await prisma.aICode.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting AI code:', error);
    return NextResponse.json(
      { error: 'Failed to delete AI code' },
      { status: 500 }
    );
  }
}

// PUT toggle AI code active status
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, isActive } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Code ID is required' },
        { status: 400 }
      );
    }

    const aiCode = await prisma.aICode.update({
      where: { id },
      data: { isActive },
    });

    return NextResponse.json(aiCode);
  } catch (error) {
    console.error('Error updating AI code:', error);
    return NextResponse.json(
      { error: 'Failed to update AI code' },
      { status: 500 }
    );
  }
}

// Helper function to generate unique AI codes
function generateAICode(): string {
  const prefix = 'AI-GRADER';
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
}
