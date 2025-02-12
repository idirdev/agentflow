#!/usr/bin/env node
import { Command } from "commander";
import { runWorkflow } from "./commands/run.js";
import { listAgents } from "./commands/list.js";
import { inspectHistory } from "./commands/inspect.js";

const program = new Command();

program
  .name("agentflow")
  .description("AI agent workflow orchestration engine")
  .version("0.8.0");

program
  .command("run")
  .description("Execute a workflow from a YAML or JSON file")
  .argument("<file>", "Workflow definition file")
  .option("-v, --verbose", "Enable verbose logging")
  .option("--dry-run", "Validate workflow without executing")
  .option("--budget <amount>", "Set cost budget in USD", "10.0")
  .action(runWorkflow);

program
  .command("list")
  .description("List available agents and workflows")
  .option("--agents", "List registered agents")
  .option("--workflows", "List workflow files")
  .action(listAgents);

program
  .command("inspect")
  .description("Inspect workflow execution history")
  .argument("[id]", "Workflow run ID")
  .option("--last", "Show last execution")
  .option("--format <format>", "Output format (json, table)", "table")
  .action(inspectHistory);

program.parse();
