import { describe, it, expect } from 'vitest';
import {
  classifyMessage,
  parseWorkspaceEvent,
  detectPackedHistory,
  parsePackedHistory,
  groupTurns,
  countTurns,
} from '../turn-grouper';
import type { RawChatEntry, RawSession } from '../../schema/raw-types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEntry(overrides: Partial<RawChatEntry> & { request_message?: string; response_text?: string } = {}): RawChatEntry {
  const { request_message, response_text, ...rest } = overrides;
  return {
    exchange: {
      request_message: request_message ?? 'hello',
      response_text: response_text ?? 'world',
    },
    completed: true,
    sequenceId: 0,
    ...rest,
  } as RawChatEntry;
}

function makeSession(entries: RawChatEntry[], extra: Partial<RawSession> = {}): RawSession {
  return {
    sessionId: 'test-session',
    created: '2025-01-01T00:00:00Z',
    modified: '2025-01-01T00:00:00Z',
    chatHistory: entries,
    ...extra,
  };
}

function makePackedMessage(
  history: { user: string; assistant: string }[],
  currentMessage: string,
): string {
  let msg = 'Conversation History:\n';
  for (const h of history) {
    msg += `User: ${h.user}\n\nA: ${h.assistant}\n\n`;
  }
  msg += `---\n\nCurrent message:\n${currentMessage}`;
  return msg;
}

// ---------------------------------------------------------------------------
// classifyMessage
// ---------------------------------------------------------------------------

describe('classifyMessage', () => {
  it('classifies a normal user message as "user"', () => {
    expect(classifyMessage('How do I fix this bug?')).toBe('user');
  });

  it('classifies an empty string as "user"', () => {
    expect(classifyMessage('')).toBe('user');
  });

  it('classifies [WORKSPACE EVENTS] prefix as "workspace_event"', () => {
    expect(classifyMessage('[WORKSPACE EVENTS] file changed')).toBe('workspace_event');
  });

  it('classifies [Currently viewing prefix as "context_metadata"', () => {
    expect(classifyMessage('[Currently viewing src/index.ts]')).toBe('context_metadata');
  });

  it('classifies "Command Description:" prefix as "command_prompt"', () => {
    expect(classifyMessage('Command Description: run tests')).toBe('command_prompt');
  });

  it('classifies "Prompt to process:" prefix as "command_prompt"', () => {
    expect(classifyMessage('Prompt to process: do something')).toBe('command_prompt');
  });

  it('trims leading whitespace before classification', () => {
    expect(classifyMessage('  [WORKSPACE EVENTS] file changed')).toBe('workspace_event');
    expect(classifyMessage('\n[Currently viewing foo]')).toBe('context_metadata');
    expect(classifyMessage('\t Command Description: x')).toBe('command_prompt');
    expect(classifyMessage('   Prompt to process: y')).toBe('command_prompt');
    expect(classifyMessage('   normal message')).toBe('user');
  });
});

// ---------------------------------------------------------------------------
// parseWorkspaceEvent
// ---------------------------------------------------------------------------

