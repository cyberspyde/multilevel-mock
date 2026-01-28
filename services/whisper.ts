/**
 * Whisper Speech-to-Text Service
 * Uses Transformers.js to run Whisper models directly in the browser
 * Optimized for GTX 1650 (4GB VRAM) with quantized models
 *
 * Available models from Hugging Face via Xenova:
 * - Xenova/whisper-tiny (39M params) - Fastest, lowest quality
 * - Xenova/whisper-small (244M params) - Good balance of speed and quality
 * - Xenova/whisper-base (74M params) - Between tiny and small
 * - Xenova/whisper-medium (769M params) - Slower, better quality
 */

import { pipeline, env } from '@xenova/transformers';

// Configure environment to use browser cache
env.allowLocalModels = false;
env.useBrowserCache = true;

// Singleton instance of the pipeline
let whisperPipeline: any = null;
let currentModel: string = '';
let isInitializing = false;
let initPromise: Promise<any> | null = null;

// Available Whisper models from Hugging Face (Xenova quantized versions)
export type WhisperModel = 'tiny' | 'base' | 'small' | 'medium';

export interface WhisperModelConfig {
  name: WhisperModel;
  modelId: string;
  params: string;
  description: string;
}

export const WHISPER_MODELS: Record<WhisperModel, WhisperModelConfig> = {
  tiny: {
    name: 'tiny',
    modelId: 'Xenova/whisper-tiny',
    params: '39M',
    description: 'Fastest, lowest quality (~1GB VRAM)',
  },
  base: {
    name: 'base',
    modelId: 'Xenova/whisper-base',
    params: '74M',
    description: 'Balanced speed and quality (~1GB VRAM)',
  },
  small: {
    name: 'small',
    modelId: 'Xenova/whisper-small',
    params: '244M',
    description: 'Good quality, moderate speed (~2GB VRAM)',
  },
  medium: {
    name: 'medium',
    modelId: 'Xenova/whisper-medium',
    params: '769M',
    description: 'Best quality, slower (~3GB VRAM)',
  },
};

// Default model (can be overridden via environment variable)
const DEFAULT_MODEL: WhisperModel = (process.env.NEXT_PUBLIC_WHISPER_MODEL as WhisperModel) || 'small';

/**
 * Initialize the Whisper pipeline with specified model
 * @param model - Model variant to use (tiny, base, small, medium)
 */
export const initializeWhisper = async (model: WhisperModel = DEFAULT_MODEL): Promise<any> => {
  const modelConfig = WHISPER_MODELS[model];

  // Return existing pipeline if same model
  if (whisperPipeline && currentModel === model) {
    return whisperPipeline;
  }

  // Reinitialize if different model
  if (whisperPipeline && currentModel !== model) {
    console.log(`Switching from ${currentModel} to ${model} model...`);
    clearWhisper();
  }

  if (isInitializing && initPromise) {
    return initPromise;
  }

  isInitializing = true;
  currentModel = model;

  initPromise = (async () => {
    try {
      console.log(`Initializing Whisper ${model} model (${modelConfig.description})...`);
      // Using quantized models from Hugging Face via Xenova
      whisperPipeline = await pipeline('automatic-speech-recognition', modelConfig.modelId, {
        progress_callback: (progress: any) => {
          if (progress.status === 'downloading') {
            console.log(`Downloading ${model} model: ${progress.progress}%`);
          } else if (progress.status === 'loading') {
            console.log(`Loading ${model} model into memory...`);
          }
        }
      });
      console.log(`Whisper ${model} model initialized successfully!`);
      return whisperPipeline;
    } catch (error) {
      console.error('Failed to initialize Whisper:', error);
      throw error;
    } finally {
      isInitializing = false;
    }
  })();

  return initPromise;
};

/**
 * Transcribe audio blob to text using Whisper
 * @param audioBlob - Audio blob from MediaRecorder
 * @returns Transcribed text
 */
export const transcribeAudio = async (audioBlob: Blob): Promise<string> => {
  try {
    // Ensure pipeline is initialized
    const pipeline = await initializeWhisper();

    // Convert blob to audio context for processing
    const audioContext = new AudioContext({ sampleRate: 16000 });
    const arrayBuffer = await audioBlob.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    // Get audio data as Float32Array
    const audioData = audioBuffer.getChannelData(0);

    // Sample rate conversion if necessary (Whisper expects 16kHz)
    const targetSampleRate = 16000;
    let processedAudio = audioData;

    if (audioBuffer.sampleRate !== targetSampleRate) {
      const ratio = audioBuffer.sampleRate / targetSampleRate;
      const newLength = Math.round(audioData.length / ratio);
      processedAudio = new Float32Array(newLength);
      for (let i = 0; i < newLength; i++) {
        const srcIndex = Math.floor(i * ratio);
        processedAudio[i] = audioData[srcIndex];
      }
    }

    // Run transcription
    console.log('Transcribing audio...');
    const result = await pipeline(processedAudio, {
      chunk_length_s: 30,
      stride_length_s: 5,
      language: 'english',
      task: 'transcribe',
      return_timestamps: false,
    });

    const text = result?.text || '';
    console.log('Transcription complete:', text);
    return text.trim();

  } catch (error) {
    console.error('Whisper transcription error:', error);
    throw new Error(`Transcription failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

/**
 * Check if Whisper is ready for use
 */
export const isWhisperReady = (): boolean => {
  return whisperPipeline !== null;
};

/**
 * Get the current loaded model name
 */
export const getCurrentModel = (): WhisperModel => {
  return currentModel as WhisperModel || DEFAULT_MODEL;
};

/**
 * Preload the Whisper model in the background
 * Useful to call when the app starts to avoid wait time during first use
 */
export const preloadWhisper = async (model?: WhisperModel): Promise<void> => {
  try {
    await initializeWhisper(model);
  } catch (error) {
    console.warn('Failed to preload Whisper:', error);
  }
};

/**
 * Clear the Whisper pipeline from memory
 * Useful for cleanup or if you need to reinitialize
 */
export const clearWhisper = (): void => {
  whisperPipeline = null;
  initPromise = null;
  isInitializing = false;
  currentModel = '';
};
