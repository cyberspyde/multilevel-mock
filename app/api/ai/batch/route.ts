import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// POST /api/ai/batch - Grade multiple sessions
export async function POST(request: NextRequest) {
    try {
        const { sessionIds } = await request.json();

        if (!sessionIds || !Array.isArray(sessionIds) || sessionIds.length === 0) {
            return NextResponse.json(
                { error: 'No session IDs provided' },
                { status: 400 }
            );
        }

        // Limit batch size to prevent timeout
        const maxBatchSize = 20;
        if (sessionIds.length > maxBatchSize) {
            return NextResponse.json(
                { error: `Maximum batch size is ${maxBatchSize} sessions` },
                { status: 400 }
            );
        }

        const results: {
            sessionId: string;
            success: boolean;
            error?: string;
            studentName?: string;
        }[] = [];

        // Process sessions sequentially with delay to avoid rate limiting
        for (let i = 0; i < sessionIds.length; i++) {
            const sessionId = sessionIds[i];

            try {
                // Get session info for status updates
                const session = await prisma.examSession.findUnique({
                    where: { id: sessionId },
                    select: { studentName: true, isAiGraded: true }
                });

                if (!session) {
                    results.push({
                        sessionId,
                        success: false,
                        error: 'Session not found'
                    });
                    continue;
                }

                if (session.isAiGraded) {
                    results.push({
                        sessionId,
                        success: true,
                        studentName: session.studentName,
                        error: 'Already graded (skipped)'
                    });
                    continue;
                }

                // Call the single grading endpoint
                const gradeRes = await fetch(new URL('/api/ai/grade', request.url).toString(), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ sessionId }),
                });

                if (!gradeRes.ok) {
                    const errorData = await gradeRes.json();
                    results.push({
                        sessionId,
                        success: false,
                        studentName: session.studentName,
                        error: errorData.error || 'Grading failed'
                    });
                } else {
                    results.push({
                        sessionId,
                        success: true,
                        studentName: session.studentName
                    });
                }

                // Add delay between requests to avoid rate limiting (except for last one)
                if (i < sessionIds.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }

            } catch (err: any) {
                results.push({
                    sessionId,
                    success: false,
                    error: err.message || 'Unknown error'
                });
            }
        }

        const successful = results.filter(r => r.success && !r.error?.includes('skipped')).length;
        const skipped = results.filter(r => r.error?.includes('skipped')).length;
        const failed = results.filter(r => !r.success).length;

        return NextResponse.json({
            success: true,
            summary: {
                total: sessionIds.length,
                successful,
                skipped,
                failed
            },
            results
        });

    } catch (error: any) {
        console.error('[Batch Grade] Error:', error);
        return NextResponse.json(
            { error: error.message || 'Batch grading failed' },
            { status: 500 }
        );
    }
}
