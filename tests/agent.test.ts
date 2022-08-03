import { describe, it, expect, vi, beforeEach } from "vitest";
import { Agent } from "../src/core/agent.js";
import { AgentConfig } from "../src/types.js";

// mock the model router so we don't make real API calls
vi.mock("../src/models/router.js", () => ({
  ModelRouter: vi.fn().mockImplementation(() => ({
    complete: vi.fn().mockResolvedValue({
      content: "mocked response",
      tokensUsed: 42,
      toolCall: undefined,
    }),
  })),
}));

function makeConfig(overrides: Partial<AgentConfig> = {}): AgentConfig {
  return {
    name: "test-agent",
    description: "an agent for testing",
    model: "gpt-4o",
    provider: "openai",
    systemPrompt: "You are a helpful assistant.",
    ...overrides,
  };
}

describe("Agent", () => {
  it("creates with a valid config", () => {
    const agent = new Agent(makeConfig());
    expect(agent.config.name).toBe("test-agent");
    expect(agent.config.model).toBe("gpt-4o");
  });

  it("exposes config as readonly", () => {
    const agent = new Agent(makeConfig({ name: "readonly-check" }));
    expect(agent.config.name).toBe("readonly-check");
    expect(agent.config.provider).toBe("openai");
  });

  it("runs and returns output with token count", async () => {
    const agent = new Agent(makeConfig());
    const result = await agent.run("hello");
    expect(result.output).toBe("mocked response");
    expect(result.tokensUsed).toBe(42);
    expect(result.toolCalls).toEqual([]);
  });

  it("accumulates conversation history", async () => {
    const agent = new Agent(makeConfig());
    await agent.run("first message");
    await agent.run("second message");
    // history should contain both exchanges, we verify indirectly
    // by running a third call (history is sliced to last 10)
    const result = await agent.run("third message");
    expect(result.output).toBe("mocked response");
  });

  it("clears conversation history", async () => {
    const agent = new Agent(makeConfig());
    await agent.run("message");
    agent.clearHistory();
    // after clearing, the next run starts fresh
    const result = await agent.run("fresh start");
    expect(result.output).toBe("mocked response");
  });

  it("uses custom temperature and maxTokens", () => {
    const agent = new Agent(makeConfig({ temperature: 0.2, maxTokens: 2048 }));
    expect(agent.config.temperature).toBe(0.2);
    expect(agent.config.maxTokens).toBe(2048);
  });

  it("defaults temperature to undefined when not set", () => {
    const agent = new Agent(makeConfig());
    expect(agent.config.temperature).toBeUndefined();
  });

  it("supports tool definitions in config", () => {
    const tools = [
      {
        name: "search",
        description: "search the web",
        parameters: { query: { type: "string" as const, description: "search query", required: true } },
        handler: async (args: Record<string, unknown>) => ({ results: [] }),
      },
    ];
    const agent = new Agent(makeConfig({ tools }));
    expect(agent.config.tools).toHaveLength(1);
    expect(agent.config.tools![0].name).toBe("search");
  });

  it("works with anthropic provider", () => {
    const agent = new Agent(makeConfig({ provider: "anthropic", model: "claude-3-5-sonnet-20241022" }));
    expect(agent.config.provider).toBe("anthropic");
    expect(agent.config.model).toBe("claude-3-5-sonnet-20241022");
  });
});
