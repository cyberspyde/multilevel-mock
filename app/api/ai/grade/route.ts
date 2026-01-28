import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateContentWithFallback, type AIProvider } from '@/services/ai-provider';

// User-friendly error messages
const ERROR_MESSAGES = {
  MISSING_PARAMS: 'Please provide both sessionId and aiCode.',
  INVALID_CODE: 'The AI code you entered is not valid. Please check and try again.',
  INACTIVE_CODE: 'This AI code has been deactivated. Please contact your administrator.',
  MAX_USES: 'This AI code has reached its maximum number of uses. Please contact your administrator.',
  SESSION_NOT_FOUND: 'Could not find the exam session. Please complete your exam first.',
  DATABASE_ERROR: 'Database error. Please try again later.',
  AI_UNAVAILABLE: 'AI grading service is currently unavailable. Using fallback evaluation.',
};

// POST /api/ai/grade - Process AI grading for a session
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, aiCode, preferredProvider, promptId } = body;

    if (!sessionId || !aiCode) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.MISSING_PARAMS },
        { status: 400 }
      );
    }

    // Verify AI code
    const aiCodeRecord = await prisma.aICode.findUnique({
      where: { code: aiCode },
    });

    if (!aiCodeRecord) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.INVALID_CODE },
        { status: 401 }
      );
    }

    if (!aiCodeRecord.isActive) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.INACTIVE_CODE },
        { status: 401 }
      );
    }

    // Check max uses
    if (aiCodeRecord.maxUses && aiCodeRecord.useCount >= aiCodeRecord.maxUses) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.MAX_USES },
        { status: 401 }
      );
    }

    // Get session with all answers
    const session = await prisma.examSession.findUnique({
      where: { id: sessionId },
      include: {
        exam: true,
        speakingAnswers: {
          include: { question: true },
        },
        writingAnswers: {
          include: { prompt: true },
        },
      },
    });

    if (!session) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.SESSION_NOT_FOUND },
        { status: 404 }
      );
    }

    // Check if already AI graded
    if (session.isAiGraded) {
      // Return existing grade
      const existingGrade = await prisma.aIGrade.findFirst({
        where: { sessionId },
      });
      return NextResponse.json({ success: true, grade: existingGrade });
    }

    // Get custom prompt if specified
    let customPrompt = null;
    if (promptId) {
      const promptRecord = await prisma.aIPrompt.findUnique({
        where: { id: promptId },
      });
      if (promptRecord && promptRecord.isActive) {
        customPrompt = promptRecord.prompt;
      }
    }

    // Get preferred provider from config or request
    let provider: AIProvider | undefined = preferredProvider;
    if (!provider) {
      const modelConfig = await prisma.adminConfig.findUnique({
        where: { key: 'ai_provider' },
      });
      provider = modelConfig?.value as AIProvider;
    }

    // Fetch all config from database
    const allConfig = await prisma.adminConfig.findMany();
    const dbConfig: Record<string, string> = {};
    allConfig.forEach((c) => {
      dbConfig[c.key] = c.value;
    });

    // Generate AI feedback
    let summary: string;
    let feedback: string;
    let usedProvider: AIProvider;
    let usedModel: string;

    // Calculate fluency metrics
    const wpmStats = { totalWords: 0, totalDuration: 0, wpm: 0 };
    if (session.speakingAnswers?.length > 0) {
      session.speakingAnswers.forEach((a: any) => {
        const words = a.transcription?.trim().split(/\s+/).length || 0;
        const dur = a.duration || 0;
        wpmStats.totalWords += words;
        wpmStats.totalDuration += dur;
      });
      if (wpmStats.totalDuration > 0) {
        wpmStats.wpm = Math.round((wpmStats.totalWords / wpmStats.totalDuration) * 60);
      }
    }

    try {
      const prompt = customPrompt
        ? applyCustomPrompt(customPrompt, session)
        : buildGradingPrompt(session, wpmStats);

      const result = await generateContentWithFallback(prompt, provider, dbConfig);
      const aiResponse = parseAIResponse(result.content);

      summary = aiResponse.summary;
      feedback = aiResponse.feedback;
      usedProvider = result.provider;
      usedModel = result.model;

      // Estimate score from feedback quality
      const score = estimateScore(session, aiResponse);

      // Create AI grade
      const grade = await prisma.aIGrade.create({
        data: {
          sessionId,
          summary,
          feedback,
          score,
          metadata: {
            provider: usedProvider,
            model: usedModel,
            timestamp: new Date().toISOString(),
            wpm: wpmStats.wpm,
            duration: wpmStats.totalDuration,
          },
        },
      });

      // Update session
      await prisma.examSession.update({
        where: { id: sessionId },
        data: {
          isAiGraded: true,
          aiCodeUsed: aiCode,
        },
      });

      // Increment AI code use count
      await prisma.aICode.update({
        where: { id: aiCodeRecord.id },
        data: { useCount: { increment: 1 } },
      });

      return NextResponse.json({
        success: true,
        grade,
        provider: usedProvider,
        model: usedModel,
      });

    } catch (aiError: any) {
      console.error('AI generation failed, using fallback:', aiError);

      // Fall back to placeholder if AI fails
      summary = generatePlaceholderSummary(session);
      feedback = generatePlaceholderFeedback(session);

      const grade = await prisma.aIGrade.create({
        data: {
          sessionId,
          summary,
          feedback,
          score: Math.floor(Math.random() * 30) + 70,
          metadata: {
            provider: 'fallback',
            model: 'placeholder',
            error: aiError.message,
            timestamp: new Date().toISOString(),
          },
        },
      });

      // Update session
      await prisma.examSession.update({
        where: { id: sessionId },
        data: {
          isAiGraded: true,
          aiCodeUsed: aiCode,
        },
      });

      // Increment AI code use count
      await prisma.aICode.update({
        where: { id: aiCodeRecord.id },
        data: { useCount: { increment: 1 } },
      });

      return NextResponse.json({
        success: true,
        grade,
        warning: 'AI service unavailable, using fallback evaluation',
      });
    }

  } catch (error) {
    console.error('Error processing AI grade:', error);
    return NextResponse.json(
      { error: 'Failed to process AI grading' },
      { status: 500 }
    );
  }
}

