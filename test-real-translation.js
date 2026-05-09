/**
 * Real-world translation test with detailed logging
 * Tests FragmentCache on diverse content with unknown nouns
 */

const { translateBatchThroughPipeline } = require('./lib/translationPipeline');
const { getFragmentCache } = require('./lib/fragmentCache');
const { getTranslationCache } = require('./lib/translationCache');

async function runRealTest() {
  console.log('\n=== REAL TRANSLATION TEST ===\n');

  // Real strings from various mods - mix of known and unknown nouns
  const phase1Texts = [
    // Known nouns (in NOUN_GENDERS)
    'Iron Sword',
    'Diamond Pickaxe',
    'Golden Helmet',
    'Copper Ingot',
    'Steel Plate',
    'Bronze Gear',

    // Unknown nouns (NOT in NOUN_GENDERS)
    'Titanium Wrench',
    'Aluminum Cable',
    'Platinum Coil',
    'Silver Wire',
    'Osmium Dust',
    'Uranium Chunk',

    // Complex phrases
    'Reinforced Iron Casing',
    'Advanced Steel Frame',
    'Heavy Duty Copper Plate',
  ];

  const phase2Texts = [
    // Variations with known nouns
    'Steel Sword',
    'Bronze Pickaxe',
    'Silver Helmet',
    'Brass Ingot',
    'Iron Plate',
    'Copper Gear',

    // Variations with unknown nouns
    'Steel Wrench',
    'Copper Cable',
    'Iron Coil',
    'Gold Wire',
    'Iron Dust',
    'Copper Chunk',

    // More complex
    'Reinforced Steel Casing',
    'Advanced Iron Frame',
    'Heavy Duty Steel Plate',
  ];

  const fragmentCache = getFragmentCache();
  const translationCache = getTranslationCache();

  // Clear caches
  fragmentCache.clear();
  console.log('Caches cleared\n');

  // ========== PHASE 1: Learning ==========
  console.log('============================================================');
  console.log('📚 PHASE 1: Learning from base translations');
  console.log('============================================================\n');

  console.log('Translating base items:');
  phase1Texts.forEach(t => console.log(`  - ${t}`));
  console.log('');

  const startTime1 = Date.now();
  const results1 = await translateBatchThroughPipeline(phase1Texts);
  const duration1 = ((Date.now() - startTime1) / 1000).toFixed(2);

  console.log(`\nPhase 1 completed in ${duration1}s\n`);

  console.log('Translations:');
  results1.forEach((r, i) => {
    console.log(`  ${phase1Texts[i]}`);
    console.log(`    → ${r.text} (${r.source})`);
  });

  const stats1Fragment = fragmentCache.getStats();
  console.log(`\nFragments learned: ${stats1Fragment.total} (${stats1Fragment.words} words, ${stats1Fragment.phrases} phrases)`);
  console.log(`High confidence: ${stats1Fragment.highConfidence}\n`);

  // ========== PHASE 2: Testing variations ==========
  console.log('============================================================');
  console.log('🔄 PHASE 2: Testing variations (different materials)');
  console.log('============================================================\n');

  console.log('Translating variations:');
  phase2Texts.forEach(t => console.log(`  - ${t}`));
  console.log('');

  const startTime2 = Date.now();
  const results2 = await translateBatchThroughPipeline(phase2Texts);
  const duration2 = ((Date.now() - startTime2) / 1000).toFixed(2);

  console.log(`\nPhase 2 completed in ${duration2}s\n`);

  // ========== DETAILED ANALYSIS ==========
  console.log('============================================================');
  console.log('📊 DETAILED ANALYSIS');
  console.log('============================================================\n');

  console.log('Phase 2 translations:\n');

  const fromFragment = [];
  const fromAPI = [];
  const unknownNouns = [];

  results2.forEach((r, i) => {
    const original = phase2Texts[i];
    console.log(`${i + 1}. ${original}`);
    console.log(`   → ${r.text}`);
    console.log(`   Source: ${r.source}`);

    // Check if this has unknown noun
    const words = original.toLowerCase().split(/\s+/);
    const lastWord = words[words.length - 1];
    const knownNouns = ['sword', 'pickaxe', 'helmet', 'ingot', 'plate', 'gear', 'ore', 'block', 'rod', 'nugget', 'sheet'];
    if (!knownNouns.includes(lastWord)) {
      console.log(`   ⚠️  Unknown noun: "${lastWord}"`);
      unknownNouns.push({ original, translation: r.text, noun: lastWord });
    }

    console.log('');

    if (r.source === 'fragment') {
      fromFragment.push({ original, translation: r.text });
    } else if (r.source === 'deepl' || r.source === 'openrouter') {
      fromAPI.push({ original, translation: r.text });
    }
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
  console.log(`  Low confidence: ${stats2Fragment.lowConfidence}`);
  console.log(`  Hits: ${stats2Fragment.hits} | Misses: ${stats2Fragment.misses}`);
  console.log(`  Hit rate: ${stats2Fragment.hitRate}%\n`);

  console.log('Translation Cache:');
  console.log(`  Total entries: ${stats2Translation.total}`);
  console.log(`  Hits: ${stats2Translation.hits} | Misses: ${stats2Translation.misses}`);
  console.log(`  Hit rate: ${stats2Translation.hitRate}%\n`);

  console.log('Phase 2 Results:');
  console.log(`  From FragmentCache: ${fromFragment.length}/${results2.length} (${((fromFragment.length / results2.length) * 100).toFixed(1)}%)`);
  console.log(`  From API: ${fromAPI.length}/${results2.length} (${((fromAPI.length / results2.length) * 100).toFixed(1)}%)`);
  console.log(`  API calls saved: ${results2.length - fromAPI.length}/${results2.length} (${(((results2.length - fromAPI.length) / results2.length) * 100).toFixed(1)}%)\n`);

  if (unknownNouns.length > 0) {
    console.log('============================================================');
    console.log('⚠️  UNKNOWN NOUNS ANALYSIS');
    console.log('============================================================\n');
    console.log(`Found ${unknownNouns.length} items with unknown nouns:\n`);

    unknownNouns.forEach(item => {
      console.log(`  "${item.original}" → "${item.translation}"`);
      console.log(`    Unknown noun: "${item.noun}"`);

      // Analyze gender agreement
      const translation = item.translation;
      const words = translation.split(/\s+/);
      if (words.length >= 2) {
        const adjective = words[0];
        console.log(`    Adjective form: "${adjective}"`);

        // Detect ending
        if (adjective.endsWith('ый') || adjective.endsWith('ой') || adjective.endsWith('ий')) {
          console.log(`    Gender: masculine (ending: ${adjective.slice(-2)})`);
        } else if (adjective.endsWith('ая') || adjective.endsWith('яя')) {
          console.log(`    Gender: feminine (ending: ${adjective.slice(-2)})`);
        } else if (adjective.endsWith('ое') || adjective.endsWith('ее')) {
          console.log(`    Gender: neuter (ending: ${adjective.slice(-2)})`);
        }
      }
      console.log('');
    });
  }

  console.log('============================================================\n');
  console.log('=== TEST COMPLETE ===\n');
}

runRealTest().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
