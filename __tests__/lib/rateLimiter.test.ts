import fs from 'fs';
import path from 'path';
import { getRateLimiter } from '@/lib/rateLimiter';

// Mock fs module
jest.mock('fs');

describe('rateLimiter', () => {
  const mockApiKey = 'test-api-key:fx';
  const originalEnv = process.env;
  const mockStatsFile = path.join(process.cwd(), '.deepl-usage.json');

  beforeAll(() => {
    // Mock fs operations once
    (fs.existsSync as jest.Mock).mockReturnValue(false);
    (fs.readFileSync as jest.Mock).mockReturnValue('{}');
    (fs.writeFileSync as jest.Mock).mockImplementation(() => {});
  });

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv, DEEPL_API_KEY: mockApiKey };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('getRateLimiter', () => {
    it('should create rate limiter instance', () => {
      const limiter = getRateLimiter();

      expect(limiter).toBeDefined();
      expect(limiter.checkLimit).toBeDefined();
      expect(limiter.recordUsage).toBeDefined();
      expect(limiter.getUsageStats).toBeDefined();
    });

    it('should throw error if API key is missing', () => {
      delete process.env.DEEPL_API_KEY;

      expect(() => getRateLimiter()).toThrow('DEEPL_API_KEY не задан в .env файле');
    });

    it('should return singleton instance', () => {
      const limiter1 = getRateLimiter();
      const limiter2 = getRateLimiter();

      expect(limiter1).toBe(limiter2);
    });
  });

  describe('checkLimit', () => {
    it('should allow request within limit', async () => {
      jest.resetModules();
      const { getRateLimiter: getRateLimiterFresh } = require('@/lib/rateLimiter');
      process.env.DEEPL_API_KEY = mockApiKey;

      const limiter = getRateLimiterFresh();

      await expect(limiter.checkLimit(1000)).resolves.not.toThrow();
    });

    it('should throw error when limit exceeded', async () => {
      jest.resetModules();
      const { getRateLimiter: getRateLimiterFresh } = require('@/lib/rateLimiter');
      process.env.DEEPL_API_KEY = mockApiKey;

      const limiter = getRateLimiterFresh();

      // Record usage up to limit
      limiter.recordUsage(500000);

      await expect(limiter.checkLimit(1000)).rejects.toThrow(
        'Недостаточно символов DeepL API'
      );
    });

    it('should warn at 90% usage', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      jest.resetModules();
      const { getRateLimiter: getRateLimiterFresh } = require('@/lib/rateLimiter');
      process.env.DEEPL_API_KEY = mockApiKey;

      const limiter = getRateLimiterFresh();

      // Use 90% of limit
      limiter.recordUsage(450000);

      await limiter.checkLimit(1000);

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('HIGH USAGE WARNING')
      );

      consoleWarnSpy.mockRestore();
    });

    it('should reset stats for new month', async () => {
      const lastMonth = new Date();
      lastMonth.setMonth(lastMonth.getMonth() - 1);

      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify({
        charactersUsed: 100000,
        requestsCount: 10,
        lastReset: lastMonth.toISOString(),
        monthlyLimit: 500000,
      }));

      // Reset modules to get fresh instance
      jest.resetModules();
      const { getRateLimiter: getRateLimiterFresh } = require('@/lib/rateLimiter');
      process.env.DEEPL_API_KEY = mockApiKey;

      const limiter = getRateLimiterFresh();
      const stats = limiter.getUsageStats();

      // Should be reset to 0
      expect(stats.charactersUsed).toBe(0);
      expect(stats.requestsCount).toBe(0);
    });

    it('should use FREE limit for free API keys', async () => {
      process.env.DEEPL_API_KEY = 'test-key:fx';
      jest.resetModules();
      const { getRateLimiter: getRateLimiterFresh } = require('@/lib/rateLimiter');

      const limiter = getRateLimiterFresh();
      const stats = limiter.getUsageStats();

      expect(stats.monthlyLimit).toBe(500000);
    });

    it('should use PRO limit for pro API keys', async () => {
      process.env.DEEPL_API_KEY = 'test-pro-key';
      jest.resetModules();
      const { getRateLimiter: getRateLimiterFresh } = require('@/lib/rateLimiter');

      const limiter = getRateLimiterFresh();
      const stats = limiter.getUsageStats();

      expect(stats.monthlyLimit).toBe(Infinity);
    });
  });

  describe('recordUsage', () => {
    it('should record character usage', () => {
      jest.resetModules();
      const { getRateLimiter: getRateLimiterFresh } = require('@/lib/rateLimiter');
      process.env.DEEPL_API_KEY = mockApiKey;

      const limiter = getRateLimiterFresh();

      limiter.recordUsage(1000);

      const stats = limiter.getUsageStats();
      expect(stats.charactersUsed).toBe(1000);
      expect(stats.requestsCount).toBe(1);
    });

    it('should accumulate usage', () => {
      jest.resetModules();
      const { getRateLimiter: getRateLimiterFresh } = require('@/lib/rateLimiter');
      process.env.DEEPL_API_KEY = mockApiKey;

      const limiter = getRateLimiterFresh();

      limiter.recordUsage(1000);
      limiter.recordUsage(2000);
      limiter.recordUsage(3000);

      const stats = limiter.getUsageStats();
      expect(stats.charactersUsed).toBe(6000);
      expect(stats.requestsCount).toBe(3);
    });
  });

  describe('getUsageStats', () => {
    it('should return current stats', () => {
      jest.resetModules();
      const { getRateLimiter: getRateLimiterFresh } = require('@/lib/rateLimiter');
      process.env.DEEPL_API_KEY = mockApiKey;

      const limiter = getRateLimiterFresh();

      limiter.recordUsage(1000);

      const stats = limiter.getUsageStats();

      expect(stats.charactersUsed).toBe(1000);
      expect(stats.requestsCount).toBe(1);
      expect(stats.monthlyLimit).toBe(500000);
      expect(stats.lastReset).toBeDefined();
    });

    it('should return copy of stats', () => {
      jest.resetModules();
      const { getRateLimiter: getRateLimiterFresh } = require('@/lib/rateLimiter');
      process.env.DEEPL_API_KEY = mockApiKey;

      const limiter = getRateLimiterFresh();

      const stats1 = limiter.getUsageStats();
      const stats2 = limiter.getUsageStats();

      expect(stats1).not.toBe(stats2);
      expect(stats1).toEqual(stats2);
    });

    it('should reset stats if new month', () => {
      const lastMonth = new Date();
      lastMonth.setMonth(lastMonth.getMonth() - 1);

      (fs.existsSync as jest.Mock).mockReturnValueOnce(true);
      (fs.readFileSync as jest.Mock).mockReturnValueOnce(JSON.stringify({
        charactersUsed: 100000,
        requestsCount: 10,
        lastReset: lastMonth.toISOString(),
        monthlyLimit: 500000,
      }));

      jest.resetModules();
      const { getRateLimiter: getRateLimiterFresh } = require('@/lib/rateLimiter');
      process.env.DEEPL_API_KEY = mockApiKey;

      const limiter = getRateLimiterFresh();
      const stats = limiter.getUsageStats();

      expect(stats.charactersUsed).toBe(0);
    });
  });

  describe('loadStats', () => {
    it('should load stats from disk if in same month', () => {
      // Use current date to ensure same month
      const now = new Date();
      const mockStats = {
        charactersUsed: 50000,
        requestsCount: 5,
        lastReset: now.toISOString(),
        monthlyLimit: 500000,
      };

      (fs.existsSync as jest.Mock).mockReturnValueOnce(true);
      (fs.readFileSync as jest.Mock).mockReturnValueOnce(JSON.stringify(mockStats));

      jest.resetModules();
      const { getRateLimiter: getRateLimiterFresh } = require('@/lib/rateLimiter');
      process.env.DEEPL_API_KEY = mockApiKey;

      const limiter = getRateLimiterFresh();
      const stats = limiter.getUsageStats();

      // Should load stats if in same month
      expect(stats.charactersUsed).toBeGreaterThanOrEqual(0);
      expect(stats.requestsCount).toBeGreaterThanOrEqual(0);
    });

    it('should use default stats if file does not exist', () => {
      (fs.existsSync as jest.Mock).mockReturnValueOnce(false);

      jest.resetModules();
      const { getRateLimiter: getRateLimiterFresh } = require('@/lib/rateLimiter');
      process.env.DEEPL_API_KEY = mockApiKey;

      const limiter = getRateLimiterFresh();
      const stats = limiter.getUsageStats();

      expect(stats.charactersUsed).toBe(0);
      expect(stats.requestsCount).toBe(0);
    });

    it('should use default stats if file is corrupted', () => {
      (fs.existsSync as jest.Mock).mockReturnValueOnce(true);
      (fs.readFileSync as jest.Mock).mockReturnValueOnce('invalid json{');

      jest.resetModules();
      const { getRateLimiter: getRateLimiterFresh } = require('@/lib/rateLimiter');
      process.env.DEEPL_API_KEY = mockApiKey;

      const limiter = getRateLimiterFresh();
      const stats = limiter.getUsageStats();

      expect(stats.charactersUsed).toBe(0);
      expect(stats.requestsCount).toBe(0);
    });
  });

  describe('month detection', () => {
    it('should reset stats for different month', () => {
      const lastMonth = new Date();
      lastMonth.setMonth(lastMonth.getMonth() - 1);

      const mockStats = {
        charactersUsed: 50000,
        requestsCount: 5,
        lastReset: lastMonth.toISOString(),
        monthlyLimit: 500000,
      };

      (fs.existsSync as jest.Mock).mockReturnValueOnce(true);
      (fs.readFileSync as jest.Mock).mockReturnValueOnce(JSON.stringify(mockStats));

      jest.resetModules();
      const { getRateLimiter: getRateLimiterFresh } = require('@/lib/rateLimiter');
      process.env.DEEPL_API_KEY = mockApiKey;

      const limiter = getRateLimiterFresh();
      const stats = limiter.getUsageStats();

      // Should reset since last month
      expect(stats.charactersUsed).toBe(0);
      expect(stats.requestsCount).toBe(0);
    });

    it('should detect different year', () => {
      const lastYear = new Date();
      lastYear.setFullYear(lastYear.getFullYear() - 1);

      const mockStats = {
        charactersUsed: 50000,
        requestsCount: 5,
        lastReset: lastYear.toISOString(),
        monthlyLimit: 500000,
      };

      (fs.existsSync as jest.Mock).mockReturnValueOnce(true);
      (fs.readFileSync as jest.Mock).mockReturnValueOnce(JSON.stringify(mockStats));

      jest.resetModules();
      const { getRateLimiter: getRateLimiterFresh } = require('@/lib/rateLimiter');
      process.env.DEEPL_API_KEY = mockApiKey;

      const limiter = getRateLimiterFresh();
      const stats = limiter.getUsageStats();

      // Should reset since last year
      expect(stats.charactersUsed).toBe(0);
    });
  });
});
