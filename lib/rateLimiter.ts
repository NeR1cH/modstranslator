// ============================================================
// BLOCK: DeepL API Rate Limiter
// Tracks usage and enforces monthly limits
// ============================================================

import fs from 'fs';
import path from 'path';

interface UsageStats {
  charactersUsed: number;
  requestsCount: number;
  lastReset: string; // ISO date string
  monthlyLimit: number;
}

class DeepLRateLimiter {
  private stats: UsageStats;
  private readonly FREE_LIMIT = 500000;
  private readonly PRO_LIMIT = Infinity;
  private readonly statsFile: string;

  constructor(apiKey: string) {
    this.statsFile = path.join(process.cwd(), '.deepl-usage.json');
    this.stats = this.loadStats();

    // Determine limit based on API key type
    const isFree = apiKey.trim().endsWith(':fx');
    this.stats.monthlyLimit = isFree ? this.FREE_LIMIT : this.PRO_LIMIT;

    console.log('[rate-limiter] Initialized with', isFree ? 'FREE' : 'PRO', 'tier');
    console.log('[rate-limiter] Current usage:', this.stats.charactersUsed, '/', this.stats.monthlyLimit);
  }

  /**
   * Check if there's enough quota for the requested character count
   * Throws error if limit would be exceeded
   */
  async checkLimit(textLength: number): Promise<void> {
    // Reset stats if new month started
    if (this.shouldReset()) {
      console.log('[rate-limiter] New month detected, resetting stats');
      this.resetStats();
    }

    const remaining = this.stats.monthlyLimit - this.stats.charactersUsed;

    // Check if request would exceed limit
    if (remaining < textLength) {
      const nextReset = this.getNextResetDate();
      throw new Error(
        `Недостаточно символов DeepL API.\n` +
        `Использовано: ${this.stats.charactersUsed.toLocaleString()}/${this.stats.monthlyLimit.toLocaleString()}\n` +
        `Требуется: ${textLength.toLocaleString()}\n` +
        `Осталось: ${remaining.toLocaleString()}\n` +
        `Лимит обновится: ${nextReset}`
      );
    }

    // Warning at 90% usage
    const usagePercent = (this.stats.charactersUsed / this.stats.monthlyLimit) * 100;
    if (usagePercent >= 90) {
      console.warn(
        `⚠️ [rate-limiter] HIGH USAGE WARNING: ${usagePercent.toFixed(1)}% used ` +
        `(${remaining.toLocaleString()} chars remaining)`
      );
    }
  }

  /**
   * Record usage after successful translation
   */
  recordUsage(charactersUsed: number): void {
    this.stats.charactersUsed += charactersUsed;
    this.stats.requestsCount++;

    const usagePercent = (this.stats.charactersUsed / this.stats.monthlyLimit) * 100;
    console.log(
      `[rate-limiter] Recorded ${charactersUsed} chars. ` +
      `Total: ${this.stats.charactersUsed.toLocaleString()} (${usagePercent.toFixed(1)}%)`
    );

    this.saveStats();
  }

  /**
   * Get current usage statistics
   */
  getUsageStats(): UsageStats {
    if (this.shouldReset()) {
      this.resetStats();
    }
    return { ...this.stats };
  }

  /**
   * Check if stats should be reset (new month)
   */
  private shouldReset(): boolean {
    const now = new Date();
    const lastReset = new Date(this.stats.lastReset);

    return (
      now.getMonth() !== lastReset.getMonth() ||
      now.getFullYear() !== lastReset.getFullYear()
    );
  }

  /**
   * Reset stats for new month
   */
  private resetStats(): void {
    this.stats.charactersUsed = 0;
    this.stats.requestsCount = 0;
    this.stats.lastReset = new Date().toISOString();
    this.saveStats();

    console.log('[rate-limiter] Stats reset for new month');
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
  private loadStats(): UsageStats {
    try {
      if (fs.existsSync(this.statsFile)) {
        const data = fs.readFileSync(this.statsFile, 'utf8');
        const stats = JSON.parse(data) as UsageStats;
        console.log('[rate-limiter] Loaded stats from disk');
        return stats;
      }
    } catch (error) {
      console.warn('[rate-limiter] Failed to load stats:', error);
    }

    // Default stats
    return {
      charactersUsed: 0,
      requestsCount: 0,
      lastReset: new Date().toISOString(),
      monthlyLimit: this.FREE_LIMIT
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
  const apiKey = process.env.DEEPL_API_KEY;

  if (!apiKey) {
    throw new Error('DEEPL_API_KEY не задан в .env файле');
  }

  if (!rateLimiterInstance) {
    rateLimiterInstance = new DeepLRateLimiter(apiKey);
  }

  return rateLimiterInstance;
}
