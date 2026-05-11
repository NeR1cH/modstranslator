/**
 * Rate Limit Statistics Tracker
 * Collects statistics about rate limit pauses and retries
 */

interface RateLimitStats {
  totalPauses: number;
  totalWaitTime: number; // in seconds
  successfulRetries: number;
  failedAttempts: number;
  stopReason: 'rate_limit_exhausted' | 'completed' | 'error' | null;
}

class RateLimitStatsTracker {
  private stats: RateLimitStats = {
    totalPauses: 0,
    totalWaitTime: 0,
    successfulRetries: 0,
    failedAttempts: 0,
    stopReason: null
  };

  /**
   * Record a rate limit pause
   */
  recordPause(waitTime: number): void {
    this.stats.totalPauses++;
    this.stats.totalWaitTime += waitTime;
  }

  /**
   * Record a successful retry after pause
   */
  recordSuccessfulRetry(): void {
    this.stats.successfulRetries++;
  }

  /**
   * Record a failed attempt
   */
  recordFailedAttempt(): void {
    this.stats.failedAttempts++;
  }

  /**
   * Set stop reason
   */
  setStopReason(reason: 'rate_limit_exhausted' | 'completed' | 'error'): void {
    this.stats.stopReason = reason;
  }

  /**
   * Get current statistics
   */
  getStats(): Readonly<RateLimitStats> {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  reset(): void {
    this.stats = {
      totalPauses: 0,
      totalWaitTime: 0,
      successfulRetries: 0,
      failedAttempts: 0,
      stopReason: null
    };
  }

  /**
   * Print statistics to console
   */
  printStats(): void {
    console.log('\n' + '='.repeat(60));
    console.log('📊 СТАТИСТИКА RATE LIMIT');
    console.log('='.repeat(60));
    console.log(`⏳ Всего пауз из-за rate limit: ${this.stats.totalPauses}`);
    console.log(`⏱️  Общее время ожидания: ${this.stats.totalWaitTime}s`);
    console.log(`🔄 Успешных retry после паузы: ${this.stats.successfulRetries}`);
    console.log(`❌ Неудачных попыток: ${this.stats.failedAttempts}`);

    const stopReasonText = this.getStopReasonText();
    console.log(`🚫 Причина остановки: ${stopReasonText}`);

    console.log('='.repeat(60) + '\n');
  }

  /**
   * Get human-readable stop reason
   */
  private getStopReasonText(): string {
    switch (this.stats.stopReason) {
      case 'rate_limit_exhausted':
        return 'rate limit исчерпан';
      case 'completed':
        return 'успешно завершено';
      case 'error':
        return 'ошибка перевода';
      default:
        return 'неизвестно';
    }
  }
}

// Singleton instance
let statsTracker: RateLimitStatsTracker | null = null;

/**
 * Get rate limit stats tracker instance
 */
export function getRateLimitStatsTracker(): RateLimitStatsTracker {
  if (!statsTracker) {
    statsTracker = new RateLimitStatsTracker();
  }
  return statsTracker;
}

/**
 * Export class for testing
 */
export { RateLimitStatsTracker };
