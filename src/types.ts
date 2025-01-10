export type ModelProvider = "openai" | "anthropic";

export interface AgentConfig {
  name: string;
  description: string;
  model: string;
  provider: ModelProvider;
  systemPrompt: string;
  tools?: ToolDefinition[];
  temperature?: number;
  maxTokens?: number;
  retryConfig?: RetryConfig;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, ParameterDef>;
  handler: (args: Record<string, unknown>) => Promise<unknown>;
}

export interface ParameterDef {
  type: "string" | "number" | "boolean" | "array" | "object";
  description: string;
  required?: boolean;
  default?: unknown;
}

export interface WorkflowConfig {
  name: string;
  description: string;
  version: string;
  steps: StepConfig[];
  variables?: Record<string, unknown>;
  onError?: "stop" | "skip" | "retry";
}

export interface StepConfig {
  id: string;
  agent: string;
  input: string | Record<string, unknown>;
  dependsOn?: string[];
  condition?: string;
  parallel?: boolean;
  retries?: number;
  timeout?: number;
  outputKey?: string;
}

export interface RetryConfig {
  maxRetries: number;
  backoffMs: number;
  fallbackModel?: string;
}

export interface WorkflowResult {
  workflowName: string;
  status: "completed" | "failed" | "partial";
  steps: StepResult[];
  totalTokens: number;
  totalCostUsd: number;
  durationMs: number;
}

export interface StepResult {
  stepId: string;
  status: "completed" | "failed" | "skipped";
  output: unknown;
  tokensUsed: number;
  costUsd: number;
  durationMs: number;
  error?: string;
}

export interface AgentMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  name?: string;
  toolCallId?: string;
}

export interface CostTracker {
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  totalCostUsd: number;
  budgetRemainingUsd: number;
}

export interface MemoryEntry {
  id: string;
  content: string;
  embedding?: number[];
  metadata: Record<string, unknown>;
  timestamp: Date;
  ttl?: number;
}
