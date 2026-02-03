import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { 
  generateContentWithFallback, 
  gradeInChunks, 
  estimateTokens,
  type AIProvider,
  type ChunkedGradingConfig
} from '@/services/ai-provider';
import type { ExamSession, SpeakingAnswer, WritingAnswer } from '@prisma/client';

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

type SessionWithAnswers = ExamSession & {
  exam: { type: string; title: string; description: string };
  speakingAnswers?: Array<Pick<SpeakingAnswer, 'transcription' | 'duration'> & { question?: { text?: string } }>;
  writingAnswers?: Array<Pick<WritingAnswer, 'wordCount' | 'content'> & { 
    prompt?: { 
      prompt?: string; 
      title?: string; 
      taskNumber?: string | null;
      part?: { id: string; order: number; title: string; description?: string | null } | null;
    } 
  }>;
};

type WpmStats = { totalWords: number; totalDuration: number; wpm: number };
type ParsedAIResponse = { summary: string; feedback: string };

// POST /api/ai/grade - Process AI grading for a session
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, aiCode, promptId } = body;

    if (!sessionId || !aiCode) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.MISSING_PARAMS },
        { status: 400 }
      );
    }

    // Verify AI code and get session in parallel
    const [aiCodeRecord, session] = await Promise.all([
      prisma.aICode.findUnique({ where: { code: aiCode } }),
      prisma.examSession.findUnique({
        where: { id: sessionId },
        include: {
          exam: true,
          speakingAnswers: { include: { question: true } },
          writingAnswers: { include: { prompt: { include: { part: true } } } },
        },
      }),
    ]);

    if (!aiCodeRecord) {
      return NextResponse.json({ error: ERROR_MESSAGES.INVALID_CODE }, { status: 401 });
    }
    if (!aiCodeRecord.isActive) {
      return NextResponse.json({ error: ERROR_MESSAGES.INACTIVE_CODE }, { status: 401 });
    }
    if (aiCodeRecord.maxUses && aiCodeRecord.useCount >= aiCodeRecord.maxUses) {
      return NextResponse.json({ error: ERROR_MESSAGES.MAX_USES }, { status: 401 });
    }
    if (!session) {
      return NextResponse.json({ error: ERROR_MESSAGES.SESSION_NOT_FOUND }, { status: 404 });
    }

    // Check if already AI graded
    if (session.isAiGraded) {
      const existingGrade = await prisma.aIGrade.findFirst({ where: { sessionId } });
      return NextResponse.json({ success: true, grade: existingGrade });
    }

    // Get custom prompt and provider config in parallel
    const [promptRecord, modelConfig, allConfig] = await Promise.all([
      promptId ? prisma.aIPrompt.findUnique({ where: { id: promptId } }) : null,
      prisma.adminConfig.findUnique({ where: { key: 'ai_provider' } }),
      prisma.adminConfig.findMany(),
    ]);

    const customPrompt = promptRecord?.isActive ? promptRecord.prompt : null;
    // Always use local AI for student grading
    const provider: AIProvider = 'local';

    const dbConfig: Record<string, string> = {};
    allConfig.forEach((c) => { dbConfig[c.key] = c.value; });

    // Calculate WPM stats
    const wpmStats = calculateWpmStats(session);

    // Get context limit from config (default to 8192 for local models)
    const maxContextTokens = parseInt(dbConfig['ai_max_context_tokens'] || '8192', 10);
    const reservedTokens = parseInt(dbConfig['ai_reserved_tokens'] || '2000', 10);

    // Generate AI feedback
    const prompt = customPrompt
      ? applyCustomPrompt(customPrompt, session)
      : buildGradingPrompt(session, wpmStats);

    let summary: string;
    let feedback: string;
    let usedProvider: AIProvider | 'fallback';
    let usedModel: string;
    let score: number;
    let errorMessage: string | undefined;
    let chunksUsed = 0;

    // Check if we need chunked grading based on prompt size
    const promptTokens = estimateTokens(prompt);
    const needsChunking = promptTokens > (maxContextTokens - reservedTokens);

    try {
      if (needsChunking && !customPrompt) {
        const answers = prepareAnswersForChunking(session);
        const examType = session.exam.type as 'SPEAKING' | 'WRITING';

        const chunkedConfig: ChunkedGradingConfig = {
          maxContextTokens,
          reservedTokens,
          provider,
          dbConfig,
        };

        const chunkedResult = await gradeInChunks(
          session.studentName,
          session.exam.title,
          examType,
          answers,
          chunkedConfig
        );

        summary = chunkedResult.summary;
        feedback = chunkedResult.feedback;
        usedProvider = chunkedResult.provider;
        usedModel = chunkedResult.model;
        chunksUsed = chunkedResult.chunksUsed;
        score = estimateScore(session, { summary, feedback });
      } else {
        const result = await generateContentWithFallback(prompt, provider, dbConfig);
        const aiResponse = parseAIResponse(result.content);

        // Validate AI response
        if (!aiResponse.summary || !aiResponse.feedback) {
          throw new Error('Invalid AI response format');
        }

        summary = aiResponse.summary;
        feedback = aiResponse.feedback;
        usedProvider = result.provider;
        usedModel = result.model;
        score = estimateScore(session, aiResponse);
      }

    } catch (aiError: unknown) {
      errorMessage = aiError instanceof Error ? aiError.message : 'Unknown error';
      summary = generatePlaceholderSummary(session);
      feedback = generatePlaceholderFeedback(session);
      const fallbackResponse = { summary, feedback };
      score = estimateScore(session, fallbackResponse);
      usedProvider = 'fallback';
      usedModel = 'placeholder';
    }

    // Run all DB operations in parallel
    const [grade] = await Promise.all([
      prisma.aIGrade.create({
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
            ...(chunksUsed > 0 && { chunksUsed }),
            ...(errorMessage && { error: errorMessage }),
          },
        },
      }),
      prisma.examSession.update({
        where: { id: sessionId },
        data: { isAiGraded: true, aiCodeUsed: aiCode },
      }),
      prisma.aICode.update({
        where: { id: aiCodeRecord.id },
        data: { useCount: { increment: 1 } },
      }),
    ]);

    return NextResponse.json({
      success: true,
      grade,
      provider: usedProvider,
      model: usedModel,
      ...(chunksUsed > 0 && { chunksUsed, message: `Grading completed in ${chunksUsed} parts due to content size` }),
      ...(errorMessage && { warning: 'AI service unavailable, using fallback evaluation' }),
    });

  } catch {
    return NextResponse.json({ error: 'Failed to process AI grading' }, { status: 500 });
  }
}

