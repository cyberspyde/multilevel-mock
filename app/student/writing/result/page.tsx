'use client';

import { useState, useEffect, Suspense, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { MarkdownRenderer, downloadGradeAsPdf } from '@/components/MarkdownRenderer';

function WritingResultContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('id');

  const [session, setSession] = useState<any>(null);
  const [aiCode, setAiCode] = useState('');
  const [submittingAi, setSubmittingAi] = useState(false);
  const [error, setError] = useState('');
  const [customPrompts, setCustomPrompts] = useState<any[]>([]);
  const [selectedPromptId, setSelectedPromptId] = useState<string>('');

  const fetchSession = useCallback(async () => {
    try {
      const res = await fetch(`/api/sessions?id=${sessionId}`);
      const data = await res.json();
      setSession(data);
    } catch (err) {
      console.error('Failed to fetch session:', err);
    }
  }, [sessionId]);

  const fetchCustomPrompts = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/prompts');
      const data = await res.json();
      setCustomPrompts(data);
    } catch (err) {
      console.error('Failed to fetch custom prompts:', err);
    }
  }, []);

  useEffect(() => {
    if (sessionId) {
      fetchSession();
      fetchCustomPrompts();
    }
  }, [sessionId, fetchSession, fetchCustomPrompts]);

  const handleAiSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingAi(true);
    setError('');

    try {
      const res = await fetch('/api/ai/grade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          aiCode,
          promptId: selectedPromptId || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'AI grading failed');
        setSubmittingAi(false);
        return;
      }

      await fetchSession();
      setSubmittingAi(false);
      setAiCode('');
    } catch (err) {
      console.error('AI grading error:', err);
      setError('Failed to process AI grading');
      setSubmittingAi(false);
    }
  };

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  const hasAiGrade = session.isAiGraded && session.aiGrades?.length > 0;
  const aiGrade = hasAiGrade ? session.aiGrades[0] : null;

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="font-bold text-xl text-gray-900">
            Bestcenter Multilevel Mock
          </Link>
          <Link
            href="/"
            className="text-gray-500 hover:text-gray-800 text-sm"
          >
            Back to Home
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="animate-fade-in space-y-6">
          {/* Completion Banner */}
          <div className="bg-green-50 border border-green-200 rounded-2xl p-6 flex items-center gap-4">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-green-900">Exam Completed!</h2>
              <p className="text-green-700">Your responses have been recorded successfully.</p>
            </div>
          </div>

          {/* Session Info */}
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-2xl font-bold text-gray-900">{session.exam.title}</h3>
                <p className="text-gray-500 mt-1">Student: {session.studentName}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500">Completed</p>
                <p className="text-lg font-semibold text-gray-900">
                  {new Date(session.completedAt).toLocaleString()}
                </p>
              </div>
            </div>

            {/* Writing Tasks */}
            <div className="space-y-6">
              {session.writingAnswers?.map((answer: any, index: number) => (
                <div key={answer.id} className="bg-gray-50 rounded-xl p-6 border border-gray-200">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      {answer.prompt?.part && (
                        <p className="text-xs text-purple-600 font-medium mb-1">
                          Part {answer.prompt.part.order}: {answer.prompt.part.title}
                        </p>
                      )}
                      <h4 className="font-bold text-gray-900">
                        {answer.prompt?.taskNumber ? `Task ${answer.prompt.taskNumber}` : `Task ${index + 1}`}: {answer.prompt?.title}
                      </h4>
                    </div>
                    <span className="text-sm text-gray-500">
                      {answer.wordCount} words
                    </span>
                  </div>

                  <div className="mt-4 p-4 bg-white rounded-lg border border-gray-200 max-h-64 overflow-y-auto">
                    <p className="text-sm text-gray-500 mb-2">Your Response:</p>
                    <p className="text-gray-900 whitespace-pre-wrap">{answer.content}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* AI Grading Section */}
          {!hasAiGrade && (
            <div className="bg-purple-50 border border-purple-200 rounded-2xl p-8">
              <h3 className="text-xl font-bold text-purple-900 mb-2">
                Get AI-Powered Feedback
              </h3>
              <p className="text-purple-700 mb-6">
                Enter your AI code to receive detailed grading and summary of your writing.
              </p>

              <form onSubmit={handleAiSubmit} className="space-y-4">
                {/* AI Code Input */}
                <div>
                  <label className="block text-sm font-medium text-purple-900 mb-1">
                    AI Code
                  </label>
                  <input
                    type="text"
                    value={aiCode}
                    onChange={(e) => setAiCode(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg border border-purple-300 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none bg-white"
                    placeholder="Enter your AI code (e.g., AI-GRADER-2024)"
                  />
                </div>

                {/* Custom Prompt Selection (Optional) */}
                {customPrompts.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-purple-900 mb-1">
                      Custom Prompt (Optional)
                    </label>
                    <select
                      value={selectedPromptId}
                      onChange={(e) => setSelectedPromptId(e.target.value)}
                      className="w-full px-4 py-3 rounded-lg border border-purple-300 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none bg-white"
                    >
                      <option value="">Default Grading Prompt</option>
                      {customPrompts.map((prompt) => (
                        <option key={prompt.id} value={prompt.id}>
                          {prompt.displayName}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-purple-600 mt-1">
                      Select a custom grading template or use the default prompt
                    </p>
                  </div>
                )}

                {error && (
                  <p className="text-red-600 text-sm">{error}</p>
                )}

                <button
                  type="submit"
                  disabled={submittingAi || !aiCode.trim()}
                  className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-lg transition-colors"
                >
                  {submittingAi ? 'Processing...' : 'Get AI Feedback'}
                </button>
              </form>
            </div>
          )}

          {/* AI Grade Display */}
          {hasAiGrade && aiGrade && (
            <div className="bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-200 rounded-2xl p-8">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-purple-900">AI Analysis</h3>
                    <p className="text-purple-700 text-sm">Powered by AI Grading</p>
                  </div>
                </div>
                <button
                  onClick={() => downloadGradeAsPdf(
                    session.studentName,
                    session.exam.title,
                    'Writing',
                    session.completedAt,
                    aiGrade
                  )}
                  className="flex items-center gap-2 px-4 py-2 bg-white border border-purple-300 rounded-lg text-purple-700 hover:bg-purple-50 transition-colors text-sm font-medium"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Download PDF
                </button>
              </div>

              {aiGrade.score && (
                <div className="mb-6 p-4 bg-white rounded-xl border border-purple-200">
                  <p className="text-sm text-gray-500 mb-1">Overall Score</p>
                  <p className="text-3xl font-bold text-purple-600">{aiGrade.score}/100</p>
                </div>
              )}

              <div className="space-y-4">
                <div className="bg-white rounded-xl p-4 border border-purple-100">
                  <h4 className="font-bold text-gray-900 mb-2">Summary</h4>
                  <MarkdownRenderer content={aiGrade.summary} className="text-gray-700" />
                </div>

                <div className="bg-white rounded-xl p-4 border border-purple-100">
                  <h4 className="font-bold text-gray-900 mb-2">Detailed Feedback</h4>
                  <MarkdownRenderer content={aiGrade.feedback} className="text-gray-700" />
                </div>
              </div>
            </div>
          )}

          {/* Back to Home */}
          <div className="text-center">
            <Link
              href="/"
              className="inline-block px-8 py-3 bg-gray-900 hover:bg-black text-white font-bold rounded-lg transition-colors"
            >
              Return to Home
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function WritingResultPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    }>
      <WritingResultContent />
    </Suspense>
  );
}
