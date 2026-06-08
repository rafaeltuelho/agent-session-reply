// =============================================================================
// Turn grouper — collapses raw exchanges into logical "turns".
// A turn starts when the user sends a message and includes all subsequent
// continuation exchanges (tool results, agent follow-ups) until the next
// user message.
//
// Also handles the "packed conversation history" format where the entire
// prior conversation is embedded in the first entry's request_message.
// =============================================================================

import type { RawSession, RawChatEntry } from '../schema/raw-types';
import type { Turn, TurnStep, TurnMessageType, ParsedWorkspaceEvent, SubAgentEvent } from '../schema/types';
import {
  isUserTurnStart,
  adaptResponseNode,
  adaptRequestNode,
} from '../schema/adapter';

/** Delimiter that separates conversation history from the current message */
const HISTORY_DELIMITER = '---\n\nCurrent message:\n';
const HISTORY_PREFIX = 'Conversation History:\n';

/**
 * Classify a user message by its origin/nature.
 */
export function classifyMessage(msg: string): TurnMessageType {
  const trimmed = msg.trim();
  if (trimmed.startsWith('[WORKSPACE EVENTS]')) return 'workspace_event';
  if (trimmed.startsWith('[Currently viewing')) return 'context_metadata';
  if (trimmed.startsWith('Command Description:') || trimmed.startsWith('Prompt to process:')) return 'command_prompt';
  return 'user';
}

/**
 * Parse a [WORKSPACE EVENTS] message into structured sub-agent notifications.
 * Returns null if the message is not a workspace event.
 */
export function parseWorkspaceEvent(msg: string): ParsedWorkspaceEvent | null {
  const trimmed = msg.trim();
  if (!trimmed.startsWith('[WORKSPACE EVENTS]')) return null;

  // Strip the prefix
  const body = trimmed.substring('[WORKSPACE EVENTS]'.length).trim();

  // Extract header line (e.g. "You have received 2 workspace events while you were working:")
  const headerMatch = body.match(/^(You have received .+?:)\s*\n/);
  const header = headerMatch ? headerMatch[1] : '';
  const rest = headerMatch ? body.substring(headerMatch[0].length) : body;

  // Split into numbered agent blocks: "1. [agent:idle] ..." , "2. [agent:idle] ..."
  // Each block starts with a number followed by ". [agent:"
  const agentBlocks: string[] = [];
  const blockPattern = /^(\d+)\.\s+\[agent:/gm;
  const blockStarts: number[] = [];
  let match: RegExpExecArray | null;
  while ((match = blockPattern.exec(rest)) !== null) {
    blockStarts.push(match.index);
  }

  for (let i = 0; i < blockStarts.length; i++) {
    const start = blockStarts[i];
    const end = i + 1 < blockStarts.length ? blockStarts[i + 1] : rest.length;
    agentBlocks.push(rest.substring(start, end).trim());
  }

  const agents: SubAgentEvent[] = agentBlocks.map(parseAgentBlock);

  return { header, agents };
}

/** Parse a single numbered agent block into a SubAgentEvent */
function parseAgentBlock(block: string): SubAgentEvent {
  // Extract agent name: [agent:idle] "Task Name" finished responding
  const nameMatch = block.match(/\[agent:\w+\]\s+"([^"]+)"/);
  const agentName = nameMatch ? nameMatch[1] : 'Unknown Agent';

  // Extract agentId: {{agentId:agent-UUID}}
  const agentIdMatch = block.match(/\{\{agentId:(agent-[a-f0-9-]+)\}\}/);
  const agentId = agentIdMatch ? agentIdMatch[1] : null;

  // Extract taskId: - Task: UUID
  const taskIdMatch = block.match(/- Task:\s+([a-f0-9-]+)/);
  const taskId = taskIdMatch ? taskIdMatch[1] : null;

  // Extract message count: N messages in conversation
  const msgCountMatch = block.match(/(\d+)\s+messages?\s+in\s+conversation/);
  const messageCount = msgCountMatch ? parseInt(msgCountMatch[1], 10) : null;

  // Extract digest: <agent_digest>...</agent_digest>
  const digestMatch = block.match(/<agent_digest>([\s\S]*?)<\/agent_digest>/);
  const digest = digestMatch ? digestMatch[1].trim() : null;

  // Extract task note link: [Task Note](workspaces://...) or [View Task Note](workspaces://...)
  const taskNoteMatch = block.match(/\[(?:View )?Task Note\]\((workspaces:\/\/[^)]+)\)/);
  const taskNoteLink = taskNoteMatch ? taskNoteMatch[1] : null;

  // Extract summary: everything between **Agent's Summary:** and the next structural element
  let summary = '';
  const summaryMatch = block.match(/\*\*Agent's Summary:\*\*\s*([\s\S]*?)(?=\s*(?:Use `read_agent_conversation|<agent_digest>|\[(?:View )?Task Note\]))/);
  if (summaryMatch) {
    summary = summaryMatch[1].trim();
  }

  return { agentName, agentId, taskId, messageCount, summary, digest, taskNoteLink };
}

