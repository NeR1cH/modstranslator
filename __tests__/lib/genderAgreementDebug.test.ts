/**
 * Debug test for gender agreement issue
 */

import { translateBatchThroughPipeline } from '../../lib/translationPipeline';
import { getFragmentCache, resetFragmentCache } from '../../lib/fragmentCache';

// Mock fetch globally for OpenRouter
global.fetch = jest.fn();

// Mock DeepL API
jest.mock('../../lib/deepl', () => ({
  translateTexts: jest.fn((texts: string[]) => {
    const translations: Record<string, string> = {
      'Iron Sword': 'Железный меч',
      'Advanced Steel Frame': 'Продвинутая стальная рама',
      'Advanced Iron Frame': 'SHOULD_NOT_BE_CALLED',
    };

    return Promise.resolve(texts.map(text => {
      if (translations[text] && translations[text] !== 'SHOULD_NOT_BE_CALLED') {
        return translations[text];
      }
      throw new Error(`Unexpected API call for: ${text}`);
    }));
  })
}));

describe('Gender agreement debug test', () => {
  it('should apply gender agreement to all adjectives', async () => {
    console.log('\n=== GENDER AGREEMENT DEBUG TEST ===\n');

    resetFragmentCache(); // Reset singleton before creating test cache
    const fragmentCache = getFragmentCache('.translation-cache-test');
    fragmentCache.clear();

    // Phase 1: Learn base translations (twice for count >= 2)
    console.log('Phase 1: Learning base translations (first time)\n');
    const phase1 = ['Iron Sword', 'Advanced Steel Frame'];
    const results1 = await translateBatchThroughPipeline(phase1);

    results1.forEach((r, i) => {
      console.log(`  ${phase1[i]} → ${r.text} (${r.source})`);
    });

    console.log('\nPhase 1b: Learning base translations (second time for count >= 2)\n');

    // Manually learn fragments again to increase count
    results1.forEach((r, i) => {
      fragmentCache.learn(phase1[i], r.text);
    });

    const stats1 = fragmentCache.getStats();
    console.log(`\nFragments learned: ${stats1.total}\n`);

    // Phase 2: Test variation
    console.log('Phase 2: Testing "Advanced Iron Frame"\n');
    const phase2 = ['Advanced Iron Frame'];
    const results2 = await translateBatchThroughPipeline(phase2);

    console.log(`Result: ${results2[0].text} (${results2[0].source})\n`);

    // Expected: "Продвинутая железная рама"
    const expected = 'Продвинутая железная рама';
    const actual = results2[0].text;

    console.log(`Expected: ${expected}`);
    console.log(`Actual:   ${actual}`);
    console.log(`Match: ${actual === expected ? '✅' : '❌'}\n`);

    expect(results2[0].source).toBe('fragment');
    expect(actual.toLowerCase()).toBe(expected.toLowerCase());
  }, 30000);
});
