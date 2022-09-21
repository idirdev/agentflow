import { z } from "zod";
import { WorkflowConfig, StepConfig } from "../types.js";
import { Logger } from "./logger.js";

const StepSchema = z.object({
  id: z.string().min(1, "Step id cannot be empty"),
  agent: z.string().min(1, "Agent name is required"),
  input: z.union([z.string(), z.record(z.unknown())]),
  dependsOn: z.array(z.string()).optional(),
  condition: z.string().optional(),
  parallel: z.boolean().optional(),
  retries: z.number().int().min(1).max(10).optional(),
  timeout: z.number().positive().optional(),
  outputKey: z.string().optional(),
});

const WorkflowSchema = z.object({
  name: z.string().min(1, "Workflow name is required"),
  description: z.string().optional(),
  version: z.string().optional(),
  steps: z.array(StepSchema).min(1, "Workflow must have at least one step"),
  variables: z.record(z.unknown()).optional(),
  onError: z.enum(["stop", "skip", "retry"]).optional(),
});

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export class WorkflowValidator {
  private logger = new Logger("WorkflowValidator");

  validate(config: unknown): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // schema validation first
    const parseResult = WorkflowSchema.safeParse(config);
    if (!parseResult.success) {
      for (const issue of parseResult.error.issues) {
        errors.push(`${issue.path.join(".")}: ${issue.message}`);
      }
      return { valid: false, errors, warnings };
    }

    const workflow = parseResult.data as WorkflowConfig;

    // check for duplicate step ids
    const seenIds = new Set<string>();
    for (const step of workflow.steps) {
      if (seenIds.has(step.id)) {
        errors.push(`Duplicate step id: "${step.id}"`);
      }
      seenIds.add(step.id);
    }

    // validate dependency references exist
    for (const step of workflow.steps) {
      if (step.dependsOn) {
        for (const dep of step.dependsOn) {
          if (!seenIds.has(dep)) {
            errors.push(`Step "${step.id}" depends on unknown step "${dep}"`);
          }
          if (dep === step.id) {
            errors.push(`Step "${step.id}" cannot depend on itself`);
          }
        }
      }
    }

    // check for cycles
    const cycleError = this.detectCycles(workflow.steps);
    if (cycleError) {
      errors.push(cycleError);
    }

    // warnings
    for (const step of workflow.steps) {
      if (step.retries && step.retries > 5) {
        warnings.push(`Step "${step.id}": high retry count (${step.retries}) may slow workflow`);
      }
      if (step.outputKey && !workflow.steps.some((s) => s.input?.toString().includes(`{{${step.outputKey}}}`))) {
        warnings.push(`Step "${step.id}": outputKey "${step.outputKey}" is never referenced`);
      }
    }

    this.logger.info(`Validation complete: ${errors.length} error(s), ${warnings.length} warning(s)`);
    return { valid: errors.length === 0, errors, warnings };
  }

  private detectCycles(steps: StepConfig[]): string | null {
    const adjacency = new Map<string, string[]>();
    for (const step of steps) {
      adjacency.set(step.id, step.dependsOn ?? []);
    }

    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const dfs = (nodeId: string): string | null => {
      visited.add(nodeId);
      recursionStack.add(nodeId);

      const neighbors = adjacency.get(nodeId) ?? [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          const cycle = dfs(neighbor);
          if (cycle) return cycle;
        } else if (recursionStack.has(neighbor)) {
          return `Circular dependency detected: "${nodeId}" -> "${neighbor}"`;
        }
      }

      recursionStack.delete(nodeId);
      return null;
    };

    for (const step of steps) {
      if (!visited.has(step.id)) {
        const cycle = dfs(step.id);
        if (cycle) return cycle;
      }
    }

    return null;
  }
}
