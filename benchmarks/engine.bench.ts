import { performance } from "node:perf_hooks";

// Simple benchmark utilities
interface BenchmarkResult {
  name: string;
  iterations: number;
  totalMs: number;
  avgMs: number;
  opsPerSecond: number;
  minMs: number;
  maxMs: number;
}

function bench(name: string, fn: () => void, iterations: number = 1000): BenchmarkResult {
  // warmup
  for (let i = 0; i < Math.min(100, iterations); i++) fn();

  const times: number[] = [];

  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    fn();
    times.push(performance.now() - start);
  }

  const totalMs = times.reduce((a, b) => a + b, 0);
  return {
    name,
    iterations,
    totalMs,
    avgMs: totalMs / iterations,
    opsPerSecond: Math.round((iterations / totalMs) * 1000),
    minMs: Math.min(...times),
    maxMs: Math.max(...times),
  };
}

async function benchAsync(
  name: string,
  fn: () => Promise<void>,
  iterations: number = 100,
): Promise<BenchmarkResult> {
  // warmup
  for (let i = 0; i < 5; i++) await fn();

  const times: number[] = [];

  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await fn();
    times.push(performance.now() - start);
  }

  const totalMs = times.reduce((a, b) => a + b, 0);
  return {
    name,
    iterations,
    totalMs,
    avgMs: totalMs / iterations,
    opsPerSecond: Math.round((iterations / totalMs) * 1000),
    minMs: Math.min(...times),
    maxMs: Math.max(...times),
  };
}

function formatResult(r: BenchmarkResult): string {
  return [
    `  ${r.name}`,
    `    avg: ${r.avgMs.toFixed(4)}ms`,
    `    ops/s: ${r.opsPerSecond.toLocaleString()}`,
    `    min: ${r.minMs.toFixed(4)}ms  max: ${r.maxMs.toFixed(4)}ms`,
    `    total: ${r.totalMs.toFixed(2)}ms (${r.iterations} iterations)`,
  ].join("\n");
}

// ---- benchmarks ----

function benchStepDependencyResolution() {
  const steps = Array.from({ length: 50 }, (_, i) => ({
    id: `step-${i}`,
    agent: "test",
    input: "go",
    dependsOn: i > 0 ? [`step-${i - 1}`] : undefined,
  }));

  return bench("dependency resolution (50 steps, linear chain)", () => {
    const completed = new Set<string>();
    const remaining = [...steps];
    const batches: typeof steps[] = [];

    while (remaining.length > 0) {
      const batch = remaining.filter((s) => {
        if (!s.dependsOn || s.dependsOn.length === 0) return true;
        return s.dependsOn.every((d) => completed.has(d));
      });
      if (batch.length === 0) break;
      batches.push(batch);
      for (const s of batch) {
        completed.add(s.id);
        remaining.splice(remaining.indexOf(s), 1);
      }
    }
  });
}

function benchParallelDependencyResolution() {
  const steps = [
    ...Array.from({ length: 10 }, (_, i) => ({
      id: `root-${i}`,
      agent: "test",
      input: "go",
      dependsOn: undefined as string[] | undefined,
    })),
    ...Array.from({ length: 20 }, (_, i) => ({
      id: `child-${i}`,
      agent: "test",
      input: "go",
      dependsOn: [`root-${i % 10}`],
    })),
  ];

  return bench("dependency resolution (30 steps, wide tree)", () => {
    const completed = new Set<string>();
    const remaining = [...steps];
    const batches: typeof steps[] = [];

    while (remaining.length > 0) {
      const batch = remaining.filter((s) => {
        if (!s.dependsOn || s.dependsOn.length === 0) return true;
        return s.dependsOn.every((d) => completed.has(d));
      });
      if (batch.length === 0) break;
      batches.push(batch);
      for (const s of batch) {
        completed.add(s.id);
        remaining.splice(remaining.indexOf(s), 1);
      }
    }
  });
}

function benchConditionEvaluation() {
  const context = new Map<string, unknown>([
    ["count", 42],
    ["name", "test"],
    ["active", true],
  ]);

  return bench("condition evaluation", () => {
    const vars = Object.fromEntries(context);
    const fn = new Function(...Object.keys(vars), "return count > 10 && active === true");
    fn(...Object.values(vars));
  });
}

function benchContextMapOperations() {
  return bench("context map get/set (1000 ops)", () => {
    const ctx = new Map<string, unknown>();
    for (let i = 0; i < 1000; i++) {
      ctx.set(`key-${i}`, { value: i, nested: { data: `test-${i}` } });
    }
    for (let i = 0; i < 1000; i++) {
      ctx.get(`key-${i}`);
    }
  }, 500);
}

// run all
async function main() {
  console.log("AgentFlow Engine Benchmarks\n" + "=".repeat(50));

  const results = [
    benchStepDependencyResolution(),
    benchParallelDependencyResolution(),
    benchConditionEvaluation(),
    benchContextMapOperations(),
  ];

  for (const r of results) {
    console.log(formatResult(r));
    console.log();
  }
}

main().catch(console.error);
