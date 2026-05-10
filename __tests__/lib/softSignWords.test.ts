/**
 * Test for words ending with -ь (soft sign)
 * Tests that NOUN_GENDERS correctly handles feminine words ending with -ь
 */

import { translateBatchThroughPipeline } from '../../lib/translationPipeline';
import { getFragmentCache } from '../../lib/fragmentCache';
import { getTranslationCache } from '../../lib/translationCache';

// Mock fetch globally for OpenRouter
global.fetch = jest.fn();

// Mock DeepL API
jest.mock('../../lib/deepl', () => ({
  translateTexts: jest.fn((texts: string[]) => {
    const translations: Record<string, string> = {
      // Base translations - words ending with -ь
      'Iron Door': 'Железная дверь',        // feminine
      'Iron Chain': 'Железная цепь',        // feminine
      'Iron Seal': 'Железная печать',       // feminine
      'Iron Pane': 'Железная панель',       // feminine
      'Steel Plate': 'Стальная пластина',   // steel (сталь) is feminine
      'Iron Gearshift': 'Железный переключатель',  // masculine
      'Iron Mixer': 'Железный смеситель',   // masculine
      'Copper Ore': 'Медная руда',          // to learn "Copper"

      // Variations - should NOT be called
      'Copper Door': 'SHOULD_NOT_BE_CALLED',
      'Copper Chain': 'SHOULD_NOT_BE_CALLED',
      'Copper Seal': 'SHOULD_NOT_BE_CALLED',
      'Copper Pane': 'SHOULD_NOT_BE_CALLED',
      'Copper Gearshift': 'SHOULD_NOT_BE_CALLED',
      'Copper Mixer': 'SHOULD_NOT_BE_CALLED',
    };

    return Promise.resolve(texts.map(text => {
      if (translations[text] && translations[text] !== 'SHOULD_NOT_BE_CALLED') {
        return translations[text];
      }
      throw new Error(`Unexpected API call for: ${text}`);
    }));
  })
}));

describe('Words ending with -ь test', () => {
  it('should correctly handle gender for words ending with -ь', async () => {
    console.log('\n=== WORDS ENDING WITH -Ь TEST ===\n');

    const fragmentCache = getFragmentCache();
    const translationCache = getTranslationCache();

    fragmentCache.clear();
    translationCache.clear();

    // Phase 1: Learn base translations (twice for count >= 2)
    console.log('Phase 1: Learning base translations (first time)\n');
    const baseTexts = [
      'Iron Door',       // дверь (feminine)
      'Iron Chain',      // цепь (feminine)
      'Iron Seal',       // печать (feminine)
      'Iron Pane',       // панель (feminine)
      'Steel Plate',     // сталь (feminine) + пластина (feminine)
      'Iron Gearshift',  // переключатель (masculine)
      'Iron Mixer',      // смеситель (masculine)
      'Copper Ore',      // руда (to learn "Copper" material)
    ];

    const results1 = await translateBatchThroughPipeline(baseTexts);

    console.log('Base translations:');
    results1.forEach((r, i) => {
      console.log(`  ${baseTexts[i]} → ${r.text} (${r.source})`);
    });

    console.log('\nPhase 1b: Learning base translations (second time for count >= 2)\n');

    // Manually learn fragments again to increase count
    results1.forEach((r, i) => {
      fragmentCache.learn(baseTexts[i], r.text);
    });

    const stats1 = fragmentCache.getStats();
    console.log(`\nFragments learned: ${stats1.total}\n`);

    // Phase 2: Test variations
    console.log('Phase 2: Testing variations (Copper items)\n');
    const variationTexts = [
      'Copper Door',      // Should be: Медная дверь (feminine)
      'Copper Chain',     // Should be: Медная цепь (feminine)
      'Copper Seal',      // Should be: Медная печать (feminine)
      'Copper Pane',      // Should be: Медная панель (feminine)
      'Copper Gearshift', // Should be: Медный переключатель (masculine)
      'Copper Mixer',     // Should be: Медный смеситель (masculine)
    ];

    const results2 = await translateBatchThroughPipeline(variationTexts);

    console.log('Translation results:\n');

    const expectedTranslations: Record<string, string> = {
      'Copper Door': 'Медная дверь',
      'Copper Chain': 'Медная цепь',
      'Copper Seal': 'Медная печать',
      'Copper Pane': 'Медная панель',
      'Copper Gearshift': 'Медный переключатель',
      'Copper Mixer': 'Медный смеситель',
    };

    let correctGender = 0;
    let fromFragment = 0;

    results2.forEach((r, i) => {
      const original = variationTexts[i];
      const expected = expectedTranslations[original];
      const isCorrect = r.text === expected;
      const genderMark = isCorrect ? '✅' : '❌';

      console.log(`${genderMark} ${original}`);
      console.log(`   → ${r.text}`);
      console.log(`   Expected: ${expected}`);
      console.log(`   Source: ${r.source}\n`);

      if (isCorrect) correctGender++;
      if (r.source === 'fragment') fromFragment++;
    });

    const stats2 = fragmentCache.getStats();

    console.log('Results:');
    console.log(`  Correct gender: ${correctGender}/${results2.length} (${((correctGender / results2.length) * 100).toFixed(1)}%)`);
    console.log(`  From FragmentCache: ${fromFragment}/${results2.length} (${((fromFragment / results2.length) * 100).toFixed(1)}%)`);
    console.log(`  Hit rate: ${stats2.hitRate}%\n`);

    // Assertions
    expect(results2.length).toBe(variationTexts.length);
    expect(correctGender).toBe(results2.length);
    expect(fromFragment).toBe(results2.length);
  }, 300000);
});
