import { AgentMessage, ToolDefinition, ModelProvider } from "../types.js";
import { Tool } from "../core/tool.js";
import { Logger } from "../utils/logger.js";

interface CompletionRequest {
  model: string;
  provider: ModelProvider;
  messages: AgentMessage[];
  tools?: ToolDefinition[];
  temperature: number;
  maxTokens: number;
}

interface CompletionResponse {
  content: string;
  tokensUsed: number;
  toolCall?: { id: string; name: string; arguments: Record<string, unknown> };
}

export class ModelRouter {
  private logger = new Logger("ModelRouter");

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    this.logger.info(`Routing to ${request.provider}/${request.model}`);

    switch (request.provider) {
      case "openai":
        return this.callOpenAI(request);
      case "anthropic":
        return this.callAnthropic(request);
      default:
        throw new Error(`Unsupported provider: ${request.provider}`);
    }
  }

  private async callOpenAI(request: CompletionRequest): Promise<CompletionResponse> {
    const { OpenAI } = await import("openai");
    const client = new OpenAI();
    const tools = request.tools?.map((t) => Tool.toOpenAIFormat(t));

    const response = await client.chat.completions.create({
      model: request.model,
      messages: request.messages.map((m) => ({
        role: m.role as any,
        content: m.content,
        ...(m.name && { name: m.name }),
        ...(m.toolCallId && { tool_call_id: m.toolCallId }),
      })),
      temperature: request.temperature,
      max_tokens: request.maxTokens,
      ...(tools && { tools }),
    });

    const choice = response.choices[0];
    const toolCall = choice.message.tool_calls?.[0];

    return {
      content: choice.message.content || "",
      tokensUsed: response.usage?.total_tokens || 0,
      ...(toolCall && {
        toolCall: {
          id: toolCall.id,
          name: toolCall.function.name,
          arguments: JSON.parse(toolCall.function.arguments),
        },
      }),
    };
  }

  private async callAnthropic(request: CompletionRequest): Promise<CompletionResponse> {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic();

    const systemMsg = request.messages.find((m) => m.role === "system");
    const nonSystemMsgs = request.messages.filter((m) => m.role !== "system");

    const response = await client.messages.create({
      model: request.model,
      max_tokens: request.maxTokens,
      system: systemMsg?.content || "",
      messages: nonSystemMsgs.map((m) => ({
        role: m.role === "tool" ? "user" : (m.role as "user" | "assistant"),
        content: m.content,
      })),
    });

    const textBlock = response.content.find((b) => b.type === "text");

    return {
      content: textBlock?.text || "",
      tokensUsed: response.usage.input_tokens + response.usage.output_tokens,
    };
  }
}
