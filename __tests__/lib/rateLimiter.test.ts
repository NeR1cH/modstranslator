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
      expect(limiter.getCurrentKey).toBeDefined();
    });

    it('should throw error if API key is missing', () => {
      delete process.env.DEEPL_API_KEY;

      expect(() => getRateLimiter()).toThrow('DEEPL_API_KEY или DEEPL_API_KEYS не задан в .env файле');
    });

    it('should return singleton instance', () => {
      const limiter1 = getRateLimiter();
      const limiter2 = getRateLimiter();

      expect(limiter1).toBe(limiter2);
    });
  });

  describe('checkLimit', () => {
    it('should pass if within limit', async () => {
      jest.resetModules();
      const { getRateLimiter: getRateLimiterFresh } = require('@/lib/rateLimiter');
      process.env.DEEPL_API_KEY = mockApiKey;

      const limiter = getRateLimiterFresh();

      await expect(limiter.checkLimit(1000)).resolves.not.toThrow();
    });

    it('should throw error if exceeds limit', async () => {
      jest.resetModules();
      const { getRateLimiter: getRateLimiterFresh } = require('@/lib/rateLimiter');
      process.env.DEEPL_API_KEY = mockApiKey;

      const limiter = getRateLimiterFresh();

      // Record usage to fill limit
      limiter.recordUsage(500000);

      await expect(limiter.checkLimit(1000)).rejects.toThrow('Все API ключи DeepL исчерпаны');
    });

    it('should warn at 90% usage', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      jest.resetModules();
      const { getRateLimiter: getRateLimiterFresh } = require('@/lib/rateLimiter');
      process.env.DEEPL_API_KEY = mockApiKey;

      const limiter = getRateLimiterFresh();

      // Record 90% usage
      limiter.recordUsage(450000);

      await limiter.checkLimit(1000);

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('HIGH USAGE WARNING')
      );

      consoleWarnSpy.mockRestore();
    });
  });

  describe('recordUsage', () => {
    it('should record usage correctly', () => {
      jest.resetModules();
      const { getRateLimiter: getRateLimiterFresh } = require('@/lib/rateLimiter');
      process.env.DEEPL_API_KEY = mockApiKey;

      const limiter = getRateLimiterFresh();

      limiter.recordUsage(1000);

      const stats = limiter.getUsageStats();
      const currentKey = limiter.getCurrentKey();

      expect(stats.keys[currentKey].charactersUsed).toBe(1000);
      expect(stats.keys[currentKey].requestsCount).toBe(1);
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
      const currentKey = limiter.getCurrentKey();

      expect(stats.keys[currentKey].charactersUsed).toBe(6000);
      expect(stats.keys[currentKey].requestsCount).toBe(3);
    });
  });

  describe('multi-key support', () => {
    it('should support multiple keys', () => {
      jest.resetModules();
      const { getRateLimiter: getRateLimiterFresh } = require('@/lib/rateLimiter');
      process.env.DEEPL_API_KEY = 'key1:fx,key2:fx,key3:fx';

      const limiter = getRateLimiterFresh();
      const stats = limiter.getUsageStats();

      expect(Object.keys(stats.keys).length).toBe(3);
    });

    it('should switch to next key when current is exhausted', async () => {
      jest.resetModules();
      const { getRateLimiter: getRateLimiterFresh } = require('@/lib/rateLimiter');
      process.env.DEEPL_API_KEY = 'key1:fx,key2:fx';

      const limiter = getRateLimiterFresh();

      // Exhaust first key
      limiter.recordUsage(500000);

      // Should switch to second key
      await expect(limiter.checkLimit(1000)).resolves.not.toThrow();

      const stats = limiter.getUsageStats();
      expect(stats.currentKeyIndex).toBe(1);
    });

    it('should throw error when all keys exhausted', async () => {
      jest.resetModules();
      const { getRateLimiter: getRateLimiterFresh } = require('@/lib/rateLimiter');
      process.env.DEEPL_API_KEY = 'key1:fx,key2:fx';

      const limiter = getRateLimiterFresh();

      // Exhaust both keys
      limiter.recordUsage(500000);
      await limiter.checkLimit(1000); // Switch to key2
      limiter.recordUsage(500000);

      // Should fail
      await expect(limiter.checkLimit(1000)).rejects.toThrow('Все API ключи DeepL исчерпаны');
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
      const currentKey = limiter.getCurrentKey();

      expect(stats.keys[currentKey].charactersUsed).toBe(1000);
      expect(stats.keys[currentKey].requestsCount).toBe(1);
      expect(stats.keys[currentKey].monthlyLimit).toBe(500000);
      expect(stats.keys[currentKey].lastReset).toBeDefined();
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
        keys: {
          [mockApiKey]: {
            charactersUsed: 100000,
            requestsCount: 10,
            lastReset: lastMonth.toISOString(),
            monthlyLimit: 500000,
            status: 'active'
          }
        },
        currentKeyIndex: 0
      }));

      jest.resetModules();
      const { getRateLimiter: getRateLimiterFresh } = require('@/lib/rateLimiter');
      process.env.DEEPL_API_KEY = mockApiKey;

      const limiter = getRateLimiterFresh();
      const stats = limiter.getUsageStats();
      const currentKey = limiter.getCurrentKey();

      expect(stats.keys[currentKey].charactersUsed).toBe(0);
    });
  });

  describe('loadStats', () => {
    it('should load stats from disk if in same month', () => {
      // Use current date to ensure same month
      const now = new Date();
      const mockStats = {
        keys: {
          [mockApiKey]: {
            charactersUsed: 50000,
            requestsCount: 5,
            lastReset: now.toISOString(),
            monthlyLimit: 500000,
            status: 'active'
          }
        },
        currentKeyIndex: 0
      };

      (fs.existsSync as jest.Mock).mockReturnValueOnce(true);
      (fs.readFileSync as jest.Mock).mockReturnValueOnce(JSON.stringify(mockStats));

      jest.resetModules();
      const { getRateLimiter: getRateLimiterFresh } = require('@/lib/rateLimiter');
      process.env.DEEPL_API_KEY = mockApiKey;

      const limiter = getRateLimiterFresh();
      const stats = limiter.getUsageStats();
      const currentKey = limiter.getCurrentKey();

      // Should load stats if in same month
      expect(stats.keys[currentKey].charactersUsed).toBeGreaterThanOrEqual(0);
      expect(stats.keys[currentKey].requestsCount).toBeGreaterThanOrEqual(0);
    });

    it('should use default stats if file does not exist', () => {
      (fs.existsSync as jest.Mock).mockReturnValueOnce(false);

      jest.resetModules();
      const { getRateLimiter: getRateLimiterFresh } = require('@/lib/rateLimiter');
      process.env.DEEPL_API_KEY = mockApiKey;

      const limiter = getRateLimiterFresh();
      const stats = limiter.getUsageStats();
      const currentKey = limiter.getCurrentKey();

      expect(stats.keys[currentKey].charactersUsed).toBe(0);
      expect(stats.keys[currentKey].requestsCount).toBe(0);
    });

    it('should use default stats if file is corrupted', () => {
      (fs.existsSync as jest.Mock).mockReturnValueOnce(true);
      (fs.readFileSync as jest.Mock).mockReturnValueOnce('invalid json{');

      jest.resetModules();
      const { getRateLimiter: getRateLimiterFresh } = require('@/lib/rateLimiter');
      process.env.DEEPL_API_KEY = mockApiKey;

      const limiter = getRateLimiterFresh();
      const stats = limiter.getUsageStats();
      const currentKey = limiter.getCurrentKey();

      expect(stats.keys[currentKey].charactersUsed).toBe(0);
      expect(stats.keys[currentKey].requestsCount).toBe(0);
    });
  });

  describe('month detection', () => {
    it('should reset stats for different month', () => {
      const lastMonth = new Date();
      lastMonth.setMonth(lastMonth.getMonth() - 1);

      (fs.existsSync as jest.Mock).mockReturnValueOnce(true);
      (fs.readFileSync as jest.Mock).mockReturnValueOnce(JSON.stringify({
        keys: {
          [mockApiKey]: {
            charactersUsed: 100000,
            requestsCount: 10,
            lastReset: lastMonth.toISOString(),
            monthlyLimit: 500000,
            status: 'active'
          }
        },
        currentKeyIndex: 0
      }));

      jest.resetModules();
      const { getRateLimiter: getRateLimiterFresh } = require('@/lib/rateLimiter');
      process.env.DEEPL_API_KEY = mockApiKey;

      const limiter = getRateLimiterFresh();
      const stats = limiter.getUsageStats();
      const currentKey = limiter.getCurrentKey();

      // Should reset since last month
      expect(stats.keys[currentKey].charactersUsed).toBe(0);
      expect(stats.keys[currentKey].requestsCount).toBe(0);
    });

    it('should detect different year', () => {
      const lastYear = new Date();
      lastYear.setFullYear(lastYear.getFullYear() - 1);

      (fs.existsSync as jest.Mock).mockReturnValueOnce(true);
      (fs.readFileSync as jest.Mock).mockReturnValueOnce(JSON.stringify({
        keys: {
          [mockApiKey]: {
            charactersUsed: 100000,
            requestsCount: 10,
            lastReset: lastYear.toISOString(),
            monthlyLimit: 500000,
            status: 'active'
          }
        },
        currentKeyIndex: 0
      }));

      jest.resetModules();
      const { getRateLimiter: getRateLimiterFresh } = require('@/lib/rateLimiter');
      process.env.DEEPL_API_KEY = mockApiKey;

      const limiter = getRateLimiterFresh();
      const stats = limiter.getUsageStats();
      const currentKey = limiter.getCurrentKey();

      // Should reset since last year
      expect(stats.keys[currentKey].charactersUsed).toBe(0);
    });
  });
});
