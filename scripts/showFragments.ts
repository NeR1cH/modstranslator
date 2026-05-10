/**
 * Show all fragments currently in cache
 */

import fs from 'fs';
import path from 'path';

const CACHE_FILE = path.join(process.cwd(), '.translation-cache', 'fragments-v1.json');

function showFragments() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('📊 CURRENT FRAGMENT CACHE STATE');
  console.log('═══════════════════════════════════════════════════════════════\n');

  if (!fs.existsSync(CACHE_FILE)) {
    console.log('❌ Fragment cache file not found\n');
    return;
  }

  const data = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));

  if (!data.fragments || Object.keys(data.fragments).length === 0) {
    console.log('✅ Fragment cache is EMPTY (as expected after fixes)\n');
    console.log('This is correct! After the fixes, only known words will be saved.');
    console.log('To populate the cache, translate some files with materials/items.\n');
    return;
  }

  const fragments = Object.entries(data.fragments);
  console.log(`Total fragments: ${fragments.length}\n`);
  console.log('═══════════════════════════════════════════════════════════════\n');

  console.log('ALL SAVED FRAGMENTS:\n');

  // Sort by word
  fragments.sort((a, b) => a[0].localeCompare(b[0]));

  for (const [word, frag] of fragments) {
    const f = frag as any;
    console.log(`"${word}" → "${f.translation}"`);
    console.log(`  Confidence: ${f.confidence}% | Count: ${f.count || 1}`);
    if (f.gender) {
      console.log(`  Gender: ${f.gender}`);
    }
    if (f.isAdjective) {
      console.log(`  Type: adjective`);
    }
    console.log('');
  }

  console.log('═══════════════════════════════════════════════════════════════\n');

  // Check for problematic words
  console.log('⚠️  CHECKING FOR PROBLEMATIC WORDS:\n');

  const problematic = [
    'tree', 'fluid', 'speed', 'use', 'used', 'blocks', 'items', 'water'
  ];

  let foundProblematic = false;
  for (const word of problematic) {
    if (data.fragments[word]) {
      foundProblematic = true;
      console.log(`❌ Found: "${word}" → "${data.fragments[word].translation}"`);
      console.log(`   This should NOT be saved (unknown word, context-dependent)\n`);
    }
  }

  if (!foundProblematic) {
    console.log('✅ No problematic words found!\n');
  }

  console.log('═══════════════════════════════════════════════════════════════');
}

showFragments();
