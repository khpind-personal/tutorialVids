export interface AgentPrompt {
  name: string;
  description: string;
  model?: string;
  system: string;
}

export interface DispatchInput {
  agent: AgentPrompt;
  user: string;
  cacheKey?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface DispatchResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
  cacheCreationTokens?: number;
  model: string;
  stopReason: string;
}
