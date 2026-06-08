import { describe, it, expect } from 'vitest';
import {
  extractTitle,
  adaptSession,
  adaptSessionListItem,
  adaptResponseNode,
  adaptRequestNode,
  isUserTurnStart,
} from '../adapter';
import type { RawSession, RawChatEntry, RawRequestNode, RawResponseNode } from '../raw-types';

// ---------------------------------------------------------------------------
// Helpers — minimal factories for raw types
// ---------------------------------------------------------------------------

function makeRawSession(overrides: Partial<RawSession> = {}): RawSession {
  return {
    sessionId: 'sess-1',
    created: '2026-01-01T00:00:00Z',
    modified: '2026-01-02T00:00:00Z',
    chatHistory: [],
    ...overrides,
  };
}

function makeChatEntry(requestMessage: string, responseText = ''): RawChatEntry {
  return {
    exchange: {
      request_message: requestMessage,
      response_text: responseText,
    },
    completed: true,
    sequenceId: 1,
  };
}

// ---------------------------------------------------------------------------
// extractTitle
// ---------------------------------------------------------------------------

describe('extractTitle', () => {
  it('returns raw.title when present', () => {
    const raw = makeRawSession({ title: 'My Session' });
    expect(extractTitle(raw)).toBe('My Session');
  });

  it('returns first request_message (truncated to 200 chars) for standard format', () => {
    const msg = 'Hello, this is my first message';
    const raw = makeRawSession({ chatHistory: [makeChatEntry(msg)] });
    expect(extractTitle(raw)).toBe(msg);
  });

  it('truncates standard request_message to 200 chars', () => {
    const longMsg = 'A'.repeat(300);
    const raw = makeRawSession({ chatHistory: [makeChatEntry(longMsg)] });
    expect(extractTitle(raw)).toBe('A'.repeat(200));
  });

  it('returns "Untitled" when chatHistory is empty', () => {
    const raw = makeRawSession({ chatHistory: [] });
    expect(extractTitle(raw)).toBe('Untitled');
  });

  it('returns "Untitled" when request_message is empty string', () => {
    const raw = makeRawSession({ chatHistory: [makeChatEntry('')] });
    expect(extractTitle(raw)).toBe('Untitled');
  });

  it('extracts current message from packed-history format', () => {
    const packed =
      'Conversation History:\nUser: old message\nAssistant: old reply\n---\n\nCurrent message:\nWhat is the weather today?';
    const raw = makeRawSession({ chatHistory: [makeChatEntry(packed)] });
    expect(extractTitle(raw)).toBe('What is the weather today?');
  });

  it('does not return the full 60K+ packed string as title', () => {
    const longHistory = 'X'.repeat(60_000);
    const packed = `Conversation History:\n${longHistory}\n---\n\nCurrent message:\nShort question`;
    const raw = makeRawSession({ chatHistory: [makeChatEntry(packed)] });
    expect(extractTitle(raw)).toBe('Short question');
    expect(extractTitle(raw).length).toBeLessThanOrEqual(200);
  });

  it('truncates extracted packed-format title to 200 chars', () => {
    const longCurrent = 'B'.repeat(300);
    const packed = `Conversation History:\nsome history\n---\n\nCurrent message:\n${longCurrent}`;
    const raw = makeRawSession({ chatHistory: [makeChatEntry(packed)] });
    expect(extractTitle(raw)).toBe('B'.repeat(200));
  });
});

// ---------------------------------------------------------------------------
// adaptSession
// ---------------------------------------------------------------------------