/**
 * Prepare answers for chunked grading
 */
function prepareAnswersForChunking(session: SessionWithAnswers): Array<{
  question: string;
  answer: string;
  wordCount?: number;
  duration?: number;
}> {
  const examType = session.exam.type;
  const answers: Array<{ question: string; answer: string; wordCount?: number; duration?: number }> = [];

  if (examType === 'SPEAKING' && session.speakingAnswers) {
    for (const sa of session.speakingAnswers) {
      answers.push({
        question: (sa as any).question?.text || 'Unknown question',
        answer: sa.transcription || '(No transcription)',
        duration: sa.duration || undefined,
        wordCount: sa.transcription?.split(/\s+/).length || 0,
      });
    }
  } else if (examType === 'WRITING' && session.writingAnswers) {
    for (const wa of session.writingAnswers) {
      const taskNumber = wa.prompt?.taskNumber ? `Task ${wa.prompt.taskNumber}` : 'Task';
      const partLabel = wa.prompt?.part ? `Part ${wa.prompt.part.order}` : '';
      const label = [partLabel, taskNumber].filter(Boolean).join(' - ');
      const questionText = wa.prompt?.prompt || 'Unknown prompt';
      answers.push({
        question: `${label}: ${questionText}`,
        answer: wa.content || '(No answer)',
        wordCount: wa.wordCount || 0,
      });
    }
  }

  return answers;
}

function calculateWpmStats(session: SessionWithAnswers): WpmStats {
  const stats = { totalWords: 0, totalDuration: 0, wpm: 0 };
  const answers = session.speakingAnswers;
  if (answers && answers.length > 0) {
    for (const a of answers) {
      const words = a.transcription?.trim().split(/\s+/).length || 0;
      stats.totalWords += words;
      stats.totalDuration += a.duration || 0;
    }
    if (stats.totalDuration > 0) {
      stats.wpm = Math.round((stats.totalWords / stats.totalDuration) * 60);
    }
  }
  return stats;
}

