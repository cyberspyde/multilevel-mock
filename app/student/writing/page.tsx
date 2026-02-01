'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import SearchBar from '../../../components/SearchBar';

type Step = 'select' | 'register' | 'unlock' | 'exam';

export default function WritingExamPage() {
  const [step, setStep] = useState<Step>('select');
  const [exams, setExams] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedExam, setSelectedExam] = useState<any>(null);
  const [studentName, setStudentName] = useState('');
  const [unlockCode, setUnlockCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [isLoadingExams, setIsLoadingExams] = useState(true);
  const [error, setError] = useState('');
  const [sessionId, setSessionId] = useState('');

  useEffect(() => {
    fetchExams();
  }, []);

  const fetchExams = async () => {
    try {
      const res = await fetch('/api/exams?type=WRITING');
      const data = await res.json();
      setExams(data);
    } catch (err) {
      console.error('Failed to fetch exams:', err);
    } finally {
      setIsLoadingExams(false);
    }
  };

  const handleExamSelect = async (exam: any) => {
    setSelectedExam(exam);
    setStep('register');
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentName.trim()) {
      setError('Please enter your name');
      return;
    }
    setStep('unlock');
  };

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const verifyRes = await fetch('/api/exams/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          examId: selectedExam.id,
          unlockCode,
        }),
      });

      const verifyData = await verifyRes.json();

      if (!verifyRes.ok) {
        setError(verifyData.error || 'Invalid unlock code');
        setLoading(false);
        return;
      }

      const sessionRes = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          examId: selectedExam.id,
          studentName,
          unlockCode,
        }),
      });

      const sessionData = await sessionRes.json();

      if (!sessionRes.ok) {
        setError(sessionData.error || 'Failed to create session');
        setLoading(false);
        return;
      }

      setSessionId(sessionData.id);
      setStep('exam');
    } catch (err) {
      console.error('Error:', err);
      setError('Something went wrong. Please try again.');
      setLoading(false);
    }
  };

  // Filter exams based on search query
  const filteredExams = exams.filter(exam => {
    const query = searchQuery.toLowerCase();
    return (
      exam.title.toLowerCase().includes(query) ||
      exam.description.toLowerCase().includes(query) ||
      exam._count.writingPrompts.toString().includes(query)
    );
  });

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
        {step === 'select' && (
          <div className="animate-fade-in">
            <h1 className="text-3xl font-bold text-gray-900 mb-6">
              Select a Writing Mock Exam
            </h1>

            <div className="mb-6">
              <SearchBar
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Search exams by title, description, or task count..."
                resultCount={exams.length}
              />
            </div>

            {isLoadingExams ? (
              <div className="flex flex-col items-center justify-center py-16 bg-white rounded-2xl border border-gray-200">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mb-4"></div>
                <p className="text-gray-600">Loading exams...</p>
              </div>
            ) : filteredExams.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-2xl border border-gray-200">
                <p className="text-gray-500">
                  {searchQuery ? 'No exams match your search.' : 'No writing exams available.'}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredExams.map((exam) => (
                  <button
                    key={exam.id}
                    onClick={() => handleExamSelect(exam)}
                    className="w-full text-left bg-white p-6 rounded-2xl border border-gray-200 hover:shadow-lg hover:border-purple-300 transition-all group"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-xl font-bold text-gray-900 group-hover:text-purple-600 transition-colors">
                          {exam.title}
                        </h3>
                        <p className="text-gray-500 mt-1">{exam.description}</p>
                        <p className="text-sm text-gray-400 mt-2">
                          {exam._count.writingPrompts} tasks
                        </p>
                      </div>
                      <svg
                        className="w-6 h-6 text-gray-400 group-hover:text-purple-600 group-hover:translate-x-1 transition-all"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {step === 'register' && (
          <div className="animate-fade-in">
            <button
              onClick={() => setStep('select')}
              className="text-gray-500 hover:text-gray-800 text-sm mb-6 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to exams
            </button>

            <div className="bg-white p-8 rounded-2xl shadow-lg border border-gray-200 max-w-md mx-auto">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">
                Student Registration
              </h2>

              <div className="mb-6 p-4 bg-purple-50 rounded-xl border border-purple-100">
                <p className="text-sm font-medium text-purple-900">Selected Exam</p>
                <p className="text-lg font-bold text-purple-900 mt-1">{selectedExam.title}</p>
              </div>

              <form onSubmit={handleRegister} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={studentName}
                    onChange={(e) => setStudentName(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
                    placeholder="Jane Doe"
                    autoFocus
                  />
                </div>

                {error && (
                  <p className="text-red-600 text-sm">{error}</p>
                )}

                <button
                  type="submit"
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-6 rounded-lg transition-colors"
                >
                  Continue
                </button>
              </form>
            </div>
          </div>
        )}

        {step === 'unlock' && (
          <div className="animate-fade-in">
            <button
              onClick={() => setStep('register')}
              className="text-gray-500 hover:text-gray-800 text-sm mb-6 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>

            <div className="bg-white p-8 rounded-2xl shadow-lg border border-gray-200 max-w-md mx-auto">
              <div className="mb-6 text-center">
                <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  Enter Exam Code
                </h2>
                <p className="text-gray-500">
                  Enter the unlock code to start {selectedExam.title}
                </p>
              </div>

              <form onSubmit={handleUnlock} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Unlock Code
                  </label>
                  <input
                    type="text"
                    value={unlockCode}
                    onChange={(e) => setUnlockCode(e.target.value.toUpperCase())}
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none text-center text-lg font-mono tracking-widest uppercase text-gray-900 placeholder:text-gray-300 transition-all"
                    placeholder="ENTER-CODE"
                    autoFocus
                  />
                </div>

                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-red-600 text-sm text-center">{error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || !unlockCode.trim()}
                  className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-lg transition-colors"
                >
                  {loading ? 'Verifying...' : 'Start Exam'}
                </button>
              </form>
            </div>
          </div>
        )}

        {step === 'exam' && sessionId && (
          <div className="animate-fade-in">
            <WritingExamInterface sessionId={sessionId} />
          </div>
        )}
      </main>
    </div>
  );
}

function WritingExamInterface({ sessionId }: { sessionId: string }) {
  const [exam, setExam] = useState<any>(null);
  const [isLoadingExam, setIsLoadingExam] = useState(true);
  const [currentPromptIndex, setCurrentPromptIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [wordCounts, setWordCounts] = useState<Record<string, number>>({});
  const [savingStatus, setSavingStatus] = useState<Record<string, 'saving' | 'saved' | 'error'>>({});
  const [submitting, setSubmitting] = useState(false);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [examStartedAt, setExamStartedAt] = useState<number>(Date.now());
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetchExam();
    return () => {
      // Clean up timers on unmount
      if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [sessionId]);

  // Setup timer when exam is loaded
  useEffect(() => {
    if (!exam || !exam.writingPrompts) return;

    // Calculate total time in seconds (sum of all prompt time limits)
    const totalMinutes = exam.writingPrompts.reduce((sum: number, p: any) => sum + (p.timeLimit || 0), 0);
    const totalSeconds = totalMinutes * 60;

    if (totalSeconds > 0) {
      setTimeRemaining(totalSeconds);

      // Start countdown
      timerIntervalRef.current = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            // Time's up - auto submit
            handleSubmit();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [exam]);

  const fetchExam = async () => {
    setIsLoadingExam(true);
    try {
      // First fetch the session to get the examId
      const sessionRes = await fetch(`/api/sessions?id=${sessionId}`);
      const sessionData = await sessionRes.json();

      if (!sessionRes.ok) {
        console.error('Failed to fetch session:', sessionData);
        setIsLoadingExam(false);
        return;
      }

      // Then load exam details with prompts
      const examRes = await fetch(`/api/exams/${sessionData.examId}`);
      const examData = await examRes.json();

      if (!examRes.ok) {
        console.error('Failed to fetch exam:', examData);
        setIsLoadingExam(false);
        return;
      }

      // Load existing answers
      const loadedAnswers: Record<string, string> = {};
      const loadedWordCounts: Record<string, number> = {};
      sessionData.writingAnswers?.forEach((ans: any) => {
        loadedAnswers[ans.promptId] = ans.content;
        loadedWordCounts[ans.promptId] = ans.wordCount;
      });

      setAnswers(loadedAnswers);
      setWordCounts(loadedWordCounts);
      // Only set exam once we have the complete data with prompts
      setExam(examData);
    } catch (err) {
      console.error('Failed to fetch exam:', err);
    } finally {
      setIsLoadingExam(false);
    }
  };

  const autoSave = async (promptId: string, content: string) => {
    // Clear existing timeout
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    // Set new timeout for 10 seconds
    autoSaveTimeoutRef.current = setTimeout(async () => {
      setSavingStatus(prev => ({ ...prev, [promptId]: 'saving' }));

      try {
        const res = await fetch('/api/writing/autosave', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            promptId,
            content,
          }),
        });

        if (res.ok) {
          setSavingStatus(prev => ({ ...prev, [promptId]: 'saved' }));
        } else {
          setSavingStatus(prev => ({ ...prev, [promptId]: 'error' }));
        }
      } catch (err) {
        console.error('Auto-save failed:', err);
        setSavingStatus(prev => ({ ...prev, [promptId]: 'error' }));
      }
    }, 10000); // 10 seconds
  };

  const handleContentChange = (promptId: string, content: string) => {
    setAnswers(prev => ({ ...prev, [promptId]: content }));

    const wordCount = content.trim().split(/\s+/).filter(w => w.length > 0).length;
    setWordCounts(prev => ({ ...prev, [promptId]: wordCount }));

    // Trigger auto-save
    autoSave(promptId, content);
  };

  const handleSubmit = useCallback(async () => {
    // Prevent double submit
    if (submitting) return;

    setSubmitting(true);

    try {
      // Check word count requirements
      const wordCountWarnings: string[] = [];
      for (const prompt of exam.writingPrompts) {
        const wordCount = wordCounts[prompt.id] || 0;
        if (prompt.wordLimit && wordCount < prompt.wordLimit) {
          wordCountWarnings.push(`Task ${prompt.order}: ${wordCount}/${prompt.wordLimit} words`);
        }
      }

      // Show warning if below word count (but allow submit)
      if (wordCountWarnings.length > 0 && !window.confirm(
        `Warning: You are below the minimum word count for some tasks:\n\n${wordCountWarnings.join('\n')}\n\nSubmit anyway?`
      )) {
        setSubmitting(false);
        return;
      }

      // Submit all answers
      for (const prompt of exam.writingPrompts) {
        const content = answers[prompt.id] || '';
        await fetch('/api/writing/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            promptId: prompt.id,
            content,
          }),
        });
      }

      // Complete session
      await fetch(`/api/sessions/${sessionId}/complete`, { method: 'POST' });

      window.location.href = `/student/writing/result?id=${sessionId}`;
    } catch (err) {
      console.error('Failed to submit:', err);
      setSubmitting(false);
      alert('Failed to submit exam. Please try again.');
    }
  }, [exam, answers, wordCounts, sessionId, submitting]);

  if (isLoadingExam) {
    return (
      <div className="flex flex-col items-center justify-center py-16 bg-white rounded-2xl shadow-lg border border-gray-200">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mb-4"></div>
        <p className="text-gray-600">Loading exam...</p>
      </div>
    );
  }

  if (!exam) {
    return (
      <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8 text-center">
        <div className="text-red-600 mb-4">
          <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h3 className="text-xl font-bold text-gray-900 mb-2">Failed to Load Exam</h3>
        <p className="text-gray-600">Please refresh the page or try again later.</p>
      </div>
    );
  }

  if (!exam.writingPrompts || exam.writingPrompts.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8 text-center">
        <div className="text-red-600 mb-4">
          <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h3 className="text-xl font-bold text-gray-900 mb-2">No Prompts Available</h3>
        <p className="text-gray-600">This exam does not have any writing prompts configured yet.</p>
      </div>
    );
  }

  const currentPrompt = exam.writingPrompts[currentPromptIndex];
  const currentWordCount = wordCounts[currentPrompt.id] || 0;
  const currentSavingStatus = savingStatus[currentPrompt.id];

  // Format time as MM:SS
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Get timer color based on remaining time
  const getTimerColor = (): string => {
    if (timeRemaining === 0) return 'text-gray-400';
    const totalMinutes = exam?.writingPrompts?.reduce((sum: number, p: any) => sum + (p.timeLimit || 0), 0) || 0;
    const totalSeconds = totalMinutes * 60;
    const percentage = (timeRemaining / totalSeconds) * 100;

    if (percentage <= 10) return 'text-red-600 animate-pulse';
    if (percentage <= 25) return 'text-orange-600';
    return 'text-purple-600';
  };

  return (
    <div className="space-y-6">
      {/* Progress Header */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">{exam.title}</h2>
            <p className="text-gray-500 text-sm">
              Task {currentPromptIndex + 1} of {exam.writingPrompts.length}
            </p>
          </div>
          <div className="text-right">
            <span className="text-2xl font-bold text-purple-600">
              {currentPromptIndex + 1}
            </span>
            <span className="text-gray-400"> / {exam.writingPrompts.length}</span>
          </div>
        </div>

        {/* Countdown Timer */}
        {timeRemaining > 0 && (
          <div className={`flex items-center justify-center gap-3 py-3 px-4 rounded-xl ${timeRemaining <= 60 ? 'bg-red-50 border border-red-200' : timeRemaining <= 300 ? 'bg-orange-50 border border-orange-200' : 'bg-purple-50 border border-purple-200'}`}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm font-medium">Time Remaining:</span>
            <span className={`text-2xl font-bold font-mono ${getTimerColor()}`}>
              {formatTime(timeRemaining)}
            </span>
            {timeRemaining <= 60 && (
              <span className="text-xs text-red-600 font-medium animate-pulse">
                (Auto-submitting soon!)
              </span>
            )}
          </div>
        )}

        {/* Task Navigation */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {exam.writingPrompts.map((prompt: any, index: number) => (
            <button
              key={prompt.id}
              onClick={() => setCurrentPromptIndex(index)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                index === currentPromptIndex
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Task {index + 1}
            </button>
          ))}
        </div>
      </div>

      {/* Writing Area */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
        {/* Prompt Header */}
        <div className="bg-gray-50 px-8 py-6 border-b border-gray-200">
          <h3 className="text-2xl font-bold text-gray-900 mb-2">
            {currentPrompt.title}
          </h3>
          <div className="text-gray-700 whitespace-pre-wrap">
            {currentPrompt.prompt}
          </div>
          {currentPrompt.instructions && (
            <p className="text-gray-500 mt-4 text-sm">
              <strong>Instructions:</strong> {currentPrompt.instructions}
            </p>
          )}
        </div>

        {/* Word Count and Timer Info */}
        <div className="px-8 py-4 border-b border-gray-200 flex items-center justify-between bg-purple-50">
          <div className="flex items-center gap-6">
            <div className="text-sm">
              <span className="text-gray-500">Word Count: </span>
              <span className="font-bold text-purple-600">{currentWordCount}</span>
              {currentPrompt.wordLimit && (
                <span className="text-gray-400"> / {currentPrompt.wordLimit} minimum</span>
              )}
            </div>
            {currentPrompt.timeLimit && (
              <div className="text-sm">
                <span className="text-gray-500">Time Limit: </span>
                <span className="font-bold text-gray-900">{currentPrompt.timeLimit} minutes</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {currentSavingStatus === 'saved' && (
              <span className="text-green-600 text-sm flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Saved
              </span>
            )}
            {currentSavingStatus === 'saving' && (
              <span className="text-blue-600 text-sm flex items-center gap-1">
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Saving...
              </span>
            )}
            {currentSavingStatus === 'error' && (
              <span className="text-red-600 text-sm flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Save failed
              </span>
            )}
          </div>
        </div>

        {/* Text Editor */}
        <div className="p-8">
          <textarea
            value={answers[currentPrompt.id] || ''}
            onChange={(e) => handleContentChange(currentPrompt.id, e.target.value)}
            className="w-full h-96 px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none resize-none text-gray-900 leading-relaxed"
            placeholder="Start writing your response here..."
            spellCheck
          />
        </div>

        {/* Action Buttons */}
        <div className="px-8 py-6 border-t border-gray-200 bg-gray-50 flex justify-between">
          <button
            onClick={() => setCurrentPromptIndex(Math.max(0, currentPromptIndex - 1))}
            disabled={currentPromptIndex === 0}
            className="px-6 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Previous Task
          </button>

          {currentPromptIndex === exam.writingPrompts.length - 1 ? (
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="px-8 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-bold disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? 'Submitting...' : 'Submit Exam'}
            </button>
          ) : (
            <button
              onClick={() => setCurrentPromptIndex(currentPromptIndex + 1)}
              className="px-6 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-bold transition-colors"
            >
              Next Task
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
