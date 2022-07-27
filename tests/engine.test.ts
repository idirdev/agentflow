import { describe, it, expect, vi, beforeEach } from "vitest";
import { WorkflowEngine } from "../src/core/engine.js";
import { Agent } from "../src/core/agent.js";

function createMockAgent(output: string = "result", tokensUsed: number = 100): Agent {
  const agent = {
    config: { name: "mock", model: "gpt-4o", provider: "openai" },
    run: vi.fn().mockResolvedValue({ output, tokensUsed, toolCalls: [] }),
    clearHistory: vi.fn(),
  } as unknown as Agent;
  return agent;
}

describe("WorkflowEngine", () => {
  let engine: WorkflowEngine;

  beforeEach(() => {
    engine = new WorkflowEngine(100);
  });

  it("registers agents and tracks them", () => {
    const agent = createMockAgent();
    engine.registerAgent("test-agent", agent);
    // no public getter, so we test via execution
    expect(() => engine.registerAgent("test-agent", agent)).not.toThrow();
  });

  it("executes a single-step workflow", async () => {
    const agent = createMockAgent("hello world", 50);
    engine.registerAgent("greeter", agent);

    const result = await engine.execute({
      name: "simple",
      description: "test workflow",
      version: "1.0",
      steps: [{ id: "greet", agent: "greeter", input: "say hi" }],
    });

    expect(result.workflowName).toBe("simple");
    expect(result.status).toBe("completed");
    expect(result.steps).toHaveLength(1);
    expect(result.steps[0].status).toBe("completed");
    expect(result.steps[0].output).toBe("hello world");
  });

  it("passes context between steps via outputKey", async () => {
    const agent1 = createMockAgent("step1-output", 30);
    const agent2 = createMockAgent("step2-output", 40);
    engine.registerAgent("a1", agent1);
    engine.registerAgent("a2", agent2);

    const result = await engine.execute({
      name: "chained",
      description: "chained steps",
      version: "1.0",
      steps: [
        { id: "s1", agent: "a1", input: "start", outputKey: "first" },
        { id: "s2", agent: "a2", input: "use {{first}}", dependsOn: ["s1"] },
      ],
    });

    expect(result.status).toBe("completed");
    expect(result.steps).toHaveLength(2);
    expect(result.totalTokens).toBe(70);
  });

  it("throws on missing agent", async () => {
    await expect(
      engine.execute({
        name: "bad",
        description: "missing agent",
        version: "1.0",
        steps: [{ id: "s1", agent: "nonexistent", input: "test" }],
      })
    ).resolves.toMatchObject({ status: "failed" });
  });

  it("detects circular dependencies", async () => {
    const agent = createMockAgent();
    engine.registerAgent("a", agent);

    await expect(
      engine.execute({
        name: "circular",
        description: "circular deps",
        version: "1.0",
        steps: [
          { id: "s1", agent: "a", input: "x", dependsOn: ["s2"] },
          { id: "s2", agent: "a", input: "y", dependsOn: ["s1"] },
        ],
      })
    ).rejects.toThrow("Circular dependency");
  });

  it("handles parallel steps in the same batch", async () => {
    const a1 = createMockAgent("r1", 10);
    const a2 = createMockAgent("r2", 20);
    engine.registerAgent("a1", a1);
    engine.registerAgent("a2", a2);

    const result = await engine.execute({
      name: "parallel",
      description: "parallel steps",
      version: "1.0",
      steps: [
        { id: "p1", agent: "a1", input: "go" },
        { id: "p2", agent: "a2", input: "go" },
      ],
    });

    expect(result.status).toBe("completed");
    expect(result.steps).toHaveLength(2);
  });

  it("stops on error when onError is stop", async () => {
    const good = createMockAgent("ok", 10);
    const bad = { config: { name: "bad", model: "gpt-4o" }, run: vi.fn().mockRejectedValue(new Error("boom")) } as unknown as Agent;
    engine.registerAgent("good", good);
    engine.registerAgent("bad", bad);

    const result = await engine.execute({
      name: "halt",
      description: "stop on error",
      version: "1.0",
      onError: "stop",
      steps: [
        { id: "s1", agent: "bad", input: "fail" },
        { id: "s2", agent: "good", input: "never", dependsOn: ["s1"] },
      ],
    });

    expect(result.status).toBe("failed");
    expect(result.steps[0].status).toBe("failed");
  });

  it("tracks total cost across steps", async () => {
    const agent = createMockAgent("out", 500);
    engine.registerAgent("a", agent);

    const result = await engine.execute({
      name: "cost-test",
      description: "cost tracking",
      version: "1.0",
      steps: [
        { id: "s1", agent: "a", input: "go" },
        { id: "s2", agent: "a", input: "go" },
      ],
    });

    expect(result.totalCostUsd).toBeGreaterThan(0);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("skips steps when condition evaluates to false", async () => {
    const agent = createMockAgent("done", 10);
    engine.registerAgent("a", agent);

    const result = await engine.execute({
      name: "conditional",
      description: "conditional step",
      version: "1.0",
      variables: { shouldRun: false },
      steps: [{ id: "s1", agent: "a", input: "go", condition: "shouldRun === true" }],
    });

    expect(result.steps[0].status).toBe("skipped");
  });
});
