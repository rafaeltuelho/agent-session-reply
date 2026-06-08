'use client';

import { useRef, useState } from 'react';
import { useSession } from '@/lib/session-context';

export default function SessionList() {
  const { loading, error, loadFromJson, loadFromUrl, loadMultipleFromJson, selectSession, sourceUrl, failedRawUrl, sessionList, clear } = useSession();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const [urlInput, setUrlInput] = useState('');

  const readFiles = (files: FileList | File[]) => {
    const fileArray = Array.from(files).filter(f => f.name.endsWith('.json'));
    if (fileArray.length === 0) return;

    // Single file with no existing list → direct to replay (existing behavior)
    if (fileArray.length === 1 && sessionList.length === 0) {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          loadFromJson(reader.result);
        }
      };
      reader.onerror = () => loadFromJson('INVALID');
      reader.readAsText(fileArray[0]);
      return;
    }

    // Multiple files or adding to existing list → parse all and show list
    let completed = 0;
    const results: string[] = [];

    for (const file of fileArray) {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          results.push(reader.result);
        }
        completed++;
        if (completed === fileArray.length) {
          loadMultipleFromJson(results);
        }
      };
      reader.onerror = () => {
        completed++;
        if (completed === fileArray.length) {
          loadMultipleFromJson(results);
        }
      };
      reader.readAsText(file);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    e.target.value = '';
    readFiles(files);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dropZoneRef.current?.classList.remove('border-accent-purple');
    const files = Array.from(e.dataTransfer.files).filter(f => f.name.endsWith('.json'));
    if (files.length > 0) {
      readFiles(files);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dropZoneRef.current?.classList.add('border-accent-purple');
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dropZoneRef.current?.classList.remove('border-accent-purple');
  };

  // ---- Session list view (when multiple files have been loaded) ----
  if (sessionList.length > 0 && !loading) {
    return (
      <div className="min-h-screen flex flex-col">
        {/* Header */}
        <header className="bg-bg-secondary border-b border-border px-6 py-6">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-xl font-bold text-text-primary flex items-center gap-2.5">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="text-accent-purple">
                <polygon points="6 3 20 12 6 21" />
              </svg>
              Augment Session Replay
            </h1>
            <p className="text-text-muted text-sm mt-1">
              {sessionList.length} session{sessionList.length !== 1 ? 's' : ''} loaded — select one to replay
            </p>
          </div>
        </header>

        <main className="flex-1 p-6">
          <div className="max-w-4xl mx-auto">
            {/* Action bar */}
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg
                           bg-bg-secondary text-text-muted border border-border
                           hover:text-text-primary hover:border-accent-purple/40
                           transition-all cursor-pointer"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Add more files
              </button>
              <button
                onClick={clear}
                className="text-xs text-text-muted hover:text-accent-red transition-colors cursor-pointer bg-transparent border-none p-0"
              >
                Clear all
              </button>
            </div>

            {/* Session list - also a drop zone */}
            <div
              ref={dropZoneRef}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              className="space-y-2"
            >
              {sessionList.map((ps) => (
                <button
                  key={ps.session.id}
                  onClick={() => selectSession(ps.session.id)}
                  className="w-full text-left p-4 rounded-lg border border-border bg-bg-secondary
                             hover:border-accent-purple/50 hover:bg-bg-secondary/80
                             transition-all cursor-pointer group"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-text-primary text-sm truncate group-hover:text-accent-purple transition-colors">
                        {ps.session.title}
                      </div>
                      {ps.firstUserMessage && (
                        <div className="text-text-muted text-xs mt-1 line-clamp-2">
                          {ps.firstUserMessage}
                        </div>
                      )}
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <div className="text-text-muted text-xs">
                        {ps.session.totalTurns} turn{ps.session.totalTurns !== 1 ? 's' : ''}
                      </div>
                      <div className="text-text-muted/60 text-[10px] mt-0.5">
                        {ps.session.modelId}
                      </div>
                    </div>
                  </div>
                  {ps.session.created && (
                    <div className="text-text-muted/50 text-[10px] mt-2">
                      {new Date(ps.session.created).toLocaleString()}
                    </div>
                  )}
                </button>
              ))}
            </div>

            {/* Hidden file input for "Add more files" */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />

            {error && (
              <div className="mt-4 p-3 rounded-lg bg-accent-red/10 border border-accent-red/30 text-accent-red text-sm text-center">
                {error}
              </div>
            )}
          </div>
        </main>

        {/* Footer */}
        <footer className="bg-bg-secondary border-t border-border px-6 py-4">
          <div className="max-w-4xl mx-auto space-y-2">
            <p className="text-text-muted text-xs text-center leading-relaxed">
              Your session files are processed entirely in the browser.
              When loading from a URL, the file is fetched directly from the host — no data passes through our servers.
            </p>
            <p className="text-text-muted/60 text-[10px] text-center">
              Augment Session Replay
            </p>
          </div>
        </footer>
      </div>
    );
  }

  // ---- File picker view (default, no sessions loaded yet) ----
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-bg-secondary border-b border-border px-6 py-6">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-xl font-bold text-text-primary flex items-center gap-2.5">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="text-accent-purple">
              <polygon points="6 3 20 12 6 21" />
            </svg>
            Augment Session Replay
          </h1>
          <p className="text-text-muted text-sm mt-1">
            Open a session JSON file to replay the conversation
          </p>
        </div>
      </header>

      {/* File picker */}
      <main className="flex-1 p-6 flex items-center justify-center">
        <div className="max-w-lg w-full">
          {loading ? (
            <div className="text-accent-blue animate-pulse text-center py-12">
              <div className="text-lg mb-2">
                {sourceUrl ? 'Fetching session…' : 'Parsing session…'}
              </div>
              {sourceUrl && (
                <div className="text-text-muted text-xs break-all max-w-md mx-auto">
                  {sourceUrl}
                </div>
              )}
            </div>
          ) : (
            <>
              <div
                ref={dropZoneRef}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-border rounded-xl p-12
                           hover:border-accent-purple/60 hover:bg-bg-secondary/50
                           transition-all cursor-pointer text-center"
              >
                <div className="text-4xl mb-4">📂</div>
                <div className="text-text-primary font-medium mb-2">
                  Drop session JSON files here
                </div>
                <div className="text-text-muted text-sm mb-4">
                  or click to browse
                </div>
                <button
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-lg
                             bg-accent-purple/20 text-accent-purple border border-accent-purple/30
                             hover:bg-accent-purple/30 hover:border-accent-purple/50
                             hover:shadow-lg hover:shadow-accent-purple/10
                             active:scale-[0.98] transition-all duration-150 cursor-pointer"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                  </svg>
                  Open Session File
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>

              {/* Divider */}
              <div className="flex items-center gap-3 my-6">
                <div className="flex-1 border-t border-border" />
                <span className="text-text-muted text-xs uppercase tracking-wider">or load from URL</span>
                <div className="flex-1 border-t border-border" />
              </div>

              {/* URL input */}
              <div className="flex gap-2">
                <input
                  type="url"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && urlInput.trim()) {
                      loadFromUrl(urlInput.trim());
                    }
                  }}
                  placeholder="https://github.com/user/repo/blob/main/session.json"
                  className="flex-1 px-4 py-2.5 text-sm rounded-lg
                             bg-bg-primary border border-border
                             text-text-primary placeholder:text-text-muted/50
                             focus:outline-none focus:border-accent-purple/60 focus:ring-1 focus:ring-accent-purple/30
                             transition-colors"
                />
                <button
                  onClick={() => {
                    if (urlInput.trim()) {
                      loadFromUrl(urlInput.trim());
                    }
                  }}
                  disabled={!urlInput.trim()}
                  className="px-4 py-2.5 text-sm font-medium rounded-lg
                             bg-accent-purple/20 text-accent-purple border border-accent-purple/30
                             hover:bg-accent-purple/30 hover:border-accent-purple/50
                             disabled:opacity-40 disabled:cursor-not-allowed
                             active:scale-[0.98] transition-all duration-150 cursor-pointer"
                >
                  Load
                </button>
              </div>

              {error && (
                <div className="mt-4 p-3 rounded-lg bg-accent-red/10 border border-accent-red/30 text-accent-red text-sm text-center">
                  <div>{error}</div>
                  {failedRawUrl && (
                    <div className="mt-2 text-text-muted text-xs">
                      Try downloading the file directly and dropping it above:{' '}
                      <a
                        href={failedRawUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-accent-blue hover:underline break-all"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {failedRawUrl}
                      </a>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-bg-secondary border-t border-border px-6 py-4">
        <div className="max-w-4xl mx-auto space-y-2">
          <p className="text-text-muted text-xs text-center leading-relaxed">
            Your session file is processed entirely in the browser.
            When loading from a URL, the file is fetched directly from the host — no data passes through our servers.
          </p>
          <p className="text-text-muted/60 text-[10px] text-center">
            Augment Session Replay
          </p>
        </div>
      </footer>
    </div>
  );
}

