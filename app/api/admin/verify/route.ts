import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// POST /api/admin/verify - Verify admin code
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code } = body;

    if (!code) {
      return NextResponse.json(
        { error: 'Admin code is required' },
        { status: 400 }
      );
    }

    const adminCode = await prisma.adminCode.findUnique({
      where: { code },
    });

    if (!adminCode || !adminCode.isActive) {
      return NextResponse.json(
        { error: 'Invalid admin code' },
        { status: 401 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error verifying admin code:', error);
    return NextResponse.json(
      { error: 'Failed to verify admin code' },
      { status: 500 }
    );
  }
}
