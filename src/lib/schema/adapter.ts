// =============================================================================
// Schema adapter — the SINGLE place that maps raw JSON → canonical types.
// When the session JSON format changes, only this file needs updating.
// =============================================================================

import type { RawSession, RawChatEntry, RawRequestNode, RawResponseNode } from './raw-types';
import type { Session, SessionListItem, TurnStep, StepType } from './types';

/** Schema version tag — bump when the raw format changes */
export const SCHEMA_VERSION = '1.0.0';

// ---------------------------------------------------------------------------
// Session-level mapping
// ---------------------------------------------------------------------------

/** Extract a usable title from the session, handling packed-history format */
export function extractTitle(raw: RawSession): string {
  if (raw.title) return raw.title;

  const firstMsg = raw.chatHistory?.[0]?.exchange?.request_message ?? '';
  if (!firstMsg) return 'Untitled';

  // Packed conversation-history: extract the current message after delimiter
  const HISTORY_PREFIX = 'Conversation History:\n';
  const HISTORY_DELIMITER = '---\n\nCurrent message:\n';
  if (firstMsg.startsWith(HISTORY_PREFIX) && firstMsg.includes(HISTORY_DELIMITER)) {
    const delimIdx = firstMsg.indexOf(HISTORY_DELIMITER);
    const currentMsg = firstMsg.substring(delimIdx + HISTORY_DELIMITER.length).trim();
    return currentMsg.substring(0, 200) || 'Untitled';
  }

  return firstMsg.substring(0, 200) || 'Untitled';
}

export function adaptSession(raw: RawSession, turnCount: number): Session {
  return {
    id: raw.sessionId,
    title: extractTitle(raw),
    created: raw.created,
    modified: raw.modified,
    modelId: raw.agentState?.modelId ?? 'unknown',
    totalExchanges: raw.chatHistory?.length ?? 0,
    totalTurns: turnCount,
  };
}

export function adaptSessionListItem(raw: RawSession, turnCount: number): SessionListItem {
  return {
    id: raw.sessionId,
    title: extractTitle(raw),
    created: raw.created,
    modified: raw.modified,
    totalTurns: turnCount,
    modelId: raw.agentState?.modelId ?? 'unknown',
  };
}

// ---------------------------------------------------------------------------
// Step-level mapping  (request nodes + response nodes → TurnStep[])
// ---------------------------------------------------------------------------

export function adaptResponseNode(node: RawResponseNode): TurnStep | null {
  switch (node.type) {
    case 0: // text
      if (!node.content?.trim()) return null;
      return {
        type: 'text' as StepType,
        content: node.content ?? '',
        timestamp: node.timestamp_ms,
      };

    case 5: // tool_use
      if (!node.tool_use) return null;
      return {
        type: 'tool_call' as StepType,
        content: '',
        toolName: node.tool_use.tool_name,
        toolInput: node.tool_use.input_json,
        toolUseId: node.tool_use.tool_use_id,
        timestamp: node.timestamp_ms,
      };

    case 8: // thinking
      if (!node.thinking?.summary) return null;
      return {
        type: 'thinking' as StepType,
        content: '',
        thinkingSummary: node.thinking.summary,
        timestamp: node.timestamp_ms,
      };

    case 10: // token_usage
      if (!node.token_usage) return null;
      return {
        type: 'token_usage' as StepType,
        content: JSON.stringify(node.token_usage),
        timestamp: node.timestamp_ms,
      };

    default:
      return null;
  }
}

export function adaptRequestNode(node: RawRequestNode): TurnStep | null {
  switch (node.type) {
    case 1: // tool_result
      if (!node.tool_result_node) return null;
      return {
        type: 'tool_result' as StepType,
        content: node.tool_result_node.content,
        toolUseId: node.tool_result_node.tool_use_id,
        isError: node.tool_result_node.is_error,
      };

    case 10: // history_summary
      if (!node.history_summary_node) return null;
      return {
        type: 'history_summary' as StepType,
        content: node.history_summary_node.summary_text,
      };

    default:
      // type 0 (text) and type 4 (ide_state) are metadata, not steps
      return null;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Check if a chat entry starts a new user turn (has a real user message) */
export function isUserTurnStart(entry: RawChatEntry): boolean {
  return entry.exchange.request_message.trim().length > 0;
}

