import { describe, it, expect } from "vitest";
import { CostManager } from "../src/core/cost.js";

describe("CostManager", () => {
  it("tracks usage and calculates cost", () => {
    const cm = new CostManager(10.0);
    const cost = cm.trackUsage(1000, "gpt-4o");
    expect(cost).toBeGreaterThan(0);
    expect(cm.getSummary().totalCostUsd).toBe(cost);
  });

  it("tracks remaining budget", () => {
    const cm = new CostManager(5.0);
    cm.trackUsage(1000, "gpt-4o");
    const s = cm.getSummary();
    expect(s.remainingUsd).toBeLessThan(5.0);
    expect(s.budgetUsd).toBe(5.0);
  });

  it("throws when budget exceeded", () => {
    const cm = new CostManager(0.0001);
    cm.trackUsage(100000, "gpt-4o");
    expect(() => cm.checkBudget()).toThrow("Budget exceeded");
  });

  it("does not throw within budget", () => {
    const cm = new CostManager(100);
    cm.trackUsage(100, "gpt-4o");
    expect(() => cm.checkBudget()).not.toThrow();
  });

  it("calculates percent used", () => {
    const cm = new CostManager(10.0);
    cm.trackUsage(1000, "gpt-4o");
    const s = cm.getSummary();
    expect(s.percentUsed).toBeGreaterThan(0);
    expect(s.percentUsed).toBeLessThan(100);
  });
});
