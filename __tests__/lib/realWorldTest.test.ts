/**
 * Real-world translation test
 * Tests FragmentCache and TemplateCache improvements with actual data
 */

import { translateBatchThroughPipeline } from '../../lib/translationPipeline';
import { getFragmentCache, resetFragmentCache } from '../../lib/fragmentCache';
import { getTemplateCache } from '../../lib/templateCache';
import { getTranslationCache } from '../../lib/translationCache';
import fs from 'fs';
import path from 'path';

// Mock DeepL API
jest.mock('../../lib/deepl', () => ({
  translateTexts: jest.fn((texts: string[]) => {
    // Simple mock translation: add "RU:" prefix
    return Promise.resolve(texts.map(text => {
      // Simulate real translations for common patterns
      const translations: Record<string, string> = {
        'Iron Sheet': 'Железный лист',
        'Copper Sheet': 'Медный лист',
        'Brass Sheet': 'Латунный лист',
        'Gold Sheet': 'Золотой лист',
        'Iron Ingot': 'Железный слиток',
        'Copper Ingot': 'Медный слиток',
        'Zinc Ingot': 'Цинковый слиток',
        'Brass Ingot': 'Латунный слиток',
        'Iron Nugget': 'Железный самородок',
        'Copper Nugget': 'Медный самородок',
        'Zinc Nugget': 'Цинковый самородок',
        'Iron Ore': 'Железная руда',
        'Copper Ore': 'Медная руда',
        'Zinc Ore': 'Цинковая руда',
        'Gold Ore': 'Золотая руда',
        'Iron Block': 'Железный блок',
        'Copper Block': 'Медный блок',
        'Brass Block': 'Латунный блок',
        'Zinc Block': 'Цинковый блок',
      };
      return translations[text] || `RU:${text}`;
    }));
  })
}));

