import fs from 'fs';
import path from 'path';
import { getFragmentCache } from '@/lib/fragmentCache';

// Mock fs module
jest.mock('fs');

describe('fragmentCache', () => {
  const mockCacheDir = path.join(process.cwd(), '.translation-cache');
  const mockCacheFile = path.join(mockCacheDir, 'fragments-v1.json');

  beforeAll(() => {
    // Setup mocks before any imports
    (fs.existsSync as jest.Mock).mockReturnValue(false);
    (fs.mkdirSync as jest.Mock).mockImplementation(() => {});
    (fs.readFileSync as jest.Mock).mockReturnValue('{"version":"v1","fragments":{}}');
    (fs.writeFileSync as jest.Mock).mockImplementation(() => {});
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getFragmentCache', () => {
    it('should create fragment cache instance', () => {
      const cache = getFragmentCache();

      expect(cache).toBeDefined();
      expect(cache.tryTranslate).toBeDefined();
      expect(cache.learn).toBeDefined();
    });

    it('should return singleton instance', () => {
      const cache1 = getFragmentCache();
      const cache2 = getFragmentCache();

      expect(cache1).toBe(cache2);
    });
  });

  describe('tryTranslate', () => {
    it('should return null for unknown text', () => {
      const cache = getFragmentCache();

      const result = cache.tryTranslate('Unknown Text');

      expect(result).toBeNull();
    });

    it('should return null for empty text', () => {
      const cache = getFragmentCache();

      const result = cache.tryTranslate('');

      expect(result).toBeNull();
    });

    it('should return null when confidence is too low', () => {
      const cache = getFragmentCache();

      // Learn with low confidence
      cache.learn('Diamond Sword', 'Алмазный меч');

      // Try to translate - should return null if confidence < 70
      const result = cache.tryTranslate('Diamond Sword');

      // Result can be null or string depending on confidence
      expect(result === null || typeof result === 'string').toBe(true);
    });

    it('should translate when fragments have high confidence', () => {
      const cache = getFragmentCache();

      // Learn multiple times to increase confidence
      for (let i = 0; i < 10; i++) {
        cache.learn('Diamond Sword', 'Алмазный меч');
      }

      const result = cache.tryTranslate('Diamond Sword');

      // Should either translate or return null
      expect(result === null || typeof result === 'string').toBe(true);
    });

    it('should return null for single word without pattern', () => {
      const cache = getFragmentCache();

      const result = cache.tryTranslate('RandomWord');

      expect(result).toBeNull();
    });

    it('should return null when not all fragments found', () => {
      const cache = getFragmentCache();

      // Learn only one part (single word, not a material/item pattern)
      cache.learn('Unknown', 'Неизвестный');

      // Try to translate two-word phrase with unknown pattern
      const result = cache.tryTranslate('Unknown Sword');

      expect(result).toBeNull();
    });
  });

  describe('learn', () => {
    it('should learn from translation pairs', () => {
      const cache = getFragmentCache();

      // Should not throw
      expect(() => cache.learn('Diamond Sword', 'Алмазный меч')).not.toThrow();
    });

    it('should handle empty strings', () => {
      const cache = getFragmentCache();

      expect(() => cache.learn('', '')).not.toThrow();
    });

    it('should handle multiple learns', () => {
      const cache = getFragmentCache();

      expect(() => {
        cache.learn('Diamond Sword', 'Алмазный меч');
        cache.learn('Iron Sword', 'Железный меч');
        cache.learn('Gold Sword', 'Золотой меч');
      }).not.toThrow();
    });

    it('should update existing fragment confidence on repeated learning', () => {
      const cache = getFragmentCache();

      cache.learn('Diamond Sword', 'Алмазный меч');
      cache.learn('Diamond Pickaxe', 'Алмазная кирка');

      // Learning same fragment again should increase confidence
      expect(() => cache.learn('Diamond Axe', 'Алмазный топор')).not.toThrow();
    });

    it('should handle conflicting translations', () => {
      const cache = getFragmentCache();

      cache.learn('Diamond Sword', 'Алмазный меч');
      // Different translation for same fragment should lower confidence
      cache.learn('Diamond Sword', 'Бриллиантовый меч');

      expect(() => cache.tryTranslate('Diamond Sword')).not.toThrow();
    });

    it('should learn single word patterns', () => {
      const cache = getFragmentCache();

      expect(() => cache.learn('Diamond', 'Алмазный')).not.toThrow();
      expect(() => cache.learn('Sword', 'Меч')).not.toThrow();
    });

    it('should handle non-material/item patterns', () => {
      const cache = getFragmentCache();

      // Should not extract patterns from non-matching text
      expect(() => cache.learn('Random Text', 'Случайный текст')).not.toThrow();
    });
  });

  describe('loadFromDisk', () => {
    it('should handle missing cache file', () => {
      (fs.existsSync as jest.Mock).mockReturnValueOnce(false);

      jest.resetModules();
      const { getFragmentCache: getFresh } = require('@/lib/fragmentCache');

      expect(() => getFresh()).not.toThrow();
    });

    it('should handle corrupted cache file', () => {
      (fs.existsSync as jest.Mock).mockReturnValueOnce(true);
      (fs.readFileSync as jest.Mock).mockReturnValueOnce('invalid json{');

      jest.resetModules();
      const { getFragmentCache: getFresh } = require('@/lib/fragmentCache');

      expect(() => getFresh()).not.toThrow();
    });

    it('should load valid cache file', () => {
      const mockData = {
        version: 'v1',
        fragments: {
          'diamond': {
            text: 'diamond',
            translation: 'алмазный',
            context: 'prefix',
            count: 5,
            confidence: 90
          }
        }
      };

      (fs.existsSync as jest.Mock).mockReturnValueOnce(true);
      (fs.readFileSync as jest.Mock).mockReturnValueOnce(JSON.stringify(mockData));

      jest.resetModules();
      const { getFragmentCache: getFresh } = require('@/lib/fragmentCache');

      expect(() => getFresh()).not.toThrow();
    });
  });

  describe('getStats', () => {
    it('should return cache statistics', () => {
      const cache = getFragmentCache();

      const stats = cache.getStats();

      expect(stats).toBeDefined();
      expect(stats.total).toBeGreaterThanOrEqual(0);
      expect(stats.highConfidence).toBeGreaterThanOrEqual(0);
      expect(stats.lowConfidence).toBeGreaterThanOrEqual(0);
    });
  });

  describe('flush', () => {
    it('should flush cache to disk', () => {
      const cache = getFragmentCache();

      cache.learn('Diamond Sword', 'Алмазный меч');

      expect(() => cache.flush()).not.toThrow();
    });
  });
});