/**
 * Detect whether a session uses the "packed conversation history" format.
 * Returns the first entry's request_message if so, otherwise null.
 */
export function detectPackedHistory(entries: RawChatEntry[]): string | null {
  if (entries.length === 0) return null;
  const msg = entries[0].exchange.request_message;
  if (msg.startsWith(HISTORY_PREFIX) && msg.includes(HISTORY_DELIMITER)) {
    return msg;
  }
  return null;
}

/**
 * Parse a packed conversation-history string into synthetic historical turns
 * plus the actual current user message.
 */
export interface ParsedHistory {
  historicalTurns: { userMessage: string; agentResponse: string }[];
  currentMessage: string;
}

export function parsePackedHistory(fullMessage: string): ParsedHistory {
  // Split on the delimiter
  const delimIdx = fullMessage.indexOf(HISTORY_DELIMITER);
  const historyPart = fullMessage.substring(HISTORY_PREFIX.length, delimIdx);
  const currentMessage = fullMessage.substring(delimIdx + HISTORY_DELIMITER.length);

  // Parse history into user/assistant pairs using line-based parsing.
  // A new "User:" turn starts when a line begins with "User: " and is
  // either at the very start or preceded by a blank line.
  const lines = historyPart.split('\n');
  const historicalTurns: { userMessage: string; agentResponse: string }[] = [];

  let currentUser = '';
  let currentAssistant = '';
  let inAssistant = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isBlankBefore = i === 0 || lines[i - 1].trim() === '';

    if (line.startsWith('User: ') && isBlankBefore) {
      // Save previous pair if we have one
      if (currentUser || currentAssistant) {
        historicalTurns.push({
          userMessage: currentUser.trim(),
          agentResponse: currentAssistant.trim(),
        });
      }
      currentUser = line.substring('User: '.length);
      currentAssistant = '';
      inAssistant = false;
    } else if ((line.startsWith('A: ') || line.startsWith('Assistant: ')) && isBlankBefore) {
      // Switch to assistant mode
      const prefix = line.startsWith('A: ') ? 'A: ' : 'Assistant: ';
      currentAssistant = line.substring(prefix.length);
      inAssistant = true;
    } else {
      // Continuation line
      if (inAssistant) {
        currentAssistant += '\n' + line;
      } else {
        currentUser += '\n' + line;
      }
    }
  }

  // Push the last pair
  if (currentUser || currentAssistant) {
    historicalTurns.push({
      userMessage: currentUser.trim(),
      agentResponse: currentAssistant.trim(),
    });
  }

  return { historicalTurns, currentMessage: currentMessage.trim() };
}

/**
 * Groups all exchanges into logical turns.
 * Returns an array of Turn objects ordered by conversation flow.
 */
