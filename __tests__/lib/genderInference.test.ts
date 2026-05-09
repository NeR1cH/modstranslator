/**
 * Test for automatic gender inference from Russian translations
 * Tests that FragmentCache can infer noun gender from Russian word endings
 */

import { translateBatchThroughPipeline } from '../../lib/translationPipeline';
import { getFragmentCache } from '../../lib/fragmentCache';

// Mock DeepL API with realistic translations
jest.mock('../../lib/deepl', () => ({
  translateTexts: jest.fn((texts: string[]) => {
    const translations: Record<string, string> = {
      // Base translations - will be learned
      'Iron Sword': 'Железный меч',
      'Iron Plate': 'Железная пластина',
      'Iron Window': 'Железное окно',
      'Copper Ore': 'Медная руда',

      // Unknown nouns - single word translations for learning
      'Wrench': 'Ключ',
      'Coil': 'Катушка',
      'Cable': 'Кабель',
      'Wire': 'Проволока',
      'Device': 'Устройство',

      // Variations - should NOT be called if inference works
      'Copper Wrench': 'SHOULD_NOT_BE_CALLED',
      'Copper Coil': 'SHOULD_NOT_BE_CALLED',
      'Copper Cable': 'SHOULD_NOT_BE_CALLED',
      'Copper Wire': 'SHOULD_NOT_BE_CALLED',
      'Copper Device': 'SHOULD_NOT_BE_CALLED',
    };

    return Promise.resolve(texts.map(text => {
      if (translations[text] && translations[text] !== 'SHOULD_NOT_BE_CALLED') {
        return translations[text];
      }
      throw new Error(`Unexpected API call for: ${text}`);
    }));
  })
}));

describe('FragmentCache gender inference test', () => {
  it('should infer gender from Russian word endings and apply correct agreement', async () => {
    console.log('\n=== GENDER INFERENCE TEST ===\n');

    const fragmentCache = getFragmentCache();
    fragmentCache.clear();

    // ========== PHASE 1: Learn base translations ==========
    console.log('============================================================');
    console.log('📚 PHASE 1: Learning base translations with unknown nouns');
    console.log('============================================================\n');

    const baseTexts = [
      'Iron Sword',      // меч (known in NOUN_GENDERS)
      'Iron Plate',      // пластина (known in NOUN_GENDERS)
      'Iron Window',     // окно (known in NOUN_GENDERS)
      'Copper Ore',      // руда (to learn "Copper" material)
      'Wrench',          // Ключ (UNKNOWN - will infer masculine from "ключ")
      'Coil',            // Катушка (UNKNOWN - will infer feminine from "катушка")
      'Cable',           // Кабель (UNKNOWN - will infer masculine from "кабель")
      'Wire',            // Проволока (UNKNOWN - will infer feminine from "проволока")
      'Device',          // Устройство (UNKNOWN - will infer neuter from "устройство")
    ];

    console.log('Translating base items:');
    baseTexts.forEach(t => console.log(`  - ${t}`));
    console.log('');

    const results1 = await translateBatchThroughPipeline(baseTexts);

    console.log('Base translations:');
    results1.forEach((r, i) => {
      console.log(`  ${baseTexts[i]} → ${r.text} (${r.source})`);
    });

    const stats1 = fragmentCache.getStats();
    console.log(`\nFragments learned: ${stats1.total}\n`);

    // ========== PHASE 2: Test variations with gender inference ==========
    console.log('============================================================');
    console.log('🔄 PHASE 2: Testing variations (Copper items)');
    console.log('============================================================\n');

    const variationTexts = [
      'Copper Wrench',   // Should infer masculine from "ключ"
      'Copper Coil',     // Should infer feminine from "катушка"
      'Copper Cable',    // Should infer masculine from "кабель"
      'Copper Wire',     // Should infer feminine from "проволока"
      'Copper Device',   // Should infer neuter from "устройство"
    ];

    console.log('Translating variations:');
    variationTexts.forEach(t => console.log(`  - ${t}`));
    console.log('');

    const results2 = await translateBatchThroughPipeline(variationTexts);

    console.log('\n============================================================');
    console.log('📊 RESULTS WITH GENDER INFERENCE');
    console.log('============================================================\n');

    // Expected translations with correct gender
    const expectedTranslations: Record<string, string> = {
      'Copper Wrench': 'Медный ключ',           // masculine (inferred from "ключ")
      'Copper Coil': 'Медная катушка',          // feminine (inferred from "катушка")
      'Copper Cable': 'Медный кабель',          // masculine (inferred from "кабель")
      'Copper Wire': 'Медная проволока',        // feminine (inferred from "проволока")
      'Copper Device': 'Медное устройство',     // neuter (inferred from "устройство")
    };

    let correctGender = 0;
    let fromFragment = 0;
    let fromAPI = 0;

    console.log('Translation results:\n');
    results2.forEach((r, i) => {
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

    const stats2 = fragmentCache.getStats();

    console.log('============================================================');
    console.log('📈 FINAL STATISTICS');
    console.log('============================================================\n');

    console.log('Fragment Cache:');
    console.log(`  Total fragments: ${stats2.total}`);
    console.log(`  Hits: ${stats2.hits} | Misses: ${stats2.misses}`);
    console.log(`  Hit rate: ${stats2.hitRate}%\n`);

    console.log('Results:');
    console.log(`  Correct gender agreement: ${correctGender}/${results2.length} (${((correctGender / results2.length) * 100).toFixed(1)}%)`);
    console.log(`  From FragmentCache: ${fromFragment}/${results2.length} (${((fromFragment / results2.length) * 100).toFixed(1)}%)`);
    console.log(`  From API: ${fromAPI}/${results2.length} (${((fromAPI / results2.length) * 100).toFixed(1)}%)`);
    console.log(`  API calls saved: ${results2.length - fromAPI}/${results2.length} (${(((results2.length - fromAPI) / results2.length) * 100).toFixed(1)}%)\n`);

    console.log('============================================================\n');

    // Assertions
    expect(results2.length).toBe(variationTexts.length);
    expect(stats2.total).toBeGreaterThan(0);

    // All should come from FragmentCache
    expect(fromFragment).toBe(results2.length);

    // All should have correct gender
    expect(correctGender).toBe(results2.length);

    // Should save all API calls
    expect(fromAPI).toBe(0);
  }, 300000);
});
