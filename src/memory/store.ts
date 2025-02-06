import { MemoryEntry } from "../types.js";
import { Logger } from "../utils/logger.js";

export class MemoryStore {
  private entries: MemoryEntry[] = [];
  private maxEntries: number;
  private logger = new Logger("MemoryStore");

  constructor(maxEntries: number = 1000) {
    this.maxEntries = maxEntries;
  }

  async add(entry: Omit<MemoryEntry, "id" | "timestamp">): Promise<string> {
    const id = crypto.randomUUID();
    const memoryEntry: MemoryEntry = { ...entry, id, timestamp: new Date() };
    this.entries.push(memoryEntry);
    if (this.entries.length > this.maxEntries) {
      this.entries = this.entries.slice(-this.maxEntries);
    }
    this.cleanup();
    this.logger.debug(`Memory added: ${id}`);
    return id;
  }

  async search(query: string, topK: number = 5): Promise<MemoryEntry[]> {
    const queryTerms = query.toLowerCase().split(/\s+/);
    const scored = this.entries.map((entry) => {
      const content = entry.content.toLowerCase();
      const score = queryTerms.reduce((acc, term) => acc + (content.includes(term) ? 1 : 0), 0);
      return { entry, score };
    });
    return scored.filter((s) => s.score > 0).sort((a, b) => b.score - a.score).slice(0, topK).map((s) => s.entry);
  }

  async getRecent(limit: number = 10): Promise<MemoryEntry[]> {
    return this.entries.slice(-limit);
  }

  async clear(): Promise<void> {
    this.entries = [];
    this.logger.info("Memory cleared");
  }

  get size(): number {
    return this.entries.length;
  }

  private cleanup(): void {
    const now = Date.now();
    this.entries = this.entries.filter((entry) => {
      if (!entry.ttl) return true;
      return now - entry.timestamp.getTime() < entry.ttl * 1000;
    });
  }
}