describe('parseWorkspaceEvent', () => {
  it('returns null for non-workspace-event messages', () => {
    expect(parseWorkspaceEvent('Hello world')).toBeNull();
    expect(parseWorkspaceEvent('[Currently viewing foo]')).toBeNull();
    expect(parseWorkspaceEvent('')).toBeNull();
  });

  it('parses a single agent notification', () => {
    const msg = `[WORKSPACE EVENTS]
You have received 1 workspace event while you were working:

1. [agent:idle] "Verify Phase 1" finished responding {{agentId:agent-16bd60e6-13b2-47bd-bfaa-1e9e4cc88383}}
   - 2 messages in conversation

   **Agent's Summary:**
   Phase 1 is correctly implemented.

   Use \`read_agent_conversation(agentId="agent-16bd60e6-13b2-47bd-bfaa-1e9e4cc88383")\` to see their full conversation.

Consider these events and take appropriate action if needed.`;

    const result = parseWorkspaceEvent(msg);
    expect(result).not.toBeNull();
    expect(result!.header).toBe('You have received 1 workspace event while you were working:');
    expect(result!.agents).toHaveLength(1);

    const agent = result!.agents[0];
    expect(agent.agentName).toBe('Verify Phase 1');
    expect(agent.agentId).toBe('agent-16bd60e6-13b2-47bd-bfaa-1e9e4cc88383');
    expect(agent.messageCount).toBe(2);
    expect(agent.summary).toContain('Phase 1 is correctly implemented');
    expect(agent.digest).toBeNull();
    expect(agent.taskId).toBeNull();
    expect(agent.taskNoteLink).toBeNull();
  });

  it('parses multiple agent notifications with all fields', () => {
    const msg = `[WORKSPACE EVENTS]
You have received 2 workspace events while you were working:

1. [agent:idle] "Migrate Entities" finished responding {{agentId:agent-aaa-111}}
   - Task: 53435c57-e14f-4bad-9259-69245b327641
   - 2 messages in conversation

   **Agent's Summary:**
   Migrated 5 entities successfully.

   <agent_digest>✅ Migrated 5 JPA entities</agent_digest>

   [Task Note](workspaces://local/task/53435c57-e14f-4bad-9259-69245b327641)

   Use \`read_agent_conversation(agentId="agent-aaa-111")\` to see their full conversation.
2. [agent:idle] "Create Backend" finished responding {{agentId:agent-bbb-222}}
   - Task: ce10a042-ae10-4ca6-aa1a-328ad36c8fea
   - 3 messages in conversation

   **Agent's Summary:**
   Created project structure.

   [Task Note](workspaces://local/task/ce10a042-ae10-4ca6-aa1a-328ad36c8fea)

   <agent_digest>✅ Created Quarkus project</agent_digest>

   Use \`read_agent_conversation(agentId="agent-bbb-222")\` to see their full conversation.

Consider these events and take appropriate action if needed.`;

    const result = parseWorkspaceEvent(msg);
    expect(result).not.toBeNull();
    expect(result!.agents).toHaveLength(2);

    const a1 = result!.agents[0];
    expect(a1.agentName).toBe('Migrate Entities');
    expect(a1.agentId).toBe('agent-aaa-111');
    expect(a1.taskId).toBe('53435c57-e14f-4bad-9259-69245b327641');
    expect(a1.messageCount).toBe(2);
    expect(a1.digest).toBe('✅ Migrated 5 JPA entities');
    expect(a1.taskNoteLink).toBe('workspaces://local/task/53435c57-e14f-4bad-9259-69245b327641');
    expect(a1.summary).toContain('Migrated 5 entities');

    const a2 = result!.agents[1];
    expect(a2.agentName).toBe('Create Backend');
    expect(a2.agentId).toBe('agent-bbb-222');
    expect(a2.taskId).toBe('ce10a042-ae10-4ca6-aa1a-328ad36c8fea');
    expect(a2.messageCount).toBe(3);
    expect(a2.digest).toBe('✅ Created Quarkus project');
    expect(a2.taskNoteLink).toBe('workspaces://local/task/ce10a042-ae10-4ca6-aa1a-328ad36c8fea');
  });

  it('handles [View Task Note] variant link', () => {
    const msg = `[WORKSPACE EVENTS]
You have received 1 workspace event while you were working:

1. [agent:idle] "Check Integration" finished responding {{agentId:agent-ccc-333}}
   - 2 messages in conversation

   **Agent's Summary:**
   Integration verified.

   [View Task Note](workspaces://local/note/spec)

   <agent_digest>✅ Integration OK</agent_digest>

   Use \`read_agent_conversation(agentId="agent-ccc-333")\` to see their full conversation.

Consider these events and take appropriate action if needed.`;

    const result = parseWorkspaceEvent(msg);
    expect(result!.agents[0].taskNoteLink).toBe('workspaces://local/note/spec');
  });

  it('handles workspace event with no summary or digest', () => {
    const msg = `[WORKSPACE EVENTS]
You have received 1 workspace event while you were working:

1. [agent:idle] "Quick Task" finished responding {{agentId:agent-ddd-444}}
   - 1 message in conversation

   Use \`read_agent_conversation(agentId="agent-ddd-444")\` to see their full conversation.

Consider these events and take appropriate action if needed.`;

    const result = parseWorkspaceEvent(msg);
    expect(result!.agents).toHaveLength(1);
    expect(result!.agents[0].agentName).toBe('Quick Task');
    expect(result!.agents[0].messageCount).toBe(1);
    expect(result!.agents[0].summary).toBe('');
    expect(result!.agents[0].digest).toBeNull();
  });

  it('handles leading whitespace', () => {
    const msg = `  [WORKSPACE EVENTS]
You have received 1 workspace event while you were working:

1. [agent:idle] "Trimmed" finished responding {{agentId:agent-eee-555}}
   - 2 messages in conversation

   Use \`read_agent_conversation(agentId="agent-eee-555")\` to see their full conversation.`;

    const result = parseWorkspaceEvent(msg);
    expect(result).not.toBeNull();
    expect(result!.agents[0].agentName).toBe('Trimmed');
  });
});

