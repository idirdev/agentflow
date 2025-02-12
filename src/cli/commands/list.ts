import fs from "fs";
import path from "path";
import chalk from "chalk";

export async function listAgents(options: { agents?: boolean; workflows?: boolean }) {
  console.log(chalk.blue("\n  AgentFlow\n"));

  if (options.workflows || !options.agents) {
    const cwd = process.cwd();
    const files = fs.readdirSync(cwd).filter((f) => f.endsWith(".yaml") || f.endsWith(".yml") || f.endsWith(".workflow.json"));

    console.log(chalk.bold("  Workflow Files:"));
    if (files.length === 0) {
      console.log(chalk.gray("    No workflow files found in current directory"));
    } else {
      files.forEach((f) => {
        const stat = fs.statSync(path.join(cwd, f));
        console.log(`    ${chalk.cyan(f)} ${chalk.gray(`(${(stat.size / 1024).toFixed(1)}KB)`)}`);
      });
    }
  }

  if (options.agents) {
    console.log(chalk.bold("\n  Built-in Agent Templates:"));
    const templates = [
      { name: "code-reviewer", description: "Reviews code for bugs, style, and best practices" },
      { name: "doc-summarizer", description: "Summarizes documents and extracts key points" },
      { name: "data-classifier", description: "Classifies data into predefined categories" },
    ];
    templates.forEach((t) => {
      console.log(`    ${chalk.cyan(t.name)} - ${chalk.gray(t.description)}`);
    });
  }
  console.log();
}
