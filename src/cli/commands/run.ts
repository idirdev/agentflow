import fs from "fs";
import YAML from "yaml";
import { WorkflowEngine } from "../../core/engine.js";
import { Agent } from "../../core/agent.js";
import { WorkflowConfig } from "../../types.js";
import chalk from "chalk";

export async function runWorkflow(file: string, options: { verbose?: boolean; dryRun?: boolean; budget?: string }) {
  console.log(chalk.blue("\n  AgentFlow - Workflow Engine\n"));

  if (!fs.existsSync(file)) {
    console.error(chalk.red(`File not found: ${file}`));
    process.exit(1);
  }

  const content = fs.readFileSync(file, "utf-8");
  const config: WorkflowConfig = file.endsWith(".yaml") || file.endsWith(".yml") ? YAML.parse(content) : JSON.parse(content);

  console.log(chalk.gray(`  Workflow: ${config.name} (${config.steps.length} steps)`));

  if (options.dryRun) {
    console.log(chalk.yellow("\n  [DRY RUN] Workflow validated successfully"));
    console.log(chalk.gray(`  Steps: ${config.steps.map((s) => s.id).join(" -> ")}`));
    return;
  }

  const engine = new WorkflowEngine(parseFloat(options.budget || "10.0"));
  const agentNames = [...new Set(config.steps.map((s) => s.agent))];

  for (const name of agentNames) {
    engine.registerAgent(name, new Agent({
      name,
      description: `Agent: ${name}`,
      model: process.env.DEFAULT_MODEL || "gpt-4o",
      provider: "openai",
      systemPrompt: `You are ${name}, an AI assistant.`,
    }));
  }

  console.log(chalk.gray(`  Agents: ${agentNames.join(", ")}\n`));

  const result = await engine.execute(config);

  console.log(chalk.bold("\n  Results"));
  console.log(chalk.gray("  " + "-".repeat(50)));

  for (const step of result.steps) {
    const icon = step.status === "completed" ? "v" : step.status === "skipped" ? "o" : "x";
    const color = step.status === "completed" ? chalk.green : step.status === "skipped" ? chalk.gray : chalk.red;
    console.log(color(`    ${icon} ${step.stepId} (${step.durationMs}ms, ${step.tokensUsed} tokens)`));
  }

  console.log(chalk.gray("\n  " + "-".repeat(50)));
  console.log(`    Status:  ${result.status === "completed" ? chalk.green("completed") : chalk.red(result.status)}`);
  console.log(`    Tokens:  ${result.totalTokens.toLocaleString()}`);
  console.log(`    Cost:    $${result.totalCostUsd.toFixed(4)}`);
  console.log(`    Time:    ${result.durationMs}ms\n`);
}
