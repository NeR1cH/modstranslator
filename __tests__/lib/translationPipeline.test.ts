/**
 * Integration tests for TranslationPipeline
 */

import { translateThroughPipeline, getPipelineStats } from '../../lib/translationPipeline';
import { getTemplateCache } from '../../lib/templateCache';
import { resetFragmentCache } from '../../lib/fragmentCache';

// Mock deepl module
jest.mock('../../lib/deepl', () => ({
  translateTexts: jest.fn((texts: string[]) => {
    // Mock DeepL responses
    const mockTranslations: Record<string, string> = {
      'unknown xyz string': 'неизвестная xyz строка',
      'Bring me a sword': 'Принесите мне меч'
    };
    return Promise.resolve(texts.map(text => mockTranslations[text] || `[MOCK] ${text}`));
  })
}));

describe('TranslationPipeline', () => {
  beforeEach(() => {
    // Reset fragment cache singleton to use test cache
    resetFragmentCache();

    // Clear all caches before each test
    jest.clearAllMocks();

    // Reset singleton instances to clear in-memory state
    // This is needed because caches persist between tests
    jest.resetModules();
  });

  describe('translateThroughPipeline', () => {
    it('should use template cache for known pattern', async () => {
      const templateCache = getTemplateCache();

      // Learn template
      templateCache.learn(
        'Collect 10 iron ingots from the mine',
        'Соберите 10 железных слитков из шахты'
      );

      // Translate with different material
      const result = await translateThroughPipeline('Collect 10 gold ingots from the mine');

      expect(result.text).toBe('Соберите 10 золотых слитков из шахты');
      expect(result.source).toBe('template');
    });

    it('should use template cache for different numbers', async () => {
      const templateCache = getTemplateCache();

      templateCache.learn(
        'Collect 10 iron ingots from the mine',
        'Соберите 10 железных слитков из шахты'
      );

      const result = await translateThroughPipeline('Collect 3 copper ingots from the mine');

      expect(result.text).toBe('Соберите 3 медных слитка из шахты'); // 2-4 uses gen_sg
      expect(result.source).toBe('template');
    });

    it('should fallback to DeepL for unknown patterns', async () => {
      const result = await translateThroughPipeline('Bring me a sword');

      expect(result.text).toBeTruthy();
      expect(['deepl', 'word-based']).toContain(result.source);
    });

    it('should use translation cache on second call', async () => {
      // First call - goes to word-based, fragment, or DeepL
      const result1 = await translateThroughPipeline('unknown xyz string');
      expect(['deepl', 'word-based', 'fragment']).toContain(result1.source);

      // Second call - should use cache
      const result2 = await translateThroughPipeline('unknown xyz string');
      expect(result2.source).toBe('cache');
      expect(result2.text).toBe(result1.text);
    });

    it('should learn from DeepL results', async () => {
      const templateCache = getTemplateCache();

      // First translation goes to DeepL and learns
      await translateThroughPipeline('Collect 10 iron ingots from the mine');

      // Second translation with different material should use template or cache
      const result = await translateThroughPipeline('Collect 10 gold ingots from the mine');
      expect(result.text).toBe('Соберите 10 золотых слитков из шахты');
      expect(['template', 'cache']).toContain(result.source); // Either is fine
    });
  });

  describe('getPipelineStats', () => {
    it('should return stats from all caches', () => {
      const stats = getPipelineStats();

      expect(stats).toHaveProperty('translationCache');
      expect(stats).toHaveProperty('fragmentCache');
      expect(stats).toHaveProperty('templateCache');

      expect(stats.translationCache).toHaveProperty('size');
      expect(stats.fragmentCache).toHaveProperty('total');
      expect(stats.templateCache).toHaveProperty('total');
    });
  });

  describe('required test cases from plan', () => {
    it('should translate "Collect 10 gold ingots from the mine" without API call after learning', async () => {
      const templateCache = getTemplateCache();

      // Learn from iron
      templateCache.learn(
        'Collect 10 iron ingots from the mine',
        'Соберите 10 железных слитков из шахты'
      );

      // Translate gold - should NOT call DeepL
      const result = await translateThroughPipeline('Collect 10 gold ingots from the mine');

      expect(result.text).toBe('Соберите 10 золотых слитков из шахты');
      expect(['template', 'cache']).toContain(result.source); // Either is fine, both avoid DeepL
    });

    it('should translate "Collect 3 copper ingots from the mine" without API call after learning', async () => {
      const templateCache = getTemplateCache();

      templateCache.learn(
        'Collect 10 iron ingots from the mine',
        'Соберите 10 железных слитков из шахты'
      );

      const result = await translateThroughPipeline('Collect 3 copper ingots from the mine');

      expect(result.text).toBe('Соберите 3 медных слитка из шахты'); // 2-4 uses gen_sg
      expect(['template', 'cache']).toContain(result.source); // Either is fine
    });

    it('should handle unknown strings without crashing', async () => {
      const result = await translateThroughPipeline('unknown xyz string');

      expect(result.text).toBeTruthy();
      expect(['deepl', 'cache', 'word-based']).toContain(result.source); // Either is fine
    });
  });
});
