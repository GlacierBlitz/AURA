import crypto from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import { app } from 'electron';
import type { LLMPrompt, LLMResponse } from '@shared/types';

/**
 * Cached LLM response entry
 */
interface CacheEntry {
  key: string;
  prompt: LLMPrompt;
  response: LLMResponse;
  timestamp: number;
  ttlMs?: number; // Time-to-live in milliseconds (optional)
}

/**
 * LLMCache handles caching of LLM requests and responses
 * Reduces API calls by storing responses to the same prompts
 * Automatically expires old cache entries based on TTL
 */
export class LLMCache {
  private cacheDir: string;
  private cacheFile: string;
  private cache: Map<string, CacheEntry> = new Map();
  private isDirty: boolean = false;
  private saveInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Use Electron app userData directory for persistent storage
    this.cacheDir = path.join(app.getPath('userData'), 'llm-cache');
    this.cacheFile = path.join(this.cacheDir, 'cache.json');
  }

  /**
   * Initialize the cache - loads from disk
   */
  async initialize(): Promise<void> {
    try {
      // Ensure cache directory exists
      await fs.mkdir(this.cacheDir, { recursive: true });

      // Load cache from disk if it exists
      try {
        const data = await fs.readFile(this.cacheFile, 'utf-8');
        const parsed = JSON.parse(data);
        
        // Restore cache with validation
        if (parsed && typeof parsed === 'object') {
          Object.entries(parsed).forEach(([key, entry]: [string, any]) => {
            if (this.isValidCacheEntry(entry)) {
              this.cache.set(key, entry as CacheEntry);
            }
          });
        }

        console.log(`[LLMCache] Loaded ${this.cache.size} cache entries from disk`);
      } catch (error: any) {
        // File doesn't exist yet or is invalid - start fresh
        if (error.code !== 'ENOENT') {
          console.warn('[LLMCache] Cache file corrupt or unreadable, starting fresh:', error.message);
        }
      }

      // Prune expired entries
      await this.pruneExpired();

      // Set up periodic save (every 30 seconds if dirty)
      this.setupPeriodicSave();
    } catch (error) {
      console.error('[LLMCache] Failed to initialize cache:', error);
    }
  }

  /**
   * Generate a cache key from a prompt
   * Uses SHA-256 hash of the prompt content
   */
  private generateCacheKey(prompt: LLMPrompt): string {
    // Create a stable key from the most important prompt fields
    const keyContent = JSON.stringify({
      systemPrompt: prompt.systemPrompt,
      userInstruction: prompt.userInstruction,
      responseFormat: prompt.responseFormat,
      // Don't include pageContext or conversationHistory as they can be large
      // and we want broader cache hits for similar prompts
    });

    return crypto.createHash('sha256').update(keyContent).digest('hex');
  }

  /**
   * Get a cached response for a prompt
   * Returns null if not cached or expired
   */
  async get(prompt: LLMPrompt): Promise<LLMResponse | null> {
    const key = this.generateCacheKey(prompt);
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check if expired
    if (entry.ttlMs && Date.now() - entry.timestamp > entry.ttlMs) {
      this.cache.delete(key);
      this.isDirty = true;
      return null;
    }

    console.log(`[LLMCache] Cache hit for prompt (key: ${key.substring(0, 8)}...)`);
    return entry.response;
  }

  /**
   * Store a response in the cache
   * @param prompt The original prompt
   * @param response The LLM response
   * @param ttlMs Optional TTL in milliseconds (default: 30 days)
   */
  async set(prompt: LLMPrompt, response: LLMResponse, ttlMs?: number): Promise<void> {
    const key = this.generateCacheKey(prompt);
    const entry: CacheEntry = {
      key,
      prompt,
      response,
      timestamp: Date.now(),
      ttlMs: ttlMs || 30 * 24 * 60 * 60 * 1000, // Default: 30 days
    };

    this.cache.set(key, entry);
    this.isDirty = true;

    console.log(`[LLMCache] Cached response (key: ${key.substring(0, 8)}..., size: ${this.cache.size} entries)`);
  }

  /**
   * Clear all cache entries
   */
  async clear(): Promise<void> {
    this.cache.clear();
    this.isDirty = true;
    await this.save();
    console.log('[LLMCache] Cache cleared');
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    memorySizeKb: number;
    oldestEntry: number | null;
    newestEntry: number | null;
  } {
    const entries = Array.from(this.cache.values());
    const timestamps = entries.map((e) => e.timestamp);

    return {
      size: this.cache.size,
      memorySizeKb: Math.round(JSON.stringify(Array.from(this.cache.values())).length / 1024),
      oldestEntry: timestamps.length > 0 ? Math.min(...timestamps) : null,
      newestEntry: timestamps.length > 0 ? Math.max(...timestamps) : null,
    };
  }

  /**
   * Validate a cache entry has required fields
   */
  private isValidCacheEntry(entry: any): entry is CacheEntry {
    return (
      entry &&
      typeof entry === 'object' &&
      typeof entry.key === 'string' &&
      entry.prompt &&
      entry.response &&
      typeof entry.timestamp === 'number'
    );
  }

  /**
   * Remove expired cache entries
   */
  private async pruneExpired(): Promise<void> {
    const now = Date.now();
    let pruned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.ttlMs && now - entry.timestamp > entry.ttlMs) {
        this.cache.delete(key);
        pruned++;
      }
    }

    if (pruned > 0) {
      this.isDirty = true;
      console.log(`[LLMCache] Pruned ${pruned} expired entries`);
    }
  }

  /**
   * Save cache to disk
   */
  private async save(): Promise<void> {
    try {
      const data: Record<string, CacheEntry> = {};
      for (const [key, entry] of this.cache.entries()) {
        data[key] = entry;
      }

      await fs.writeFile(this.cacheFile, JSON.stringify(data, null, 2), 'utf-8');
      this.isDirty = false;
      console.log(`[LLMCache] Saved ${this.cache.size} entries to disk`);
    } catch (error) {
      console.error('[LLMCache] Failed to save cache:', error);
    }
  }

  /**
   * Set up periodic save if cache is dirty
   */
  private setupPeriodicSave(): void {
    if (this.saveInterval) {
      clearInterval(this.saveInterval);
    }

    this.saveInterval = setInterval(() => {
      if (this.isDirty) {
        this.save();
      }
    }, 30000); // Save every 30 seconds if dirty
  }

  /**
   * Cleanup - cancel periodic save
   */
  destroy(): void {
    if (this.saveInterval) {
      clearInterval(this.saveInterval);
    }
    if (this.isDirty) {
      this.save();
    }
  }
}

// Singleton instance
let cacheInstance: LLMCache | null = null;

/**
 * Get or create the LLM cache singleton
 */
export async function getLLMCache(): Promise<LLMCache> {
  if (!cacheInstance) {
    cacheInstance = new LLMCache();
    await cacheInstance.initialize();
  }
  return cacheInstance;
}
