'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import SearchBar from '../../../components/SearchBar';

type Step = 'select' | 'register' | 'unlock' | 'exam';

// Dynamic import for Whisper (browser-only)
let clientTranscribeAudio: ((audioBlob: Blob) => Promise<string>) | null = null;

if (typeof window !== 'undefined') {
  import('../../../services/whisper').then((module) => {
    clientTranscribeAudio = module.transcribeAudio;
  });
}

// Helper function to transcribe audio based on server config
async function transcribeAudioWithMode(audioBlob: Blob): Promise<string> {
  try {
    // Check whisper mode from server
    const modeRes = await fetch('/api/whisper');
    const { mode } = await modeRes.json();

    if (mode === 'server') {
      // Use server-side transcription
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');

      const res = await fetch('/api/whisper', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const error = await res.json();
        console.error('Server transcription failed:', error);
        throw new Error(error.error || 'Server transcription failed');
      }

      const data = await res.json();
      return data.transcription || '';
    } else {
      // Use client-side transcription
      if (!clientTranscribeAudio) {
        throw new Error('Client-side Whisper not loaded');
      }
      return await clientTranscribeAudio(audioBlob);
    }
  } catch (error) {
    console.error('Transcription error:', error);
    // Fallback to client-side if server fails
    if (clientTranscribeAudio) {
      console.log('Falling back to client-side transcription');
      return await clientTranscribeAudio(audioBlob);
    }
    throw error;
  }
}

