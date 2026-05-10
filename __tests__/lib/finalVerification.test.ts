/**
 * Final Verification - All 9 test cases from the plan
 * Focus: TemplateCache functionality and API call savings
 */

import { translateThroughPipeline } from '../../lib/translationPipeline';
import { getTemplateCache } from '../../lib/templateCache';
import { resetFragmentCache } from '../../lib/fragmentCache';

// Mock deepl module
jest.mock('../../lib/deepl', () => ({
  translateTexts: jest.fn((texts: string[]) => {
    const mockTranslations: Record<string, string> = {
      'Collect 10 iron ingots from the mine': 'Соберите 10 железных слитков из шахты',
      'unknown xyz string': 'неизвестная xyz строка'
    };
    return Promise.resolve(texts.map(text => mockTranslations[text] || `[MOCK] ${text}`));
  })
}));

describe('Final Verification - Template System', () => {
  beforeEach(() => {
    resetFragmentCache(); // Reset singleton to use test cache
    jest.clearAllMocks();
  });

  describe('Core template functionality', () => {
    it('1. Learn template from "Collect 10 iron ingots from the mine"', async () => {
      const templateCache = getTemplateCache();

      // Learn template
      templateCache.learn(
        'Collect 10 iron ingots from the mine',
        'Соберите 10 железных слитков из шахты'
      );

      // Verify it was learned
      const stats = templateCache.getStats();
      expect(stats.total).toBeGreaterThan(0);
    });

    it('2. Translate "Collect 10 gold ingots from the mine" without API call', async () => {
      const templateCache = getTemplateCache();
      const deepl = require('../../lib/deepl');

      // Learn template
      templateCache.learn(
        'Collect 10 iron ingots from the mine',
        'Соберите 10 железных слитков из шахты'
      );

      // Clear mock
      deepl.translateTexts.mockClear();

      // Translate with different material
      const result = await translateThroughPipeline('Collect 10 gold ingots from the mine');

      expect(result.text).toBe('Соберите 10 золотых слитков из шахты');
      expect(['template', 'cache']).toContain(result.source);

      // Verify DeepL was NOT called
      expect(deepl.translateTexts).not.toHaveBeenCalled();
    });

    it('3. Translate "Collect 5 copper ingots from the mine" without API call', async () => {
      const templateCache = getTemplateCache();
      const deepl = require('../../lib/deepl');

      templateCache.learn(
        'Collect 10 iron ingots from the mine',
        'Соберите 10 железных слитков из шахты'
      );

      deepl.translateTexts.mockClear();

      const result = await translateThroughPipeline('Collect 5 copper ingots from the mine');

      expect(result.text).toBe('Соберите 5 медных слитков из шахты');
      expect(['template', 'cache']).toContain(result.source);
      expect(deepl.translateTexts).not.toHaveBeenCalled();
    });

    it('4. Translate "Collect 3 copper ingots from the mine" with correct grammar (2-4 rule)', async () => {
      const templateCache = getTemplateCache();

      templateCache.learn(
        'Collect 10 iron ingots from the mine',
        'Соберите 10 железных слитков из шахты'
      );

      const result = await translateThroughPipeline('Collect 3 copper ingots from the mine');

      // For numbers 2-4, Russian uses gen_sg: "3 медных слитка" (not "слитков")
      expect(result.text).toBe('Соберите 3 медных слитка из шахты');
    });

    it('5. Translate "Collect 2 diamond ingots from the mine" with correct grammar', async () => {
      const templateCache = getTemplateCache();

      templateCache.learn(
        'Collect 10 iron ingots from the mine',
        'Соберите 10 железных слитков из шахты'
      );

      const result = await translateThroughPipeline('Collect 2 diamond ingots from the mine');

      expect(result.text).toBe('Соберите 2 алмазных слитка из шахты');
    });

    it('6. Translate "Collect 1 gold ingots from the mine" with singular form', async () => {
      const templateCache = getTemplateCache();

      templateCache.learn(
        'Collect 10 iron ingots from the mine',
        'Соберите 10 железных слитков из шахты'
      );

      const result = await translateThroughPipeline('Collect 1 gold ingots from the mine');

      expect(result.text).toBe('Соберите 1 золотой слиток из шахты');
    });
  });

  describe('Fallback and error handling', () => {
    it('7. Handle unknown pattern gracefully', async () => {
      const result = await translateThroughPipeline('unknown xyz string');

      expect(result.text).toBeTruthy();
      expect(['deepl', 'cache', 'word-based', 'fragment']).toContain(result.source);
    });

    it('8. Handle unknown words in template pattern', async () => {
      const templateCache = getTemplateCache();

      templateCache.learn(
        'Collect 10 iron ingots from the mine',
        'Соберите 10 железных слитков из шахты'
      );

      // "platinum" is not in word library
      const result = await translateThroughPipeline('Collect 10 platinum ingots from the mine');

      // Should fallback to word-based or DeepL
      expect(['deepl', 'word-based']).toContain(result.source);
    });
  });

  describe('API call savings', () => {
    it('9. Verify API call savings: 1 learn → 3 free translations', async () => {
      const templateCache = getTemplateCache();
      const deepl = require('../../lib/deepl');

      // Learn one template (1 API call)
      await translateThroughPipeline('Collect 10 iron ingots from the mine');

      // Clear mock to count only new calls
      deepl.translateTexts.mockClear();

      // Translate 3 variations - should NOT call DeepL
      await translateThroughPipeline('Collect 10 gold ingots from the mine');
      await translateThroughPipeline('Collect 5 copper ingots from the mine');
      await translateThroughPipeline('Collect 2 diamond ingots from the mine');

      // Verify DeepL was NOT called
      expect(deepl.translateTexts).not.toHaveBeenCalled();
    });
  });
});
