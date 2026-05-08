// ============================================================
// BLOCK: DeepL API Rate Limiter with Multi-Key Rotation
// Tracks usage and enforces monthly limits for multiple API keys
// ============================================================

import fs from 'fs';
import path from 'path';

interface KeyStats {
  charactersUsed: number;
  requestsCount: number;
  lastReset: string; // ISO date string
  monthlyLimit: number;
  status: 'active' | 'exhausted' | 'error';
}

interface MultiKeyUsageStats {
  keys: Record<string, KeyStats>;
  currentKeyIndex: number;
}

class DeepLRateLimiter {
  private apiKeys: string[];
  private stats: MultiKeyUsageStats;
  private readonly FREE_LIMIT = 500000;
  private readonly PRO_LIMIT = Infinity;
  private readonly statsFile: string;

  constructor(apiKeys: string | string[]) {
    this.statsFile = path.join(process.cwd(), '.deepl-usage.json');

    // Parse API keys (support both single string and array)
    if (typeof apiKeys === 'string') {
      // Support comma-separated keys in single string
      this.apiKeys = apiKeys.split(',').map(k => k.trim()).filter(k => k.length > 0);
    } else {
      this.apiKeys = apiKeys;
    }

    if (this.apiKeys.length === 0) {
      throw new Error('No API keys provided');
    }

    this.stats = this.loadStats();

    console.log(`[rate-limiter] Initialized with ${this.apiKeys.length} API key(s)`);
    this.logCurrentStatus();
  }

  /**
   * Get current active API key
   */
  getCurrentKey(): string {
    return this.apiKeys[this.stats.currentKeyIndex];
  }

  /**
   * Get masked version of API key for logging
   */
  private maskKey(key: string): string {
    if (key.length <= 8) return '***';
    return key.substring(0, 4) + '***' + key.substring(key.length - 4);
  }

  /**
   * Log current status
   */
  private logCurrentStatus(): void {
    const currentKey = this.getCurrentKey();
    const keyStats = this.stats.keys[currentKey];
    const maskedKey = this.maskKey(currentKey);

    console.log(`[rate-limiter] Current key: ${maskedKey} (${this.stats.currentKeyIndex + 1}/${this.apiKeys.length})`);
    console.log(`[rate-limiter] Usage: ${keyStats.charactersUsed.toLocaleString()} / ${keyStats.monthlyLimit.toLocaleString()}`);
    console.log(`[rate-limiter] Status: ${keyStats.status}`);
  }

  /**
   * Switch to next available API key
   * Returns true if switched successfully, false if no keys available
   */
  switchToNextKey(): boolean {
    const startIndex = this.stats.currentKeyIndex;
    let attempts = 0;

    while (attempts < this.apiKeys.length) {
      this.stats.currentKeyIndex = (this.stats.currentKeyIndex + 1) % this.apiKeys.length;
      attempts++;

      const nextKey = this.getCurrentKey();
      const keyStats = this.stats.keys[nextKey];

      // Reset stats if new month
      if (this.shouldResetKey(nextKey)) {
        this.resetKeyStats(nextKey);
      }

      // Check if this key has quota available
      const remaining = keyStats.monthlyLimit - keyStats.charactersUsed;
      if (remaining > 0 && keyStats.status !== 'error') {
        console.log(`[rate-limiter] Switched to key ${this.maskKey(nextKey)} (${this.stats.currentKeyIndex + 1}/${this.apiKeys.length})`);
        this.saveStats();
        return true;
      }
    }

    // No available keys
    console.error('[rate-limiter] All API keys exhausted');
    return false;
  }

  /**
   * Check if there's enough quota for the requested character count
   * Throws error if limit would be exceeded
   */
  async checkLimit(textLength: number): Promise<void> {
    const currentKey = this.getCurrentKey();
    const keyStats = this.stats.keys[currentKey];

    // Reset stats if new month started
    if (this.shouldResetKey(currentKey)) {
      console.log(`[rate-limiter] New month detected for key ${this.maskKey(currentKey)}, resetting stats`);
      this.resetKeyStats(currentKey);
    }

    const remaining = keyStats.monthlyLimit - keyStats.charactersUsed;

    // Check if request would exceed limit
    if (remaining < textLength) {
      console.warn(`[rate-limiter] Key ${this.maskKey(currentKey)} exhausted, attempting to switch...`);

      // Mark current key as exhausted
      keyStats.status = 'exhausted';
      this.saveStats();

      // Try to switch to next key
      if (this.switchToNextKey()) {
        // Recursively check limit with new key
        return this.checkLimit(textLength);
      }

      // No keys available
      const nextReset = this.getNextResetDate();
      throw new Error(
        `Все API ключи DeepL исчерпаны.\n` +
        `Всего ключей: ${this.apiKeys.length}\n` +
        `Лимит обновится: ${nextReset}`
      );
    }

    // Warning at 90% usage
    const usagePercent = (keyStats.charactersUsed / keyStats.monthlyLimit) * 100;
    if (usagePercent >= 90) {
      console.warn(
        `⚠️ [rate-limiter] HIGH USAGE WARNING: ${usagePercent.toFixed(1)}% used ` +
        `(${remaining.toLocaleString()} chars remaining) on key ${this.maskKey(currentKey)}`
      );
    }
  }

