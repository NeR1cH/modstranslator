/**
 * FragmentCache variation test
 * Tests that FragmentCache can compose translations from learned fragments
 */

import { translateBatchThroughPipeline } from '../../lib/translationPipeline';
import { getFragmentCache } from '../../lib/fragmentCache';
import { getTemplateCache } from '../../lib/templateCache';
import { getTranslationCache } from '../../lib/translationCache';

// Mock DeepL API with realistic translations
jest.mock('../../lib/deepl', () => ({
  translateTexts: jest.fn((texts: string[]) => {
    const translations: Record<string, string> = {
      // Base translations (will be learned)
      'Iron Sheet': 'Железный лист',
      'Iron Block': 'Железный блок',
      'Iron Ingot': 'Железный слиток',
      'Iron Gear': 'Железная шестерня',
      'Iron Rod': 'Железный стержень',
      'Iron Plate': 'Железная пластина',
      'Copper Ore': 'Медная руда',
      'Gold Ore': 'Золотая руда',

      // These should NOT be called if FragmentCache works
      'Copper Sheet': 'SHOULD_NOT_BE_CALLED',
      'Copper Block': 'SHOULD_NOT_BE_CALLED',
      'Copper Ingot': 'SHOULD_NOT_BE_CALLED',
      'Copper Gear': 'SHOULD_NOT_BE_CALLED',
      'Copper Rod': 'SHOULD_NOT_BE_CALLED',
      'Copper Plate': 'SHOULD_NOT_BE_CALLED',
      'Gold Sheet': 'SHOULD_NOT_BE_CALLED',
      'Gold Block': 'SHOULD_NOT_BE_CALLED',
      'Gold Ingot': 'SHOULD_NOT_BE_CALLED',
    };

    return Promise.resolve(texts.map(text => {
      if (translations[text] && translations[text] !== 'SHOULD_NOT_BE_CALLED') {
        return translations[text];
      }
      throw new Error(`Unexpected API call for: ${text}`);
    }));
  })
}));

