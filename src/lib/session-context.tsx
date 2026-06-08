'use client';

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  Suspense,
  type ReactNode,
} from 'react';
import { useSearchParams } from 'next/navigation';
import type { RawSession } from './schema/raw-types';
import type { Session, Turn } from './schema/types';
import { adaptSession } from './schema/adapter';
import { groupTurns } from './parser/turn-grouper';
import { resolveRawUrl } from './git-url';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface ParsedSession {
  session: Session;
  turns: Turn[];
  firstUserMessage: string; // first ~200 chars of the first turn's user message
}

// ---------------------------------------------------------------------------
// Context shape
// ---------------------------------------------------------------------------

interface SessionState {
  /** Parsed session metadata (null = no session loaded) */
  session: Session | null;
  /** Grouped turns for the replay view */
  turns: Turn[];
  /** Loading indicator while parsing a large file */
  loading: boolean;
  /** Error message from the last load attempt */
  error: string | null;
  /** Load a session from a raw JSON string (read from a File in the browser) */
  loadFromJson: (json: string) => void;
  /** Load a session from a remote URL (GitHub, Gist, or any HTTPS URL) */
  loadFromUrl: (url: string) => void;
  /** The source URL if the session was loaded from a URL */
  sourceUrl: string | null;
  /** The resolved raw URL that failed to fetch (for CORS error display) */
  failedRawUrl: string | null;
  /** Clear the current session and return to the file picker */
  clear: () => void;
  /** List of parsed sessions when multiple files are loaded */
  sessionList: ParsedSession[];
  /** Load multiple session JSON strings at once */
  loadMultipleFromJson: (jsonStrings: string[]) => void;
  /** Select a session from the list for replay */
  selectSession: (id: string) => void;
  /** Go back from replay to the session list */
  backToList: () => void;
}

const SessionContext = createContext<SessionState | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [failedRawUrl, setFailedRawUrl] = useState<string | null>(null);
  const [sessionList, setSessionList] = useState<ParsedSession[]>([]);

  const loadFromJson = useCallback((json: string) => {
    setLoading(true);
    setError(null);

    // Use setTimeout(0) to let the UI show the loading state before
    // blocking the main thread with JSON.parse + turn grouping.
    setTimeout(() => {
      try {
        const raw = JSON.parse(json) as RawSession;

        if (!raw.sessionId || typeof raw.sessionId !== 'string') {
          throw new Error('Invalid session: missing sessionId');
        }
        if (!Array.isArray(raw.chatHistory)) {
          throw new Error('Invalid session: missing chatHistory array');
        }

        const grouped = groupTurns(raw);
        const meta = adaptSession(raw, grouped.length);

        setSession(meta);
        setTurns(grouped);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to parse session file');
        setSession(null);
        setTurns([]);
      } finally {
        setLoading(false);
      }
    }, 0);
  }, []);

  const loadFromUrl = useCallback(async (url: string) => {
    setLoading(true);
    setError(null);
    setSourceUrl(url);
    setFailedRawUrl(null);

    try {
      const rawUrl = resolveRawUrl(url);
      const response = await fetch(rawUrl);

      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
      }

      const text = await response.text();
      loadFromJson(text);
    } catch (e) {
      setLoading(false);
      if (e instanceof TypeError && e.message.includes('fetch')) {
        const rawUrl = (() => { try { return resolveRawUrl(url); } catch { return url; } })();
        setFailedRawUrl(rawUrl);
        setError('Unable to fetch the file. The server may not allow cross-origin requests (CORS).');
      } else {
        setError(e instanceof Error ? e.message : 'Failed to load session from URL');
      }
    }
  }, [loadFromJson]);

  const loadMultipleFromJson = useCallback((jsonStrings: string[]) => {
    setLoading(true);
    setError(null);

    setTimeout(() => {
      const parsed: ParsedSession[] = [];
      const errors: string[] = [];

      for (const json of jsonStrings) {
        try {
          const raw = JSON.parse(json) as RawSession;
          if (!raw.sessionId || typeof raw.sessionId !== 'string') {
            errors.push('Missing sessionId');
            continue;
          }
          if (!Array.isArray(raw.chatHistory)) {
            errors.push('Missing chatHistory');
            continue;
          }

          const grouped = groupTurns(raw);
          const meta = adaptSession(raw, grouped.length);
          const firstUserMessage = grouped[0]?.userMessage?.substring(0, 200) ?? '';

          // Avoid duplicates by sessionId
          if (!parsed.some(p => p.session.id === meta.id)) {
            parsed.push({ session: meta, turns: grouped, firstUserMessage });
          }
        } catch {
          errors.push('Invalid JSON');
        }
      }

      if (parsed.length === 0) {
        setError(`Failed to parse any session files (${errors.length} error(s))`);
      } else {
        // Append to existing list, avoiding duplicates
        setSessionList(prev => {
          const combined = [...prev];
          for (const p of parsed) {
            if (!combined.some(c => c.session.id === p.session.id)) {
              combined.push(p);
            }
          }
          return combined;
        });
      }

      setLoading(false);
    }, 0);
  }, []);

  const selectSession = useCallback((id: string) => {
    const found = sessionList.find(p => p.session.id === id);
    if (found) {
      setSession(found.session);
      setTurns(found.turns);
      setError(null);
    }
  }, [sessionList]);

  const backToList = useCallback(() => {
    setSession(null);
    setTurns([]);
    setError(null);
  }, []);

  const clear = useCallback(() => {
    setSession(null);
    setTurns([]);
    setError(null);
    setLoading(false);
    setSourceUrl(null);
    setFailedRawUrl(null);
    setSessionList([]);
  }, []);

  return (
    <SessionContext.Provider
      value={{ session, turns, loading, error, loadFromJson, loadFromUrl, sourceUrl, failedRawUrl, clear, sessionList, loadMultipleFromJson, selectSession, backToList }}
    >
      <Suspense fallback={children}>
        <AutoLoadFromUrl loadFromUrl={loadFromUrl} />
      </Suspense>
      {children}
    </SessionContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Inner component that reads ?file= search param and auto-loads
// ---------------------------------------------------------------------------

function AutoLoadFromUrl({ loadFromUrl }: { loadFromUrl: (url: string) => void }) {
  const searchParams = useSearchParams();

  useEffect(() => {
    const fileUrl = searchParams.get('file');
    if (fileUrl) {
      loadFromUrl(fileUrl);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useSession(): SessionState {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error('useSession must be used within a <SessionProvider>');
  }
  return ctx;
}

