import { describe, it, expect } from "vitest";
import { WorkflowValidator } from "../src/utils/validation.js";

describe("WorkflowValidator", () => {
  const validator = new WorkflowValidator();

  it("validates a correct workflow", () => {
    const result = validator.validate({
      name: "test-workflow",
      description: "a valid workflow",
      version: "1.0",
      steps: [
        { id: "s1", agent: "analyzer", input: "analyze this" },
        { id: "s2", agent: "summarizer", input: "summarize {{analysis}}", dependsOn: ["s1"] },
      ],
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("rejects workflow with no name", () => {
    const result = validator.validate({
      name: "",
      steps: [{ id: "s1", agent: "a", input: "x" }],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("name"))).toBe(true);
  });

  it("rejects workflow with no steps", () => {
    const result = validator.validate({
      name: "empty",
      steps: [],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("at least one step"))).toBe(true);
  });

  it("detects duplicate step ids", () => {
    const result = validator.validate({
      name: "dupes",
      steps: [
        { id: "s1", agent: "a", input: "x" },
        { id: "s1", agent: "b", input: "y" },
      ],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("Duplicate step id"))).toBe(true);
  });

  it("detects unknown dependency references", () => {
    const result = validator.validate({
      name: "bad-deps",
      steps: [{ id: "s1", agent: "a", input: "x", dependsOn: ["s99"] }],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("unknown step"))).toBe(true);
  });

  it("detects self-dependency", () => {
    const result = validator.validate({
      name: "self-dep",
      steps: [{ id: "s1", agent: "a", input: "x", dependsOn: ["s1"] }],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("cannot depend on itself"))).toBe(true);
  });

  it("detects circular dependencies", () => {
    const result = validator.validate({
      name: "circular",
      steps: [
        { id: "a", agent: "x", input: "go", dependsOn: ["b"] },
        { id: "b", agent: "x", input: "go", dependsOn: ["c"] },
        { id: "c", agent: "x", input: "go", dependsOn: ["a"] },
      ],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("Circular dependency"))).toBe(true);
  });

  it("warns on high retry count", () => {
    const result = validator.validate({
      name: "high-retry",
      steps: [{ id: "s1", agent: "a", input: "x", retries: 8 }],
    });
    expect(result.valid).toBe(true);
    expect(result.warnings.some((w) => w.includes("high retry count"))).toBe(true);
  });

  it("rejects invalid step schema", () => {
    const result = validator.validate({
      name: "bad-step",
      steps: [{ id: "", agent: "a", input: "x" }],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("Step id cannot be empty"))).toBe(true);
  });

  it("validates object input", () => {
    const result = validator.validate({
      name: "obj-input",
      steps: [{ id: "s1", agent: "a", input: { key: "value" } }],
    });
    expect(result.valid).toBe(true);
  });

  it("handles deeply chained dependencies without false positives", () => {
    const result = validator.validate({
      name: "chain",
      steps: [
        { id: "a", agent: "x", input: "go" },
        { id: "b", agent: "x", input: "go", dependsOn: ["a"] },
        { id: "c", agent: "x", input: "go", dependsOn: ["b"] },
        { id: "d", agent: "x", input: "go", dependsOn: ["c"] },
      ],
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});
