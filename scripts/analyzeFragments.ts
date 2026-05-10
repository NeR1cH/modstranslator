/**
 * Analyze existing FragmentCache confidence levels
 * No translation needed - just analyzes loaded fragments
 */

import { getFragmentCache } from '../lib/fragmentCache.js';

function analyzeLoadedFragments() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('📊 FRAGMENT CACHE CONFIDENCE ANALYSIS');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // Get fragment cache (will auto-load from disk)
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

  if (fragments.size === 0) {
    console.log('⚠️  No fragments loaded. Run some translations first.\n');
    return;
  }

  // Convert to array with metadata
  const fragmentArray = Array.from(fragments.entries()).map(([key, value]) => ({
    word: key,
    translation: value.translation,
    confidence: value.confidence,
    context: value.context,
    gender: value.gender,
    isAdjective: value.isAdjective,
    // Count how many times this exact translation appears
    count: 1
  }));

  // Group by word to detect conflicts
  const wordGroups = new Map<string, typeof fragmentArray>();
  for (const frag of fragmentArray) {
    if (!wordGroups.has(frag.word)) {
      wordGroups.set(frag.word, []);
    }
    wordGroups.get(frag.word)!.push(frag);
  }

  // Sort by confidence (lowest first)
  fragmentArray.sort((a, b) => a.confidence - b.confidence);

  // Show top 10 lowest confidence
  console.log('🔻 TOP 10 WORDS WITH LOWEST CONFIDENCE:');
  console.log('─────────────────────────────────────────────────────────────\n');

  for (let i = 0; i < Math.min(10, fragmentArray.length); i++) {
    const frag = fragmentArray[i];
    const variants = wordGroups.get(frag.word)!;
    const hasConflict = variants.length > 1;

    console.log(`${i + 1}. "${frag.word}" → "${frag.translation}"`);
    console.log(`   Confidence: ${frag.confidence}%`);
    console.log(`   Context: ${frag.context}`);
    if (frag.gender) {
      console.log(`   Gender: ${frag.gender}`);
    }
    if (frag.isAdjective) {
      console.log(`   Type: adjective`);
    }
    if (hasConflict) {
      console.log(`   ⚠️  Has ${variants.length} translation variants (CONFLICT)`);
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
  console.log('⚠️  TRANSLATION CONFLICTS:\n');

  let conflictsFound = 0;
  const conflicts: Array<{ word: string; variants: typeof fragmentArray }> = [];

  for (const [word, variants] of wordGroups.entries()) {
    if (variants.length > 1) {
      conflictsFound++;
      conflicts.push({ word, variants });
    }
  }

  if (conflictsFound === 0) {
    console.log('✅ No conflicts found - all words have single translations\n');
  } else {
    console.log(`Found ${conflictsFound} conflicts:\n`);

    // Sort conflicts by number of variants (most problematic first)
    conflicts.sort((a, b) => b.variants.length - a.variants.length);

    // Show top 10 conflicts
    for (let i = 0; i < Math.min(10, conflicts.length); i++) {
      const conflict = conflicts[i];
      console.log(`${i + 1}. "${conflict.word}" has ${conflict.variants.length} variants:`);

      // Sort variants by confidence
      conflict.variants.sort((a, b) => b.confidence - a.confidence);

      for (const variant of conflict.variants) {
        console.log(`   → "${variant.translation}" (confidence: ${variant.confidence}%)`);
      }
      console.log('');
    }
  }

  console.log('═══════════════════════════════════════════════════════════════\n');

  // Confidence distribution
  console.log('📊 CONFIDENCE DISTRIBUTION:\n');

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
    const percentage = ((range.count / fragmentArray.length) * 100).toFixed(1);
    const bar = '█'.repeat(Math.floor(range.count / 50));
    console.log(`${range.min}-${range.max}%: ${range.count.toString().padStart(4)} (${percentage.padStart(5)}%) ${bar}`);
  }

  console.log('\n═══════════════════════════════════════════════════════════════');
}

analyzeLoadedFragments();