/**
 * Apply custom prompt template to the session data
 */
function applyCustomPrompt(customPrompt: string, session: SessionWithAnswers): string {
  const examType = session.exam.type;
  let answers = '';

  const speakingAnswers = session.speakingAnswers;
  const writingAnswers = session.writingAnswers;

  if (examType === 'SPEAKING' && speakingAnswers && speakingAnswers.length > 0) {
    answers = speakingAnswers.map((answer: { question?: { text?: string } }, index: number) => {
      const q = answer.question?.text || 'Unknown';
      const a = (answer as { transcription?: string }).transcription || '(No transcription)';
      return `Q${index + 1}: "${q}"\nA${index + 1}: "${a}"`;
    }).join('\n');
  } else if (examType === 'WRITING' && writingAnswers && writingAnswers.length > 0) {
    answers = writingAnswers.map((answer: { prompt?: { prompt?: string; taskNumber?: string | null; part?: { order: number } | null } }, index: number) => {
      const q = answer.prompt?.prompt || 'Unknown';
      const a = (answer as { content?: string }).content || '(No answer)';
      const taskLabel = answer.prompt?.taskNumber ? `Task ${answer.prompt.taskNumber}` : `Task ${index + 1}`;
      const partLabel = answer.prompt?.part ? `Part ${answer.prompt.part.order}` : '';
      const label = [partLabel, taskLabel].filter(Boolean).join(' - ');
      return `${label}: "${q.substring(0, 100)}..."\nResponse: "${a.substring(0, 200)}..."`;
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
function buildGradingPrompt(session: SessionWithAnswers, wpmStats?: WpmStats): string {
  const examType = session.exam.type;
  const isWriting = examType === 'WRITING';
  const isSpeaking = examType === 'SPEAKING';

  let prompt = `You are an expert English language examiner with extensive experience in evaluating ${examType.toLowerCase()} assessments. Your role is to provide fair, accurate, and constructive feedback that helps students improve.

STUDENT INFORMATION:
Name: ${session.studentName}
Assessment: ${session.exam.title}
Description: ${session.exam.description}
Type: ${examType}

`;

  // ===== CONTENT SECTION =====
  const speakingAnswers = session.speakingAnswers;
  const writingAnswers = session.writingAnswers;

  if (isSpeaking && speakingAnswers && speakingAnswers.length > 0) {
    prompt += `SPEAKING RESPONSES:\n\n`;

    speakingAnswers.forEach((answer, index) => {
      prompt += `Question ${index + 1}: ${(answer as { question?: { text?: string } }).question?.text || 'Unknown'}\n`;
      prompt += `Response: "${(answer as { transcription?: string }).transcription}"\n`;
      if ((answer as { duration?: number }).duration) {
        prompt += `Duration: ${(answer as { duration?: number }).duration} seconds\n`;
      }
      const wordCount = (answer as { transcription?: string }).transcription?.split(/\s+/).length || 0;
      prompt += `Word Count: ~${wordCount} words\n\n`;
    });

    if (wpmStats && wpmStats.wpm > 0) {
      prompt += `FLUENCY METRICS:\n`;
      prompt += `Speaking Rate: ${wpmStats.wpm} words per minute (WPM)\n`;
      prompt += `Reference: 120-150 WPM is typical for conversational English; 150-180 WPM indicates strong fluency\n\n`;
    }
  } else if (isWriting && writingAnswers && writingAnswers.length > 0) {
    prompt += `WRITING RESPONSES:\n\n`;

    writingAnswers.forEach((answer, index) => {
      const promptInfo = (answer as { prompt?: { prompt?: string; taskNumber?: string | null; part?: { order: number; title?: string } | null } }).prompt;
      const taskLabel = promptInfo?.taskNumber ? `Task ${promptInfo.taskNumber}` : `Task ${index + 1}`;
      const partLabel = promptInfo?.part ? `Part ${promptInfo.part.order}` : '';
      const label = [partLabel, taskLabel].filter(Boolean).join(' - ');
      prompt += `${label}: ${promptInfo?.prompt || 'Unknown'}\n`;
      prompt += `Word Count: ${(answer as { wordCount: number }).wordCount} words\n`;
      prompt += `Response:\n"${(answer as { content: string }).content}"\n\n`;
    });
  }

  // ===== EVALUATION FRAMEWORK =====
  prompt += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EVALUATION FRAMEWORK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

`;

  // Assessment criteria based on type
  if (isWriting) {
    const totalWords = session.writingAnswers?.reduce((sum: number, a: any) => sum + a.wordCount, 0) || 0;
    const taskCount = session.writingAnswers?.length || 1;
    const avgWords = Math.round(totalWords / taskCount);

    prompt += `CRITICAL LENGTH ASSESSMENT:
Total Words Written: ${totalWords}
Average per Task: ${avgWords} words
Expected Range: 150-250+ words per task (minimum 100 words)

`;

    if (totalWords < 50) {
      prompt += `⚠️ SEVERE INSUFFICIENCY: Response is critically short (under 50 words total). This indicates:
- Incomplete attempt or minimal engagement
- Inability to develop ideas
- Lack of substantive content
Such responses should receive failing marks unless there are exceptional circumstances.

`;
    } else if (totalWords < 100) {
      prompt += `⚠️ SIGNIFICANT INSUFFICIENCY: Response is very short (under 100 words total). This suggests:
- Underdeveloped ideas and arguments
- Insufficient detail or examples
- Failure to meet basic task requirements
This should result in substantially reduced scores.

`;
    } else if (totalWords < 150) {
      prompt += `⚠️ BELOW EXPECTATIONS: Response is shorter than expected (under 150 words total).
Consider whether ideas are adequately developed despite the brevity.

`;
    }

    prompt += `EVALUATION CRITERIA (in order of importance):

1. TASK ACHIEVEMENT & RELEVANCE (35%)
   - Does the response directly address all parts of the prompt?
   - Is the main question/topic answered clearly?
   - Are ideas relevant and on-topic throughout?
   - Is there sufficient content depth (not just surface-level)?
   ❌ RED FLAGS: Off-topic content, ignoring parts of the prompt, superficial treatment

2. CONTENT QUALITY & DEVELOPMENT (25%)
   - Are ideas well-developed with explanations and examples?
   - Is there meaningful substance beyond generic statements?
   - Does the response demonstrate critical thinking?
   - Are arguments or descriptions supported with details?
   ❌ RED FLAGS: Repetitive phrases, generic filler, lack of specific details

3. COHERENCE & ORGANIZATION (20%)
   - Is there a clear logical structure?
   - Are ideas connected smoothly with appropriate transitions?
   - Is the response easy to follow?
   - Are paragraphs/sections well-organized?
   ❌ RED FLAGS: Disjointed ideas, no clear flow, abrupt topic changes

4. LANGUAGE USE & VOCABULARY (15%)
   - Is vocabulary appropriate and varied?
   - Are word choices accurate and natural?
   - Is there evidence of range beyond basic words?
   - Are collocations and expressions used correctly?
   ❌ RED FLAGS: Very limited vocabulary, repeated words, unnatural phrasing

5. GRAMMAR & ACCURACY (5%)
   - Are sentences grammatically correct?
   - Is there variety in sentence structures?
   - Are errors minor or do they impede understanding?
   Note: Grammar is weighted lower as content and communication are prioritized

`;
  } else if (isSpeaking) {
    prompt += `EVALUATION CRITERIA (in order of importance):

1. TASK ACHIEVEMENT & RELEVANCE (30%)
   - Does the speaker directly answer the question asked?
   - Is the response focused and on-topic?
   - Is there sufficient content (not just 1-2 sentences)?
   - Does the speaker address all parts of multi-part questions?
   ❌ RED FLAGS: Answering a different question, completely off-topic, minimal response

2. FLUENCY & COHERENCE (25%)
   - Does speech flow naturally without excessive hesitation?
   - Are ideas connected logically?
   - Can the speaker maintain extended speech?
   - Are there appropriate linking words and phrases?
   ❌ RED FLAGS: Long pauses, inability to continue, disjointed thoughts, excessive repetition

3. PRONUNCIATION & INTELLIGIBILITY (20%)
   - Can the speech be easily understood?
   - Are individual sounds pronounced clearly enough?
   - Is stress and intonation reasonably natural?
   Note: Accent is NOT evaluated; only clarity matters
   ❌ RED FLAGS: Unclear speech, mispronunciations that obscure meaning

4. VOCABULARY & EXPRESSION (15%)
   - Is vocabulary sufficient for the topic?
   - Are words used accurately?
   - Does the speaker attempt varied expressions?
   ❌ RED FLAGS: Very limited vocabulary, frequent inability to express ideas, repetitive words

5. GRAMMATICAL RANGE & ACCURACY (10%)
   - Are basic structures used correctly?
   - Is there some variety in sentence types?
   - Do errors significantly impair communication?
   Note: Perfect grammar is not required; focus is on communication

`;

    if (wpmStats && wpmStats.wpm > 0) {
      if (wpmStats.wpm < 80) {
        prompt += `⚠️ FLUENCY CONCERN: Speaking rate of ${wpmStats.wpm} WPM is notably slow.
This may indicate: hesitation, limited vocabulary, or difficulty formulating ideas.

`;
      } else if (wpmStats.wpm > 200) {
        prompt += `⚠️ FLUENCY CONCERN: Speaking rate of ${wpmStats.wpm} WPM is unusually fast.
Check if clarity and coherence are maintained at this pace.

`;
      }
    }
  }

  // ===== OUTPUT FORMAT =====
  prompt += `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REQUIRED OUTPUT FORMAT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

OVERALL_PERFORMANCE:
[2-3 sentences summarizing the student's performance. BE HONEST. If the response is insufficient, say so clearly. If it's strong, acknowledge that. Mention the most critical issues or strengths.]

CRITERION_SCORES:
`;

  if (isWriting) {
    prompt += `Task Achievement & Relevance: [Score/Assessment]
Content Quality & Development: [Score/Assessment]
Coherence & Organization: [Score/Assessment]
Language Use & Vocabulary: [Score/Assessment]
Grammar & Accuracy: [Score/Assessment]

`;
  } else {
    prompt += `Task Achievement & Relevance: [Score/Assessment]
Fluency & Coherence: [Score/Assessment]
Pronunciation & Intelligibility: [Score/Assessment]
Vocabulary & Expression: [Score/Assessment]
Grammatical Range & Accuracy: [Score/Assessment]

`;
  }

  prompt += `STRENGTHS:
- [List 2-4 specific strengths with examples from the response]
- [If there are genuinely no strengths, state: "Due to the insufficient nature of the response, there are no notable strengths to highlight."]

AREAS_FOR_IMPROVEMENT:
- [List 2-5 specific areas with clear explanations]
- [Be direct about major issues like insufficient length, off-topic content, or lack of substance]
- [Include examples from the response where helpful]

ACTIONABLE_RECOMMENDATIONS:
- [Provide 3-5 concrete, specific steps the student can take to improve]
- [Focus on the most impactful changes first]
- [Make recommendations realistic and achievable]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EVALUATION PRINCIPLES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✓ BE HONEST: Don't inflate scores for insufficient work
✓ BE SPECIFIC: Reference actual content from the response
✓ BE CONSTRUCTIVE: Frame criticism to help students improve
✓ BE FAIR: Consider that English may not be the student's first language
✓ BE CONSISTENT: Apply the same standards to all responses
✓ PRIORITIZE COMMUNICATION: Content and clarity matter more than perfect grammar

✗ DO NOT give positive feedback to responses that are:
  - Extremely short (under 50 words for writing)
  - Completely off-topic or irrelevant
  - Just repetitive filler phrases
  - Lacking any substantive content

✗ DO NOT ignore major issues like:
  - Failure to address the actual question/prompt
  - Insufficient length that prevents adequate development
  - Lack of coherent ideas or organization

REMEMBER: Your feedback should help students understand both what they did well and what they need to improve. Be encouraging where appropriate, but honest about weaknesses.`;

  return prompt;
}

/**
 * Parse AI response to extract summary and feedback
 */
function parseAIResponse(response: string): { summary: string; feedback: string } {
  // Try to extract OVERALL_PERFORMANCE and the rest (new format)
  const overallMatch = response.match(/OVERALL_PERFORMANCE:\s*([\s\S]*?)(?=\nCRITERION_SCORES:|STRENGTHS:|$)/i);
  const strengthsMatch = response.match(/STRENGTHS:\s*([\s\S]*?)(?=\nAREAS_FOR_IMPROVEMENT:|ACTIONABLE_RECOMMENDATIONS:|$)/i);
  const areasMatch = response.match(/AREAS_FOR_IMPROVEMENT:\s*([\s\S]*?)(?=\nACTIONABLE_RECOMMENDATIONS:|EVALUATION PRINCIPLES:|$)/i);
  const recommendationsMatch = response.match(/ACTIONABLE_RECOMMENDATIONS:\s*([\s\S]*?)(?=\nEVALUATION PRINCIPLES:|━━━━━━|$)/i);

  if (overallMatch && (strengthsMatch || areasMatch || recommendationsMatch)) {
    const summary = overallMatch[1].trim();

    let feedback = '';
    if (strengthsMatch) feedback += `Strengths:\n${strengthsMatch[1].trim()}\n\n`;
    if (areasMatch) feedback += `Areas for Improvement:\n${areasMatch[1].trim()}\n\n`;
    if (recommendationsMatch) feedback += `Recommendations:\n${recommendationsMatch[1].trim()}`;

    return { summary, feedback: feedback.trim() };
  }

  // Try old format (SUMMARY and DETAILED_FEEDBACK)
  const oldSummaryMatch = response.match(/SUMMARY:\s*([\s\S]*?)(?=\n\nDETAILED_FEEDBACK:|$)/i);
  const oldFeedbackMatch = response.match(/DETAILED_FEEDBACK:\s*([\s\S]*?)$/i);

  if (oldSummaryMatch && oldFeedbackMatch) {
    return {
      summary: oldSummaryMatch[1].trim(),
      feedback: oldFeedbackMatch[1].trim(),
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
function estimateScore(session: SessionWithAnswers, aiResponse: ParsedAIResponse): number {
  const responseText = (aiResponse.summary + ' ' + aiResponse.feedback).toLowerCase();

  // Negative indicators - expanded list
  const negativeIndicators = [
    'does not answer', 'doesn\'t answer', 'did not address', 'didn\'t address',
    'irrelevant', 'off-topic', 'not related', 'failed to answer', 'fails to answer',
    'does not relate', 'unrelated to', 'does not respond', 'minimal response',
    'insufficient content', 'lacks detail', 'too brief', 'inadequate',
    'barely addresses', 'superficial', 'lacks substance'
  ];

  // Positive indicators
  const positiveIndicators = [
    'excellent', 'strong', 'well-developed', 'comprehensive', 'thorough',
    'articulate', 'coherent', 'well-organized', 'detailed', 'insightful'
  ];

  const hasNegativeIndicators = negativeIndicators.some(indicator => responseText.includes(indicator));
  const hasPositiveIndicators = positiveIndicators.some(indicator => responseText.includes(indicator));

  // Base score calculation
  let score = 50; // Start at neutral

  if (hasNegativeIndicators) {
    score -= 20;
  }
  if (hasPositiveIndicators) {
    score += 15;
  }

  // SEVERE penalty for extremely short responses (writing)
  if (session.exam.type === 'WRITING') {
    const totalWords = session.writingAnswers?.reduce((sum: number, a: any) => sum + a.wordCount, 0) || 0;
    const answerCount = session.writingAnswers?.length || 0;

    // Extreme penalties for insufficient length
    if (totalWords < 30) {
      score -= 30; // Extremely short - almost no content
    } else if (totalWords < 50) {
      score -= 20; // Very short - insufficient
    } else if (totalWords < 100) {
      score -= 10; // Short - minimal effort
    } else if (totalWords < 150) {
      score -= 5; // Below expectations
    } else if (totalWords >= 250) {
      score += 10; // Good length
    } else if (totalWords >= 400) {
      score += 15; // Excellent length
    }

    // Penalty for not completing all tasks
    if (answerCount < 2) {
      score -= 15;
    }
  }

  // SEVERE penalty for extremely short responses (speaking)
  if (session.exam.type === 'SPEAKING') {
    const answers = session.speakingAnswers;
    const totalChars = answers ? answers.reduce((sum: number, a) => sum + ((a as { transcription?: string }).transcription?.length || 0), 0) : 0;
    const answerCount = answers?.length || 0;

    if (totalChars < 50) {
      score -= 30;
    } else if (totalChars < 100) {
      score -= 20;
    } else if (totalChars < 200) {
      score -= 10;
    } else if (totalChars >= 800) {
      score += 10;
    } else if (totalChars >= 1200) {
      score += 15;
    }

    if (answerCount < 2) {
      score -= 15;
    }
  }

  // Bonus for completing all required tasks
  const answerCount = session.exam.type === 'SPEAKING'
    ? session.speakingAnswers?.length || 0
    : session.writingAnswers?.length || 0;

  if (answerCount >= 3 && !hasNegativeIndicators) {
    score += 5;
  }

  // Ensure score is within bounds (removed the 60 floor)
  return Math.max(0, Math.min(100, score));
}

/**
 * Fallback placeholder functions
 */
function generatePlaceholderSummary(session: SessionWithAnswers): string {
  const type = session.exam.type;

  if (type === 'SPEAKING') {
    const answerCount = session.speakingAnswers?.length || 0;
    const totalChars = session.speakingAnswers?.reduce((sum: number, a: any) => sum + (a.transcription?.length || 0), 0) || 0;

    if (totalChars < 100) {
      return `The student provided ${answerCount} speaking response(s) with very limited content (approximately ${totalChars} characters total). The responses are extremely brief and insufficient to demonstrate English proficiency. Meaningful evaluation requires substantially more spoken content.`;
    }
    return `The student completed ${answerCount} speaking questions. The responses show basic command of English with room for improvement in fluency, vocabulary range, and content depth. Continued practice is recommended.`;
  } else {
    const answerCount = session.writingAnswers?.length || 0;
    const totalWords = session.writingAnswers?.reduce((sum: number, a: any) => sum + a.wordCount, 0) || 0;

    if (totalWords < 50) {
      return `The student completed ${answerCount} writing task(s) with only ${totalWords} words total. This is an extremely insufficient response that does not meet basic expectations. The responses lack substance, detail, and meaningful engagement with the prompts. A minimum of 150-250 words per task is expected.`;
    } else if (totalWords < 100) {
      return `The student completed ${answerCount} writing task(s) with ${totalWords} words total. This is well below the expected length (150-250 words per task). The responses are too brief to adequately address the prompts or demonstrate writing ability.`;
    }
    return `The student completed ${answerCount} writing task(s) with ${totalWords} total words. The writing demonstrates basic organizational skills. Further development in content depth, sentence variety, and academic vocabulary is needed.`;
  }
}

function generatePlaceholderFeedback(session: SessionWithAnswers): string {
  const type = session.exam.type;

  if (type === 'SPEAKING') {
    const totalChars = session.speakingAnswers?.reduce((sum: number, a: any) => sum + (a.transcription?.length || 0), 0) || 0;

    if (totalChars < 100) {
      return `Relevance: Cannot be fully assessed due to extremely brief responses.

Strengths:
- Attempted to respond to questions

Areas for Improvement:
- Responses are far too brief (under 100 characters total)
- Need to expand answers with specific details and examples
- Provide complete thoughts rather than short phrases
- Practice speaking for 1-2 minutes per question

Recommendations:
- Practice speaking at greater length on familiar topics
- Aim for 100+ words per response
- Use the PREP method: Point, Reason, Example, Point`;
    }
    return `Strengths:
- Attempted to answer questions
- Basic communication of ideas

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
    const totalWords = session.writingAnswers?.reduce((sum: number, a: any) => sum + a.wordCount, 0) || 0;

    if (totalWords < 50) {
      return `Relevance: The responses are too brief to properly address the prompts.

Strengths:
- Submitted the assignment

Areas for Improvement:
- Response length is EXTREMELY insufficient (${totalWords} words vs 150-250 expected)
- Lacks any meaningful detail or substance
- No development of ideas or examples
- Does not demonstrate writing ability

Recommendations:
- Write 150-250 words per task as required
- Include specific examples and details
- Develop a clear introduction, body, and conclusion
- Practice expanding on ideas with supporting evidence`;
    } else if (totalWords < 100) {
      return `Strengths:
- Submitted the assignment
- Basic understanding of prompts

Areas for Improvement:
- Response length is insufficient (${totalWords} words vs 150-250 expected)
- Need more detail and development of ideas
- Expand vocabulary and sentence variety
- Include specific examples to support points

Recommendations:
- Aim for 150-250 words per task
- Practice outlining essays before writing
- Read examples of well-developed responses`;
    }
    return `Strengths:
- Basic organization and structure
- Attempted to address task requirements

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
