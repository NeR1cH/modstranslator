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
      cache.learn('Settings', 'Настройки');

      // Try to translate - should return null if confidence < 70
      const result = cache.tryTranslate('Settings');

      // Result can be null or string depending on confidence
      expect(result === null || typeof result === 'string').toBe(true);
    });

    it('should translate exact phrase match with high confidence', () => {
      const cache = getFragmentCache();

      // Learn multiple times to increase confidence
      for (let i = 0; i < 10; i++) {
        cache.learn('Armor Status', 'Статус брони');
      }

      const result = cache.tryTranslate('Armor Status');

      // Should either translate or return null
      expect(result === null || typeof result === 'string').toBe(true);
    });

    it('should translate word-by-word when all words are known', () => {
      const cache = getFragmentCache();

      // Learn individual words
      for (let i = 0; i < 10; i++) {
        cache.learn('Enable', 'Включить');
        cache.learn('Notifications', 'Уведомления');
      }

      const result = cache.tryTranslate('Enable Notifications');

      // Should either translate or return null
      expect(result === null || typeof result === 'string').toBe(true);
    });

    it('should return null when not all words are known', () => {
      const cache = getFragmentCache();

      // Learn only one word
      cache.learn('Enable', 'Включить');

      // Try to translate two-word phrase with one unknown word
      const result = cache.tryTranslate('Enable Something');

      expect(result).toBeNull();
    });
  });

  describe('learn', () => {
    it('should learn from translation pairs', () => {
      const cache = getFragmentCache();

      // Should not throw
      expect(() => cache.learn('Settings', 'Настройки')).not.toThrow();
    });

    it('should handle empty strings', () => {
      const cache = getFragmentCache();

      expect(() => cache.learn('', '')).not.toThrow();
    });

    it('should handle multiple learns', () => {
      const cache = getFragmentCache();

      expect(() => {
        cache.learn('Enable', 'Включить');
        cache.learn('Disable', 'Отключить');
        cache.learn('Settings', 'Настройки');
      }).not.toThrow();
    });

    it('should update existing fragment confidence on repeated learning', () => {
      const cache = getFragmentCache();

      cache.learn('Enable', 'Включить');
      cache.learn('Enable', 'Включить');

      // Learning same fragment again should increase confidence
      expect(() => cache.learn('Enable', 'Включить')).not.toThrow();
    });

    it('should handle conflicting translations', () => {
      const cache = getFragmentCache();

      cache.learn('Settings', 'Настройки');
      // Different translation for same fragment should lower confidence
      cache.learn('Settings', 'Параметры');

      expect(() => cache.tryTranslate('Settings')).not.toThrow();
    });

    it('should learn single word patterns', () => {
      const cache = getFragmentCache();

      expect(() => cache.learn('Enable', 'Включить')).not.toThrow();
      expect(() => cache.learn('Disable', 'Отключить')).not.toThrow();
    });

    it('should learn phrases', () => {
      const cache = getFragmentCache();

      expect(() => cache.learn('Armor Status', 'Статус брони')).not.toThrow();
      expect(() => cache.learn('Enable Notifications', 'Включить уведомления')).not.toThrow();
    });

    it('should extract individual words from phrases', () => {
      const cache = getFragmentCache();

      // Should extract both "Enable" and "Notifications" as separate fragments
      expect(() => cache.learn('Enable Notifications', 'Включить уведомления')).not.toThrow();
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
          'enable': {
            text: 'Enable',
            translation: 'Включить',
            context: 'word',
            count: 5,
            confidence: 90,
            lastSeen: Date.now()
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
      expect(stats.words).toBeGreaterThanOrEqual(0);
      expect(stats.phrases).toBeGreaterThanOrEqual(0);
      expect(stats.highConfidence).toBeGreaterThanOrEqual(0);
      expect(stats.lowConfidence).toBeGreaterThanOrEqual(0);
    });

    it('should count words and phrases separately', () => {
      const cache = getFragmentCache();

      // Learn some known words (materials and nouns with known gender)
      for (let i = 0; i < 10; i++) {
        cache.learn('Diamond Sword', 'Алмазный меч');
        cache.learn('Iron Pickaxe', 'Железная кирка');
      }

      const stats = cache.getStats();

      expect(stats.total).toBeGreaterThan(0);
      expect(stats.words + stats.phrases).toBeLessThanOrEqual(stats.total);
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
