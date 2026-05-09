/**
 * Tests for TemplateCache
 * TemplateCache handles [Adjectives...] + Noun patterns like "Iron Sword", "Copycat Block"
 */

import { TemplateCache } from '../../lib/templateCache';

describe('TemplateCache', () => {
  let cache: TemplateCache;

  beforeEach(() => {
    cache = new TemplateCache();
  });

  describe('learn and tryTranslate', () => {
    it('should learn simple adjective + noun pattern', () => {
      // Learn from example: "Iron Ingot" → "Железный слиток"
      cache.learn('Iron Ingot', 'Железный слиток');

      // Try to translate exact match
      const result = cache.tryTranslate('Iron Ingot');
      expect(result).toBe('Железный слиток');
    });

    it('should learn multi-adjective + noun pattern', () => {
      // Learn: "Copycat Ghost Block" → "Копирующий призрачный блок"
      cache.learn('Copycat Ghost Block', 'Копирующий призрачный блок');

      // Try to translate exact match
      const result = cache.tryTranslate('Copycat Ghost Block');
      expect(result).toBe('Копирующий призрачный блок');
    });

    it('should return null for non-matching pattern', () => {
      cache.learn('Iron Ingot', 'Железный слиток');

      // Different pattern - should not match
      const result = cache.tryTranslate('Gold Sword');
      expect(result).toBeNull();
    });

    it('should return null if noun not in library', () => {
      cache.learn('Iron Ingot', 'Железный слиток');

      // "Unknown" is not a known noun
      const result = cache.tryTranslate('Iron Unknown');
      expect(result).toBeNull();
    });

    it('should learn any multi-word pattern', () => {
      cache.learn('Unknown Block', 'Неизвестный блок');

      // Should learn and return translation for exact match
      const result = cache.tryTranslate('Unknown Block');
      expect(result).toBe('Неизвестный блок');
    });
  });

  describe('real-world patterns from cache-v1.json', () => {
    it('should handle Copycat patterns', () => {
      cache.learn('Copycat Block', 'Копирующий блок');
      const result = cache.tryTranslate('Copycat Block');
      expect(result).toBe('Копирующий блок');
    });

    it('should handle multi-word Copycat patterns', () => {
      cache.learn('Copycat Fence Gate', 'Копирующая калитка');
      const result = cache.tryTranslate('Copycat Fence Gate');
      expect(result).toBe('Копирующая калитка');
    });

    it('should handle material + item patterns', () => {
      cache.learn('Diamond Sword', 'Алмазный меч');
      const result = cache.tryTranslate('Diamond Sword');
      expect(result).toBe('Алмазный меч');
    });
  });

  describe('edge cases', () => {
    it('should not throw on empty input', () => {
      expect(() => cache.learn('', '')).not.toThrow();
      expect(cache.tryTranslate('')).toBeNull();
    });

    it('should return null for single word', () => {
      cache.learn('Block', 'Блок');
      // Single word - need at least 2 words (adjective + noun)
      const result = cache.tryTranslate('Block');
      expect(result).toBeNull();
    });

    it('should cache any text with 2+ words', () => {
      cache.learn('xyz abc', 'тест тест');
      const result = cache.tryTranslate('xyz abc');
      // Should return cached translation for exact match
      expect(result).toBe('тест тест');
    });

    it('should return null for unknown template', () => {
      const result = cache.tryTranslate('Some Random Text');
      expect(result).toBeNull();
    });
  });

  describe('getStats', () => {
    it('should return 0 templates initially', () => {
      const stats = cache.getStats();
      expect(stats.total).toBe(0);
    });

    it('should count learned templates', () => {
      cache.learn('Iron Ingot', 'Железный слиток');
      cache.learn('Gold Ingot', 'Золотой слиток');
      cache.learn('Diamond Sword', 'Алмазный меч');

      const stats = cache.getStats();
      expect(stats.total).toBeGreaterThan(0);
    });
  });
});
