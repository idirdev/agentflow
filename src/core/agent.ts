import { AgentConfig, AgentMessage, ToolDefinition } from "../types.js";
import { ModelRouter } from "../models/router.js";
import { MemoryStore } from "../memory/store.js";
import { Logger } from "../utils/logger.js";

export interface AgentRunResult {
  output: string;
  tokensUsed: number;
  toolCalls: string[];
}

export class Agent {
  readonly config: AgentConfig;
  private router: ModelRouter;
  private memory: MemoryStore;
  private logger: Logger;
  private conversationHistory: AgentMessage[] = [];

  constructor(config: AgentConfig) {
    this.config = config;
    this.router = new ModelRouter();
    this.memory = new MemoryStore();
    this.logger = new Logger(`Agent:${config.name}`);
  }

  async run(input: string): Promise<AgentRunResult> {
    this.logger.info(`Running with input: ${input.slice(0, 100)}...`);

    const messages: AgentMessage[] = [
      { role: "system", content: this.config.systemPrompt },
      ...this.conversationHistory.slice(-10),
      { role: "user", content: input },
    ];

    const relevantMemory = await this.memory.search(input, 3);
    if (relevantMemory.length > 0) {
      const memoryContext = relevantMemory.map((m) => m.content).join("\n");
      messages.splice(1, 0, { role: "system", content: `Relevant context from memory:\n${memoryContext}` });
    }

    const toolCalls: string[] = [];
    let totalTokens = 0;
    let finalOutput = "";
    let iterations = 0;

    while (iterations < 5) {
      iterations++;
      const response = await this.router.complete({
        model: this.config.model,
        provider: this.config.provider,
        messages,
        tools: this.config.tools,
        temperature: this.config.temperature ?? 0.7,
        maxTokens: this.config.maxTokens ?? 4096,
      });

      totalTokens += response.tokensUsed;

      if (response.toolCall && this.config.tools) {
        const tool = this.config.tools.find((t) => t.name === response.toolCall!.name);
        if (tool) {
          toolCalls.push(response.toolCall.name);
          this.logger.info(`Tool call: ${response.toolCall.name}`);
          const toolResult = await tool.handler(response.toolCall.arguments);
          messages.push(
            { role: "assistant", content: "", name: response.toolCall.name },
            { role: "tool", content: JSON.stringify(toolResult), toolCallId: response.toolCall.id }
          );
          continue;
        }
      }

      finalOutput = response.content;
      break;
    }

    this.conversationHistory.push(
      { role: "user", content: input },
      { role: "assistant", content: finalOutput }
    );

    await this.memory.add({
      content: `Input: ${input}\nOutput: ${finalOutput.slice(0, 500)}`,
      metadata: { agent: this.config.name, timestamp: new Date().toISOString() },
    });

    return { output: finalOutput, tokensUsed: totalTokens, toolCalls };
  }

  clearHistory(): void {
    this.conversationHistory = [];
  }
}
