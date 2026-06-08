'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import TurnCard from './TurnCard';
import PlaybackControls from './PlaybackControls';
import Timeline from './Timeline';
import { useSession } from '@/lib/session-context';

export default function SessionReplay() {
  const { session, turns, clear, sessionList, backToList } = useSession();
  const [currentTurn, setCurrentTurn] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const conversationRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to current turn
  useEffect(() => {
    const el = document.getElementById(`turn-${currentTurn}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [currentTurn]);

  // Playback timer
  useEffect(() => {
    if (isPlaying && currentTurn < turns.length - 1) {
      const delay = 3000 / playbackSpeed;
      timerRef.current = setTimeout(() => {
        setCurrentTurn(prev => prev + 1);
      }, delay);
    } else if (isPlaying && currentTurn >= turns.length - 1) {
      setIsPlaying(false);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isPlaying, currentTurn, playbackSpeed, turns.length]);

  const onPlay = useCallback(() => {
    if (currentTurn >= turns.length - 1) setCurrentTurn(0);
    setIsPlaying(true);
  }, [currentTurn, turns.length]);
  const onPause = useCallback(() => setIsPlaying(false), []);
  const onStepForward = useCallback(() => {
    setIsPlaying(false);
    setCurrentTurn(prev => Math.min(prev + 1, turns.length - 1));
  }, [turns.length]);
  const onStepBackward = useCallback(() => {
    setIsPlaying(false);
    setCurrentTurn(prev => Math.max(prev - 1, 0));
  }, []);
  const onSkipToStart = useCallback(() => { setIsPlaying(false); setCurrentTurn(0); }, []);
  const onSkipToEnd = useCallback(() => {
    setIsPlaying(false);
    setCurrentTurn(turns.length - 1);
  }, [turns.length]);
  const onSeek = useCallback((turn: number) => {
    setIsPlaying(false);
    setCurrentTurn(Math.max(0, Math.min(turn, turns.length - 1)));
  }, [turns.length]);

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="bg-bg-secondary border-b border-border px-4 py-3 shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <button
              onClick={sessionList.length > 0 ? backToList : clear}
              className="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-accent-blue
                         cursor-pointer bg-transparent border-none p-0 transition-colors duration-150 group"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                   className="transition-transform duration-150 group-hover:-translate-x-0.5">
                <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
              </svg>
              {sessionList.length > 0 ? '← Back to list' : 'Open another file'}
            </button>
            <h1 className="text-sm font-bold text-text-primary mt-1 truncate max-w-2xl">
              {session?.title}
            </h1>
          </div>
          <div className="text-text-muted text-xs text-right">
            <div>{session?.modelId}</div>
            <div>{session?.created ? new Date(session.created).toLocaleDateString() : ''}</div>
          </div>
        </div>
      </header>

      {turns.length === 0 ? (
        /* Empty state */
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-3">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
                 strokeLinecap="round" strokeLinejoin="round" className="mx-auto text-text-muted/40">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <p className="text-text-muted text-sm">This session has no conversation turns.</p>
            <p className="text-text-muted/60 text-xs">The chat history is empty.</p>
          </div>
        </div>
      ) : (
        <>
          {/* Main content */}
          <div className="flex flex-1 overflow-hidden">
            {/* Timeline sidebar */}
            <aside className="w-72 bg-bg-secondary border-r border-border shrink-0 hidden lg:block">
              <Timeline turns={turns} currentTurn={currentTurn} onSelect={onSeek} />
            </aside>

            {/* Conversation area */}
            <main ref={conversationRef} className="flex-1 overflow-y-auto p-4 space-y-4">
              {turns.slice(0, currentTurn + 1).map((turn) => (
                <TurnCard key={turn.index} turn={turn} isActive={turn.index === currentTurn} />
              ))}
            </main>
          </div>

          {/* Playback controls */}
          <PlaybackControls
            currentTurn={currentTurn}
            totalTurns={turns.length}
            isPlaying={isPlaying}
            playbackSpeed={playbackSpeed}
            onPlay={onPlay}
            onPause={onPause}
            onStepForward={onStepForward}
            onStepBackward={onStepBackward}
            onSkipToStart={onSkipToStart}
            onSkipToEnd={onSkipToEnd}
            onSpeedChange={setPlaybackSpeed}
            onSeek={onSeek}
          />
        </>
      )}
    </div>
  );
}

