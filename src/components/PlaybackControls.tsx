'use client';

import { useEffect, useRef, useCallback } from 'react';

interface Props {
  currentTurn: number;
  totalTurns: number;
  isPlaying: boolean;
  playbackSpeed: number;
  onPlay: () => void;
  onPause: () => void;
  onStepForward: () => void;
  onStepBackward: () => void;
  onSkipToStart: () => void;
  onSkipToEnd: () => void;
  onSpeedChange: (speed: number) => void;
  onSeek: (turn: number) => void;
}

const SPEEDS = [0.5, 1, 2, 4];

export default function PlaybackControls({
  currentTurn,
  totalTurns,
  isPlaying,
  playbackSpeed,
  onPlay,
  onPause,
  onStepForward,
  onStepBackward,
  onSkipToStart,
  onSkipToEnd,
  onSpeedChange,
  onSeek,
}: Props) {
  const progressRef = useRef<HTMLDivElement>(null);

  // Keyboard shortcuts
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement) return;
    switch (e.key) {
      case ' ':
        e.preventDefault();
        isPlaying ? onPause() : onPlay();
        break;
      case 'ArrowRight':
        e.preventDefault();
        onStepForward();
        break;
      case 'ArrowLeft':
        e.preventDefault();
        onStepBackward();
        break;
      case 'Home':
        e.preventDefault();
        onSkipToStart();
        break;
      case 'End':
        e.preventDefault();
        onSkipToEnd();
        break;
    }
  }, [isPlaying, onPlay, onPause, onStepForward, onStepBackward, onSkipToStart, onSkipToEnd]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const handleProgressClick = (e: React.MouseEvent) => {
    if (!progressRef.current) return;
    const rect = progressRef.current.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    onSeek(Math.round(pct * (totalTurns - 1)));
  };

  const progress = totalTurns > 1 ? (currentTurn / (totalTurns - 1)) * 100 : 0;

  return (
    <div className="bg-bg-secondary border-t border-border px-4 py-3">
      {/* Progress bar */}
      <div
        ref={progressRef}
        onClick={handleProgressClick}
        className="w-full h-1.5 bg-bg-tertiary rounded-full cursor-pointer mb-3 group"
      >
        <div
          className="h-full bg-accent-blue rounded-full transition-all duration-200 relative"
          style={{ width: `${progress}%` }}
        >
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-accent-blue rounded-full
                          opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </div>

      {/* Controls row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <Btn onClick={onSkipToStart} title="Skip to start (Home)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="19 20 9 12 19 4" /><line x1="5" y1="4" x2="5" y2="20" /></svg>
          </Btn>
          <Btn onClick={onStepBackward} title="Step backward (←)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="19 20 9 12 19 4" /><line x1="5" y1="4" x2="5" y2="20" /></svg>
          </Btn>
          <Btn
            onClick={isPlaying ? onPause : onPlay}
            title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
            accent
          >
            {isPlaying ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 3 20 12 6 21" /></svg>
            )}
          </Btn>
          <Btn onClick={onStepForward} title="Step forward (→)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 4 15 12 5 20" /><line x1="19" y1="4" x2="19" y2="20" /></svg>
          </Btn>
          <Btn onClick={onSkipToEnd} title="Skip to end (End)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="5 4 15 12 5 20" /><line x1="19" y1="4" x2="19" y2="20" /></svg>
          </Btn>
        </div>

        <div className="text-text-secondary text-xs tabular-nums">
          Turn {currentTurn + 1} / {totalTurns}
        </div>

        <div className="flex items-center gap-0.5 bg-bg-tertiary/50 rounded-lg p-0.5">
          {SPEEDS.map(s => (
            <button
              key={s}
              onClick={() => onSpeedChange(s)}
              className={`px-2.5 py-1 text-xs rounded-md transition-all duration-150 cursor-pointer ${
                playbackSpeed === s
                  ? 'bg-accent-blue text-bg-primary font-semibold shadow-sm'
                  : 'text-text-muted hover:text-text-secondary hover:bg-bg-hover/60'
              }`}
            >
              {s}×
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function Btn({ children, onClick, title, accent }: {
  children: React.ReactNode; onClick: () => void; title: string; accent?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`w-9 h-9 flex items-center justify-center rounded-lg transition-all duration-150 cursor-pointer ${
        accent
          ? 'bg-accent-blue text-bg-primary hover:bg-accent-blue/80 shadow-md shadow-accent-blue/25 hover:shadow-lg hover:shadow-accent-blue/30 hover:scale-105'
          : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover/80 active:scale-95'
      }`}
    >
      {children}
    </button>
  );
}

