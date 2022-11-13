import { Logger } from "../utils/logger.js";

interface CacheEntry<T> {
  key: string;
  value: T;
  createdAt: number;
  ttlMs: number;
  hits: number;
}

export class LRUCache<T = unknown> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private maxSize: number;
  private defaultTtlMs: number;
  private logger: Logger;
  private hitCount = 0;
  private missCount = 0;

  constructor(options: { maxSize?: number; defaultTtlMs?: number } = {}) {
    this.maxSize = options.maxSize ?? 256;
    this.defaultTtlMs = options.defaultTtlMs ?? 300_000; // 5 minutes
    this.logger = new Logger("LRUCache");
  }

  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) {
      this.missCount++;
      return undefined;
    }

    if (this.isExpired(entry)) {
      this.cache.delete(key);
      this.missCount++;
      return undefined;
    }

    // move to end (most recently used)
    this.cache.delete(key);
    entry.hits++;
    this.cache.set(key, entry);
    this.hitCount++;
    return entry.value;
  }

  set(key: string, value: T, ttlMs?: number): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    if (this.cache.size >= this.maxSize) {
      this.evictLRU();
    }

    this.cache.set(key, {
      key,
      value,
      createdAt: Date.now(),
      ttlMs: ttlMs ?? this.defaultTtlMs,
      hits: 0,
    });
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    if (this.isExpired(entry)) {
      this.cache.delete(key);
      return false;
    }
    return true;
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
    this.hitCount = 0;
    this.missCount = 0;
    this.logger.debug("Cache cleared");
  }

  get size(): number {
    return this.cache.size;
  }

  getStats(): { size: number; maxSize: number; hits: number; misses: number; hitRate: number } {
    const total = this.hitCount + this.missCount;
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hits: this.hitCount,
      misses: this.missCount,
      hitRate: total > 0 ? this.hitCount / total : 0,
    };
  }

  prune(): number {
    let pruned = 0;
    const now = Date.now();
    for (const [key, entry] of this.cache) {
      if (now - entry.createdAt >= entry.ttlMs) {
        this.cache.delete(key);
        pruned++;
      }
    }
    if (pruned > 0) {
      this.logger.debug(`Pruned ${pruned} expired entries`);
    }
    return pruned;
  }

  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  private evictLRU(): void {
    const firstKey = this.cache.keys().next().value;
    if (firstKey !== undefined) {
      this.cache.delete(firstKey);
    }
  }

  private isExpired(entry: CacheEntry<T>): boolean {
    return Date.now() - entry.createdAt >= entry.ttlMs;
  }

  static createPromptCache(): LRUCache<string> {
    return new LRUCache<string>({
      maxSize: 512,
      defaultTtlMs: 600_000,
    });
  }
}