describe('Real-world translation test', () => {
  it('should translate test file twice and show cache improvement', async () => {
    console.log('\n=== TRANSLATION TEST START ===\n');

    // Load test file
    const testFile = fs.readFileSync(path.join(process.cwd(), 'test-translation.json'), 'utf-8');
    const testData = JSON.parse(testFile);
    const texts = Object.values(testData) as string[];

    console.log(`Total strings to translate: ${texts.length}`);
    console.log('\nSample strings:');
    texts.slice(0, 5).forEach(t => console.log(`  - ${t}`));
    console.log('  ...\n');

    // Get caches
    resetFragmentCache(); // Reset singleton before creating test cache
    const fragmentCache = getFragmentCache('.translation-cache-test');
    const templateCache = getTemplateCache();
    const translationCache = getTranslationCache();

    // Clear caches for clean test
    fragmentCache.clear();

    console.log('Initial cache state:');
    console.log(`  Translation Cache: ${translationCache.getStats().total} entries`);
    console.log(`  Fragment Cache: ${fragmentCache.getStats().total} fragments`);
    console.log(`  Template Cache: ${templateCache.getStats().total} templates\n`);

    // ========== FIRST PASS (LEARNING) ==========
    console.log('============================================================');
    console.log('🔄 FIRST PASS - Learning phase');
    console.log('============================================================\n');

    const startTime1 = Date.now();
    const results1 = await translateBatchThroughPipeline(texts);
    const duration1 = ((Date.now() - startTime1) / 1000).toFixed(2);

    console.log(`\nFirst pass completed in ${duration1}s\n`);

    const stats1Fragment = fragmentCache.getStats();
    const stats1Template = templateCache.getStats();
    const stats1Translation = translationCache.getStats();

    console.log('After first pass:');
    console.log(`  Translation Cache: ${stats1Translation.total} entries`);
    console.log(`  Fragment Cache: ${stats1Fragment.total} fragments (${stats1Fragment.words} words, ${stats1Fragment.phrases} phrases)`);
    console.log(`  Template Cache: ${stats1Template.total} templates (${stats1Template.smart} smart, ${stats1Template.simple} simple)`);

    const sources1: Record<string, number> = {};
    results1.forEach(r => sources1[r.source] = (sources1[r.source] || 0) + 1);
    console.log('\nFirst pass sources:');
    Object.entries(sources1).forEach(([source, count]) => {
      console.log(`  ${source}: ${count} (${((count / results1.length) * 100).toFixed(1)}%)`);
    });

    // ========== SECOND PASS (CACHE USAGE) ==========
    console.log('\n============================================================');
    console.log('🚀 SECOND PASS - Cache usage phase');
    console.log('============================================================\n');

    const startTime2 = Date.now();
    const results2 = await translateBatchThroughPipeline(texts);
    const duration2 = ((Date.now() - startTime2) / 1000).toFixed(2);

    console.log(`\nSecond pass completed in ${duration2}s\n`);

    const stats2Fragment = fragmentCache.getStats();
    const stats2Template = templateCache.getStats();
    const stats2Translation = translationCache.getStats();

    console.log('\n============================================================');
    console.log('📊 FINAL CACHE STATISTICS');
    console.log('============================================================\n');

    console.log('Translation Cache:');
    console.log(`  Total entries: ${stats2Translation.total}`);
    console.log(`  Hits: ${stats2Translation.hits} | Misses: ${stats2Translation.misses}`);
    console.log(`  Hit rate: ${stats2Translation.hitRate}%\n`);

    console.log('Fragment Cache:');
    console.log(`  Total fragments: ${stats2Fragment.total}`);
    console.log(`  Words: ${stats2Fragment.words} | Phrases: ${stats2Fragment.phrases}`);
    console.log(`  High confidence (≥80): ${stats2Fragment.highConfidence}`);
    console.log(`  Low confidence: ${stats2Fragment.lowConfidence}`);
    console.log(`  Hits: ${stats2Fragment.hits} | Misses: ${stats2Fragment.misses}`);
    console.log(`  Hit rate: ${stats2Fragment.hitRate}%\n`);

    console.log('Template Cache:');
    console.log(`  Total templates: ${stats2Template.total}`);
    console.log(`  Smart: ${stats2Template.smart} | Simple: ${stats2Template.simple}\n`);

    const sources2: Record<string, number> = {};
    results2.forEach(r => sources2[r.source] = (sources2[r.source] || 0) + 1);

    console.log('Second pass sources:');
    Object.entries(sources2).forEach(([source, count]) => {
      const percent = ((count / results2.length) * 100).toFixed(1);
      console.log(`  ${source}: ${count} (${percent}%)`);
    });

    const apiCalls2 = (sources2['deepl'] || 0) + (sources2['openrouter'] || 0);
    const saved2 = results2.length - apiCalls2;
    const savedPercent2 = ((saved2 / results2.length) * 100).toFixed(1);

    console.log(`\n💰 API calls saved on second pass: ${saved2}/${results2.length} (${savedPercent2}%)`);

    console.log('\n============================================================');
    console.log('📈 IMPROVEMENT SUMMARY');
    console.log('============================================================\n');

    console.log(`Speed improvement: ${duration1}s → ${duration2}s (${((1 - parseFloat(duration2) / parseFloat(duration1)) * 100).toFixed(1)}% faster)`);
    console.log(`Fragment Cache hit rate: 0% → ${stats2Fragment.hitRate}%`);
    console.log(`Translation Cache hit rate: 0% → ${stats2Translation.hitRate}%`);
    console.log(`API calls: ${results1.length} → ${apiCalls2} (saved ${saved2})`);

    console.log('\n============================================================\n');
    console.log('=== TRANSLATION TEST END ===\n');

    // Assertions
    expect(results2.length).toBe(texts.length);
    expect(stats2Fragment.total).toBeGreaterThan(0);
    // Note: FragmentCache hit rate will be 0% on second pass because TranslationCache
    // intercepts all exact matches first. Use fragmentCacheVariation.test.ts to test
    // FragmentCache effectiveness with material variations.
  }, 300000); // 5 minute timeout
});
