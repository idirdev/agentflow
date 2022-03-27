import { describe, it, expect } from "vitest";
import { MemoryStore } from "../src/memory/store.js";

describe("MemoryStore", () => {
  it("adds entries", async () => {
    const s = new MemoryStore();
    await s.add({ content: "test", metadata: {} });
    expect(s.size).toBe(1);
  });
  it("searches by relevance", async () => {
    const s = new MemoryStore();
    await s.add({ content: "TypeScript language", metadata: {} });
    await s.add({ content: "Python data science", metadata: {} });
    const r = await s.search("TypeScript");
    expect(r.length).toBe(1);
    expect(r[0].content).toContain("TypeScript");
  });
  it("clears entries", async () => {
    const s = new MemoryStore();
    await s.add({ content: "x", metadata: {} });
    await s.clear();
    expect(s.size).toBe(0);
  });
  it("respects max entries", async () => {
    const s = new MemoryStore(3);
    for (let i = 0; i < 5; i++) await s.add({ content: `e${i}`, metadata: {} });
    expect(s.size).toBe(3);
  });
});
