/**
 * Direct translation test bypassing API
 */

import { translateBatchThroughPipeline } from '../lib/translationPipeline.js';
import { getFragmentCache } from '../lib/fragmentCache.js';
import { parseSnbt } from '../lib/langParsers.js';
import fs from 'fs';
import path from 'path';

const SNBT_FILE = path.join(process.cwd(), 'create111.snbt');

async function directTranslate() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('📝 DIRECT TRANSLATION TEST (FIRST RUN)');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // Read and parse SNBT file
  const content = fs.readFileSync(SNBT_FILE, 'utf-8');
  const entries = parseSnbt(content);
  const values = entries.map(e => e.value);

  console.log(`Found ${entries.length} entries to translate\n`);

  // First translation
  console.log('🔄 First translation (populating cache)...\n');
  const results1 = await translateBatchThroughPipeline(values, 'RU', {
    fileName: 'create111.snbt',
    fileContent: content
  });

  console.log('\n✅ First translation complete!\n');

  // Show translation sources
  const sources1 = { cache: 0, fragment: 0, template: 0, deepl: 0, openrouter: 0 };
  for (const result of results1) {
    sources1[result.source]++;
  }

  console.log('📊 Translation sources (first run):');
  console.log(`   Cache:     ${sources1.cache}`);
  console.log(`   Fragment:  ${sources1.fragment}`);
  console.log(`   Template:  ${sources1.template}`);
  console.log(`   DeepL:     ${sources1.deepl}`);
  console.log(`   OpenRouter: ${sources1.openrouter}`);
  console.log(`   Total:     ${results1.length}\n`);

  console.log('═══════════════════════════════════════════════════════════════\n');

  // Second translation (should use cache)
  console.log('🔄 Second translation (using cache)...\n');
  const results2 = await translateBatchThroughPipeline(values, 'RU', {
    fileName: 'create111.snbt',
    fileContent: content
  });

  console.log('\n✅ Second translation complete!\n');

  // Show translation sources
  const sources2 = { cache: 0, fragment: 0, template: 0, deepl: 0, openrouter: 0 };
  for (const result of results2) {
    sources2[result.source]++;
  }

  console.log('📊 Translation sources (second run):');
  console.log(`   Cache:     ${sources2.cache}`);
  console.log(`   Fragment:  ${sources2.fragment}`);
  console.log(`   Template:  ${sources2.template}`);
  console.log(`   DeepL:     ${sources2.deepl}`);
  console.log(`   OpenRouter: ${sources2.openrouter}`);
  console.log(`   Total:     ${results2.length}\n`);

  console.log('═══════════════════════════════════════════════════════════════\n');

  // Show fragment cache stats
  const fragmentCache = getFragmentCache();
  const stats = fragmentCache.getStats();

  console.log('📊 FRAGMENT CACHE STATISTICS:');
  console.log(`   Total fragments: ${stats.total}`);
  console.log(`   Words: ${stats.words}`);
  console.log(`   Phrases: ${stats.phrases}`);
  console.log(`   High confidence (≥80): ${stats.highConfidence}`);
  console.log(`   Low confidence (<80): ${stats.lowConfidence}`);
  console.log(`   Hit rate: ${stats.hitRate}%\n`);

  console.log('═══════════════════════════════════════════════════════════════');
}

directTranslate().catch(console.error);
