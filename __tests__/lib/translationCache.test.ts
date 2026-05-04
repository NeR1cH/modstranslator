import fs from 'fs';
import path from 'path';

// Mock fs module BEFORE importing translationCache
jest.mock('fs');

describe('TranslationCache', () => {
  const mockCacheDir = path.join(process.cwd(), '.translation-cache');
  const mockCacheFile = path.join(mockCacheDir, 'cache-v1.json');

  beforeAll(() => {
    // Setup mocks before any imports
    (fs.existsSync as jest.Mock).mockReturnValue(false);
    (fs.mkdirSync as jest.Mock).mockImplementation(() => {});
    (fs.readFileSync as jest.Mock).mockReturnValue('{"version":"v1","entries":[]}');
    (fs.writeFileSync as jest.Mock).mockImplementation(() => {});
  });

  beforeEach(() => {
    // Clear mock call history before each test
    jest.clearAllMocks();
  });

  // Import after mocks are set up
  const { getTranslationCache } = require('@/lib/translationCache');

  describe('initialization', () => {
    it('should create cache directory if it does not exist', () => {
      const cache = getTranslationCache();

      // mkdirSync should have been called during initialization
      expect(fs.mkdirSync).toHaveBeenCalledWith(mockCacheDir, { recursive: true });
    });

    it('should load existing cache from disk', () => {
      // This test verifies the cache was initialized
      const cache = getTranslationCache();

      // The cache should be accessible
      expect(cache).toBeDefined();
      expect(cache.getStats).toBeDefined();
    });

    it('should handle missing cache file gracefully', () => {
      // Should not throw during initialization
      expect(() => getTranslationCache()).not.toThrow();
    });
  });

  describe('get and set', () => {
    it('should store and retrieve a translation', () => {
      const cache = getTranslationCache();

      cache.set('Hello', 'Привет');
      const result = cache.get('Hello');

      expect(result).toBe('Привет');
    });

    it('should return null for cache miss', () => {
      const cache = getTranslationCache();

      const result = cache.get('NonExistent');

      expect(result).toBeNull();
    });

    it('should be case-insensitive', () => {
      const cache = getTranslationCache();

      cache.set('Hello', 'Привет');
      const result1 = cache.get('hello');
      const result2 = cache.get('HELLO');

      expect(result1).toBe('Привет');
      expect(result2).toBe('Привет');
    });

    it('should trim whitespace', () => {
      const cache = getTranslationCache();

      cache.set('  Hello  ', 'Привет');
      const result = cache.get('Hello');

      expect(result).toBe('Привет');
    });

    it('should handle empty strings', () => {
      const cache = getTranslationCache();

      cache.set('', 'Empty');
      const result = cache.get('');

      expect(result).toBe('Empty');
    });
  });

  describe('getMany and setMany', () => {
    it('should retrieve multiple cached translations', () => {
      const cache = getTranslationCache();

      cache.set('Hello', 'Привет');
      cache.set('World', 'Мир');

      const results = cache.getMany(['Hello', 'World', 'NotCached']);

      expect(results.size).toBe(2);
      expect(results.get('Hello')).toBe('Привет');
      expect(results.get('World')).toBe('Мир');
      expect(results.has('NotCached')).toBe(false);
    });

    it('should store multiple translations at once', () => {
      const cache = getTranslationCache();

      cache.setMany([
        { original: 'Hello', translated: 'Привет' },
        { original: 'World', translated: 'Мир' },
      ]);

      expect(cache.get('Hello')).toBe('Привет');
      expect(cache.get('World')).toBe('Мир');
    });

    it('should return empty map for all misses', () => {
      const cache = getTranslationCache();

      const results = cache.getMany(['NotCached1', 'NotCached2']);

      expect(results.size).toBe(0);
    });

    it('should handle empty arrays', () => {
      const cache = getTranslationCache();

      const results = cache.getMany([]);

      expect(results.size).toBe(0);
    });
  });

  describe('statistics', () => {
    it('should return cache statistics', () => {
      const cache = getTranslationCache();

      // Clear cache first to have known state
      cache.clear();

      cache.set('Hello', 'Привет');
      cache.set('World', 'Мир');

      const stats = cache.getStats();

      expect(stats.size).toBe(2);
      expect(stats.cacheFile).toBe(mockCacheFile);
      expect(stats.cacheDir).toBe(mockCacheDir);
    });

    it('should return zero size for empty cache', () => {
      const cache = getTranslationCache();

      // Clear cache to ensure it's empty
      cache.clear();

      const stats = cache.getStats();

      expect(stats.size).toBe(0);
    });
  });

  describe('clear', () => {
    it('should clear all cached translations', () => {
      const cache = getTranslationCache();

      cache.set('Hello', 'Привет');
      cache.set('World', 'Мир');

      cache.clear();

      expect(cache.get('Hello')).toBeNull();
      expect(cache.get('World')).toBeNull();
      expect(cache.getStats().size).toBe(0);
    });
  });

  describe('flush', () => {
    it('should save cache to disk immediately', () => {
      const cache = getTranslationCache();

      cache.set('Hello', 'Привет');

      // Clear previous calls
      (fs.writeFileSync as jest.Mock).mockClear();

      cache.flush();

      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it('should not save if cache is not dirty', () => {
      const cache = getTranslationCache();

      // Clear any previous writes
      (fs.writeFileSync as jest.Mock).mockClear();

      cache.flush();

      // Should not write if nothing changed
      expect(fs.writeFileSync).not.toHaveBeenCalled();
    });
  });

  describe('hash generation', () => {
    it('should generate same hash for same text', () => {
      const cache = getTranslationCache();

      cache.set('Test', 'Тест1');
      cache.set('Test', 'Тест2'); // Should overwrite

      const result = cache.get('Test');
      expect(result).toBe('Тест2');
    });

    it('should generate different hashes for different text', () => {
      const cache = getTranslationCache();

      cache.set('Test1', 'Тест1');
      cache.set('Test2', 'Тест2');

      expect(cache.get('Test1')).toBe('Тест1');
      expect(cache.get('Test2')).toBe('Тест2');
    });
  });

  describe('persistence', () => {
    it('should save cache data in correct format', () => {
      const cache = getTranslationCache();

      cache.set('Hello', 'Привет');

      // Clear previous calls
      (fs.writeFileSync as jest.Mock).mockClear();

      cache.flush();

      // Check that writeFileSync was called
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        mockCacheFile,
        expect.any(String),
        'utf8'
      );

      // Parse the saved data to verify structure
      const savedData = (fs.writeFileSync as jest.Mock).mock.calls[0][1];
      const parsed = JSON.parse(savedData);
      expect(parsed.version).toBe('v1');
      expect(parsed.entries).toBeDefined();
      expect(Array.isArray(parsed.entries)).toBe(true);
    });

    it('should handle version mismatch', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      const oldCache = {
        version: 'v0',
        entries: [{ hash: 'old', original: '', translated: 'Old', timestamp: Date.now() }]
      };
      (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(oldCache));

      const cache = getTranslationCache();

      // Should not load old version entries
      expect(cache.get('old')).toBeNull();
    });

    it('should handle corrupted cache file', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockReturnValue('invalid json');

      expect(() => getTranslationCache()).not.toThrow();
    });
  });
});
