// =============================================================================
// Canonical types — the ONLY types the UI and API routes consume.
// These are decoupled from the raw JSON shape so the adapter is the single
// point of change when the upstream session format evolves.
// =============================================================================

/** Top-level session metadata */
export interface Session {
  id: string;
  title: string;
  created: string;          // ISO 8601
  modified: string;         // ISO 8601
  modelId: string;
  totalExchanges: number;
  totalTurns: number;
}

/** A logical "turn" = one user prompt + all agent activity until the next prompt */
export interface Turn {
  index: number;            // 0-based position in the turn list
  userMessage: string;      // the user's prompt text
  agentResponse: string;    // the top-level response_text (may contain markdown)
  timestamp: string;        // finishedAt of the first exchange in this turn
  durationMs: number | null;
  steps: TurnStep[];        // ordered list of everything the agent did
  isComplete: boolean;
  messageType?: TurnMessageType; // classification of the user message
}

/** Classifies the origin/nature of a turn's user message */
export type TurnMessageType =
  | 'user'              // normal user-typed message
  | 'workspace_event'   // system-injected [WORKSPACE EVENTS] notification
  | 'context_metadata'  // [Currently viewing: ...] IDE context prefix
  | 'command_prompt';   // automated command/prompt (e.g. "Command Description: ...")

/** One discrete action inside a turn */
export interface TurnStep {
  type: StepType;
  content: string;          // text / markdown / JSON depending on type
  toolName?: string;        // for tool_call and tool_result
  toolInput?: string;       // JSON string of tool input
  toolUseId?: string;       // links tool_call ↔ tool_result
  isError?: boolean;        // for tool_result
  thinkingSummary?: string; // for thinking steps
  timestamp?: number;       // epoch ms
}

export type StepType =
  | 'text'            // agent prose (type 0 response node)
  | 'tool_call'       // agent invokes a tool (type 5 response node)
  | 'tool_result'     // tool output returned (type 1 request node)
  | 'thinking'        // extended thinking (type 8 response node)
  | 'history_summary' // context-window summary (type 10 request node)
  | 'token_usage';    // billing/token info (type 10 response node)

/** A single sub-agent notification within a workspace event */
export interface SubAgentEvent {
  agentName: string;          // e.g. "Migrate JPA Entities to Quarkus/Panache"
  agentId: string | null;     // e.g. "agent-b8d60038-..."
  taskId: string | null;      // e.g. "53435c57-..."
  messageCount: number | null; // e.g. 2
  summary: string;            // the **Agent's Summary:** content (may be truncated with leading "...")
  digest: string | null;      // the <agent_digest> content
  taskNoteLink: string | null; // e.g. "workspaces://local/task/UUID"
}

/** Parsed structure of a [WORKSPACE EVENTS] message */
export interface ParsedWorkspaceEvent {
  header: string;             // e.g. "You have received 2 workspace events while you were working:"
  agents: SubAgentEvent[];
}

/** Lightweight session entry for the list view */
export interface SessionListItem {
  id: string;
  title: string;
  created: string;
  modified: string;
  totalTurns: number;
  modelId: string;
}

