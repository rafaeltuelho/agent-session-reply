'use client';

import type { ParsedWorkspaceEvent, SubAgentEvent } from '@/lib/schema/types';
import MarkdownRenderer from './MarkdownRenderer';

interface Props {
  event: ParsedWorkspaceEvent;
}

function AgentEventCard({ agent }: { agent: SubAgentEvent }) {
  return (
    <div className="border border-border rounded-md bg-bg-secondary overflow-hidden">
      {/* Agent header */}
      <div className="px-3 py-2 bg-accent-orange/8 border-b border-border flex items-center gap-2 flex-wrap">
        <span className="text-xs">🤖</span>
        <span className="text-sm font-semibold text-text-primary">{agent.agentName}</span>
        {agent.messageCount != null && (
          <span className="text-text-muted text-xs ml-auto">
            {agent.messageCount} message{agent.messageCount !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      <div className="px-3 py-2 space-y-2">
        {/* Digest badge */}
        {agent.digest && (
          <div className="flex items-start gap-2 bg-accent-green/8 border border-accent-green/20 rounded px-2.5 py-1.5">
            <span className="text-xs shrink-0 mt-0.5">✅</span>
            <span className="text-xs text-text-primary leading-relaxed">
              {agent.digest.replace(/^✅\s*/, '')}
            </span>
          </div>
        )}

        {/* Summary (collapsible if long) */}
        {agent.summary && (
          <details className="group">
            <summary className="text-xs text-text-muted cursor-pointer hover:text-text-secondary select-none">
              <span className="ml-1">Agent&apos;s Summary</span>
            </summary>
            <div className="mt-1.5 text-xs border-l-2 border-border pl-3 max-h-48 overflow-y-auto">
              <MarkdownRenderer content={agent.summary} />
            </div>
          </details>
        )}

        {/* Metadata row */}
        <div className="flex items-center gap-3 flex-wrap text-[10px] text-text-muted">
          {agent.agentId && (
            <span className="font-mono" title={agent.agentId}>
              🔗 {agent.agentId.substring(0, 20)}…
            </span>
          )}
          {agent.taskId && (
            <span className="font-mono" title={`Task: ${agent.taskId}`}>
              📋 {agent.taskId.substring(0, 8)}…
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function WorkspaceEventCard({ event }: Props) {
  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="text-xs text-text-muted italic">
        {event.header}
      </div>

      {/* Agent cards */}
      <div className="space-y-2">
        {event.agents.map((agent, i) => (
          <AgentEventCard key={i} agent={agent} />
        ))}
      </div>
    </div>
  );
}

