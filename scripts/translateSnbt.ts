/**
 * Translate create111.snbt and analyze fragment cache results
 */

import { translateBatchThroughPipeline } from '../lib/translationPipeline.js';
import { getFragmentCache } from '../lib/fragmentCache.js';
import { parseSnbt } from '../lib/langParsers.js';
import fs from 'fs';
import path from 'path';

const SNBT_FILE = path.join(process.cwd(), 'create111.snbt');

async function translateAndAnalyze() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('📝 TRANSLATING create111.snbt WITH FIXED FRAGMENTCACHE');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // Check if file exists
  if (!fs.existsSync(SNBT_FILE)) {
    console.log(`❌ File not found: ${SNBT_FILE}`);
    console.log('Please place create111.snbt in the project root directory.\n');
    return;
  }

  // Read and parse SNBT file
  console.log('📖 Reading create111.snbt...\n');
  const content = fs.readFileSync(SNBT_FILE, 'utf-8');
  const entries = parseSnbt(content);

  console.log(`Found ${entries.length} entries to translate\n`);
  console.log('═══════════════════════════════════════════════════════════════\n');

  // Translate
  console.log('🔄 Translating...\n');
  const values = entries.map(e => e.value);
  const results = await translateBatchThroughPipeline(values, 'RU', {
    fileName: 'create111.snbt',
    fileContent: content
  });

  console.log('\n✅ Translation complete!\n');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // Analyze fragment cache
  const fragmentCache = getFragmentCache();
  const stats = fragmentCache.getStats();

  console.log('📊 FRAGMENT CACHE STATISTICS:');
  console.log('─────────────────────────────────────────────────────────────');
  console.log(`Total fragments: ${stats.total}`);
  console.log(`Words: ${stats.words}`);
  console.log(`Phrases: ${stats.phrases}`);
  console.log(`High confidence (≥80): ${stats.highConfidence}`);
  console.log(`Low confidence (<80): ${stats.lowConfidence}`);
  console.log(`Hit rate: ${stats.hitRate}%\n`);

  // Access internal fragments map
  const fragments = (fragmentCache as any).fragments as Map<string, any>;

  // Convert to array and sort by confidence
  const fragmentArray = Array.from(fragments.entries()).map(([key, value]) => ({
    word: key,
    translation: value.translation,
    confidence: value.confidence,
    count: value.count || 1,
    context: value.context,
    gender: value.gender,
    isAdjective: value.isAdjective
  }));

  console.log('═══════════════════════════════════════════════════════════════\n');

  // Show top 20 by confidence
  console.log('🔺 TOP 20 FRAGMENTS BY CONFIDENCE:');
  console.log('─────────────────────────────────────────────────────────────\n');

  fragmentArray.sort((a, b) => b.confidence - a.confidence);

  for (let i = 0; i < Math.min(20, fragmentArray.length); i++) {
    const frag = fragmentArray[i];
    console.log(`${(i + 1).toString().padStart(2)}. "${frag.word}" → "${frag.translation}"`);
    console.log(`    Confidence: ${frag.confidence}% | Count: ${frag.count} | Context: ${frag.context}`);
    if (frag.gender) {
      console.log(`    Gender: ${frag.gender}`);
    }
    if (frag.isAdjective) {
      console.log(`    Type: adjective`);
    }
    console.log('');
  }

  console.log('═══════════════════════════════════════════════════════════════\n');

  // Confidence distribution
  console.log('📊 CONFIDENCE DISTRIBUTION:');
  console.log('─────────────────────────────────────────────────────────────\n');

  const ranges = [
    { min: 0, max: 20, count: 0 },
    { min: 20, max: 40, count: 0 },
    { min: 40, max: 60, count: 0 },
    { min: 60, max: 80, count: 0 },
    { min: 80, max: 100, count: 0 }
  ];

  for (const frag of fragmentArray) {
    for (const range of ranges) {
      if (frag.confidence >= range.min && frag.confidence < range.max) {
        range.count++;
        break;
      }
    }
  }

  for (const range of ranges) {
    const percentage = fragmentArray.length > 0
      ? ((range.count / fragmentArray.length) * 100).toFixed(1)
      : '0.0';
    const bar = '█'.repeat(Math.floor(range.count / 10));
    console.log(`${range.min.toString().padStart(3)}-${range.max.toString().padStart(3)}%: ${range.count.toString().padStart(4)} (${percentage.padStart(5)}%) ${bar}`);
  }

  console.log('\n═══════════════════════════════════════════════════════════════\n');

  // Translation sources breakdown
  console.log('📊 TRANSLATION SOURCES:');
  console.log('─────────────────────────────────────────────────────────────\n');

  const sources = {
    cache: 0,
    fragment: 0,
    template: 0,
    deepl: 0,
    openrouter: 0
  };

  for (const result of results) {
    sources[result.source]++;
  }

  console.log(`Cache hits:     ${sources.cache.toString().padStart(4)} (${((sources.cache / results.length) * 100).toFixed(1)}%)`);
  console.log(`Fragment hits:  ${sources.fragment.toString().padStart(4)} (${((sources.fragment / results.length) * 100).toFixed(1)}%)`);
  console.log(`Template hits:  ${sources.template.toString().padStart(4)} (${((sources.template / results.length) * 100).toFixed(1)}%)`);
  console.log(`DeepL API:      ${sources.deepl.toString().padStart(4)} (${((sources.deepl / results.length) * 100).toFixed(1)}%)`);
  console.log(`OpenRouter API: ${sources.openrouter.toString().padStart(4)} (${((sources.openrouter / results.length) * 100).toFixed(1)}%)`);
  console.log(`Total:          ${results.length.toString().padStart(4)}`);

  console.log('\n═══════════════════════════════════════════════════════════════');
}

translateAndAnalyze().catch(console.error);