describe('adaptSession', () => {
  it('maps all fields correctly', () => {
    const raw = makeRawSession({
      sessionId: 'sess-42',
      created: '2026-01-10T00:00:00Z',
      modified: '2026-01-11T12:00:00Z',
      title: 'Test Session',
      chatHistory: [makeChatEntry('msg1'), makeChatEntry('msg2'), makeChatEntry('msg3')],
      agentState: { modelId: 'claude-opus-4' },
    });
    const session = adaptSession(raw, 5);
    expect(session).toEqual({
      id: 'sess-42',
      title: 'Test Session',
      created: '2026-01-10T00:00:00Z',
      modified: '2026-01-11T12:00:00Z',
      modelId: 'claude-opus-4',
      totalExchanges: 3,
      totalTurns: 5,
    });
  });

  it('uses "unknown" when modelId is missing', () => {
    const raw = makeRawSession({ agentState: undefined });
    const session = adaptSession(raw, 0);
    expect(session.modelId).toBe('unknown');
  });

  it('uses "unknown" when agentState exists but modelId is undefined', () => {
    const raw = makeRawSession({ agentState: {} });
    const session = adaptSession(raw, 0);
    expect(session.modelId).toBe('unknown');
  });

  it('counts totalExchanges from chatHistory length', () => {
    const raw = makeRawSession({
      chatHistory: [makeChatEntry('a'), makeChatEntry('b')],
    });
    const session = adaptSession(raw, 1);
    expect(session.totalExchanges).toBe(2);
  });

  it('sets totalExchanges to 0 when chatHistory is empty', () => {
    const raw = makeRawSession({ chatHistory: [] });
    const session = adaptSession(raw, 0);
    expect(session.totalExchanges).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// adaptSessionListItem
// ---------------------------------------------------------------------------

describe('adaptSessionListItem', () => {
  it('maps all fields correctly', () => {
    const raw = makeRawSession({
      sessionId: 'sess-99',
      created: '2026-02-01T00:00:00Z',
      modified: '2026-02-02T00:00:00Z',
      title: 'List Item Title',
      agentState: { modelId: 'claude-sonnet-4' },
    });
    const item = adaptSessionListItem(raw, 7);
    expect(item).toEqual({
      id: 'sess-99',
      title: 'List Item Title',
      created: '2026-02-01T00:00:00Z',
      modified: '2026-02-02T00:00:00Z',
      totalTurns: 7,
      modelId: 'claude-sonnet-4',
    });
  });

  it('uses extractTitle for title (falls back to first message)', () => {
    const raw = makeRawSession({
      chatHistory: [makeChatEntry('First user message')],
    });
    const item = adaptSessionListItem(raw, 1);
    expect(item.title).toBe('First user message');
  });
});

// ---------------------------------------------------------------------------
// adaptResponseNode
// ---------------------------------------------------------------------------

describe('adaptResponseNode', () => {
  it('type=0 (text) returns TurnStep with type "text"', () => {
    const node: RawResponseNode = { id: 1, type: 0, content: 'Hello world', timestamp_ms: 1000 };
    const step = adaptResponseNode(node);
    expect(step).toEqual({
      type: 'text',
      content: 'Hello world',
      timestamp: 1000,
    });
  });

  it('type=0 with empty content returns null', () => {
    const node: RawResponseNode = { id: 1, type: 0, content: '' };
    expect(adaptResponseNode(node)).toBeNull();
  });

  it('type=0 with whitespace-only content returns null', () => {
    const node: RawResponseNode = { id: 1, type: 0, content: '   \n\t  ' };
    expect(adaptResponseNode(node)).toBeNull();
  });

  it('type=0 with undefined content returns null', () => {
    const node: RawResponseNode = { id: 1, type: 0 };
    expect(adaptResponseNode(node)).toBeNull();
  });

  it('type=5 (tool_use) returns TurnStep with type "tool_call"', () => {
    const node: RawResponseNode = {
      id: 2,
      type: 5,
      tool_use: {
        tool_use_id: 'tu-1',
        tool_name: 'read_file',
        input_json: '{"path":"foo.ts"}',
      },
      timestamp_ms: 2000,
    };
    const step = adaptResponseNode(node);
    expect(step).toEqual({
      type: 'tool_call',
      content: '',
      toolName: 'read_file',
      toolInput: '{"path":"foo.ts"}',
      toolUseId: 'tu-1',
      timestamp: 2000,
    });
  });

  it('type=5 with null tool_use returns null', () => {
    const node: RawResponseNode = { id: 2, type: 5, tool_use: null };
    expect(adaptResponseNode(node)).toBeNull();
  });

  it('type=8 (thinking) returns TurnStep with type "thinking"', () => {
    const node: RawResponseNode = {
      id: 3,
      type: 8,
      thinking: { summary: 'Let me think about this...' },
      timestamp_ms: 3000,
    };
    const step = adaptResponseNode(node);
    expect(step).toEqual({
      type: 'thinking',
      content: '',
      thinkingSummary: 'Let me think about this...',
      timestamp: 3000,
    });
  });

  it('type=8 with null thinking returns null', () => {
    const node: RawResponseNode = { id: 3, type: 8, thinking: null };
    expect(adaptResponseNode(node)).toBeNull();
  });

  it('type=8 with empty summary returns null', () => {
    const node: RawResponseNode = { id: 3, type: 8, thinking: { summary: '' } };
    expect(adaptResponseNode(node)).toBeNull();
  });

  it('type=10 (token_usage) returns TurnStep with type "token_usage"', () => {
    const usage = { input_tokens: 100, output_tokens: 50 };
    const node: RawResponseNode = {
      id: 4,
      type: 10,
      token_usage: usage,
      timestamp_ms: 4000,
    };
    const step = adaptResponseNode(node);
    expect(step).toEqual({
      type: 'token_usage',
      content: JSON.stringify(usage),
      timestamp: 4000,
    });
  });

  it('type=10 with null token_usage returns null', () => {
    const node: RawResponseNode = { id: 4, type: 10, token_usage: null };
    expect(adaptResponseNode(node)).toBeNull();
  });

  it('unknown type returns null', () => {
    const node: RawResponseNode = { id: 5, type: 99 };
    expect(adaptResponseNode(node)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// adaptRequestNode
// ---------------------------------------------------------------------------

describe('adaptRequestNode', () => {
  it('type=1 (tool_result) returns TurnStep with type "tool_result"', () => {
    const node: RawRequestNode = {
      id: 10,
      type: 1,
      tool_result_node: {
        tool_use_id: 'tu-1',
        content: 'file contents here',
        is_error: false,
      },
    };
    const step = adaptRequestNode(node);
    expect(step).toEqual({
      type: 'tool_result',
      content: 'file contents here',
      toolUseId: 'tu-1',
      isError: false,
    });
  });

  it('type=1 (tool_result) with is_error=true sets isError', () => {
    const node: RawRequestNode = {
      id: 11,
      type: 1,
      tool_result_node: {
        tool_use_id: 'tu-2',
        content: 'Error: file not found',
        is_error: true,
      },
    };
    const step = adaptRequestNode(node);
    expect(step).not.toBeNull();
    expect(step!.isError).toBe(true);
  });

  it('type=1 with undefined tool_result_node returns null', () => {
    const node: RawRequestNode = { id: 12, type: 1 };
    expect(adaptRequestNode(node)).toBeNull();
  });

  it('type=10 (history_summary) returns TurnStep with type "history_summary"', () => {
    const node: RawRequestNode = {
      id: 20,
      type: 10,
      history_summary_node: { summary_text: 'Summary of previous conversation' },
    };
    const step = adaptRequestNode(node);
    expect(step).toEqual({
      type: 'history_summary',
      content: 'Summary of previous conversation',
    });
  });

  it('type=10 with undefined history_summary_node returns null', () => {
    const node: RawRequestNode = { id: 21, type: 10 };
    expect(adaptRequestNode(node)).toBeNull();
  });

  it('type=0 (text) returns null — metadata, not a step', () => {
    const node: RawRequestNode = { id: 30, type: 0 };
    expect(adaptRequestNode(node)).toBeNull();
  });

  it('type=4 (ide_state) returns null — metadata, not a step', () => {
    const node: RawRequestNode = { id: 40, type: 4 };
    expect(adaptRequestNode(node)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// isUserTurnStart
// ---------------------------------------------------------------------------

describe('isUserTurnStart', () => {
  it('returns true for non-empty request_message', () => {
    const entry = makeChatEntry('Hello, help me with this');
    expect(isUserTurnStart(entry)).toBe(true);
  });

  it('returns false for empty request_message', () => {
    const entry = makeChatEntry('');
    expect(isUserTurnStart(entry)).toBe(false);
  });

  it('returns false for whitespace-only request_message', () => {
    const entry = makeChatEntry('   \n\t  ');
    expect(isUserTurnStart(entry)).toBe(false);
  });
});
