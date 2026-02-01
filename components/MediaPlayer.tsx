'use client';

import { useEffect, useRef, useState } from 'react';

interface MediaPlayerProps {
  src: string;
  type: 'video' | 'audio';
  onEnded: () => void;
  onError?: () => void;
  autoPlay?: boolean;
  className?: string;
}

export function MediaPlayer({ src, type, onEnded, onError, autoPlay = true, className = '' }: MediaPlayerProps) {
  const mediaRef = useRef<HTMLVideoElement | HTMLAudioElement>(null);
  const [volume, setVolume] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [error, setError] = useState(false);

  // Handle play when autoPlay is triggered
  useEffect(() => {
    const media = mediaRef.current;
    if (!media || !autoPlay || hasStarted) return;

    const playMedia = async () => {
      try {
        await media.play();
        setIsPlaying(true);
        setHasStarted(true);
      } catch (err) {
        console.error('Auto-play failed:', err);
        // Auto-play might be blocked by browser, need user interaction
        setError(true);
        if (onError) onError();
      }
    };

    // Small delay to ensure media is ready
    const timer = setTimeout(playMedia, 100);
    return () => clearTimeout(timer);
  }, [autoPlay, hasStarted, onError]);

  // Handle volume change
  useEffect(() => {
    if (mediaRef.current) {
      mediaRef.current.volume = volume;
    }
  }, [volume]);

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
  };

  const handleEnded = () => {
    setIsPlaying(false);
    onEnded();
  };

  const handleError = () => {
    setError(true);
    if (onError) onError();
  };

  const handleUserStart = async () => {
    if (error && mediaRef.current) {
      try {
        await mediaRef.current.play();
        setIsPlaying(true);
        setError(false);
        setHasStarted(true);
      } catch (err) {
        console.error('Play failed:', err);
      }
    }
  };

  return (
    <div className={`media-player-container ${className}`}>
      {/* Media Element */}
      {type === 'video' ? (
        <video
          ref={mediaRef as React.RefObject<HTMLVideoElement>}
          src={src}
          className="w-full rounded-lg"
          preload="auto"
          playsInline
          onEnded={handleEnded}
          onError={handleError}
          disablePictureInPicture
          controls={false}
        />
      ) : (
        <audio
          ref={mediaRef as React.RefObject<HTMLAudioElement>}
          src={src}
          preload="auto"
          onEnded={handleEnded}
          onError={handleError}
          controls={false}
        />
      )}

      {/* Custom Controls - Only Volume */}
      <div className="mt-4 bg-slate-100 rounded-xl p-4 flex items-center justify-center">
        <div className="flex items-center gap-3 w-full max-w-xs">
          {/* Volume Icon */}
          <svg
            className="w-5 h-5 text-slate-600 flex-shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            {volume === 0 ? (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
              />
            ) : volume < 0.5 ? (
              <>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2"
                />
              </>
            ) : (
              <>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728"
                />
              </>
            )}
          </svg>

          {/* Volume Slider */}
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={volume}
            onChange={handleVolumeChange}
            className="flex-1 h-2 bg-slate-300 rounded-lg appearance-none cursor-pointer accent-blue-600"
          />

          {/* Volume Value */}
          <span className="text-sm font-medium text-slate-600 w-8 text-right">
            {Math.round(volume * 100)}%
          </span>
        </div>
      </div>

      {/* Playing Indicator */}
      {isPlaying && !error && (
        <div className="mt-3 flex items-center justify-center gap-2 text-green-600">
          <div className="w-2 h-2 bg-green-600 rounded-full animate-ping"></div>
          <span className="text-sm font-medium">
            {type === 'video' ? 'Video playing...' : 'Audio playing...'}
          </span>
        </div>
      )}

      {/* Error Message with Click to Play */}
      {error && (
        <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-4 text-center">
          <p className="text-amber-800 text-sm mb-2">
            Click to enable playback and ensure audio is enabled
          </p>
          <button
            onClick={handleUserStart}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Start {type === 'video' ? 'Video' : 'Audio'}
          </button>
        </div>
      )}
    </div>
  );
}
