'use client';

import { useState } from 'react';
import type { TurnStep } from '@/lib/schema/types';

interface Props {
  step: TurnStep;
  result?: TurnStep; // matching tool_result if available
}

function formatToolInput(input: string): string {
  try {
    return JSON.stringify(JSON.parse(input), null, 2);
  } catch {
    return input;
  }
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + '…' : s;
}

export default function ToolCallPanel({ step, result }: Props) {
  const [expanded, setExpanded] = useState(false);

  const toolName = step.toolName ?? 'unknown';
  const isSubAgent = toolName.startsWith('sub-agent');
  const isBrowser = toolName.includes('Chrome_Devtools');
  const isSnyk = toolName.includes('snyk') || toolName.includes('Snyk');

  // Color-code by tool category
  let dotColor = 'bg-accent-blue';
  if (isSubAgent) dotColor = 'bg-accent-purple';
  else if (isBrowser) dotColor = 'bg-accent-orange';
  else if (isSnyk) dotColor = 'bg-accent-green';

  return (
    <div className="border border-border rounded-md my-1 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm
                   bg-bg-secondary hover:bg-bg-hover transition-colors cursor-pointer"
      >
        <span className={`w-2 h-2 rounded-full ${dotColor} shrink-0`} />
        <span className="text-text-secondary font-medium">{toolName}</span>
        {result?.isError && (
          <span className="text-accent-red text-xs ml-1">ERROR</span>
        )}
        <span className="ml-auto text-text-muted text-xs">
          {expanded ? '▼' : '▶'}
        </span>
      </button>

      {expanded && (
        <div className="px-3 py-2 bg-bg-tertiary text-xs space-y-2">
          {step.toolInput && (
            <div>
              <div className="text-text-muted mb-1 uppercase tracking-wider text-[10px]">Input</div>
              <pre className="whitespace-pre-wrap break-all text-text-secondary overflow-x-auto max-h-60 overflow-y-auto">
                {formatToolInput(step.toolInput)}
              </pre>
            </div>
          )}
          {result && (
            <div>
              <div className={`mb-1 uppercase tracking-wider text-[10px] ${result.isError ? 'text-accent-red' : 'text-text-muted'}`}>
                {result.isError ? 'Error' : 'Output'}
              </div>
              <pre className="whitespace-pre-wrap break-all text-text-secondary overflow-x-auto max-h-60 overflow-y-auto">
                {truncate(result.content, 3000)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

