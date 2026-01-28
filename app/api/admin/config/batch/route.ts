import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const configs = await req.json();
    
    // Validate input
    if (!Array.isArray(configs)) {
      return NextResponse.json(
        { error: 'Invalid input format' },
        { status: 400 }
      );
    }

    // Update all configs in a transaction
    await prisma.$transaction(
      configs.map((config: { key: string; value: string }) =>
        prisma.adminConfig.upsert({
          where: { key: config.key },
          update: { value: config.value },
          create: { key: config.key, value: config.value },
        })
      )
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to update configs:', error);
    return NextResponse.json(
      { error: 'Failed to update configurations' },
      { status: 500 }
    );
  }
}
