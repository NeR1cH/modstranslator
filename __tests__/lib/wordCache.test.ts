/**
 * Tests for WordCache
 */

import { WordCache } from '../../lib/wordCache';
import * as fs from 'fs';
import * as path from 'path';

describe('WordCache', () => {
  let cache: WordCache;
  const testCacheFile = path.join(process.cwd(), 'cache', 'word-cache.json');

  beforeEach(() => {
    // Clean up cache file before each test
    if (fs.existsSync(testCacheFile)) {
      fs.unlinkSync(testCacheFile);
    }
    cache = new WordCache();
  });

  afterEach(() => {
    // Clean up after tests
    if (fs.existsSync(testCacheFile)) {
      fs.unlinkSync(testCacheFile);
    }
  });

  describe('addWord and getWord', () => {
    it('should add a new word', () => {
      cache.addWord('hero', 'герой');

      const word = cache.getWord('hero');
      expect(word).not.toBeNull();
      expect(word?.word).toBe('hero');
      expect(word?.forms.default).toBe('герой');
    });

    it('should be case-insensitive', () => {
      cache.addWord('Hero', 'герой');

      const word = cache.getWord('HERO');
      expect(word).not.toBeNull();
      expect(word?.forms.default).toBe('герой');
    });

    it('should store word with context', () => {
      cache.addWord('hero', 'герой', {
        pos: 'noun',
        gender: 'm',
        form: 'nom'
      });

      const word = cache.getWord('hero');
      expect(word?.pos).toBe('noun');
      expect(word?.gender).toBe('m');
      expect(word?.forms.nom).toBe('герой');
    });

    it('should update existing word', () => {
      cache.addWord('hero', 'герой', { form: 'nom' });
      cache.addWord('hero', 'героя', { form: 'gen' });

      const word = cache.getWord('hero');
      expect(word?.count).toBe(2);
      expect(word?.forms.nom).toBe('герой');
      expect(word?.forms.gen).toBe('героя');
    });

    it('should increase confidence on repeated use', () => {
      cache.addWord('hero', 'герой');
      const confidence1 = cache.getWord('hero')?.confidence || 0;

      cache.addWord('hero', 'герой');
      const confidence2 = cache.getWord('hero')?.confidence || 0;

      expect(confidence2).toBeGreaterThan(confidence1);
    });
  });

  describe('getForm', () => {
    it('should get specific form', () => {
      cache.addWord('hero', 'герой', { form: 'nom' });
      cache.addWord('hero', 'героя', { form: 'gen' });

      expect(cache.getForm('hero', 'nom')).toBe('герой');
      expect(cache.getForm('hero', 'gen')).toBe('героя');
    });

    it('should fallback to default form', () => {
      cache.addWord('hero', 'герой');

      expect(cache.getForm('hero', 'nom')).toBe('герой');
      expect(cache.getForm('hero', 'gen')).toBe('герой');
    });

    it('should return null for unknown word', () => {
      expect(cache.getForm('unknown', 'nom')).toBeNull();
    });
  });

  describe('hasWord', () => {
    it('should return true for known word', () => {
      cache.addWord('hero', 'герой');
      expect(cache.hasWord('hero')).toBe(true);
    });

    it('should return false for unknown word', () => {
      expect(cache.hasWord('unknown')).toBe(false);
    });

    it('should be case-insensitive', () => {
      cache.addWord('Hero', 'герой');
      expect(cache.hasWord('HERO')).toBe(true);
    });
  });

  describe('getAllForms', () => {
    it('should return all forms', () => {
      cache.addWord('hero', 'герой', { form: 'nom' });
      cache.addWord('hero', 'героя', { form: 'gen' });
      cache.addWord('hero', 'герою', { form: 'dat' });

      const forms = cache.getAllForms('hero');
      expect(forms).toEqual({
        nom: 'герой',
        gen: 'героя',
        dat: 'герою'
      });
    });

    it('should return null for unknown word', () => {
      expect(cache.getAllForms('unknown')).toBeNull();
    });
  });

  describe('learnFromTranslation', () => {
    it('should learn from simple translation', () => {
      cache.learnFromTranslation('the hero', 'герой');

      expect(cache.hasWord('hero')).toBe(true);
      expect(cache.getForm('hero', 'default')).toBe('герой');
    });

    it('should learn multiple words', () => {
      cache.learnFromTranslation('ancient mine', 'древняя шахта');

      expect(cache.hasWord('ancient')).toBe(true);
      expect(cache.hasWord('mine')).toBe(true);
      expect(cache.getForm('ancient', 'default')).toBe('древняя');
      expect(cache.getForm('mine', 'default')).toBe('шахта');
    });

    it('should skip short words', () => {
      cache.learnFromTranslation('a hero', 'герой');

      expect(cache.hasWord('a')).toBe(false); // Too short
      expect(cache.hasWord('hero')).toBe(true);
    });

    it('should handle punctuation', () => {
      cache.learnFromTranslation('hero, warrior', 'герой, воин');

      expect(cache.hasWord('hero')).toBe(true);
      expect(cache.hasWord('warrior')).toBe(true);
    });
  });

  describe('getStats', () => {
    it('should return empty stats initially', () => {
      const stats = cache.getStats();
      expect(stats.totalWords).toBe(0);
      expect(stats.avgConfidence).toBe(0);
    });

    it('should count total words', () => {
      cache.addWord('hero', 'герой');
      cache.addWord('warrior', 'воин');

      const stats = cache.getStats();
      expect(stats.totalWords).toBe(2);
    });

    it('should group by part of speech', () => {
      cache.addWord('hero', 'герой', { pos: 'noun' });
      cache.addWord('ancient', 'древний', { pos: 'adjective' });
      cache.addWord('warrior', 'воин', { pos: 'noun' });

      const stats = cache.getStats();
      expect(stats.byPos.noun).toBe(2);
      expect(stats.byPos.adjective).toBe(1);
    });

    it('should calculate average confidence', () => {
      cache.addWord('hero', 'герой'); // confidence: 80
      cache.addWord('warrior', 'воин'); // confidence: 80

      const stats = cache.getStats();
      expect(stats.avgConfidence).toBe(80);
    });
  });

  describe('persistence', () => {
    it('should save to disk', (done) => {
      cache.addWord('hero', 'герой');

      // Wait for debounced save
      setTimeout(() => {
        expect(fs.existsSync(testCacheFile)).toBe(true);

        const data = JSON.parse(fs.readFileSync(testCacheFile, 'utf-8'));
        expect(data).toHaveLength(1);
        expect(data[0].word).toBe('hero');
        done();
      }, 6000); // Wait for 5s debounce + 1s buffer
    }, 10000);

    it('should load from disk', () => {
      // Create cache file manually
      const dir = path.dirname(testCacheFile);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const data = [
        {
          word: 'hero',
          forms: { default: 'герой' },
          count: 5,
          confidence: 90,
          lastUsed: Date.now()
        }
      ];
      fs.writeFileSync(testCacheFile, JSON.stringify(data), 'utf-8');

      // Create new cache instance (should load from disk)
      const newCache = new WordCache();
      expect(newCache.hasWord('hero')).toBe(true);
      expect(newCache.getForm('hero', 'default')).toBe('герой');
    });

    it('should flush immediately', () => {
      cache.addWord('hero', 'герой');
      cache.flush();

      expect(fs.existsSync(testCacheFile)).toBe(true);
    });
  });

  describe('real-world scenarios', () => {
    it('should handle sentence learning', () => {
      cache.learnFromTranslation(
        'Inside the ancient mine',
        'В древней шахте'
      );

      expect(cache.hasWord('ancient')).toBe(true);
      expect(cache.hasWord('mine')).toBe(true);
      expect(cache.getForm('ancient', 'default')).toBe('древней');
      expect(cache.getForm('mine', 'default')).toBe('шахте');
    });

    it('should accumulate knowledge over time', () => {
      // First translation
      cache.learnFromTranslation('ancient mine', 'древняя шахта');

      // Second translation with same words
      cache.learnFromTranslation('ancient castle', 'древний замок');

      const ancient = cache.getWord('ancient');
      expect(ancient?.count).toBe(2); // Seen twice
      expect(ancient?.confidence).toBeGreaterThan(80); // Increased confidence
    });

    it('should handle multiple forms of same word', () => {
      cache.addWord('hero', 'герой', { form: 'nom' });
      cache.addWord('hero', 'героя', { form: 'gen' });
      cache.addWord('hero', 'герою', { form: 'dat' });
      cache.addWord('hero', 'героя', { form: 'acc' });
      cache.addWord('hero', 'героем', { form: 'ins' });
      cache.addWord('hero', 'герое', { form: 'pre' });

      const forms = cache.getAllForms('hero');
      expect(Object.keys(forms || {}).length).toBe(6);
    });
  });
});
