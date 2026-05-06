/**
 * Fragment Extractor - Extract fragments from existing translation cache
 *
 * This script reads the existing translation cache and extracts fragments
 * without making any new API calls or modifying the main codebase.
 *
 * Usage: node scripts/extract-fragments.js
 */

const fs = require('fs');
const path = require('path');

// Paths
const CACHE_DIR = path.join(process.cwd(), '.translation-cache');
const TRANSLATION_CACHE_FILE = path.join(CACHE_DIR, 'cache-v1.json');
const FRAGMENT_CACHE_FILE = path.join(CACHE_DIR, 'fragments-v1.json');

// Fragment interface
class FragmentExtractor {
  constructor() {
    this.fragments = new Map();

    // Material patterns
    this.MATERIALS = [
      'diamond', 'iron', 'gold', 'golden', 'stone', 'wooden', 'wood',
      'netherite', 'leather', 'chainmail', 'steel', 'bronze', 'silver',
      'copper', 'tin', 'brass', 'aluminum', 'titanium', 'obsidian',
      'emerald', 'ruby', 'sapphire', 'amethyst', 'quartz',
      'zinc', 'lead', 'uranium', 'nickel', 'osmium', 'platinum',
      'iridium', 'tungsten', 'chromium', 'cobalt', 'invar', 'electrum',
      'constantan', 'signalum', 'lumium', 'enderium'
    ];

    // Item types
    this.ITEM_TYPES = [
      'sword', 'pickaxe', 'axe', 'shovel', 'hoe', 'helmet', 'chestplate',
      'leggings', 'boots', 'bow', 'arrow', 'shield', 'dagger', 'spear',
      'pike', 'lance', 'mace', 'hammer', 'scythe', 'katana', 'rapier',
      'stiletto', 'saber', 'cutlass', 'claymore', 'greatsword',
      'ore', 'dust', 'plate', 'gear', 'rod', 'sheet', 'nugget',
      'ingot', 'block', 'chunk', 'clump', 'shard', 'crystal',
      'wire', 'coil', 'casing', 'frame'
    ];

    // Prefixes
    this.PREFIXES = [
      'raw', 'crushed', 'molten', 'refined', 'processed', 'purified',
      'enriched', 'compressed', 'dense', 'dirty'
    ];

    // Gender dictionary
    this.ITEM_GENDERS = {
      'sword': 'masculine', 'axe': 'masculine', 'helmet': 'masculine',
      'bow': 'masculine', 'shield': 'masculine', 'ingot': 'masculine',
      'block': 'masculine', 'rod': 'masculine', 'nugget': 'masculine',
      'chunk': 'masculine', 'crystal': 'masculine', 'sheet': 'masculine',
      'ore': 'feminine', 'dust': 'feminine', 'plate': 'feminine',
      'gear': 'feminine', 'wire': 'feminine', 'pickaxe': 'feminine',
      'arrow': 'feminine', 'shovel': 'feminine', 'hoe': 'feminine',
      'spear': 'neuter', 'lance': 'neuter'
    };
  }

  /**
   * Extract patterns from original and translated text
   */
  extractPatterns(original, translated) {
    const results = [];

    // Pattern 1: "Material + Item" (2 words)
    const materialMatch = original.match(/^(\w+)\s+(\w+)$/i);
    if (materialMatch) {
      const [, material, item] = materialMatch;
      const translatedParts = translated.split(/\s+/);

      if (translatedParts.length >= 1 && translatedParts.length <= 3) {
        const isMaterial = this.MATERIALS.includes(material.toLowerCase());
        const isItem = this.ITEM_TYPES.includes(item.toLowerCase());
        const itemGender = this.ITEM_GENDERS[item.toLowerCase()];

        if (isMaterial || isItem) {
          if (translatedParts.length === 2) {
            results.push({
              fragment: material,
              translation: translatedParts[0],
              context: 'prefix',
              confidence: isMaterial ? 90 : 70,
              gender: itemGender
            });
            results.push({
              fragment: item,
              translation: translatedParts[1],
              context: 'suffix',
              confidence: isItem ? 90 : 70,
              gender: itemGender
            });
          } else if (translatedParts.length === 1) {
            results.push({
              fragment: original,
              translation: translated,
              context: 'standalone',
              confidence: (isMaterial && isItem) ? 85 : 75,
              gender: itemGender
            });
          } else if (translatedParts.length === 3) {
            if (isMaterial) {
              results.push({
                fragment: material,
                translation: translatedParts[0],
                context: 'prefix',
                confidence: 85,
                gender: itemGender
              });
            }
            if (isItem) {
              results.push({
                fragment: item,
                translation: translatedParts[2],
                context: 'suffix',
                confidence: 85,
                gender: itemGender
              });
            }
          }
        }
      }
    }

    // Pattern 2: Single known word
    const singleWord = original.trim();
    if (!/\s/.test(singleWord)) {
      const isMaterial = this.MATERIALS.includes(singleWord.toLowerCase());
      const isItem = this.ITEM_TYPES.includes(singleWord.toLowerCase());

      if (isMaterial || isItem) {
        const itemGender = isItem ? this.ITEM_GENDERS[singleWord.toLowerCase()] : undefined;
        results.push({
          fragment: singleWord,
          translation: translated.trim(),
          context: 'standalone',
          confidence: 85,
          gender: itemGender
        });
      }
    }

    // Pattern 3: "Prefix + Material + Item" (3 words)
    const prefixMatch = original.match(/^(\w+)\s+(\w+)\s+(\w+)$/i);
    if (prefixMatch) {
      const [, prefix, material, item] = prefixMatch;
      const translatedParts = translated.split(/\s+/);

      const isPrefix = this.PREFIXES.includes(prefix.toLowerCase());
      const isMaterial = this.MATERIALS.includes(material.toLowerCase());
      const isItem = this.ITEM_TYPES.includes(item.toLowerCase());
      const itemGender = this.ITEM_GENDERS[item.toLowerCase()];

      if ((isPrefix && isMaterial) || (isMaterial && isItem) || (isPrefix && isItem)) {
        if (isPrefix && translatedParts.length >= 1) {
          results.push({
            fragment: prefix,
            translation: translatedParts[0],
            context: 'prefix',
            confidence: 80,
            gender: itemGender
          });
        }

        if (isMaterial && translatedParts.length >= 2) {
          const materialIndex = isPrefix ? 1 : 0;
          results.push({
            fragment: material,
            translation: translatedParts[materialIndex],
            context: 'prefix',
            confidence: 85,
            gender: itemGender
          });
        }

        if (isItem && translatedParts.length >= 2) {
          results.push({
            fragment: item,
            translation: translatedParts[translatedParts.length - 1],
            context: 'suffix',
            confidence: 85,
            gender: itemGender
          });
        }
      }
    }

    return results;
  }

