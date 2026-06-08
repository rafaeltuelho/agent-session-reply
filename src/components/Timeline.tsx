'use client';

import { useMemo } from 'react';
import type { Turn } from '@/lib/schema/types';
import { parseWorkspaceEvent } from '@/lib/parser/turn-grouper';

interface Props {
  turns: Turn[];
  currentTurn: number;
  onSelect: (index: number) => void;
}

/** Get a short label for a turn in the timeline */
function getTurnLabel(turn: Turn): string {
  if (!turn.userMessage) return '(continuation)';

  // Defence-in-depth: detect workspace events by content, not only by messageType
  if (turn.userMessage.includes('[WORKSPACE EVENTS]')) {
    const parsed = parseWorkspaceEvent(turn.userMessage);
    if (parsed && parsed.agents.length > 0) {
      const names = parsed.agents.map(a => a.agentName);
      const label = names.join(', ');
      return label.length > 55 ? label.slice(0, 55) + '…' : label;
    }
  }

  const msg = turn.userMessage;
  return msg.length > 60 ? msg.slice(0, 60) + '…' : msg;
}

function TimelineItem({ turn, isActive, isPast, onSelect }: {
  turn: Turn;
  isActive: boolean;
  isPast: boolean;
  onSelect: (index: number) => void;
}) {
  const toolCount = turn.steps.filter(s => s.type === 'tool_call').length;
  const label = useMemo(() => getTurnLabel(turn), [turn]);

  return (
    <button
      onClick={() => onSelect(turn.index)}
      className={`w-full text-left px-3 py-2 rounded-md text-xs transition-all cursor-pointer ${
        isActive
          ? 'bg-accent-blue/15 border border-accent-blue/40 text-text-primary'
          : isPast
          ? 'text-text-muted hover:bg-bg-hover hover:text-text-secondary border border-transparent'
          : 'text-text-secondary hover:bg-bg-hover border border-transparent'
      }`}
    >
      <div className="flex items-center gap-2">
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
          isActive ? 'bg-accent-blue' : isPast ? 'bg-text-muted' : 'bg-border'
        }`} />
        <span className="font-medium tabular-nums text-text-muted w-5">
          {turn.index + 1}
        </span>
        {(turn.messageType === 'workspace_event' || turn.userMessage?.includes('[WORKSPACE EVENTS]')) && (
          <span className="text-[10px] shrink-0" title="Workspace Event">📡</span>
        )}
        {turn.messageType === 'command_prompt' && (
          <span className="text-[10px] shrink-0" title="Command Prompt">⚙️</span>
        )}
        {!turn.isComplete && (
          <span className="text-[10px] shrink-0" title="Incomplete">⏳</span>
        )}
        <span className="truncate flex-1">{label}</span>
      </div>
      {isActive && (
        <div className="mt-1 ml-5 flex items-center gap-2 text-text-muted">
          {toolCount > 0 && <span>🔧 {toolCount}</span>}
          {turn.timestamp && (
            <span>{new Date(turn.timestamp).toLocaleTimeString()}</span>
          )}
        </div>
      )}
    </button>
  );
}

export default function Timeline({ turns, currentTurn, onSelect }: Props) {
  return (
    <div className="h-full overflow-y-auto">
      <div className="p-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-text-muted mb-3">
          Timeline · {turns.length} turns
        </h2>
        <div className="space-y-1">
          {turns.map((turn) => (
            <TimelineItem
              key={turn.index}
              turn={turn}
              isActive={turn.index === currentTurn}
              isPast={turn.index < currentTurn}
              onSelect={onSelect}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

