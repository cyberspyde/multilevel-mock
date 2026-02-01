'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import SearchBar from '../../../components/SearchBar';
import { MediaPlayer } from '../../../components/MediaPlayer';

type Step = 'select' | 'register' | 'unlock' | 'exam';

// Helper function to transcribe audio using server-side Whisper
async function transcribeAudioServer(audioBlob: Blob): Promise<string> {
  const formData = new FormData();
  formData.append('file', audioBlob, 'recording.webm');

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
      <header className="glass sticky top-0 z-10 border-b border-slate-200/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="font-bold text-xl bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            Bestcenter Multilevel Mock
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-all"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Home
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {step === 'select' && (
          <div className="animate-fade-in-up">
            <div className="mb-8">
              <h1 className="text-4xl font-bold text-slate-900 mb-2">
                Speaking Mock Exams
              </h1>
              <p className="text-slate-500 text-lg">
                Select an exam to begin your speaking assessment
              </p>
            </div>

            <div className="mb-8">
              <SearchBar
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Search exams by title, description, or question count..."
                resultCount={exams.length}
              />
            </div>

            {isLoadingExams ? (
              <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-slate-200 shadow-soft">
                <div className="relative">
                  <div className="animate-spin rounded-full h-16 w-16 border-4 border-slate-200"></div>
                  <div className="animate-spin rounded-full h-16 w-16 border-4 border-t-blue-600 absolute top-0 left-0 border-r-transparent border-b-transparent"></div>
                </div>
                <p className="text-slate-600 mt-6 font-medium">Loading exams...</p>
              </div>
            ) : filteredExams.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-3xl border border-slate-200 shadow-soft">
                <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-10 h-10 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <p className="text-slate-500 text-lg">
                  {searchQuery ? 'No exams match your search.' : 'No speaking exams available.'}
                </p>
              </div>
            ) : (
              <div className="grid gap-4">
                {filteredExams.map((exam) => (
                  <button
                    key={exam.id}
                    onClick={() => handleExamSelect(exam)}
                    className="group text-left bg-white p-6 rounded-2xl border border-slate-200 hover:shadow-soft-lg hover:border-blue-300 transition-all duration-300 relative overflow-hidden"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-50 to-indigo-50 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                    <div className="relative flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-xl font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                            {exam.title}
                          </h3>
                          <span className="badge bg-blue-100 text-blue-700">
                            {exam._count.questions} {exam._count.questions === 1 ? 'question' : 'questions'}
                          </span>
                        </div>
                        <p className="text-slate-500">{exam.description}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-blue-600 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-x-2 group-hover:translate-x-0">
                          Start
                        </span>
                        <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center group-hover:bg-blue-600 transition-all duration-300">
                          <svg
                            className="w-5 h-5 text-blue-600 group-hover:text-white transition-colors duration-300"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {step === 'register' && (
          <div className="animate-scale-in max-w-md mx-auto">
            <button
              onClick={() => setStep('select')}
              className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-800 text-sm mb-6 font-medium transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to exams
            </button>

            <div className="bg-white p-8 rounded-3xl shadow-soft-lg border border-slate-200">
              <div className="mb-6">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-blue-500/30">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-slate-900">
                  Student Registration
                </h2>
                <p className="text-slate-500 mt-1">Enter your details to continue</p>
              </div>

              <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl border border-blue-100">
                <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Selected Exam</p>
                <p className="text-lg font-bold text-blue-900 mt-1">{selectedExam.title}</p>
              </div>

              <form onSubmit={handleRegister} className="space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={studentName}
                    onChange={(e) => setStudentName(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-slate-900 placeholder:text-slate-400"
                    placeholder="Jane Doe"
                    autoFocus
                  />
                </div>

                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2">
                    <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-red-600 text-sm">{error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold py-3.5 px-6 rounded-xl transition-all shadow-lg shadow-blue-500/30 hover:shadow-blue-500/40"
                >
                  Continue
                </button>
              </form>
            </div>
          </div>
        )}

        {step === 'unlock' && (
          <div className="animate-scale-in max-w-md mx-auto">
            <button
              onClick={() => setStep('register')}
              className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-800 text-sm mb-6 font-medium transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>

            <div className="bg-white p-8 rounded-3xl shadow-soft-lg border border-slate-200">
              <div className="mb-8 text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-lg shadow-indigo-500/30">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-slate-900 mb-2">
                  Enter Exam Code
                </h2>
                <p className="text-slate-500">
                  Enter the unlock code to start <span className="font-semibold text-slate-700">{selectedExam.title}</span>
                </p>
              </div>

              <form onSubmit={handleUnlock} className="space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Unlock Code
                  </label>
                  <input
                    type="text"
                    value={unlockCode}
                    onChange={(e) => setUnlockCode(e.target.value.toUpperCase())}
                    className="w-full px-4 py-3.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-center text-lg font-mono tracking-widest uppercase text-slate-900 placeholder:text-slate-300 transition-all"
                    placeholder="ENTER-CODE"
                    autoFocus
                  />
                </div>

                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center justify-center gap-2">
                    <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-red-600 text-sm text-center">{error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || !unlockCode.trim()}
                  className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:from-slate-300 disabled:to-slate-400 disabled:cursor-not-allowed text-white font-semibold py-3.5 px-6 rounded-xl transition-all shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/40"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Verifying...
                    </span>
                  ) : 'Start Exam'}
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
  const [phase, setPhase] = useState<'reading' | 'watching' | 'answering' | 'idle'>('idle');
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [questionStartTime, setQuestionStartTime] = useState<Date | null>(null);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const [showRetry, setShowRetry] = useState(false);
  const [recordingActive, setRecordingActive] = useState(false); // Visual feedback for active recording
  const [mediaPlayed, setMediaPlayed] = useState(false); // Track if media has been played
  const recordingStartTimeRef = useRef<number | null>(null);

  useEffect(() => {
    fetchExam();
  }, [sessionId]);

  useEffect(() => {
    if (exam && exam.questions && exam.questions.length > 0) {
      setMediaPlayed(false);
      startReadingPhase();
    }
  }, [exam, currentQuestionIndex]);

  useEffect(() => {
    if (timeRemaining <= 0) return;

    const timer = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          if (phase === 'reading') {
            // After reading time, check if we need to play media
            const currentQuestion = exam?.questions[currentQuestionIndex];
            const hasMedia = currentQuestion?.format === 'VIDEO' ||
                            (currentQuestion?.format === 'AUDIO_ONLY' && currentQuestion?.mediaUrl);

            if (hasMedia && !mediaPlayed) {
              // Transition to watching phase - media will auto-play
              setPhase('watching');
              setTimeRemaining(0); // No timer during media playback
            } else {
              // No media, go directly to answering
              startAnsweringPhase();
            }
          } else if (phase === 'answering' && isRecording) {
            stopRecording();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeRemaining, phase, isRecording, exam, currentQuestionIndex, mediaPlayed]);

  const handleMediaEnded = () => {
    setMediaPlayed(true);
    // After media ends, start answering phase (recording)
    startAnsweringPhase();
  };

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
    setRecordingError(null);
    setShowRetry(false);
    setRecordingActive(false);
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
    setRecordingError(null);
    setShowRetry(false);

    try {
      // Check if mediaDevices is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Microphone access is not supported in this browser. Please try using Chrome, Firefox, or Edge.');
      }

      // Check microphone permission
      try {
        const permissionStatus = await navigator.permissions.query({ name: 'microphone' as PermissionName });
        if (permissionStatus.state === 'denied') {
          throw new Error('Microphone permission has been denied. Please allow microphone access in your browser settings and refresh the page.');
        }
      } catch {
        // Permission query might not be supported in all browsers, continue
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Check if we got actual audio tracks
      if (stream.getAudioTracks().length === 0) {
        throw new Error('No microphone detected. Please connect a microphone and try again.');
      }

      // Determine supported MIME type for recording
      let mimeType = 'audio/webm';
      const types = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/ogg',
        'audio/mp4',
        'audio/mp3'
      ];

      for (const type of types) {
        if (MediaRecorder.isTypeSupported(type)) {
          mimeType = type;
          console.log('[Recording] Using MIME type:', mimeType);
          break;
        }
      }

      const options = mimeType ? { mimeType } : undefined;
      const recorder = new MediaRecorder(stream, options);
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
          setRecordingActive(true); // Visual feedback that recording is working
        }
      };

      recorder.onstop = async () => {
        // Use the actual recorded MIME type or default to webm
        const recordedMimeType = mimeType || 'audio/webm';
        const audioBlob = new Blob(chunks, { type: recordedMimeType });
        const duration = recordingStartTimeRef.current ? Math.round((Date.now() - recordingStartTimeRef.current) / 1000) : 0;

        console.log('[Recording] Stopped. Blob size:', audioBlob.size, 'bytes, MIME type:', recordedMimeType);

        // Validate the recording has actual data
        if (audioBlob.size < 1000) {
          console.warn('[Recording] Audio blob is very small, may be empty');
        }

        await saveAnswer(audioBlob, duration);
        stream.getTracks().forEach(track => track.stop());
        setRecordingActive(false);
      };

      recorder.onerror = (event) => {
        console.error('MediaRecorder error:', event);
        setRecordingError('Recording error occurred. Please try again.');
        setShowRetry(true);
        setIsRecording(false);
      };

      // Start recording with 100ms timeslice for more reliable data capture
      recorder.start(100);
      recordingStartTimeRef.current = Date.now();
      setMediaRecorder(recorder);
      setAudioChunks(chunks);
      setIsRecording(true);

      // Verify recording is active after a short delay
      setTimeout(() => {
        if (recorder.state === 'inactive') {
          setRecordingError('Recording failed to start. Please check your microphone and try again.');
          setShowRetry(true);
          setIsRecording(false);
        }
      }, 1000);

    } catch (err: any) {
      console.error('Failed to start recording:', err);
      const errorMessage = err.message || 'Failed to access microphone. Please ensure you have granted permission.';
      setRecordingError(errorMessage);
      setShowRetry(true);
      setIsRecording(false);
      setRecordingActive(false);
    }
  };

  const handleRetryRecording = () => {
    setRecordingError(null);
    setShowRetry(false);
    startRecording();
  };

  const handleSkipQuestion = async () => {
    // User chose to skip after recording failed
    setRecordingError(null);
    setShowRetry(false);
    await saveAnswer(null);
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

      let audioUrl: string | null = null;

      // Upload audio if available (transcription happens AFTER exam completes)
      if (audioBlob) {
        // Validate recording has actual data
        if (audioBlob.size < 500) {
          console.warn('[SaveAnswer] Audio blob too small (< 500 bytes), skipping upload');
          // Still save the answer but without audio URL
        } else {
          // Determine file extension based on MIME type
          let fileExt = 'webm';
          const mimeType = audioBlob.type.toLowerCase();

          if (mimeType.includes('ogg')) {
            fileExt = 'ogg';
          } else if (mimeType.includes('mp4') || mimeType.includes('m4a')) {
            fileExt = 'm4a';
          } else if (mimeType.includes('mp3')) {
            fileExt = 'mp3';
          } else if (mimeType.includes('wav')) {
            fileExt = 'wav';
          }

          const filename = `answer-${sessionId}-${currentQuestion.id}.${fileExt}`;
          console.log('[SaveAnswer] Uploading audio:', filename, 'Size:', audioBlob.size, 'Type:', mimeType);

          let uploadSuccess = false;
          let retryCount = 0;
          const maxRetries = 3;

          while (!uploadSuccess && retryCount < maxRetries) {
            try {
              const formData = new FormData();
              formData.append('file', audioBlob, filename);

              // Use XMLHttpRequest for better timeout control and retry support
              await new Promise<void>((resolve, reject) => {
                const xhr = new XMLHttpRequest();

                xhr.addEventListener('load', () => {
                  if (xhr.status === 200) {
                    const uploadData = JSON.parse(xhr.responseText);
                    audioUrl = uploadData.url;
                    console.log('[SaveAnswer] Audio uploaded successfully:', audioUrl);
                    uploadSuccess = true;
                    resolve();
                  } else {
                    let uploadError;
                    try {
                      uploadError = JSON.parse(xhr.responseText);
                    } catch {
                      uploadError = { error: `Upload failed with status ${xhr.status}` };
                    }
                    reject(new Error(uploadError.error || 'Upload failed'));
                  }
                });

                xhr.addEventListener('error', () => {
                  reject(new Error('Network error during upload'));
                });

                xhr.addEventListener('timeout', () => {
                  reject(new Error('Upload timed out'));
                });

                xhr.open('POST', '/api/upload');
                xhr.timeout = 60000; // 1 minute timeout
                xhr.send(formData);
              });

              break; // Success, exit retry loop
            } catch (uploadErr: any) {
              retryCount++;
              console.error(`[SaveAnswer] Upload attempt ${retryCount} failed:`, uploadErr.message);

              if (retryCount < maxRetries) {
                // Wait before retry with exponential backoff
                await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
              } else {
                console.warn('[SaveAnswer] All upload attempts failed, continuing without audio file');
              }
            }
          }
        }
      }

      // Save answer with audio URL (transcription will be done after exam)
      const answerResponse = await fetch('/api/speaking/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          questionId: currentQuestion.id,
          audioUrl,
          duration,
        }),
      });

      if (!answerResponse.ok) {
        const answerError = await answerResponse.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(answerError.error || 'Failed to save answer');
      }

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
      {phase !== 'idle' && phase !== 'watching' && (
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

      {/* Watching Phase Header */}
      {phase === 'watching' && (
        <div className="bg-gradient-to-r from-indigo-50 to-blue-50 px-8 py-6 border-b border-gray-200">
          <div className="flex items-center justify-center">
            <div className="text-center">
              <p className="text-sm font-medium text-gray-600 uppercase tracking-wide">
                {currentQuestion.format === 'VIDEO' ? '🎬 Watching Video' : '🎧 Listening to Audio'}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {currentQuestion.format === 'VIDEO'
                  ? 'Pay attention to the video content'
                  : 'Listen carefully to the audio'}
              </p>
              <p className="text-sm text-indigo-600 mt-2 font-medium">
                Recording will start automatically when it ends
              </p>
            </div>
          </div>
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

        {currentQuestion.format === 'VIDEO' && (
          <div className="mb-8">
            {currentQuestion.mediaUrl ? (
              phase === 'watching' ? (
                <MediaPlayer
                  src={currentQuestion.mediaUrl}
                  type="video"
                  onEnded={handleMediaEnded}
                  autoPlay={true}
                  className="mb-4"
                />
              ) : (
                <div className="bg-slate-100 rounded-lg p-6 mb-4 text-center border border-slate-200">
                  <p className="text-slate-600 font-medium">
                    {phase === 'reading' ? 'Video will play after reading time' : 'Video finished'}
                  </p>
                </div>
              )
            ) : (
              <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-4 text-center">
                <p className="text-red-600 font-medium">Video file not available</p>
                <p className="text-red-500 text-sm mt-1">Please contact your instructor</p>
              </div>
            )}
            <h3 className="text-2xl font-semibold text-gray-900">
              {currentQuestion.text}
            </h3>
            {currentQuestion.instructions && (
              <p className="text-gray-500 mt-2">{currentQuestion.instructions}</p>
            )}
          </div>
        )}

        {currentQuestion.format === 'AUDIO_ONLY' && (
          <div className="mb-8">
            {currentQuestion.mediaUrl ? (
              phase === 'watching' ? (
                <MediaPlayer
                  src={currentQuestion.mediaUrl}
                  type="audio"
                  onEnded={handleMediaEnded}
                  autoPlay={true}
                  className="mb-4"
                />
              ) : (
                <div className="bg-slate-100 rounded-lg p-6 mb-4 text-center border border-slate-200">
                  <p className="text-slate-600 font-medium">
                    {phase === 'reading' ? 'Audio will play after reading time' : 'Audio finished'}
                  </p>
                </div>
              )
            ) : (
              <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-4 text-center">
                <p className="text-red-600 font-medium">Audio file not available</p>
                <p className="text-red-500 text-sm mt-1">Please contact your instructor</p>
              </div>
            )}
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
          {isProcessing ? (
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
              <p className="text-sm text-gray-500 mt-2">
                {(currentQuestion.format === 'VIDEO' || currentQuestion.format === 'AUDIO_ONLY') && currentQuestion.mediaUrl
                  ? 'Media will play automatically, then recording will start'
                  : 'Recording will start automatically'}
              </p>
            </div>
          ) : phase === 'watching' ? (
            <div className="text-center py-8">
              <div className="w-20 h-20 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
                {currentQuestion.format === 'VIDEO' ? (
                  <svg className="w-10 h-10 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ) : (
                  <svg className="w-10 h-10 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                  </svg>
                )}
              </div>
              <p className="text-lg font-semibold text-gray-900">
                {currentQuestion.format === 'VIDEO' ? 'Watching video...' : 'Listening to audio...'}
              </p>
              <p className="text-sm text-gray-500 mt-2">Recording will start automatically when it ends</p>
            </div>
          ) : recordingError ? (
            <div className="text-center py-6 max-w-md">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-red-900 mb-2">Recording Failed</h3>
              <p className="text-sm text-red-700 mb-6">{recordingError}</p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={handleRetryRecording}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
                >
                  Try Again
                </button>
                <button
                  onClick={handleSkipQuestion}
                  className="px-6 py-2 border border-gray-300 text-gray-700 hover:bg-gray-100 font-medium rounded-lg transition-colors"
                >
                  Skip Question
                </button>
              </div>
            </div>
          ) : (
            <>
              {isRecording && (
                <div className="flex flex-col items-center gap-4">
                  <div className="animate-pulse flex items-center gap-2 text-red-600 font-bold text-xl">
                    <div className="w-4 h-4 bg-red-600 rounded-full animate-ping"></div>
                    Recording...
                    {recordingActive && (
                      <span className="text-sm text-green-600 font-normal flex items-center gap-1">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        Active
                      </span>
                    )}
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