describe('FragmentCache variation test', () => {
  it('should compose translations from learned fragments with correct gender agreement', async () => {
    console.log('\n=== FRAGMENT CACHE VARIATION TEST ===\n');

    const fragmentCache = getFragmentCache();
    const templateCache = getTemplateCache();
    const translationCache = getTranslationCache();

    // Clear caches
    fragmentCache.clear();

    // ========== PHASE 1: Learn base translations ==========
    console.log('============================================================');
    console.log('📚 PHASE 1: Learning base translations (Iron items)');
    console.log('============================================================\n');

    const baseTexts = [
      'Iron Sheet',
      'Iron Block',
      'Iron Ingot',
      'Iron Gear',
      'Iron Rod',
      'Iron Plate',
      // Add ONE example with Copper and Gold to learn these materials
      'Copper Ore',
      'Gold Ore',
    ];

    console.log('Translating base items:');
    baseTexts.forEach(t => console.log(`  - ${t}`));
    console.log('');

    const baseResults = await translateBatchThroughPipeline(baseTexts);

    console.log('Base translations:');
    baseResults.forEach((r, i) => {
      console.log(`  ${baseTexts[i]} → ${r.text} (${r.source})`);
    });

    const stats1Fragment = fragmentCache.getStats();
    const stats1Translation = translationCache.getStats();

    console.log(`\nFragments learned: ${stats1Fragment.total} (${stats1Fragment.words} words, ${stats1Fragment.phrases} phrases)`);
    console.log(`Translation cache: ${stats1Translation.total} entries\n`);

    // ========== PHASE 2: Test variations ==========
    console.log('============================================================');
    console.log('🔄 PHASE 2: Testing variations (Copper & Gold items)');
    console.log('============================================================\n');

    const variationTexts = [
      'Copper Sheet',
      'Copper Block',
      'Copper Ingot',
      'Copper Gear',
      'Copper Rod',
      'Copper Plate',
      'Gold Sheet',
      'Gold Block',
      'Gold Ingot',
    ];

    console.log('Translating variations:');
    variationTexts.forEach(t => console.log(`  - ${t}`));
    console.log('');

    const variationResults = await translateBatchThroughPipeline(variationTexts);

    console.log('\n============================================================');
    console.log('📊 VARIATION RESULTS');
    console.log('============================================================\n');

    // Expected translations with correct gender
    const expectedTranslations: Record<string, string> = {
      'Copper Sheet': 'Медный лист',
      'Copper Block': 'Медный блок',
      'Copper Ingot': 'Медный слиток',
      'Copper Gear': 'Медная шестерня',
      'Copper Rod': 'Медный стержень',
      'Copper Plate': 'Медная пластина',
      'Gold Sheet': 'Золотой лист',
      'Gold Block': 'Золотой блок',
      'Gold Ingot': 'Золотой слиток',
    };

    let correctGender = 0;
    let fromFragment = 0;
    let fromAPI = 0;

    console.log('Translation results:\n');
    variationResults.forEach((r, i) => {
      const original = variationTexts[i];
      const expected = expectedTranslations[original];
      const isCorrect = r.text === expected;
      const genderMark = isCorrect ? '✅' : '❌';
      const source = r.source;

      console.log(`${genderMark} ${original}`);
      console.log(`   → ${r.text}`);
      console.log(`   Expected: ${expected}`);
      console.log(`   Source: ${source}\n`);

      if (isCorrect) correctGender++;
      if (source === 'fragment') fromFragment++;
      if (source === 'deepl' || source === 'openrouter') fromAPI++;
    });

    const stats2Fragment = fragmentCache.getStats();
    const stats2Translation = translationCache.getStats();

    console.log('============================================================');
    console.log('📈 FINAL STATISTICS');
    console.log('============================================================\n');

    console.log('Fragment Cache:');
    console.log(`  Total fragments: ${stats2Fragment.total}`);
    console.log(`  Words: ${stats2Fragment.words} | Phrases: ${stats2Fragment.phrases}`);
    console.log(`  High confidence: ${stats2Fragment.highConfidence}`);
    console.log(`  Hits: ${stats2Fragment.hits} | Misses: ${stats2Fragment.misses}`);
    console.log(`  Hit rate: ${stats2Fragment.hitRate}%\n`);

    console.log('Translation Cache:');
    console.log(`  Total entries: ${stats2Translation.total}`);
    console.log(`  Hits: ${stats2Translation.hits} | Misses: ${stats2Translation.misses}`);
    console.log(`  Hit rate: ${stats2Translation.hitRate}%\n`);

    console.log('Results:');
    console.log(`  Correct gender agreement: ${correctGender}/${variationResults.length} (${((correctGender / variationResults.length) * 100).toFixed(1)}%)`);
    console.log(`  From FragmentCache: ${fromFragment}/${variationResults.length} (${((fromFragment / variationResults.length) * 100).toFixed(1)}%)`);
    console.log(`  From API: ${fromAPI}/${variationResults.length} (${((fromAPI / variationResults.length) * 100).toFixed(1)}%)`);
    console.log(`  API calls saved: ${variationResults.length - fromAPI}/${variationResults.length} (${(((variationResults.length - fromAPI) / variationResults.length) * 100).toFixed(1)}%)\n`);

    console.log('============================================================\n');

    // Assertions
    expect(variationResults.length).toBe(variationTexts.length);
    expect(stats2Fragment.total).toBeGreaterThan(0);

    // At least 50% should come from FragmentCache
    expect(fromFragment).toBeGreaterThan(variationResults.length * 0.5);

    // At least 80% should have correct gender
    expect(correctGender).toBeGreaterThan(variationResults.length * 0.8);

    // Should save at least 80% of API calls
    expect(fromAPI).toBeLessThan(variationResults.length * 0.2);
  }, 300000);
});
