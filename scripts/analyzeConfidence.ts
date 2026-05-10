/**
 * Analyze FragmentCache confidence levels
 * Translates sample sentences and shows lowest confidence fragments
 */

import { translateBatchThroughPipeline } from '../lib/translationPipeline.js';
import { getFragmentCache } from '../lib/fragmentCache.js';

const sampleTexts = [
  "Diamond Sword",
  "Iron Pickaxe",
  "Gold Ingot",
  "Copper Ore",
  "Brass Casing",
  "Steel Plate",
  "Wooden Gear",
  "Stone Axe",
  "Leather Boots",
  "Glass Bottle",
  "Obtain crushed raw iron for industrial purposes",
  "Crush raw gold to prepare it for refining",
  "Brass casing used in machinery for durability",
  "Copper casing for protecting delicate mechanical parts",
  "A larger cogwheel used to transfer rotational force",
  "Craft a mechanical press for processing materials",
  "Use water wheels to generate rotational power",
  "Connect shafts to transfer mechanical energy",
  "Install gearboxes to change rotation speed",
  "Place belts between pulleys for power transmission"
];

async function analyzeConfidence() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('📊 FRAGMENT CACHE CONFIDENCE ANALYSIS');
  console.log('═══════════════════════════════════════════════════════════════\n');

  console.log(`🔄 Translating ${sampleTexts.length} sample texts to populate cache...\n`);

  // Translate all texts to populate fragment cache
  const results = await translateBatchThroughPipeline(sampleTexts, 'RU');

  console.log(`✅ Translation complete!\n`);

  // Get fragment cache
  const fragmentCache = getFragmentCache();
  const stats = fragmentCache.getStats();

  console.log('📊 Fragment Cache Statistics:');
  console.log(`   Total fragments: ${stats.total}`);
  console.log(`   Words: ${stats.words}`);
  console.log(`   Phrases: ${stats.phrases}`);
  console.log(`   High confidence (≥80): ${stats.highConfidence}`);
  console.log(`   Low confidence (<80): ${stats.lowConfidence}`);
  console.log(`   Hit rate: ${stats.hitRate}\n`);

  console.log('═══════════════════════════════════════════════════════════════\n');

  // Access internal fragments map
  const fragments = (fragmentCache as any).fragments as Map<string, any>;

  // Convert to array and sort by confidence
  const fragmentArray = Array.from(fragments.entries()).map(([key, value]) => ({
    word: key,
    translation: value.translation,
    confidence: value.confidence,
    context: value.context,
    gender: value.gender,
    isAdjective: value.isAdjective,
    count: value.count || 1
  }));

  // Sort by confidence (lowest first)
  fragmentArray.sort((a, b) => a.confidence - b.confidence);

  // Show top 10 lowest confidence
  console.log('🔻 TOP 10 WORDS WITH LOWEST CONFIDENCE:');
  console.log('─────────────────────────────────────────────────────────────\n');

  for (let i = 0; i < Math.min(10, fragmentArray.length); i++) {
    const frag = fragmentArray[i];
    console.log(`${i + 1}. "${frag.word}" → "${frag.translation}"`);
    console.log(`   Confidence: ${frag.confidence}%`);
    console.log(`   Count: ${frag.count}`);
    console.log(`   Context: ${frag.context}`);
    if (frag.gender) {
      console.log(`   Gender: ${frag.gender}`);
    }
    if (frag.isAdjective) {
      console.log(`   Type: adjective`);
    }
    console.log('');
  }

  console.log('═══════════════════════════════════════════════════════════════\n');

  // Show top 10 highest confidence
  console.log('🔺 TOP 10 WORDS WITH HIGHEST CONFIDENCE:');
  console.log('─────────────────────────────────────────────────────────────\n');

  fragmentArray.sort((a, b) => b.confidence - a.confidence);

  for (let i = 0; i < Math.min(10, fragmentArray.length); i++) {
    const frag = fragmentArray[i];
    console.log(`${i + 1}. "${frag.word}" → "${frag.translation}"`);
    console.log(`   Confidence: ${frag.confidence}%`);
    console.log(`   Count: ${frag.count}`);
    console.log(`   Context: ${frag.context}`);
    if (frag.gender) {
      console.log(`   Gender: ${frag.gender}`);
    }
    if (frag.isAdjective) {
      console.log(`   Type: adjective`);
    }
    console.log('');
  }

  console.log('═══════════════════════════════════════════════════════════════\n');

  // Check for conflicts (same word, different translations)
  console.log('⚠️  CHECKING FOR TRANSLATION CONFLICTS:\n');

  const wordGroups = new Map<string, Array<{ translation: string; confidence: number }>>();

  for (const [word, value] of fragments.entries()) {
    if (!wordGroups.has(word)) {
      wordGroups.set(word, []);
    }
    wordGroups.get(word)!.push({
      translation: value.translation,
      confidence: value.confidence
    });
  }

  let conflictsFound = 0;
  for (const [word, translations] of wordGroups.entries()) {
    if (translations.length > 1) {
      conflictsFound++;
      console.log(`❌ Conflict: "${word}"`);
      for (const t of translations) {
        console.log(`   → "${t.translation}" (confidence: ${t.confidence}%)`);
      }
      console.log('');
    }
  }

  if (conflictsFound === 0) {
    console.log('✅ No conflicts found - all words have single translations\n');
  } else {
    console.log(`Found ${conflictsFound} conflicts\n`);
  }

  console.log('═══════════════════════════════════════════════════════════════');
}

analyzeConfidence().catch(console.error);
