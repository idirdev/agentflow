type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_PRIORITY: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };
const LEVEL_COLORS: Record<LogLevel, string> = { debug: "\x1b[90m", info: "\x1b[36m", warn: "\x1b[33m", error: "\x1b[31m" };

export class Logger {
  private context: string;
  private static minLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) || "info";

  constructor(context: string) {
    this.context = context;
  }

  debug(message: string): void { this.log("debug", message); }
  info(message: string): void { this.log("info", message); }
  warn(message: string): void { this.log("warn", message); }
  error(message: string): void { this.log("error", message); }

  private log(level: LogLevel, message: string): void {
    if (LEVEL_PRIORITY[level] < LEVEL_PRIORITY[Logger.minLevel]) return;
    const timestamp = new Date().toISOString();
    const color = LEVEL_COLORS[level];
    const reset = "\x1b[0m";
    console.log(`${color}[${timestamp}] [${level.toUpperCase()}] [${this.context}]${reset} ${message}`);
  }
}