export function groupTurns(raw: RawSession): Turn[] {
  const entries = raw.chatHistory ?? [];
  if (entries.length === 0) return [];

  // Check for packed conversation-history format
  const packedMsg = detectPackedHistory(entries);
  if (packedMsg) {
    return groupTurnsFromPacked(packedMsg, entries, raw);
  }

  // Standard format: group by user-turn-start boundaries
  const turnGroups: RawChatEntry[][] = [];
  let currentGroup: RawChatEntry[] = [];

  for (const entry of entries) {
    if (isUserTurnStart(entry) && currentGroup.length > 0) {
      turnGroups.push(currentGroup);
      currentGroup = [];
    }
    currentGroup.push(entry);
  }
  if (currentGroup.length > 0) {
    turnGroups.push(currentGroup);
  }

  return turnGroups.map((group, index) => buildTurn(group, index));
}

/**
 * Build turns from a packed conversation-history format session.
 */
function groupTurnsFromPacked(
  packedMsg: string,
  entries: RawChatEntry[],
  _raw: RawSession,
): Turn[] {
  const { historicalTurns, currentMessage } = parsePackedHistory(packedMsg);
  const turns: Turn[] = [];

  // Build synthetic turns for the conversation history
  for (let i = 0; i < historicalTurns.length; i++) {
    const ht = historicalTurns[i];
    turns.push({
      index: i,
      userMessage: ht.userMessage,
      agentResponse: ht.agentResponse,
      timestamp: '',
      durationMs: null,
      steps: ht.agentResponse
        ? [{ type: 'text', content: ht.agentResponse }]
        : [],
      isComplete: true,
      messageType: classifyMessage(ht.userMessage),
    });
  }

  // Build the real final turn from the current message + all entries
  // (all entries belong to this single exchange in the packed format)
  const realTurn = buildTurn(entries, historicalTurns.length);
  // Override userMessage with the extracted current message
  realTurn.userMessage = currentMessage;
  realTurn.messageType = classifyMessage(currentMessage);
  turns.push(realTurn);

  return turns;
}

/**
 * Count turns without building them (cheaper for metadata endpoints).
 */
export function countTurns(raw: RawSession): number {
  const entries = raw.chatHistory ?? [];
  if (entries.length === 0) return 0;

  // Check for packed format
  const packedMsg = detectPackedHistory(entries);
  if (packedMsg) {
    const { historicalTurns } = parsePackedHistory(packedMsg);
    return historicalTurns.length + 1; // historical + current
  }

  let count = 0;
  let hasStarted = false;

  for (const entry of entries) {
    if (isUserTurnStart(entry)) {
      if (hasStarted) count++;
      hasStarted = true;
    }
  }
  if (entries.length > 0) count++;

  return count;
}

// ---------------------------------------------------------------------------
// Internal
// ---------------------------------------------------------------------------

function buildTurn(group: RawChatEntry[], index: number): Turn {
  const first = group[0];
  const last = group[group.length - 1];

  // Collect all steps across all exchanges in this turn
  const steps: TurnStep[] = [];

  for (const entry of group) {
    const ex = entry.exchange;

    // Request nodes → steps (tool results, history summaries)
    for (const rn of ex.request_nodes ?? []) {
      const step = adaptRequestNode(rn);
      if (step) steps.push(step);
    }

    // Response nodes → steps (text, tool calls, thinking)
    for (const rn of ex.response_nodes ?? []) {
      const step = adaptResponseNode(rn);
      if (step) steps.push(step);
    }
  }

  // Collect all text steps into a combined agent response
  const agentTexts = steps
    .filter(s => s.type === 'text')
    .map(s => s.content)
    .filter(Boolean);

  // Use response_text from the first exchange as primary, fall back to collected text
  const agentResponse = first.exchange.response_text || agentTexts.join('\n\n');

  // Duration: from first exchange timestamp to last
  const firstTs = first.finishedAt ? new Date(first.finishedAt).getTime() : null;
  const lastTs = last.finishedAt ? new Date(last.finishedAt).getTime() : null;
  const durationMs = firstTs && lastTs ? lastTs - firstTs : null;

  return {
    index,
    userMessage: first.exchange.request_message,
    agentResponse,
    timestamp: first.finishedAt ?? '',
    durationMs,
    steps,
    isComplete: last.completed,
    messageType: classifyMessage(first.exchange.request_message),
  };
}