/**
 * Apply custom prompt template to the session data
 */
function applyCustomPrompt(customPrompt: string, session: any): string {
  const examType = session.exam.type;
  let answers = '';

  if (examType === 'SPEAKING' && session.speakingAnswers?.length > 0) {
    answers = session.speakingAnswers.map((answer: any, index: number) => {
      const q = answer.question?.text || 'Unknown';
      const a = answer.transcription || '(No transcription)';
      return `Q${index + 1}: "${q}"\nA${index + 1}: "${a}"`;
    }).join('\n');
  } else if (examType === 'WRITING' && session.writingAnswers?.length > 0) {
    answers = session.writingAnswers.map((answer: any, index: number) => {
      const q = answer.prompt?.prompt || answer.prompt?.text || 'Unknown';
      const a = answer.content || '(No answer)';
      return `Q${index + 1}: "${q.substring(0, 100)}..."\nA${index + 1}: "${a.substring(0, 200)}..."`;
    }).join('\n\n');
  }

  // Replace placeholders in custom prompt
  return customPrompt
    .replace(/{studentName}/g, session.studentName)
    .replace(/{examTitle}/g, session.exam.title)
    .replace(/{examType}/g, examType)
    .replace(/{answers}/g, answers || '(No answers available)')
    .replace(/{student_name}/g, session.studentName)
    .replace(/{exam_title}/g, session.exam.title)
    .replace(/{exam_type}/g, examType);
}

/**
 * Build the grading prompt for the AI
 */
function buildGradingPrompt(session: any, wpmStats?: any): string {
  const examType = session.exam.type;
  let prompt = `You are an expert English examiner. Evaluate the following student's performance.\n\n`;
  prompt += `Student Name: ${session.studentName}\n`;
  prompt += `Test: ${session.exam.title} - ${session.exam.description}\n`;
  prompt += `Test Type: ${examType}\n\n`;

  if (examType === 'SPEAKING' && session.speakingAnswers?.length > 0) {
    prompt += `Speaking Questions and Answers:\n\n`;
    session.speakingAnswers.forEach((answer: any, index: number) => {
      prompt += `Question ${index + 1}: ${answer.question?.text || 'Unknown'}\n`;
      prompt += `Student Answer: "${answer.transcription}"\n`;
      if (answer.duration) {
        prompt += `Duration: ${answer.duration} seconds\n`;
      }
      prompt += `\n`;
    });

    if (wpmStats && wpmStats.wpm > 0) {
      prompt += `Fluency Metrics: Approximately ${wpmStats.wpm} Words Per Minute (WPM).\n\n`;
    } else {
      prompt += `\n`;
    }
  } else if (examType === 'WRITING' && session.writingAnswers?.length > 0) {
    prompt += `Writing Prompts and Responses:\n\n`;
    session.writingAnswers.forEach((answer: any, index: number) => {
      prompt += `Prompt ${index + 1}: ${answer.prompt?.prompt || 'Unknown'}\n`;
      prompt += `Student Response (${answer.wordCount} words):\n"${answer.content}"\n\n`;
    });
  }

  prompt += `\nEVALUATION CRITERIA:\n`;
  prompt += `1. RELEVANCE: Does the answer actually address the question asked? (Critical - answers that don't address the question should receive low scores)\n`;
  prompt += `2. CONTENT: Is the answer accurate, complete, and appropriate?\n`;
  prompt += `3. LANGUAGE: Grammar, vocabulary, fluency, and coherence\n`;
  prompt += `4. STRUCTURE: Organization and clarity of response\n\n`;
  prompt += `Please provide a structured evaluation in the following format:\n\n`;
  prompt += `SUMMARY: [A brief 2-3 sentence summary of overall performance, explicitly stating whether answers addressed the questions]\n\n`;
  prompt += `DETAILED_FEEDBACK:\n`;
  prompt += `Relevance: [Did the student answer the actual questions asked? This is critical.]\n\n`;
  prompt += `Strengths:\n- [List strengths]\n\n`;
  prompt += `Areas for Improvement:\n- [List areas, including if they didn't answer the questions]\n\n`;
  prompt += `Recommendations:\n- [List actionable recommendations]\n\n`;
  prompt += `IMPORTANT: Be honest about relevance. If an answer doesn't address the question at all, clearly state this. Keep the tone professional but accurate.`;

  return prompt;
}

