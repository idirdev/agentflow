import { Logger } from "../utils/logger.js";

const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  "gpt-4o": { input: 2.5 / 1_000_000, output: 10 / 1_000_000 },
  "gpt-4o-mini": { input: 0.15 / 1_000_000, output: 0.6 / 1_000_000 },
  "gpt-4-turbo": { input: 10 / 1_000_000, output: 30 / 1_000_000 },
  "claude-3-5-sonnet-20241022": { input: 3 / 1_000_000, output: 15 / 1_000_000 },
  "claude-3-haiku-20240307": { input: 0.25 / 1_000_000, output: 1.25 / 1_000_000 },
};

export class CostManager {
  private totalCostUsd = 0;
  private budgetUsd: number;
  private logger: Logger;

  constructor(budgetUsd: number) {
    this.budgetUsd = budgetUsd;
    this.logger = new Logger("CostManager");
  }

  trackUsage(tokens: number, model: string): number {
    const pricing = MODEL_PRICING[model] || MODEL_PRICING["gpt-4o"];
    const cost = tokens * ((pricing.input + pricing.output) / 2);
    this.totalCostUsd += cost;
    this.logger.debug(`Usage: ${tokens} tokens, $${cost.toFixed(6)} (total: $${this.totalCostUsd.toFixed(4)})`);
    return cost;
  }

  checkBudget(): void {
    if (this.totalCostUsd >= this.budgetUsd) {
      throw new Error(`Budget exceeded: $${this.totalCostUsd.toFixed(4)} / $${this.budgetUsd.toFixed(2)}`);
    }
    if (this.totalCostUsd >= this.budgetUsd * 0.9) {
      this.logger.warn(`Budget warning: $${this.totalCostUsd.toFixed(4)} / $${this.budgetUsd.toFixed(2)} (90%+)`);
    }
  }

  getSummary() {
    return {
      totalCostUsd: this.totalCostUsd,
      budgetUsd: this.budgetUsd,
      remainingUsd: this.budgetUsd - this.totalCostUsd,
      percentUsed: (this.totalCostUsd / this.budgetUsd) * 100,
    };
  }
}
