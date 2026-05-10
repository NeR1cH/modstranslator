/**
 * Tests for Rate Limit Statistics Tracker
 */

import { getRateLimitStatsTracker, RateLimitStatsTracker } from '@/lib/rateLimitStats';

describe('RateLimitStatsTracker', () => {
  let tracker: RateLimitStatsTracker;

  beforeEach(() => {
    tracker = new RateLimitStatsTracker();
  });

  describe('recordPause', () => {
    it('should record a pause and increment counters', () => {
      tracker.recordPause(60);

      const stats = tracker.getStats();
      expect(stats.totalPauses).toBe(1);
      expect(stats.totalWaitTime).toBe(60);
    });

    it('should accumulate multiple pauses', () => {
      tracker.recordPause(30);
      tracker.recordPause(45);
      tracker.recordPause(60);

      const stats = tracker.getStats();
      expect(stats.totalPauses).toBe(3);
      expect(stats.totalWaitTime).toBe(135);
    });
  });

  describe('recordSuccessfulRetry', () => {
    it('should increment successful retry counter', () => {
      tracker.recordSuccessfulRetry();
      tracker.recordSuccessfulRetry();

      const stats = tracker.getStats();
      expect(stats.successfulRetries).toBe(2);
    });
  });

  describe('recordFailedAttempt', () => {
    it('should increment failed attempt counter', () => {
      tracker.recordFailedAttempt();
      tracker.recordFailedAttempt();
      tracker.recordFailedAttempt();

      const stats = tracker.getStats();
      expect(stats.failedAttempts).toBe(3);
    });
  });

  describe('setStopReason', () => {
    it('should set stop reason to rate_limit_exhausted', () => {
      tracker.setStopReason('rate_limit_exhausted');

      const stats = tracker.getStats();
      expect(stats.stopReason).toBe('rate_limit_exhausted');
    });

    it('should set stop reason to completed', () => {
      tracker.setStopReason('completed');

      const stats = tracker.getStats();
      expect(stats.stopReason).toBe('completed');
    });

    it('should set stop reason to error', () => {
      tracker.setStopReason('error');

      const stats = tracker.getStats();
      expect(stats.stopReason).toBe('error');
    });
  });

  describe('reset', () => {
    it('should reset all statistics to initial state', () => {
      tracker.recordPause(60);
      tracker.recordSuccessfulRetry();
      tracker.recordFailedAttempt();
      tracker.setStopReason('completed');

      tracker.reset();

      const stats = tracker.getStats();
      expect(stats.totalPauses).toBe(0);
      expect(stats.totalWaitTime).toBe(0);
      expect(stats.successfulRetries).toBe(0);
      expect(stats.failedAttempts).toBe(0);
      expect(stats.stopReason).toBe(null);
    });
  });

  describe('printStats', () => {
    it('should not print if no rate limit events occurred', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      tracker.printStats();

      expect(consoleSpy).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should print stats if pauses occurred', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      tracker.recordPause(60);
      tracker.recordSuccessfulRetry();
      tracker.setStopReason('completed');

      tracker.printStats();

      expect(consoleSpy).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('СТАТИСТИКА RATE LIMIT'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Всего пауз из-за rate limit: 1'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Общее время ожидания: 60s'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Успешных retry после паузы: 1'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('успешно завершено'));

      consoleSpy.mockRestore();
    });

    it('should print stats if failed attempts occurred', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      tracker.recordFailedAttempt();
      tracker.recordFailedAttempt();
      tracker.setStopReason('rate_limit_exhausted');

      tracker.printStats();

      expect(consoleSpy).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Неудачных попыток: 2'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('rate limit исчерпан'));

      consoleSpy.mockRestore();
    });

    it('should show correct stop reason text', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      tracker.recordPause(30);
      tracker.setStopReason('error');

      tracker.printStats();

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('ошибка перевода'));

      consoleSpy.mockRestore();
    });
  });

  describe('getStats', () => {
    it('should return a copy of stats, not reference', () => {
      const stats1 = tracker.getStats();
      stats1.totalPauses = 999; // Try to modify

      const stats2 = tracker.getStats();
      expect(stats2.totalPauses).toBe(0); // Should still be 0
    });
  });

  describe('getRateLimitStatsTracker', () => {
    it('should return singleton instance', () => {
      const tracker1 = getRateLimitStatsTracker();
      const tracker2 = getRateLimitStatsTracker();

      expect(tracker1).toBe(tracker2);
    });

    it('should maintain state across calls', () => {
      const tracker1 = getRateLimitStatsTracker();
      tracker1.recordPause(60);

      const tracker2 = getRateLimitStatsTracker();
      const stats = tracker2.getStats();

      expect(stats.totalPauses).toBe(1);
      expect(stats.totalWaitTime).toBe(60);

      // Clean up for other tests
      tracker1.reset();
    });
  });

  describe('realistic scenario', () => {
    it('should track a complete rate limit scenario', () => {
      // Simulate: 3 pauses, 2 successful retries, 1 final failure
      tracker.recordPause(60);
      tracker.recordFailedAttempt();
      tracker.recordSuccessfulRetry();

      tracker.recordPause(60);
      tracker.recordFailedAttempt();
      tracker.recordSuccessfulRetry();

      tracker.recordPause(60);
      tracker.recordFailedAttempt();
      // No successful retry this time

      tracker.setStopReason('rate_limit_exhausted');

      const stats = tracker.getStats();
      expect(stats.totalPauses).toBe(3);
      expect(stats.totalWaitTime).toBe(180);
      expect(stats.successfulRetries).toBe(2);
      expect(stats.failedAttempts).toBe(3);
      expect(stats.stopReason).toBe('rate_limit_exhausted');
    });
  });
});