export default function SpeakingExamPage() {
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
      const res = await fetch('/api/exams?type=SPEAKING');
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
      // Verify unlock code
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

      // Create session
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
      exam._count.questions.toString().includes(query)
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
              Select a Speaking Mock Exam
            </h1>

            <div className="mb-6">
              <SearchBar
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Search exams by title, description, or question count..."
                resultCount={exams.length}
              />
            </div>

            {isLoadingExams ? (
              <div className="flex flex-col items-center justify-center py-16 bg-white rounded-2xl border border-gray-200">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
                <p className="text-gray-600">Loading exams...</p>
              </div>
            ) : filteredExams.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-2xl border border-gray-200">
                <p className="text-gray-500">
                  {searchQuery ? 'No exams match your search.' : 'No speaking exams available.'}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredExams.map((exam) => (
                  <button
                    key={exam.id}
                    onClick={() => handleExamSelect(exam)}
                    className="w-full text-left bg-white p-6 rounded-2xl border border-gray-200 hover:shadow-lg hover:border-blue-300 transition-all group"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-xl font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                          {exam.title}
                        </h3>
                        <p className="text-gray-500 mt-1">{exam.description}</p>
                        <p className="text-sm text-gray-400 mt-2">
                          {exam._count.questions} questions
                        </p>
                      </div>
                      <svg
                        className="w-6 h-6 text-gray-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all"
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

              <div className="mb-6 p-4 bg-blue-50 rounded-xl border border-blue-100">
                <p className="text-sm font-medium text-blue-900">Selected Exam</p>
                <p className="text-lg font-bold text-blue-900 mt-1">{selectedExam.title}</p>
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
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    placeholder="Jane Doe"
                    autoFocus
                  />
                </div>

                {error && (
                  <p className="text-red-600 text-sm">{error}</p>
                )}

                <button
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition-colors"
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
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                    onChange={(e) => setUnlockCode(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-center text-lg font-mono tracking-wider"
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
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-lg transition-colors"
                >
                  {loading ? 'Verifying...' : 'Start Exam'}
                </button>
              </form>
            </div>
          </div>
        )}

        {step === 'exam' && sessionId && (
          <div className="animate-fade-in">
            <SpeakingExamInterface sessionId={sessionId} />
          </div>
        )}
      </main>
    </div>
  );
}

function SpeakingExamInterface({ sessionId }: { sessionId: string }) {
  const [exam, setExam] = useState<any>(null);
  const [isLoadingExam, setIsLoadingExam] = useState(true);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);
  const [phase, setPhase] = useState<'reading' | 'answering' | 'idle'>('idle');
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [questionStartTime, setQuestionStartTime] = useState<Date | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const recordingStartTimeRef = useRef<number | null>(null);

  useEffect(() => {
    fetchExam();
  }, [sessionId]);

  useEffect(() => {
    if (exam && exam.questions && exam.questions.length > 0) {
      startReadingPhase();
    }
  }, [exam, currentQuestionIndex]);

  useEffect(() => {
    if (timeRemaining <= 0) return;

    const timer = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          if (phase === 'reading') {
            startAnsweringPhase();
          } else if (phase === 'answering' && isRecording) {
            stopRecording();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeRemaining, phase, isRecording]);

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

      // Then load exam details with questions
      const examRes = await fetch(`/api/exams/${sessionData.examId}`);
      const examData = await examRes.json();

      if (!examRes.ok) {
        console.error('Failed to fetch exam:', examData);
        setIsLoadingExam(false);
        return;
      }

      // Only set exam once we have the complete data with questions
      setExam(examData);
    } catch (err) {
      console.error('Failed to fetch exam:', err);
    } finally {
      setIsLoadingExam(false);
    }
  };

  const startReadingPhase = () => {
    const currentQuestion = exam?.questions[currentQuestionIndex];
    if (!currentQuestion) return;

    const readingTime = currentQuestion.readingTimeLimit || 5;
    setPhase('reading');
    setTimeRemaining(readingTime);
    setQuestionStartTime(new Date());
    setIsRecording(false);
  };

  const startAnsweringPhase = () => {
    const currentQuestion = exam?.questions[currentQuestionIndex];
    if (!currentQuestion) return;

    const answeringTime = currentQuestion.answeringTimeLimit || 30;
    setPhase('answering');
    setTimeRemaining(answeringTime);
    startRecording();
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(chunks, { type: 'audio/webm' });
        const duration = recordingStartTimeRef.current ? Math.round((Date.now() - recordingStartTimeRef.current) / 1000) : 0;
        await saveAnswer(audioBlob, duration);
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      recordingStartTimeRef.current = Date.now();
      setMediaRecorder(recorder);
      setAudioChunks(chunks);
      setIsRecording(true);
    } catch (err) {
      console.error('Failed to start recording:', err);
      alert('Microphone access is required for this exam.');
      // If can't record, move to next after answering time
      const currentQuestion = exam?.questions[currentQuestionIndex];
      const answeringTime = currentQuestion?.answeringTimeLimit || 30;
      setTimeout(() => {
        saveAnswer(null);
      }, answeringTime * 1000);
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      setIsRecording(false);
      setIsProcessing(true);
    }
  };

  const saveAnswer = async (audioBlob: Blob | null, duration: number = 0) => {
    const currentQuestion = exam.questions[currentQuestionIndex];

    try {
      setPhase('idle');
      setIsProcessing(true);

      let transcription = null;
      let audioUrl: string | null = null;

      // Transcribe and upload audio if available
      if (audioBlob) {
        // Step 1: Transcribe audio (uses server or client based on config)
        try {
          setIsTranscribing(true);
          transcription = await transcribeAudioWithMode(audioBlob);
          console.log('Transcription:', transcription);
        } catch (err) {
          console.error('Transcription failed:', err);
          // Continue without transcription
        } finally {
          setIsTranscribing(false);
        }

        // Step 2: Upload audio to storage
        try {
          const formData = new FormData();
          formData.append('file', audioBlob, `answer-${sessionId}-${currentQuestion.id}.webm`);

          const uploadRes = await fetch('/api/upload', {
            method: 'POST',
            body: formData,
          });

          if (uploadRes.ok) {
            const uploadData = await uploadRes.json();
            audioUrl = uploadData.url;
            console.log('Audio uploaded successfully:', audioUrl);
          } else {
            const uploadError = await uploadRes.json();
            console.warn('Failed to upload audio:', uploadError.error);
            // Continue with transcription even if audio upload fails
          }
        } catch (uploadErr) {
          console.error('Audio upload error:', uploadErr);
          // Continue with transcription even if audio upload fails
        }
      }

      // Save answer with audio URL and transcription
      await fetch('/api/speaking/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          questionId: currentQuestion.id,
          audioUrl,
          transcription,
          duration,
        }),
      });

      setIsProcessing(false);

      // Move to next question or complete
      if (currentQuestionIndex < exam.questions.length - 1) {
        setCurrentQuestionIndex(currentQuestionIndex + 1);
      } else {
        await fetch(`/api/sessions/${sessionId}/complete`, { method: 'POST' });
        window.location.href = `/student/speaking/result?id=${sessionId}`;
      }
    } catch (err) {
      console.error('Failed to save answer:', err);
      setIsProcessing(false);

      // Show user-friendly error message
      alert(`Failed to save your answer: ${err instanceof Error ? err.message : 'Please try again.'}`);
    }
  };

  if (isLoadingExam) {
    return (
      <div className="flex flex-col items-center justify-center py-16 bg-white rounded-2xl shadow-lg border border-gray-200">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
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

  if (!exam.questions || exam.questions.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8 text-center">
        <div className="text-red-600 mb-4">
          <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h3 className="text-xl font-bold text-gray-900 mb-2">No Questions Available</h3>
        <p className="text-gray-600">This exam does not have any questions configured yet.</p>
      </div>
    );
  }

  const currentQuestion = exam.questions[currentQuestionIndex];

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
      {/* Question Header */}
      <div className="bg-gray-50 px-8 py-4 border-b border-gray-200 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">{exam.title}</h2>
          <p className="text-gray-500 text-sm">
            Question {currentQuestionIndex + 1} of {exam.questions.length}
          </p>
        </div>
        <div className="text-right">
          <span className="text-2xl font-bold text-blue-600">
            {currentQuestionIndex + 1}
          </span>
          <span className="text-gray-400"> / {exam.questions.length}</span>
        </div>
      </div>

      {/* Timer Display */}
      {phase !== 'idle' && (
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 px-8 py-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 uppercase tracking-wide">
                {phase === 'reading' ? '📖 Reading Time' : '🎤 Recording Time'}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {phase === 'reading'
                  ? 'Read the question carefully'
                  : 'Speak your answer clearly'}
              </p>
            </div>
            <div className="text-center">
              <div className={`text-6xl font-bold ${timeRemaining <= 5 && phase === 'answering'
                ? 'text-red-600 animate-pulse'
                : timeRemaining <= 10 && phase === 'answering'
                  ? 'text-orange-600'
                  : 'text-blue-600'
                }`}>
                {timeRemaining}
              </div>
              <div className="text-sm text-gray-500 mt-1">seconds</div>
            </div>
          </div>
          {phase === 'answering' && (
            <div className="mt-4 bg-white rounded-full h-2 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-1000"
                style={{
                  width: `${(timeRemaining / (currentQuestion.answeringTimeLimit || 30)) * 100}%`
                }}
              />
            </div>
          )}
        </div>
      )}

      {/* Question Content */}
      <div className="p-8">
        {/* Format-specific display */}
        {currentQuestion.format === 'TEXT_ONLY' && (
          <div className="mb-8">
            <h3 className="text-2xl font-semibold text-gray-900">
              {currentQuestion.text}
            </h3>
            {currentQuestion.instructions && (
              <p className="text-gray-500 mt-2">{currentQuestion.instructions}</p>
            )}
          </div>
        )}

        {currentQuestion.format === 'PICTURE_TEXT' && currentQuestion.mediaUrl && (
          <div className="mb-8">
            <img
              src={currentQuestion.mediaUrl}
              alt="Question context"
              className="w-full max-h-64 object-contain rounded-lg mb-4"
            />
            <h3 className="text-2xl font-semibold text-gray-900">
              {currentQuestion.text}
            </h3>
            {currentQuestion.instructions && (
              <p className="text-gray-500 mt-2">{currentQuestion.instructions}</p>
            )}
          </div>
        )}

        {currentQuestion.format === 'VIDEO' && currentQuestion.mediaUrl && (
          <div className="mb-8">
            <video
              src={currentQuestion.mediaUrl}
              className="w-full rounded-lg mb-4"
              controls
            />
            <h3 className="text-2xl font-semibold text-gray-900">
              {currentQuestion.text}
            </h3>
            {currentQuestion.instructions && (
              <p className="text-gray-500 mt-2">{currentQuestion.instructions}</p>
            )}
          </div>
        )}

        {currentQuestion.format === 'AUDIO_ONLY' && currentQuestion.mediaUrl && (
          <div className="mb-8">
            <audio
              src={currentQuestion.mediaUrl}
              controls
              className="w-full mb-4"
            />
            <h3 className="text-2xl font-semibold text-gray-900">
              {currentQuestion.text}
            </h3>
            {currentQuestion.instructions && (
              <p className="text-gray-500 mt-2">{currentQuestion.instructions}</p>
            )}
          </div>
        )}

        {/* Recording Interface */}
        <div className="bg-gray-50 rounded-xl p-8 border border-gray-200 flex flex-col items-center justify-center min-h-[200px]">
          {isTranscribing ? (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Transcribing audio...</p>
              <p className="text-xs text-gray-500 mt-2">This may take a moment</p>
            </div>
          ) : isProcessing ? (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Saving your response...</p>
            </div>
          ) : phase === 'reading' ? (
            <div className="text-center py-8">
              <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-10 h-10 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <p className="text-lg font-semibold text-gray-900">Read the question carefully</p>
              <p className="text-sm text-gray-500 mt-2">Recording will start automatically</p>
            </div>
          ) : (
            <>
              {isRecording && (
                <div className="flex flex-col items-center gap-4">
                  <div className="animate-pulse flex items-center gap-2 text-red-600 font-bold text-xl">
                    <div className="w-4 h-4 bg-red-600 rounded-full"></div>
                    Recording...
                  </div>
                  <button
                    onClick={stopRecording}
                    className="bg-gray-900 hover:bg-black text-white px-8 py-3 rounded-full font-bold shadow-md transition-all"
                  >
                    Stop & Submit
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
