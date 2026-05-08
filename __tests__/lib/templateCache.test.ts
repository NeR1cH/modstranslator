/**
 * Tests for TemplateCache
 */

import { TemplateCache } from '../../lib/templateCache';

describe('TemplateCache', () => {
  let cache: TemplateCache;

  beforeEach(() => {
    cache = new TemplateCache();
  });

  describe('learn and tryTranslate', () => {
    it('should learn template and translate with different material', () => {
      // Learn from example
      cache.learn(
        'Collect 10 iron ingots from the mine',
        'Соберите 10 железных слитков из шахты'
      );

      // Try to translate with gold
      const result = cache.tryTranslate('Collect 10 gold ingots from the mine');
      expect(result).toBe('Соберите 10 золотых слитков из шахты');
    });

    it('should handle different numbers', () => {
      cache.learn(
        'Collect 10 iron ingots from the mine',
        'Соберите 10 железных слитков из шахты'
      );

      const result = cache.tryTranslate('Collect 5 copper ingots from the mine');
      expect(result).toBe('Соберите 5 медных слитков из шахты');
    });

    it('should return null for non-matching template', () => {
      cache.learn(
        'Collect 10 iron ingots from the mine',
        'Соберите 10 железных слитков из шахты'
      );

      const result = cache.tryTranslate('Bring me a sword');
      expect(result).toBeNull();
    });

    it('should return null if word not in library', () => {
      cache.learn(
        'Collect 10 iron ingots from the mine',
        'Соберите 10 железных слитков из шахты'
      );

      const result = cache.tryTranslate('Collect 10 unknown ingots from the mine');
      expect(result).toBeNull();
    });
  });

  describe('required test cases from checklist', () => {
    beforeEach(() => {
      // Learn the template
      cache.learn(
        'Collect 10 iron ingots from the mine',
        'Соберите 10 железных слитков из шахты'
      );
    });

    it('tryTranslate("Collect 10 gold ingots from the mine") → "Соберите 10 золотых слитков из шахты"', () => {
      const result = cache.tryTranslate('Collect 10 gold ingots from the mine');
      expect(result).toBe('Соберите 10 золотых слитков из шахты');
    });

    it('tryTranslate("Collect 5 copper ingots from the mine") → "Соберите 5 медных слитков из шахты"', () => {
      const result = cache.tryTranslate('Collect 5 copper ingots from the mine');
      expect(result).toBe('Соберите 5 медных слитков из шахты');
    });

    it('tryTranslate("Bring me a sword") → null (другой шаблон)', () => {
      const result = cache.tryTranslate('Bring me a sword');
      expect(result).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('should not throw on empty input', () => {
      expect(() => cache.learn('', '')).not.toThrow();
      expect(cache.tryTranslate('')).toBeNull();
    });

    it('should handle text without known words', () => {
      cache.learn('xyz abc def', 'тест тест тест');
      const result = cache.tryTranslate('xyz abc def');
      // Should return null because no known words
      expect(result).toBeNull();
    });

    it('should return null for unknown template', () => {
      const result = cache.tryTranslate('Some random text');
      expect(result).toBeNull();
    });
  });

  describe('getStats', () => {
    it('should return 0 templates initially', () => {
      const stats = cache.getStats();
      expect(stats.total).toBe(0);
    });

    it('should count learned templates', () => {
      cache.learn('Collect 10 iron ingots from the mine', 'Соберите 10 железных слитков из шахты');
      cache.learn('Collect 5 gold ingots from the mine', 'Соберите 5 золотых слитков из шахты');

      const stats = cache.getStats();
      expect(stats.total).toBeGreaterThan(0);
    });
  });
});
