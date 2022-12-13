import { WorkflowConfig, WorkflowResult, StepResult, StepConfig } from "../types.js";
import { Agent } from "./agent.js";
import { PromptTemplate } from "./prompt.js";
import { CostManager } from "./cost.js";
import { Logger } from "../utils/logger.js";

export class WorkflowEngine {
  private agents = new Map<string, Agent>();
  private costManager: CostManager;
  private logger: Logger;

  constructor(budgetUsd: number = 10.0) {
    this.costManager = new CostManager(budgetUsd);
    this.logger = new Logger("WorkflowEngine");
  }

  registerAgent(name: string, agent: Agent): void {
    this.agents.set(name, agent);
    this.logger.info(`Agent registered: ${name}`);
  }

  async execute(workflow: WorkflowConfig): Promise<WorkflowResult> {
    const startTime = Date.now();
    const context = new Map<string, unknown>(Object.entries(workflow.variables || {}));
    const stepResults: StepResult[] = [];

    this.logger.info(`Starting workflow: ${workflow.name} (${workflow.steps.length} steps)`);

    const executionOrder = this.resolveExecutionOrder(workflow.steps);

    let halted = false;

    for (const batch of executionOrder) {
      if (halted) break;

      const batchPromises = batch.map((step) =>
        this.executeStep(step, context, workflow.onError || "stop")
      );

      const results = await Promise.allSettled(batchPromises);

      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const step = batch[i];

        if (result.status === "fulfilled") {
          stepResults.push(result.value);
          if (result.value.status === "completed" && step.outputKey) {
            context.set(step.outputKey, result.value.output);
          }
        } else {
          stepResults.push({
            stepId: step.id,
            status: "failed",
            output: null,
            tokensUsed: 0,
            costUsd: 0,
            durationMs: 0,
            error: result.reason?.message || "Unknown error",
          });
          if (workflow.onError === "stop") {
            this.logger.error(`Workflow halted at step: ${step.id}`);
            halted = true;
            break;
          }
        }
      }
    }

    const totalTokens = stepResults.reduce((sum, r) => sum + r.tokensUsed, 0);
    const totalCost = stepResults.reduce((sum, r) => sum + r.costUsd, 0);
    const hasFailures = stepResults.some((r) => r.status === "failed");

    let status: WorkflowResult["status"];
    if (!hasFailures) {
      status = "completed";
    } else if (halted) {
      status = "failed";
    } else {
      status = stepResults.some((r) => r.status === "completed") ? "partial" : "failed";
    }

    return {
      workflowName: workflow.name,
      status,
      steps: stepResults,
      totalTokens,
      totalCostUsd: totalCost,
      durationMs: Date.now() - startTime,
    };
  }

  private async executeStep(step: StepConfig, context: Map<string, unknown>, onError: string): Promise<StepResult> {
    const startTime = Date.now();
    const agent = this.agents.get(step.agent);
    if (!agent) throw new Error(`Agent not found: ${step.agent}`);

    if (step.condition) {
      const shouldRun = this.evaluateCondition(step.condition, context);
      if (!shouldRun) {
        return { stepId: step.id, status: "skipped", output: null, tokensUsed: 0, costUsd: 0, durationMs: 0 };
      }
    }

    this.costManager.checkBudget();

    const input = typeof step.input === "string"
      ? PromptTemplate.render(step.input, Object.fromEntries(context))
      : step.input;

    let lastError: Error | null = null;
    const maxRetries = step.retries || 1;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const result = await agent.run(typeof input === "string" ? input : JSON.stringify(input));
        const cost = this.costManager.trackUsage(result.tokensUsed, agent.config.model);
        return { stepId: step.id, status: "completed", output: result.output, tokensUsed: result.tokensUsed, costUsd: cost, durationMs: Date.now() - startTime };
      } catch (error) {
        lastError = error as Error;
        this.logger.warn(`Step ${step.id} attempt ${attempt + 1} failed: ${lastError.message}`);
        if (attempt < maxRetries - 1) await this.sleep(1000 * Math.pow(2, attempt));
      }
    }

    throw lastError || new Error(`Step ${step.id} failed after ${maxRetries} retries`);
  }

  private resolveExecutionOrder(steps: StepConfig[]): StepConfig[][] {
    const batches: StepConfig[][] = [];
    const completed = new Set<string>();
    const remaining = [...steps];

    while (remaining.length > 0) {
      const batch = remaining.filter((step) => {
        if (!step.dependsOn || step.dependsOn.length === 0) return true;
        return step.dependsOn.every((dep) => completed.has(dep));
      });
      if (batch.length === 0) throw new Error("Circular dependency detected in workflow steps");
      batches.push(batch);
      batch.forEach((step) => {
        completed.add(step.id);
        remaining.splice(remaining.indexOf(step), 1);
      });
    }

    return batches;
  }

  private evaluateCondition(condition: string, context: Map<string, unknown>): boolean {
    const vars = Object.fromEntries(context);
    try {
      const fn = new Function(...Object.keys(vars), `return ${condition}`);
      return Boolean(fn(...Object.values(vars)));
    } catch {
      this.logger.warn(`Failed to evaluate condition: ${condition}`);
      return true;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
