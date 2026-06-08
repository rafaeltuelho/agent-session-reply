'use client';

import { useState } from 'react';
import type { TurnStep } from '@/lib/schema/types';

interface Props {
  step: TurnStep;
}

export default function ThinkingBlock({ step }: Props) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-border rounded-md my-1 overflow-hidden border-l-2 border-l-accent-purple">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm
                   bg-bg-secondary hover:bg-bg-hover transition-colors cursor-pointer"
      >
        <span className="text-accent-purple">💭</span>
        <span className="text-text-secondary font-medium">Thinking</span>
        <span className="ml-auto text-text-muted text-xs">
          {expanded ? '▼' : '▶'}
        </span>
      </button>

      {expanded && (
        <div className="px-3 py-2 bg-bg-tertiary text-sm text-text-secondary leading-relaxed whitespace-pre-wrap max-h-80 overflow-y-auto">
          {step.thinkingSummary}
        </div>
      )}
    </div>
  );
}