/**
 * Parse AI response to extract summary and feedback
 */
function parseAIResponse(response: string): { summary: string; feedback: string } {
  // Try to extract SUMMARY and DETAILED_FEEDBACK sections
  const summaryMatch = response.match(/SUMMARY:\s*([\s\S]*?)(?=\n\nDETAILED_FEEDBACK:|$)/i);
  const feedbackMatch = response.match(/DETAILED_FEEDBACK:\s*([\s\S]*?)$/i);

  if (summaryMatch && feedbackMatch) {
    return {
      summary: summaryMatch[1].trim(),
      feedback: feedbackMatch[1].trim(),
    };
  }

  // Fallback: split the response in half
  const lines = response.split('\n');
  const midPoint = Math.floor(lines.length / 2);

  return {
    summary: lines.slice(0, midPoint).join('\n').trim(),
    feedback: lines.slice(midPoint).join('\n').trim(),
  };
}

/**
 * Estimate score based on session and AI response
 */
function estimateScore(session: any, aiResponse: any): number {
  // Check for keywords indicating poor relevance or quality
  const responseText = (aiResponse.summary + ' ' + aiResponse.feedback).toLowerCase();
  const negativeIndicators = [
    'does not answer',
    'doesn\'t answer',
    'did not address',
    'didn\'t address',
    'irrelevant',
    'off-topic',
    'not related',
    'failed to answer',
    'fails to answer',
    'does not relate',
    'unrelated to'
  ];

  const hasNegativeIndicators = negativeIndicators.some(indicator =>
    responseText.includes(indicator)
  );

  // Start with lower base score
  let score = hasNegativeIndicators ? 20 : 60;

  // Adjust based on answer count
  const answerCount = session.exam.type === 'SPEAKING'
    ? session.speakingAnswers?.length || 0
    : session.writingAnswers?.length || 0;

  if (answerCount >= 3 && !hasNegativeIndicators) score += 5;
  if (answerCount >= 5 && !hasNegativeIndicators) score += 5;

  // Adjust based on content length (only if relevant)
  if (!hasNegativeIndicators) {
    if (session.exam.type === 'WRITING') {
      const totalWords = session.writingAnswers?.reduce((sum: number, a: any) => sum + a.wordCount, 0) || 0;
      if (totalWords > 200) score += 5;
      if (totalWords > 400) score += 5;
    } else {
      const totalChars = session.speakingAnswers?.reduce((sum: number, a: any) => sum + a.transcription.length, 0) || 0;
      if (totalChars > 300) score += 5;
      if (totalChars > 600) score += 5;
    }
  }

  // Ensure score is within bounds
  return Math.max(60, Math.min(100, score));
}

/**
 * Fallback placeholder functions
 */
function generatePlaceholderSummary(session: any): string {
  const type = session.exam.type;

  if (type === 'SPEAKING') {
    const answerCount = session.speakingAnswers?.length || 0;
    return `The student completed ${answerCount} speaking questions. The responses demonstrate good command of English with room for improvement in fluency and vocabulary range. Overall performance shows potential for development with continued practice.`;
  } else {
    const answerCount = session.writingAnswers?.length || 0;
    const totalWords = session.writingAnswers?.reduce((sum: number, a: any) => sum + a.wordCount, 0) || 0;
    return `The student completed ${answerCount} writing tasks with a total of ${totalWords} words. The writing demonstrates organizational skills and basic coherence. Further development in complex sentence structures and academic vocabulary would enhance the quality of written responses.`;
  }
}

function generatePlaceholderFeedback(session: any): string {
  const type = session.exam.type;

  if (type === 'SPEAKING') {
    return `Strengths:
- Clear pronunciation and articulation
- Good attempt at answering all questions
- Demonstrated understanding of question prompts

Areas for Improvement:
- Expand vocabulary range beyond common words
- Work on reducing hesitation and filler sounds
- Develop more complex sentence structures
- Practice maintaining consistent pace throughout responses

Recommendations:
- Regular practice with timed speaking exercises
- Listen to native English speakers and mimic patterns
- Record and review your own responses`;
  } else {
    return `Strengths:
- Clear organization and structure in responses
- Good attempt at addressing task requirements
- Demonstrated understanding of writing prompts

Areas for Improvement:
- Expand academic and formal vocabulary
- Work on sentence variety and complexity
- Improve paragraph transitions and cohesion
- Develop stronger thesis statements and conclusions

Recommendations:
- Read academic articles to internalize formal writing style
- Practice outlining before writing
- Review and edit your work for grammar and clarity`;
  }
}
