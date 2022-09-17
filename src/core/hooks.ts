import { StepConfig, StepResult } from "../types.js";
import { Logger } from "../utils/logger.js";

export type BeforeStepHook = (step: StepConfig, context: Map<string, unknown>) => Promise<void> | void;
export type AfterStepHook = (step: StepConfig, result: StepResult) => Promise<void> | void;
export type OnErrorHook = (step: StepConfig, error: Error) => Promise<void> | void;
export type OnCompleteHook = (results: StepResult[]) => Promise<void> | void;

interface HookRegistration<T> {
  name: string;
  priority: number;
  handler: T;
}

export class HookManager {
  private beforeStepHooks: HookRegistration<BeforeStepHook>[] = [];
  private afterStepHooks: HookRegistration<AfterStepHook>[] = [];
  private errorHooks: HookRegistration<OnErrorHook>[] = [];
  private completeHooks: HookRegistration<OnCompleteHook>[] = [];
  private logger: Logger;

  constructor() {
    this.logger = new Logger("HookManager");
  }

  onBeforeStep(name: string, handler: BeforeStepHook, priority: number = 0): this {
    this.beforeStepHooks.push({ name, priority, handler });
    this.beforeStepHooks.sort((a, b) => b.priority - a.priority);
    this.logger.debug(`Registered beforeStep hook: ${name} (priority: ${priority})`);
    return this;
  }

  onAfterStep(name: string, handler: AfterStepHook, priority: number = 0): this {
    this.afterStepHooks.push({ name, priority, handler });
    this.afterStepHooks.sort((a, b) => b.priority - a.priority);
    this.logger.debug(`Registered afterStep hook: ${name} (priority: ${priority})`);
    return this;
  }

  onError(name: string, handler: OnErrorHook, priority: number = 0): this {
    this.errorHooks.push({ name, priority, handler });
    this.errorHooks.sort((a, b) => b.priority - a.priority);
    return this;
  }

  onComplete(name: string, handler: OnCompleteHook, priority: number = 0): this {
    this.completeHooks.push({ name, priority, handler });
    this.completeHooks.sort((a, b) => b.priority - a.priority);
    return this;
  }

  async runBeforeStep(step: StepConfig, context: Map<string, unknown>): Promise<void> {
    for (const hook of this.beforeStepHooks) {
      try {
        await hook.handler(step, context);
      } catch (err) {
        this.logger.warn(`beforeStep hook "${hook.name}" threw: ${(err as Error).message}`);
      }
    }
  }

  async runAfterStep(step: StepConfig, result: StepResult): Promise<void> {
    for (const hook of this.afterStepHooks) {
      try {
        await hook.handler(step, result);
      } catch (err) {
        this.logger.warn(`afterStep hook "${hook.name}" threw: ${(err as Error).message}`);
      }
    }
  }

  async runOnError(step: StepConfig, error: Error): Promise<void> {
    for (const hook of this.errorHooks) {
      try {
        await hook.handler(step, error);
      } catch (err) {
        this.logger.warn(`onError hook "${hook.name}" threw: ${(err as Error).message}`);
      }
    }
  }

  async runOnComplete(results: StepResult[]): Promise<void> {
    for (const hook of this.completeHooks) {
      try {
        await hook.handler(results);
      } catch (err) {
        this.logger.warn(`onComplete hook "${hook.name}" threw: ${(err as Error).message}`);
      }
    }
  }

  removeHook(name: string): boolean {
    const initialCount = this.totalHookCount();
    this.beforeStepHooks = this.beforeStepHooks.filter((h) => h.name !== name);
    this.afterStepHooks = this.afterStepHooks.filter((h) => h.name !== name);
    this.errorHooks = this.errorHooks.filter((h) => h.name !== name);
    this.completeHooks = this.completeHooks.filter((h) => h.name !== name);
    return this.totalHookCount() < initialCount;
  }

  clearAll(): void {
    this.beforeStepHooks = [];
    this.afterStepHooks = [];
    this.errorHooks = [];
    this.completeHooks = [];
  }

  private totalHookCount(): number {
    return (
      this.beforeStepHooks.length +
      this.afterStepHooks.length +
      this.errorHooks.length +
      this.completeHooks.length
    );
  }
}
