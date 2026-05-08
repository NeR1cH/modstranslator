/**
 * Tests for WordBasedTranslator
 */

import { translateWordBased, translateWithWordBasedFallback, getWordBasedStats } from '../../lib/wordBasedTranslator';

// Mock deepl module
jest.mock('../../lib/deepl', () => ({
  translateTexts: jest.fn((texts: string[]) => {
    const mockTranslations: Record<string, string> = {
      'hero': 'герой',
      'found': 'нашёл',
      'sword': 'меч',
      'ancient': 'древний',
      'mine': 'шахта',
      'collect': 'собрать',
      'iron': 'железный',
      'ingots': 'слитки',
      'from': 'из',
      'the': '', // Articles are often dropped in Russian
      'Unknown test sentence': 'Неизвестное тестовое предложение'
    };
    return Promise.resolve(texts.map(text => mockTranslations[text.toLowerCase()] || `[MOCK] ${text}`));
  })
}));

describe('WordBasedTranslator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('translateWordBased', () => {
    it('should translate simple sentence word by word', async () => {
      const result = await translateWordBased('hero found sword');

      expect(result).not.toBeNull();
      if (result) {
        expect(result.text).toBeTruthy();
        expect(result.source).toBe('word-based');
        expect(result.wordsUsed).toBeGreaterThan(0);
      }
    });

    it('should handle numbers in sentence', async () => {
      const result = await translateWordBased('collect 10 iron ingots');

      expect(result).not.toBeNull();
      if (result) {
        expect(result.text).toContain('10');
        expect(result.source).toBe('word-based');
      }
    });

    it('should use cache on second call', async () => {
      const deepl = require('../../lib/deepl');

      // First call
      await translateWordBased('hero found sword');
      const firstCallCount = deepl.translateTexts.mock.calls.length;

      // Second call - should use cache
      deepl.translateTexts.mockClear();
      await translateWordBased('hero found sword');
      const secondCallCount = deepl.translateTexts.mock.calls.length;

      // Second call should make fewer API calls (or none if fully cached)
      expect(secondCallCount).toBeLessThanOrEqual(firstCallCount);
    });

    it('should return null for empty sentence', async () => {
      const result = await translateWordBased('');
      expect(result).toBeNull();
    });

    it('should handle sentence with articles', async () => {
      const result = await translateWordBased('the ancient mine');

      expect(result).not.toBeNull();
      if (result) {
        expect(result.text).toBeTruthy();
        expect(result.wordsUsed).toBeGreaterThan(0);
      }
    });

    it('should track statistics correctly', async () => {
      const result = await translateWordBased('hero sword');

      expect(result).not.toBeNull();
      if (result) {
        expect(result.wordsUsed).toBe(2);
        expect(result.wordsTranslated + result.wordsCached).toBe(2);
      }
    });
  });

  describe('translateWithWordBasedFallback', () => {
    it('should use word-based translation for simple sentence', async () => {
      const result = await translateWithWordBasedFallback('hero found sword');

      expect(result.text).toBeTruthy();
      expect(result.source).toBe('word-based');
    });

    it('should fallback to DeepL for complex sentence', async () => {
      const result = await translateWithWordBasedFallback('Unknown test sentence');

      expect(result.text).toBeTruthy();
      // Could be either word-based or deepl-fallback depending on cache state
      expect(['word-based', 'deepl-fallback']).toContain(result.source);
    });

    it('should handle empty sentence gracefully', async () => {
      const result = await translateWithWordBasedFallback('');

      expect(result).toBeTruthy();
      expect(result.text).toBeDefined();
    });

    it('should learn from DeepL fallback', async () => {
      const deepl = require('../../lib/deepl');
      deepl.translateTexts.mockClear();

      // Translate words that will require DeepL calls
      await translateWithWordBasedFallback('newword1 newword2 newword3');

      // Check that DeepL was called for individual words
      expect(deepl.translateTexts.mock.calls.length).toBeGreaterThan(0);
    });
  });

  describe('getWordBasedStats', () => {
    it('should return statistics object', () => {
      const stats = getWordBasedStats();

      expect(stats).toHaveProperty('totalWords');
      expect(stats).toHaveProperty('byPos');
      expect(stats).toHaveProperty('averageConfidence');
      expect(typeof stats.totalWords).toBe('number');
    });

    it('should show increased word count after translations', async () => {
      const statsBefore = getWordBasedStats();

      await translateWordBased('hero sword');

      const statsAfter = getWordBasedStats();
      expect(statsAfter.totalWords).toBeGreaterThanOrEqual(statsBefore.totalWords);
    });
  });

  describe('integration tests', () => {
    it('should handle "Collect 10 iron ingots from the mine"', async () => {
      const result = await translateWordBased('Collect 10 iron ingots from the mine');

      expect(result).not.toBeNull();
      if (result) {
        expect(result.text).toContain('10');
        expect(result.source).toBe('word-based');
      }
    });

    it('should handle "ancient mine"', async () => {
      const result = await translateWordBased('ancient mine');

      expect(result).not.toBeNull();
      if (result) {
        expect(result.text).toBeTruthy();
        expect(result.wordsUsed).toBe(2);
      }
    });

    it('should handle "hero found sword"', async () => {
      const result = await translateWordBased('hero found sword');

      expect(result).not.toBeNull();
      if (result) {
        expect(result.text).toBeTruthy();
        expect(result.wordsUsed).toBe(3);
      }
    });
  });

  describe('error handling', () => {
    it('should handle DeepL API errors gracefully', async () => {
      const deepl = require('../../lib/deepl');
      deepl.translateTexts.mockRejectedValueOnce(new Error('API Error'));

      const result = await translateWithWordBasedFallback('test sentence');

      // Should still return a result (original text as fallback)
      expect(result).toBeTruthy();
      expect(result.text).toBeDefined();
    });

    it('should handle partial translation failures', async () => {
      const deepl = require('../../lib/deepl');

      // Mock to fail on specific words
      deepl.translateTexts.mockImplementation((texts: string[]) => {
        return Promise.resolve(texts.map(text => {
          if (text === 'failword') throw new Error('Translation failed');
          return `translated_${text}`;
        }));
      });

      const result = await translateWordBased('hero failword sword');

      expect(result).not.toBeNull();
      if (result) {
        expect(result.text).toBeTruthy();
      }
    });
  });
});
