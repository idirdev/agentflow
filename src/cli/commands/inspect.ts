import chalk from "chalk";

export async function inspectHistory(id?: string, options?: { last?: boolean; format?: string }) {
  console.log(chalk.blue("\n  AgentFlow - Execution History\n"));

  if (!id && !options?.last) {
    console.log(chalk.gray("  No execution history found."));
    console.log(chalk.gray("  Run a workflow first with: agentflow run <file>\n"));
    return;
  }

  console.log(chalk.gray("  Execution history is stored in memory during runtime."));
  console.log(chalk.gray("  Persistent history will be available in v1.0.\n"));
}