  /**
   * Learn fragments from a translation pair
   */
  learn(original, translated) {
    const patterns = this.extractPatterns(original, translated);

    patterns.forEach(({ fragment, translation, context, confidence, gender }) => {
      const key = fragment.toLowerCase();
      const existing = this.fragments.get(key);

      if (existing) {
        existing.count++;
        existing.confidence = Math.min(100, existing.confidence + 5);
        if (existing.translation !== translation) {
          existing.confidence = Math.max(50, existing.confidence - 10);
        }
        if (gender && !existing.gender) {
          existing.gender = gender;
        }
      } else {
        this.fragments.set(key, {
          text: fragment,
          translation,
          context,
          count: 1,
          confidence,
          gender
        });
      }
    });
  }

  /**
   * Get statistics
   */
  getStats() {
    let highConfidence = 0;
    let lowConfidence = 0;

    this.fragments.forEach(fragment => {
      if (fragment.confidence >= 80) highConfidence++;
      else lowConfidence++;
    });

    return {
      total: this.fragments.size,
      highConfidence,
      lowConfidence
    };
  }

  /**
   * Save fragments to disk
   */
  save() {
    const data = {
      version: 'v1',
      fragments: Object.fromEntries(this.fragments)
    };

    fs.writeFileSync(FRAGMENT_CACHE_FILE, JSON.stringify(data, null, 2), 'utf-8');
  }
}

// Main execution
async function main() {
  console.log('='.repeat(60));
  console.log('Fragment Extractor - Extract fragments from translation cache');
  console.log('='.repeat(60));
  console.log();

  // Check if translation cache exists
  if (!fs.existsSync(TRANSLATION_CACHE_FILE)) {
    console.error('❌ Translation cache not found:', TRANSLATION_CACHE_FILE);
    process.exit(1);
  }

  // Load translation cache
  console.log('📂 Loading translation cache...');
  const translationCache = JSON.parse(fs.readFileSync(TRANSLATION_CACHE_FILE, 'utf-8'));
  console.log(`   Found ${translationCache.entries.length} translation entries`);
  console.log();

  // Load existing fragment cache (if exists)
  let existingFragments = 0;
  if (fs.existsSync(FRAGMENT_CACHE_FILE)) {
    const fragmentCache = JSON.parse(fs.readFileSync(FRAGMENT_CACHE_FILE, 'utf-8'));
    existingFragments = Object.keys(fragmentCache.fragments || {}).length;
    console.log(`📦 Existing fragment cache: ${existingFragments} fragments`);
  } else {
    console.log('📦 No existing fragment cache found');
  }
  console.log();

  // Create extractor
  const extractor = new FragmentExtractor();

  // Process each translation entry
  console.log('🔍 Extracting fragments from translations...');
  let processed = 0;
  let skipped = 0;

  for (const entry of translationCache.entries) {
    // Skip entries without original text
    if (!entry.original || entry.original.trim() === '') {
      skipped++;
      continue;
    }

    extractor.learn(entry.original, entry.translated);
    processed++;

    if (processed % 100 === 0) {
      process.stdout.write(`\r   Processed: ${processed}, Skipped: ${skipped}`);
    }
  }

  console.log(`\r   Processed: ${processed}, Skipped: ${skipped}`);
  console.log();

  // Get statistics
  const stats = extractor.getStats();
  console.log('📊 Extraction Results:');
  console.log(`   Total fragments: ${stats.total}`);
  console.log(`   High confidence (≥80%): ${stats.highConfidence}`);
  console.log(`   Low confidence (<80%): ${stats.lowConfidence}`);
  console.log();

  // Show comparison
  if (existingFragments > 0) {
    const increase = stats.total - existingFragments;
    const percentIncrease = ((increase / existingFragments) * 100).toFixed(1);
    console.log('📈 Comparison:');
    console.log(`   Before: ${existingFragments} fragments`);
    console.log(`   After: ${stats.total} fragments`);
    console.log(`   Increase: +${increase} fragments (+${percentIncrease}%)`);
    console.log();
  }

  // Save fragments
  console.log('💾 Saving fragments to disk...');
  extractor.save();
  console.log(`   Saved to: ${FRAGMENT_CACHE_FILE}`);
  console.log();

  console.log('✅ Done!');
  console.log();
  console.log('Note: Most entries were skipped because translation cache');
  console.log('does not store original text (to save space). To extract more');
  console.log('fragments, translate new files that contain simple patterns like:');
  console.log('  - "Diamond Sword" → "Алмазный меч"');
  console.log('  - "Iron Ingot" → "Железный слиток"');
  console.log('  - "Raw Copper Ore" → "Сырая медная руда"');
}

// Run
main().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
