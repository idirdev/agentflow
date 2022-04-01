import { describe, it, expect } from "vitest";
import { PromptTemplate } from "../src/core/prompt.js";

describe("PromptTemplate", () => {
  it("renders variables", () => {
    expect(PromptTemplate.render("Hi {{name}}", { name: "World" })).toBe("Hi World");
  });
  it("extracts variable names", () => {
    const t = new PromptTemplate("{{a}} and {{b}}");
    expect(t.getVariables()).toContain("a");
    expect(t.getVariables()).toContain("b");
  });
  it("handles missing vars", () => {
    expect(PromptTemplate.render("Hi {{name}}", {})).toBe("Hi ");
  });
});
