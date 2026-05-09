/**
 * Direct translation test script
 * Tests FragmentCache and TemplateCache improvements
 */

const fs = require('fs');
const path = require('path');

// Import translation pipeline
const { translateBatchThroughPipeline } = require('./lib/translationPipeline');
const { getFragmentCache } = require('./lib/fragmentCache');
const { getTemplateCache } = require('./lib/templateCache');
const { getTranslationCache } = require('./lib/translationCache');

async function runTest() {
  console.log('\n=== TRANSLATION TEST START ===\n');

  // Load test file
  const testFile = fs.readFileSync('test-translation.json', 'utf-8');
  const testData = JSON.parse(testFile);
  const texts = Object.values(testData);

  console.log(`Total strings to translate: ${texts.length}`);
  console.log('\nSample strings:');
  texts.slice(0, 5).forEach(t => console.log(`  - ${t}`));
  console.log('  ...\n');

  // Get initial stats
  const fragmentCache = getFragmentCache();
  const templateCache = getTemplateCache();
  const translationCache = getTranslationCache();

  console.log('Initial cache state:');
  console.log(`  Translation Cache: ${translationCache.getStats().total} entries`);
  console.log(`  Fragment Cache: ${fragmentCache.getStats().total} fragments`);
  console.log(`  Template Cache: ${templateCache.getStats().total} templates\n`);

  // Translate
  console.log('Starting translation...\n');
  const startTime = Date.now();

  const results = await translateBatchThroughPipeline(texts);

  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);

  console.log(`\nTranslation completed in ${duration}s\n`);

  // Show results
  console.log('Sample translations:');
  for (let i = 0; i < Math.min(10, results.length); i++) {
    console.log(`  ${texts[i]} → ${results[i].text} (${results[i].source})`);
  }
  console.log('  ...\n');

  // Get final stats
  const finalFragmentStats = fragmentCache.getStats();
  const finalTemplateStats = templateCache.getStats();
  const finalTranslationStats = translationCache.getStats();

  console.log('\n============================================================');
  console.log('📊 FINAL CACHE STATISTICS');
  console.log('============================================================\n');

  console.log('Translation Cache:');
  console.log(`  Total entries: ${finalTranslationStats.total}`);
  console.log(`  Hits: ${finalTranslationStats.hits} | Misses: ${finalTranslationStats.misses}`);
  console.log(`  Hit rate: ${finalTranslationStats.hitRate}%\n`);

  console.log('Fragment Cache:');
  console.log(`  Total fragments: ${finalFragmentStats.total}`);
  console.log(`  Words: ${finalFragmentStats.words} | Phrases: ${finalFragmentStats.phrases}`);
  console.log(`  High confidence (≥80): ${finalFragmentStats.highConfidence}`);
  console.log(`  Low confidence: ${finalFragmentStats.lowConfidence}`);
  console.log(`  Hits: ${finalFragmentStats.hits} | Misses: ${finalFragmentStats.misses}`);
  console.log(`  Hit rate: ${finalFragmentStats.hitRate}%\n`);

  console.log('Template Cache:');
  console.log(`  Total templates: ${finalTemplateStats.total}`);
  console.log(`  Smart: ${finalTemplateStats.smart} | Simple: ${finalTemplateStats.simple}\n`);

  // Count sources
  const sourceCounts = {};
  results.forEach(r => {
    sourceCounts[r.source] = (sourceCounts[r.source] || 0) + 1;
  });

  console.log('Translation sources:');
  Object.entries(sourceCounts).forEach(([source, count]) => {
    const percent = ((count / results.length) * 100).toFixed(1);
    console.log(`  ${source}: ${count} (${percent}%)`);
  });

  const apiCalls = sourceCounts['deepl'] || sourceCounts['openrouter'] || 0;
  const saved = results.length - apiCalls;
  const savedPercent = ((saved / results.length) * 100).toFixed(1);

  console.log(`\n💰 API calls saved: ${saved}/${results.length} (${savedPercent}%)`);
  console.log('============================================================\n');

  console.log('=== TRANSLATION TEST END ===\n');
}

runTest().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
