import { describe, it, expect } from "vitest";
import { Tool } from "../src/core/tool.js";

describe("Tool", () => {
  it("creates a tool", () => {
    const t = Tool.create({ name: "s", description: "d", parameters: {}, handler: async () => ({}) });
    expect(t.name).toBe("s");
  });
  it("validates required params", async () => {
    const t = Tool.create({
      name: "t", description: "d",
      parameters: { req: { type: "string", description: "r", required: true } },
      handler: async (a) => a,
    });
    await expect(t.handler({})).rejects.toThrow("Missing required parameter");
  });
  it("applies defaults", async () => {
    const t = Tool.create({
      name: "t", description: "d",
      parameters: { n: { type: "number", description: "n", default: 10 } },
      handler: async (a) => a,
    });
    expect(await t.handler({})).toEqual({ n: 10 });
  });
  it("converts to OpenAI format", () => {
    const t = Tool.create({ name: "f", description: "d", parameters: { x: { type: "string", description: "x", required: true } }, handler: async () => ({}) });
    const fmt = Tool.toOpenAIFormat(t);
    expect(fmt.type).toBe("function");
    expect(fmt.function.name).toBe("f");
  });
});