// ---------------------------------------------------------------------------
// detectPackedHistory
// ---------------------------------------------------------------------------

describe('detectPackedHistory', () => {
  it('returns null for empty entries', () => {
    expect(detectPackedHistory([])).toBeNull();
  });

  it('returns null for standard format entries', () => {
    const entries = [makeEntry({ request_message: 'hello' })];
    expect(detectPackedHistory(entries)).toBeNull();
  });

  it('returns null when prefix present but no delimiter', () => {
    const msg = 'Conversation History:\nUser: hi\n\nA: hello';
    const entries = [makeEntry({ request_message: msg })];
    expect(detectPackedHistory(entries)).toBeNull();
  });

  it('returns the message when both prefix and delimiter are present', () => {
    const msg = makePackedMessage([{ user: 'hi', assistant: 'hello' }], 'current');
    const entries = [makeEntry({ request_message: msg })];
    expect(detectPackedHistory(entries)).toBe(msg);
  });
});

// ---------------------------------------------------------------------------
// parsePackedHistory
// ---------------------------------------------------------------------------

describe('parsePackedHistory', () => {
  it('parses a single user/assistant pair', () => {
    const msg = makePackedMessage([{ user: 'hi', assistant: 'hello' }], 'current msg');
    const result = parsePackedHistory(msg);
    expect(result.historicalTurns).toHaveLength(1);
    expect(result.historicalTurns[0].userMessage).toBe('hi');
    expect(result.historicalTurns[0].agentResponse).toBe('hello');
    expect(result.currentMessage).toBe('current msg');
  });

  it('parses multiple user/assistant pairs', () => {
    const msg = makePackedMessage(
      [
        { user: 'first', assistant: 'response1' },
        { user: 'second', assistant: 'response2' },
        { user: 'third', assistant: 'response3' },
      ],
      'the current one',
    );
    const result = parsePackedHistory(msg);
    expect(result.historicalTurns).toHaveLength(3);
    expect(result.historicalTurns[0].userMessage).toBe('first');
    expect(result.historicalTurns[1].userMessage).toBe('second');
    expect(result.historicalTurns[2].userMessage).toBe('third');
    expect(result.historicalTurns[2].agentResponse).toBe('response3');
    expect(result.currentMessage).toBe('the current one');
  });


  it('handles "Assistant:" prefix in addition to "A:"', () => {
    let msg = 'Conversation History:\n';
    msg += 'User: question\n\nAssistant: answer with assistant prefix\n\n';
    msg += '---\n\nCurrent message:\ncurrent';
    const result = parsePackedHistory(msg);
    expect(result.historicalTurns).toHaveLength(1);
    expect(result.historicalTurns[0].agentResponse).toBe('answer with assistant prefix');
    expect(result.currentMessage).toBe('current');
  });

  it('handles multi-line user and assistant messages', () => {
    let msg = 'Conversation History:\n';
    msg += 'User: line one\nline two\nline three\n\n';
    msg += 'A: resp line one\nresp line two\n\n';
    msg += '---\n\nCurrent message:\nmulti\nline\ncurrent';
    const result = parsePackedHistory(msg);
    expect(result.historicalTurns).toHaveLength(1);
    expect(result.historicalTurns[0].userMessage).toContain('line one');
    expect(result.historicalTurns[0].userMessage).toContain('line two');
    expect(result.historicalTurns[0].userMessage).toContain('line three');
    expect(result.historicalTurns[0].agentResponse).toContain('resp line one');
    expect(result.historicalTurns[0].agentResponse).toContain('resp line two');
    expect(result.currentMessage).toBe('multi\nline\ncurrent');
  });

  it('handles workspace events and context metadata in history', () => {
    let msg = 'Conversation History:\n';
    msg += 'User: [WORKSPACE EVENTS] file changed\n\n';
    msg += 'A: acknowledged\n\n';
    msg += 'User: [Currently viewing src/foo.ts]\n\n';
    msg += 'A: I see the file\n\n';
    msg += '---\n\nCurrent message:\nnormal message';
    const result = parsePackedHistory(msg);
    expect(result.historicalTurns).toHaveLength(2);
    expect(result.historicalTurns[0].userMessage).toBe('[WORKSPACE EVENTS] file changed');
    expect(result.historicalTurns[1].userMessage).toBe('[Currently viewing src/foo.ts]');
    expect(result.currentMessage).toBe('normal message');
  });
});

