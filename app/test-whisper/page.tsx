'use client';

import { useState, useRef } from 'react';
import { initializeWhisper, transcribeAudio, clearWhisper, WHISPER_MODELS, type WhisperModel } from '@/services/whisper';

export default function TestWhisperPage() {
  const [selectedModel, setSelectedModel] = useState<WhisperModel>('small');
  const [isRecording, setIsRecording] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcription, setTranscription] = useState('');
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const handleInitialize = async () => {
    setIsInitializing(true);
    setError('');
    setStatus(`Initializing ${selectedModel} model...`);

    try {
      await clearWhisper(); // Clear any existing model
      await initializeWhisper(selectedModel);
      setStatus(`✅ ${WHISPER_MODELS[selectedModel].name} model initialized successfully!`);
    } catch (err: any) {
      setError(`Initialization failed: ${err.message}`);
      setStatus('');
    } finally {
      setIsInitializing(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      setStatus('Recording... Speak now!');
      setError('');
    } catch (err: any) {
      setError(`Failed to access microphone: ${err.message}`);
    }
  };

  const stopRecording = async () => {
    if (!mediaRecorderRef.current) return;

    mediaRecorderRef.current.stop();
    setIsRecording(false);
    setStatus('Processing audio...');

    mediaRecorderRef.current.onstop = async () => {
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });

      setIsTranscribing(true);
      setStatus('Transcribing with Whisper...');

      try {
        const text = await transcribeAudio(audioBlob);
        setTranscription(text);
        setStatus('✅ Transcription complete!');
      } catch (err: any) {
        setError(`Transcription failed: ${err.message}`);
        setStatus('');
      } finally {
        setIsTranscribing(false);
      }
    };
  };

  return (
    <div style={{ maxWidth: 800, margin: '40px auto', padding: '20px', fontFamily: 'system-ui' }}>
      <h1>Whisper Transcription Test</h1>
      <p>Test Whisper models from Hugging Face locally in your browser.</p>

      <div style={{ marginTop: '30px', padding: '20px', border: '1px solid #ddd', borderRadius: '8px' }}>
        <h2>Model Selection</h2>

        <div style={{ marginBottom: '20px' }}>
          <label htmlFor="model-select" style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
            Select Whisper Model:
          </label>
          <select
            id="model-select"
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value as WhisperModel)}
            disabled={isInitializing || isTranscribing}
            style={{ padding: '8px 16px', fontSize: '16px', minWidth: '200px' }}
          >
            {Object.entries(WHISPER_MODELS).map(([key, config]) => (
              <option key={key} value={key}>
                {config.name.toUpperCase()} - {config.params} - {config.description}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={handleInitialize}
            disabled={isInitializing || isTranscribing}
            style={{
              padding: '12px 24px',
              fontSize: '16px',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: isInitializing || isTranscribing ? 'not-allowed' : 'pointer',
              opacity: isInitializing || isTranscribing ? 0.6 : 1,
            }}
          >
            {isInitializing ? 'Initializing...' : 'Load Model'}
          </button>

          <button
            onClick={isRecording ? stopRecording : startRecording}
            disabled={isTranscribing}
            style={{
              padding: '12px 24px',
              fontSize: '16px',
              backgroundColor: isRecording ? '#ef4444' : '#22c55e',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: isTranscribing ? 'not-allowed' : 'pointer',
              opacity: isTranscribing ? 0.6 : 1,
            }}
          >
            {isRecording ? '⏹ Stop Recording' : '🎤 Start Recording'}
          </button>
        </div>
      </div>

      {status && (
        <div style={{
          marginTop: '20px',
          padding: '16px',
          backgroundColor: '#f0f9ff',
          border: '1px solid #0ea5e9',
          borderRadius: '6px',
          fontSize: '14px'
        }}>
          {status}
        </div>
      )}

      {error && (
        <div style={{
          marginTop: '20px',
          padding: '16px',
          backgroundColor: '#fef2f2',
          border: '1px solid #ef4444',
          borderRadius: '6px',
          color: '#991b1b',
          fontSize: '14px'
        }}>
          ❌ {error}
        </div>
      )}

      {transcription && (
        <div style={{ marginTop: '20px', padding: '20px', border: '1px solid #ddd', borderRadius: '8px' }}>
          <h2>Transcription Result</h2>
          <div style={{
            padding: '16px',
            backgroundColor: '#f9fafb',
            borderRadius: '6px',
            lineHeight: '1.6',
            fontSize: '16px'
          }}>
            {transcription || <em style={{ color: '#6b7280' }}>No transcription available</em>}
          </div>
        </div>
      )}

      <div style={{ marginTop: '30px', padding: '16px', backgroundColor: '#fef3c7', borderRadius: '6px' }}>
        <h3>ℹ️ How to use:</h3>
        <ol style={{ paddingLeft: '20px', lineHeight: '1.8' }}>
          <li>Select a Whisper model (small is recommended for testing)</li>
          <li>Click "Load Model" to initialize the model (first download may take a while)</li>
          <li>Click "Start Recording" and speak into your microphone</li>
          <li>Click "Stop Recording" to transcribe your speech</li>
        </ol>
      </div>
    </div>
  );
}
