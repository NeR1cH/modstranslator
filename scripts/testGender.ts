/**
 * Test script for gender agreement system
 * Tests FragmentCache word-by-word translation with gender agreement
 */

import { getFragmentCache } from '../lib/fragmentCache.js';
import { getTranslationCache } from '../lib/translationCache.js';
import fs from 'fs';
import path from 'path';

const CACHE_FILE = path.join(process.cwd(), '.translation-cache', 'cache-v1.json');

interface TestCase {
  original: string;
  expected: string;
}

const testCases: TestCase[] = [
  {
    original: "Obtain crushed raw iron for industrial purposes.",
    expected: ""
  },
  {
    original: "Crush raw gold to prepare it for refining.",
    expected: ""
  },
  {
    original: "Brass casing used in machinery for durability.",
    expected: ""
  },
  {
    original: "Copper casing for protecting delicate mechanical parts.",
    expected: ""
  },
  {
    original: "A larger cogwheel used to transfer rotational force.",
    expected: ""
  }
];

async function loadExpectedTranslations() {
  if (!fs.existsSync(CACHE_FILE)) {
    console.log('⚠️  cache-v1.json not found, skipping expected translations');
    return;
  }

  try {
    const data = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));

    if (!data.entries || data.entries.length === 0) {
      console.log('⚠️  cache-v1.json is empty, skipping expected translations');
      return;
    }

    for (const testCase of testCases) {
      for (const entry of data.entries) {
        if (entry.original === testCase.original) {
          testCase.expected = entry.translated;
          break;
        }
      }
    }
  } catch (error) {
    console.log('⚠️  Error reading cache-v1.json:', error);
  }
}

function testFragmentTranslation() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🧪 TESTING GENDER AGREEMENT SYSTEM');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const fragmentCache = getFragmentCache();
  const stats = fragmentCache.getStats();

  console.log('📊 Fragment Cache Statistics:');
  console.log(`   Total fragments: ${stats.total}`);
  console.log(`   Words: ${stats.words}`);
  console.log(`   Phrases: ${stats.phrases}`);
  console.log(`   Hit rate: ${stats.hitRate}\n`);

  console.log('═══════════════════════════════════════════════════════════════\n');

  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];

    console.log(`TEST ${i + 1}/${testCases.length}`);
    console.log('─────────────────────────────────────────────────────────────');
    console.log(`📝 Original: "${testCase.original}"`);

    if (testCase.expected) {
      console.log(`✅ Expected: "${testCase.expected}"`);
    }

    console.log('');

    // Try to translate using fragments
    const result = fragmentCache.tryTranslate(testCase.original);

    if (result) {
      console.log(`🎯 Fragment result: "${result}"`);

      if (testCase.expected) {
        const match = result === testCase.expected;
        console.log(`${match ? '✅' : '❌'} Match: ${match ? 'YES' : 'NO'}`);

        if (!match) {
          console.log(`   Difference:`);
          console.log(`   Expected: "${testCase.expected}"`);
          console.log(`   Got:      "${result}"`);
        }
      }
    } else {
      console.log('❌ Fragment translation failed (not enough fragments or low confidence)');

      // Analyze which words are missing
      const words = testCase.original.split(/\s+/);
      console.log('\n   Word analysis:');

      for (const word of words) {
        const normalized = word.toLowerCase().replace(/[^a-z]/g, '');
        if (normalized.length < 2) continue;

        // Try to find this word in cache
        const fragment = (fragmentCache as any).fragments.get(normalized);

        if (fragment) {
          console.log(`   ✅ "${word}" → "${fragment.translation}" (confidence: ${fragment.confidence}%)`);
          if (fragment.gender) {
            console.log(`      Gender: ${fragment.gender}`);
          }
          if (fragment.isAdjective) {
            console.log(`      Type: adjective`);
          }
        } else {
          console.log(`   ❌ "${word}" → NOT FOUND`);
        }
      }
    }

    console.log('\n═══════════════════════════════════════════════════════════════\n');
  }

  // Summary
  const successful = testCases.filter((tc, i) => {
    const result = fragmentCache.tryTranslate(tc.original);
    return result !== null;
  }).length;

  console.log('📊 SUMMARY');
  console.log('─────────────────────────────────────────────────────────────');
  console.log(`Total tests: ${testCases.length}`);
  console.log(`Successful translations: ${successful}`);
  console.log(`Failed translations: ${testCases.length - successful}`);
  console.log(`Success rate: ${((successful / testCases.length) * 100).toFixed(1)}%`);
  console.log('═══════════════════════════════════════════════════════════════');
}

async function main() {
  await loadExpectedTranslations();
  testFragmentTranslation();
}

main().catch(console.error);