// ---------------------------------------------------------------------------
// groupTurns — standard format
// ---------------------------------------------------------------------------

describe('groupTurns — standard format', () => {
  it('returns empty array for empty chatHistory', () => {
    const session = makeSession([]);
    expect(groupTurns(session)).toEqual([]);
  });

  it('returns empty array for undefined chatHistory', () => {
    const session = { sessionId: 's', created: '', modified: '' } as RawSession;
    expect(groupTurns(session)).toEqual([]);
  });

  it('creates one turn from a single entry', () => {
    const entry = makeEntry({ request_message: 'hi', response_text: 'hello' });
    const turns = groupTurns(makeSession([entry]));
    expect(turns).toHaveLength(1);
    expect(turns[0].index).toBe(0);
    expect(turns[0].userMessage).toBe('hi');
    expect(turns[0].agentResponse).toBe('hello');
    expect(turns[0].isComplete).toBe(true);
    expect(turns[0].messageType).toBe('user');
  });

  it('groups continuation entries (empty request_message) into one turn', () => {
    const entries = [
      makeEntry({ request_message: 'start', response_text: 'r1', sequenceId: 0 }),
      makeEntry({ request_message: '', response_text: 'r2', sequenceId: 1 }),
      makeEntry({ request_message: '', response_text: 'r3', sequenceId: 2 }),
    ];
    const turns = groupTurns(makeSession(entries));
    expect(turns).toHaveLength(1);
    expect(turns[0].userMessage).toBe('start');
  });

  it('splits at user-message boundaries into multiple turns', () => {
    const entries = [
      makeEntry({ request_message: 'first question', response_text: 'a1', sequenceId: 0 }),
      makeEntry({ request_message: '', response_text: 'a1-cont', sequenceId: 1 }),
      makeEntry({ request_message: 'second question', response_text: 'a2', sequenceId: 2 }),
    ];
    const turns = groupTurns(makeSession(entries));
    expect(turns).toHaveLength(2);
    expect(turns[0].index).toBe(0);
    expect(turns[0].userMessage).toBe('first question');
    expect(turns[1].index).toBe(1);
    expect(turns[1].userMessage).toBe('second question');
  });

  it('classifies command prompt turns correctly', () => {
    const entry = makeEntry({ request_message: 'Command Description: run lint', response_text: 'ok' });
    const turns = groupTurns(makeSession([entry]));
    expect(turns[0].messageType).toBe('command_prompt');
  });

  it('marks incomplete turns when completed=false', () => {
    const entry = makeEntry({ request_message: 'wip', response_text: '', completed: false });
    const turns = groupTurns(makeSession([entry]));
    expect(turns[0].isComplete).toBe(false);
  });

  it('computes duration from timestamps', () => {
    const entries = [
      makeEntry({
        request_message: 'q',
        response_text: 'a',
        sequenceId: 0,
        finishedAt: '2025-01-01T00:00:00Z',
      }),
      makeEntry({
        request_message: '',
        response_text: 'cont',
        sequenceId: 1,
        finishedAt: '2025-01-01T00:00:05Z',
      }),
    ];
    const turns = groupTurns(makeSession(entries));
    expect(turns[0].durationMs).toBe(5000);
  });

  it('returns null duration when timestamps are missing', () => {
    const entry = makeEntry({ request_message: 'q', response_text: 'a' });
    const turns = groupTurns(makeSession([entry]));
    expect(turns[0].durationMs).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// groupTurns — packed format
// ---------------------------------------------------------------------------

describe('groupTurns — packed format', () => {
  it('creates historical + current turns from packed session', () => {
    const packed = makePackedMessage(
      [
        { user: 'q1', assistant: 'a1' },
        { user: 'q2', assistant: 'a2' },
      ],
      'current question',
    );
    const entry = makeEntry({ request_message: packed, response_text: 'current answer' });
    const turns = groupTurns(makeSession([entry]));

    // 2 historical + 1 current = 3 turns
    expect(turns).toHaveLength(3);

    // Historical turns
    expect(turns[0].userMessage).toBe('q1');
    expect(turns[0].agentResponse).toBe('a1');
    expect(turns[1].userMessage).toBe('q2');
    expect(turns[1].agentResponse).toBe('a2');

    // Current turn
    expect(turns[2].userMessage).toBe('current question');
    expect(turns[2].agentResponse).toBe('current answer');
  });

  it('classifies historical turns with correct messageType', () => {
    const packed = makePackedMessage(
      [
        { user: '[WORKSPACE EVENTS] something', assistant: 'ack' },
        { user: 'normal question', assistant: 'answer' },
      ],
      'final',
    );
    const entry = makeEntry({ request_message: packed, response_text: 'done' });
    const turns = groupTurns(makeSession([entry]));

    expect(turns[0].messageType).toBe('workspace_event');
    expect(turns[1].messageType).toBe('user');
  });

  it('classifies current message with correct messageType', () => {
    const packed = makePackedMessage(
      [{ user: 'q', assistant: 'a' }],
      'Command Description: do thing',
    );
    const entry = makeEntry({ request_message: packed, response_text: 'ok' });
    const turns = groupTurns(makeSession([entry]));

    expect(turns[1].messageType).toBe('command_prompt');
  });

  it('assigns sequential turn indices', () => {
    const packed = makePackedMessage(
      [
        { user: 'q1', assistant: 'a1' },
        { user: 'q2', assistant: 'a2' },
        { user: 'q3', assistant: 'a3' },
      ],
      'q4',
    );
    const entry = makeEntry({ request_message: packed, response_text: 'a4' });
    const turns = groupTurns(makeSession([entry]));

    expect(turns.map(t => t.index)).toEqual([0, 1, 2, 3]);
  });

  it('marks historical turns as isComplete=true', () => {
    const packed = makePackedMessage(
      [{ user: 'q1', assistant: 'a1' }],
      'current',
    );
    const entry = makeEntry({ request_message: packed, response_text: 'resp' });
    const turns = groupTurns(makeSession([entry]));

    expect(turns[0].isComplete).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// countTurns
// ---------------------------------------------------------------------------

describe('countTurns', () => {
  it('returns 0 for empty chatHistory', () => {
    expect(countTurns(makeSession([]))).toBe(0);
  });

  it('returns 0 for undefined chatHistory', () => {
    const session = { sessionId: 's', created: '', modified: '' } as RawSession;
    expect(countTurns(session)).toBe(0);
  });

  it('counts standard format turns correctly', () => {
    const entries = [
      makeEntry({ request_message: 'q1', response_text: 'a1', sequenceId: 0 }),
      makeEntry({ request_message: '', response_text: 'cont', sequenceId: 1 }),
      makeEntry({ request_message: 'q2', response_text: 'a2', sequenceId: 2 }),
    ];
    expect(countTurns(makeSession(entries))).toBe(2);
  });

  it('counts packed format turns as historical + 1', () => {
    const packed = makePackedMessage(
      [
        { user: 'q1', assistant: 'a1' },
        { user: 'q2', assistant: 'a2' },
      ],
      'current',
    );
    const entry = makeEntry({ request_message: packed, response_text: 'resp' });
    expect(countTurns(makeSession([entry]))).toBe(3); // 2 historical + 1 current
  });

  it('counts multiple standard turns without continuations', () => {
    const entries = [
      makeEntry({ request_message: 'q1', response_text: 'a1', sequenceId: 0 }),
      makeEntry({ request_message: 'q2', response_text: 'a2', sequenceId: 1 }),
      makeEntry({ request_message: 'q3', response_text: 'a3', sequenceId: 2 }),
    ];
    expect(countTurns(makeSession(entries))).toBe(3);
  });

  it('counts single entry as 1 turn', () => {
    const entries = [makeEntry({ request_message: 'q', response_text: 'a' })];
    expect(countTurns(makeSession(entries))).toBe(1);
  });
});