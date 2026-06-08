// =============================================================================
// Raw JSON types — mirrors the on-disk session JSON structure.
// When the upstream format changes, update THESE types and the adapter.
// The rest of the app never imports from this file.
// =============================================================================

export interface RawSession {
  sessionId: string;
  created: string;
  modified: string;
  title?: string;
  workspaceId?: string;
  rootTaskUuid?: string;
  terminalId?: string;
  remoteCreatedAt?: string;
  chatHistory: RawChatEntry[];
  agentState?: RawAgentState;
}

export interface RawAgentState {
  userGuidelines?: string;
  workspaceGuidelines?: string;
  agentMemories?: string;
  modelId?: string;
  userEmail?: string;
}

export interface RawChatEntry {
  exchange: RawExchange;
  completed: boolean;
  sequenceId: number;
  finishedAt?: string;
  changedFiles?: unknown[];
  changedFilesSkipped?: unknown[];
  changedFilesSkippedCount?: number;
  isHistorySummary?: boolean;
  historySummaryVersion?: number;
  source?: string;
}

export interface RawExchange {
  request_message: string;
  response_text: string;
  request_id?: string;
  request_nodes?: RawRequestNode[];
  response_nodes?: RawResponseNode[];
}

// --- Request node variants ---

export interface RawRequestNode {
  id: number;
  type: number; // 0=text, 1=tool_result, 4=ide_state, 10=history_summary
  text_node?: { content: string };
  tool_result_node?: {
    tool_use_id: string;
    content: string;
    is_error: boolean;
  };
  ide_state_node?: {
    workspace_folders?: { repository_root: string; folder_root: string }[];
    workspace_folders_unchanged?: boolean;
    current_terminal?: { terminal_id: number; current_working_directory: string };
  };
  history_summary_node?: {
    summary_text: string;
  };
}

// --- Response node variants ---

export interface RawResponseNode {
  id: number;
  type: number; // 0=text, 5=tool_use, 8=thinking, 10=token_usage
  content?: string;
  tool_use?: {
    tool_use_id: string;
    tool_name: string;
    input_json: string;
    is_partial?: boolean;
  } | null;
  thinking?: {
    summary: string;
  } | null;
  token_usage?: {
    input_tokens: number;
    output_tokens: number;
    cache_read_input_tokens?: number;
    cache_creation_input_tokens?: number;
  } | null;
  timestamp_ms?: number;
  billing_metadata?: unknown;
  metadata?: unknown;
}

