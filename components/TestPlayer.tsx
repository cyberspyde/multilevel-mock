import React, { useState, useRef, useEffect } from 'react';
import { TestScenario, StudentSession, Question, Answer } from '../types';
import { updateSession } from '../services/storage';
import { generateFeedback } from '../services/gemini';
import { transcribeAudio, preloadWhisper } from '../services/whisper';
import { analyzeTextComplexity } from '../services/summarizer';
import Button from './Button';

interface TestPlayerProps {
  test: TestScenario;
  session: StudentSession;
  onComplete: (updatedSession: StudentSession) => void;
}

const TestPlayer: React.FC<TestPlayerProps> = ({ test, session, onComplete }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [activeQuestion, setActiveQuestion] = useState<Question | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [sessionState, setSessionState] = useState<StudentSession>(session);
  const [modelLoading, setModelLoading] = useState(true);

  // Recorder refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // Preload AI models on mount
  useEffect(() => {
    const loadModels = async () => {
      try {
        setModelLoading(true);
        // Preload Whisper in background
        await preloadWhisper();
        console.log('AI models loaded successfully');
      } catch (error) {
        console.warn('Failed to preload models, will load on demand:', error);
      } finally {
        setModelLoading(false);
      }
    };
    loadModels();
  }, []);

  // Initialize playback position if resuming
  useEffect(() => {
    // Determine last answered question to seek video
    if (session.answers.length > 0) {
      const lastAnswer = session.answers[session.answers.length - 1];
      const lastQuestion = test.questions.find(q => q.id === lastAnswer.questionId);
      if (lastQuestion && videoRef.current) {
        // Seek to just after the last question
        videoRef.current.currentTime = lastQuestion.timestamp + 1;
      }
    }
  }, [session.answers, test.questions]); // Run once on mount/session change

  const handleTimeUpdate = () => {
    if (!videoRef.current || activeQuestion) return;

    const currentT = videoRef.current.currentTime;
    // Find a question that is at the current time (within tolerance) AND hasn't been answered yet
    const triggerQuestion = test.questions.find(q => {
      const isTime = Math.abs(q.timestamp - currentT) < 0.5; // 0.5s tolerance
      const isAnswered = sessionState.answers.some(a => a.questionId === q.id);
      return isTime && !isAnswered;
    });

    if (triggerQuestion) {
      videoRef.current.pause();
      setActiveQuestion(triggerQuestion);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = handleRecordingComplete;

      recorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Microphone access failed or device not found.", err);
      // Show error to user - microphone is required
      alert('Microphone access is required for this application. Please ensure you have a microphone connected and grant permission to use it.');
      throw err;
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsProcessing(true);

      // Stop all tracks to release mic
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
  };

  const handleRecordingComplete = async () => {
    if (!activeQuestion) return;

    const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });

    try {
      // 1. Real Transcription using Whisper
      const transcription = await transcribeAudio(audioBlob);

      // 2. Save Answer
      const newAnswer: Answer = {
        questionId: activeQuestion.id,
        audioBlob: audioBlob,
        transcription: transcription,
        recordedAt: new Date().toISOString()
      };

      const updatedSession = {
        ...sessionState,
        answers: [...sessionState.answers, newAnswer]
      };

      // Check if test is complete
      const allAnswered = test.questions.every(q => updatedSession.answers.some(a => a.questionId === q.id));

      if (allAnswered) {
        updatedSession.completed = true;

        // 3. Combine all transcriptions for analysis
        const allTranscriptions = updatedSession.answers.map(a => a.transcription).join(' ');
        const complexity = analyzeTextComplexity(allTranscriptions);

        // 4. Generate AI Summary with enhanced context
        const summary = await generateFeedback(JSON.stringify({ session: updatedSession, test, complexity }));
        updatedSession.aiSummary = summary;
      }

      // 5. Persist
      await updateSession(updatedSession);
      setSessionState(updatedSession);

      // 6. Resume
      setIsProcessing(false);
      setActiveQuestion(null);

      if (allAnswered) {
        onComplete(updatedSession);
      } else {
        videoRef.current?.play();
      }
    } catch (error) {
      console.error('Error processing recording:', error);
      setIsProcessing(false);

      // Show error to user
      alert(`Transcription failed: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
        {/* Video Area */}
        <div className="relative aspect-video bg-black">
          <video
            ref={videoRef}
            src={test.videoUrl}
            className="w-full h-full"
            onTimeUpdate={handleTimeUpdate}
            controls={false} // Hide controls to enforce test flow
            playsInline
          />
          
          {!activeQuestion && !sessionState.completed && (
             <div className="absolute bottom-4 right-4 bg-black/50 backdrop-blur-sm text-white px-3 py-1 rounded-md text-xs">
               Observing Scenario...
             </div>
          )}
        </div>

        {/* Interaction Area */}
        <div className="p-8">
          {activeQuestion ? (
            <div className="animate-fade-in-up space-y-6">
              <div className="space-y-2">
                <h3 className="text-sm font-bold text-blue-600 uppercase tracking-wide">Question</h3>
                <p className="text-2xl font-semibold text-gray-900">{activeQuestion.text}</p>
              </div>

              <div className="bg-gray-50 rounded-xl p-6 border border-gray-200 flex flex-col items-center justify-center space-y-4">
                 {isProcessing ? (
                   <div className="text-center py-4">
                     <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-3"></div>
                     <p className="text-gray-600">Transcribing response...</p>
                   </div>
                 ) : (
                   <>
                     {!isRecording ? (
                       <div>
                         <button
                           onClick={startRecording}
                           className="flex items-center gap-3 bg-red-600 hover:bg-red-700 text-white px-8 py-4 rounded-full text-lg font-bold shadow-lg hover:shadow-xl transition-all hover:scale-105 active:scale-95"
                         >
                           <div className="w-4 h-4 bg-white rounded-full"></div>
                           Start Recording Answer
                         </button>
                       </div>
                     ) : (
                       <div className="flex flex-col items-center gap-4">
                         <div className="animate-pulse flex items-center gap-2 text-red-600 font-bold">
                           <div className="w-3 h-3 bg-red-600 rounded-full"></div>
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
          ) : (
            <div className="flex justify-between items-center">
              <div>
                 <h2 className="text-xl font-bold text-gray-900">{test.title}</h2>
                 <p className="text-gray-500 mt-1">Watch the video carefully. It will pause for questions.</p>
                 {modelLoading && (
                   <p className="text-xs text-blue-600 mt-2 flex items-center gap-2">
                     <span className="animate-spin inline-block w-3 h-3 border border-blue-600 border-t-transparent rounded-full"></span>
                     Loading AI models...
                   </p>
                 )}
              </div>
              <div className="text-right">
                <span className="block text-2xl font-bold text-gray-900">
                  {sessionState.answers.length} / {test.questions.length}
                </span>
                <span className="text-xs text-gray-400 uppercase font-medium">Questions Answered</span>
              </div>
            </div>
          )}

          {/* Start Button Overlay if video hasn't started and no questions active */}
          {!activeQuestion && videoRef.current?.paused && sessionState.answers.length === 0 && (
             <div className="mt-6 flex justify-center">
               <Button onClick={() => videoRef.current?.play()} className="px-10 py-4 text-lg">
                 Start Test
               </Button>
             </div>
          )}
          
          {/* Resume button if video paused manually or by browser policy */}
          {!activeQuestion && videoRef.current?.paused && sessionState.answers.length > 0 && (
              <div className="mt-6 flex justify-center">
                <Button onClick={() => videoRef.current?.play()}>
                  Resume Video
                </Button>
              </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TestPlayer;