'use client';

import { useMemo } from 'react';
import type { Turn, TurnStep, TurnMessageType } from '@/lib/schema/types';
import { parseWorkspaceEvent } from '@/lib/parser/turn-grouper';
import MarkdownRenderer from './MarkdownRenderer';
import ToolCallPanel from './ToolCallPanel';
import ThinkingBlock from './ThinkingBlock';
import WorkspaceEventCard from './WorkspaceEventCard';

interface Props {
  turn: Turn;
  isActive: boolean;
}

/** Visual config for each message type */
function messageTypeConfig(type: TurnMessageType | undefined) {
  switch (type) {
    case 'workspace_event':
      return {
        label: 'Workspace Event',
        labelColor: 'text-accent-orange',
        icon: '📡',
        bgClass: 'bg-accent-orange/5 border-l-2 border-l-accent-orange',
      };
    case 'context_metadata':
      return {
        label: 'User',
        labelColor: 'text-accent-green',
        icon: '📄',
        bgClass: 'bg-bg-secondary',
      };
    case 'command_prompt':
      return {
        label: 'Command Prompt',
        labelColor: 'text-accent-blue',
        icon: '⚙️',
        bgClass: 'bg-accent-blue/5 border-l-2 border-l-accent-blue',
      };
    default:
      return {
        label: 'User',
        labelColor: 'text-accent-green',
        icon: null,
        bgClass: 'bg-bg-secondary',
      };
  }
}

export default function TurnCard({ turn, isActive }: Props) {
  // Build a map of tool_use_id → tool_result for linking
  const resultMap = new Map<string, TurnStep>();
  for (const step of turn.steps) {
    if (step.type === 'tool_result' && step.toolUseId) {
      resultMap.set(step.toolUseId, step);
    }
  }

  // Filter steps to render (skip raw tool_results — they're shown inside ToolCallPanel)
  const visibleSteps = turn.steps.filter(
    s => s.type !== 'tool_result' && s.type !== 'token_usage'
  );

  const hasAgentContent = visibleSteps.length > 0 || turn.agentResponse;

  // Parse workspace event structure (memoised to avoid re-parsing on every render).
  // Defence-in-depth: try parsing any message that contains [WORKSPACE EVENTS],
  // regardless of how classifyMessage() categorised the turn.
  const parsedEvent = useMemo(
    () => turn.userMessage?.includes('[WORKSPACE EVENTS]')
      ? parseWorkspaceEvent(turn.userMessage)
      : null,
    [turn.userMessage],
  );

  // If parsing succeeded, use workspace-event styling even when the turn was
  // classified differently (e.g. as 'user').
  const effectiveType = parsedEvent ? 'workspace_event' as const : turn.messageType;
  const msgConfig = messageTypeConfig(effectiveType);

  return (
    <div
      id={`turn-${turn.index}`}
      className={`rounded-lg border transition-all duration-300 ${
        isActive
          ? 'border-accent-blue shadow-lg shadow-accent-blue/10'
          : 'border-border'
      }`}
    >
      {/* User message */}
      {turn.userMessage && (
        <div className={`px-4 py-3 rounded-t-lg border-b border-border ${msgConfig.bgClass}`}>
          <div className="flex items-center gap-2 mb-2">
            {msgConfig.icon && <span className="text-xs">{msgConfig.icon}</span>}
            <span className={`${msgConfig.labelColor} text-xs font-bold uppercase tracking-wider`}>
              {msgConfig.label}
            </span>
            {parsedEvent && (
              <span className="text-accent-orange text-xs">
                {parsedEvent.agents.length} agent{parsedEvent.agents.length !== 1 ? 's' : ''}
              </span>
            )}
            {turn.timestamp && (
              <span className="text-text-muted text-xs ml-auto">
                {new Date(turn.timestamp).toLocaleTimeString()}
              </span>
            )}
          </div>
          {/* Structured rendering for workspace events, raw text for everything else */}
          {parsedEvent ? (
            <WorkspaceEventCard event={parsedEvent} />
          ) : (
            <div className="text-text-primary text-sm leading-relaxed whitespace-pre-wrap">
              {turn.userMessage}
            </div>
          )}
        </div>
      )}

      {/* Agent response + steps */}
      <div className="px-4 py-3">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-accent-purple text-xs font-bold uppercase tracking-wider">Agent</span>
          {turn.durationMs != null && turn.durationMs > 0 && (
            <span className="text-text-muted text-xs">
              {(turn.durationMs / 1000).toFixed(1)}s
            </span>
          )}
          {!turn.isComplete && (
            <span className="text-accent-orange text-xs ml-1">⏳ incomplete</span>
          )}
          <span className="text-text-muted text-xs ml-auto">
            {turn.steps.filter(s => s.type === 'tool_call').length} tool calls
          </span>
        </div>

        {/* Render steps in order, or show empty state for incomplete turns */}
        {hasAgentContent ? (
          <div className="space-y-2">
            {visibleSteps.map((step, i) => {
              switch (step.type) {
                case 'text':
                  return (
                    <div key={i} className="text-sm">
                      <MarkdownRenderer content={step.content} />
                    </div>
                  );
                case 'tool_call':
                  return (
                    <ToolCallPanel
                      key={i}
                      step={step}
                      result={step.toolUseId ? resultMap.get(step.toolUseId) : undefined}
                    />
                  );
                case 'thinking':
                  return <ThinkingBlock key={i} step={step} />;
                case 'history_summary':
                  return (
                    <div key={i} className="border border-border rounded-md p-3 my-1 bg-bg-secondary border-l-2 border-l-accent-orange">
                      <div className="text-accent-orange text-xs font-bold uppercase tracking-wider mb-1">
                        📋 Context Summary
                      </div>
                      <div className="text-text-secondary text-xs max-h-40 overflow-y-auto whitespace-pre-wrap">
                        {step.content.slice(0, 500)}{step.content.length > 500 ? '…' : ''}
                      </div>
                    </div>
                  );
                default:
                  return null;
              }
            })}
          </div>
        ) : (
          <div className="text-text-muted text-xs italic py-2">
            {!turn.isComplete
              ? 'No response — this turn was abandoned or interrupted.'
              : 'No response content.'}
          </div>
        )}
      </div>
    </div>
  );
}