  /**
   * Record usage after successful translation
   */
  recordUsage(charactersUsed: number): void {
    const currentKey = this.getCurrentKey();
    const keyStats = this.stats.keys[currentKey];

    keyStats.charactersUsed += charactersUsed;
    keyStats.requestsCount++;

    const usagePercent = (keyStats.charactersUsed / keyStats.monthlyLimit) * 100;
    console.log(
      `[rate-limiter] Recorded ${charactersUsed} chars on key ${this.maskKey(currentKey)}. ` +
      `Total: ${keyStats.charactersUsed.toLocaleString()} (${usagePercent.toFixed(1)}%)`
    );

    this.saveStats();
  }

  /**
   * Get current usage statistics (for all keys)
   */
  getUsageStats(): MultiKeyUsageStats {
    // Reset stats for keys if new month
    for (const key of this.apiKeys) {
      if (this.shouldResetKey(key)) {
        this.resetKeyStats(key);
      }
    }
    return { ...this.stats };
  }

  /**
   * Check if stats should be reset for a specific key (new month)
   */
  private shouldResetKey(key: string): boolean {
    const keyStats = this.stats.keys[key];
    if (!keyStats) return false;

    const now = new Date();
    const lastReset = new Date(keyStats.lastReset);

    return (
      now.getMonth() !== lastReset.getMonth() ||
      now.getFullYear() !== lastReset.getFullYear()
    );
  }

  /**
   * Reset stats for a specific key
   */
  private resetKeyStats(key: string): void {
    const keyStats = this.stats.keys[key];
    if (!keyStats) return;

    keyStats.charactersUsed = 0;
    keyStats.requestsCount = 0;
    keyStats.lastReset = new Date().toISOString();
    keyStats.status = 'active';
    this.saveStats();

    console.log(`[rate-limiter] Stats reset for key ${this.maskKey(key)}`);
  }

  /**
   * Get date when limit will reset
   */
  private getNextResetDate(): string {
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return nextMonth.toLocaleDateString('ru-RU', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  /**
   * Load stats from disk
   */
  private loadStats(): MultiKeyUsageStats {
    try {
      if (fs.existsSync(this.statsFile)) {
        const data = fs.readFileSync(this.statsFile, 'utf8');
        const stats = JSON.parse(data) as MultiKeyUsageStats;
        console.log('[rate-limiter] Loaded stats from disk');

        // Validate and add missing keys
        for (const key of this.apiKeys) {
          if (!stats.keys[key]) {
            stats.keys[key] = this.createDefaultKeyStats(key);
          }
        }

        // Ensure currentKeyIndex is valid
        if (stats.currentKeyIndex >= this.apiKeys.length) {
          stats.currentKeyIndex = 0;
        }

        return stats;
      }
    } catch (error) {
      console.warn('[rate-limiter] Failed to load stats:', error);
    }

    // Default stats
    const keys: Record<string, KeyStats> = {};
    for (const key of this.apiKeys) {
      keys[key] = this.createDefaultKeyStats(key);
    }

    return {
      keys,
      currentKeyIndex: 0
    };
  }

  /**
   * Create default stats for a key
   */
  private createDefaultKeyStats(key: string): KeyStats {
    const isFree = key.trim().endsWith(':fx');
    return {
      charactersUsed: 0,
      requestsCount: 0,
      lastReset: new Date().toISOString(),
      monthlyLimit: isFree ? this.FREE_LIMIT : this.PRO_LIMIT,
      status: 'active'
    };
  }

  /**
   * Save stats to disk
   */
  private saveStats(): void {
    try {
      fs.writeFileSync(
        this.statsFile,
        JSON.stringify(this.stats, null, 2),
        'utf8'
      );
    } catch (error) {
      console.error('[rate-limiter] Failed to save stats:', error);
    }
  }
}

// Singleton instance
let rateLimiterInstance: DeepLRateLimiter | null = null;

/**
 * Get or create rate limiter instance
 */
export function getRateLimiter(): DeepLRateLimiter {
  const apiKeys = process.env.DEEPL_API_KEY || process.env.DEEPL_API_KEYS;

  if (!apiKeys) {
    throw new Error('DEEPL_API_KEY или DEEPL_API_KEYS не задан в .env файле');
  }

  if (!rateLimiterInstance) {
    rateLimiterInstance = new DeepLRateLimiter(apiKeys);
  }

  return rateLimiterInstance;
}
