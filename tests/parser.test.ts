import { describe, it, expect } from "vitest";
import { OutputParser } from "../src/utils/parser.js";

describe("OutputParser.json", () => {
  it("parses JSON from code block", () => {
    const r = OutputParser.json('Result:\n```json\n{"key":"value"}\n```');
    expect(r).toEqual({ key: "value" });
  });
  it("parses raw JSON", () => {
    expect(OutputParser.json('{"a":1}')).toEqual({ a: 1 });
  });
  it("throws when no JSON", () => {
    expect(() => OutputParser.json("no json")).toThrow();
  });
});

describe("OutputParser.list", () => {
  it("parses bullet list", () => {
    expect(OutputParser.list("- A\n- B\n- C")).toEqual(["A", "B", "C"]);
  });
  it("parses numbered list", () => {
    expect(OutputParser.list("1. X\n2. Y")).toEqual(["X", "Y"]);
  });
});

describe("OutputParser.extractCodeBlock", () => {
  it("extracts typed code block", () => {
    const r = OutputParser.extractCodeBlock('```ts\nconst x = 1;\n```', "ts");
    expect(r).toBe("const x = 1;");
  });
  it("returns null when missing", () => {
    expect(OutputParser.extractCodeBlock("none", "py")).toBeNull();
  });
});
