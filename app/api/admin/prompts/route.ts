import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/admin/prompts - Get all prompts
export async function GET(request: NextRequest) {
  try {
    const prompts = await prisma.aIPrompt.findMany({
      orderBy: [{ examType: 'asc' }, { createdAt: 'desc' }],
    });
    return NextResponse.json(prompts);
  } catch (error: any) {
    console.error('[Prompts API] Error fetching prompts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch prompts' },
      { status: 500 }
    );
  }
}

// POST /api/admin/prompts - Create new prompt
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { displayName, examType, prompt } = body;

    if (!displayName || !examType || !prompt) {
      return NextResponse.json(
        { error: 'displayName, examType, and prompt are required' },
        { status: 400 }
      );
    }

    // Generate a unique name from displayName
    const name = displayName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .substring(0, 50);

    const newPrompt = await prisma.aIPrompt.create({
      data: {
        name,
        displayName,
        examType,
        prompt,
      },
    });

    return NextResponse.json(newPrompt);
  } catch (error: any) {
    console.error('[Prompts API] Error creating prompt:', error);

    // Handle unique constraint violation
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'A prompt with this name already exists' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create prompt' },
      { status: 500 }
    );
  }
}
