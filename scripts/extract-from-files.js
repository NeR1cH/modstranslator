/**
 * Fragment Extractor from Original + Translated Files
 *
 * This script compares original and translated modpack files
 * to extract translation fragments without using API.
 *
 * Usage: node scripts/extract-from-files.js <original.zip> <translated.zip>
 */

const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

// Paths
const CACHE_DIR = path.join(process.cwd(), '.translation-cache');
const FRAGMENT_CACHE_FILE = path.join(CACHE_DIR, 'fragments-v1.json');

// Fragment extractor class
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

    if (!fs.existsSync(CACHE_DIR)) {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
    }

    fs.writeFileSync(FRAGMENT_CACHE_FILE, JSON.stringify(data, null, 2), 'utf-8');
  }
}

/**
 * Parse JSON lang file
 */
function parseJson(content) {
  try {
    return JSON.parse(content);
  } catch (e) {
    return null;
  }
}

/**
 * Parse .lang file
 */
function parseLang(content) {
  const entries = {};
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const match = trimmed.match(/^([^=]+)=(.*)$/);
    if (match) {
      entries[match[1].trim()] = match[2].trim();
    }
  }

  return entries;
}

/**
 * Parse SNBT file
 */
function parseSnbt(content) {
  const entries = {};
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed === '{' || trimmed === '}') continue;

    // Match: key: "value" or key: ["value"]
    const match = trimmed.match(/^([^:]+):\s*(?:\[?"([^"\]]+)"\]?)/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim();

      // Skip color codes and formatting
      if (value && !value.startsWith('&')) {
        entries[key] = value;
      }
    }
  }

  return entries;
}

/**
 * Extract lang entries from ZIP
 */
async function extractLangEntries(zipPath) {
  const entries = new Map();

  console.log(`📂 Reading ${path.basename(zipPath)}...`);
  const data = fs.readFileSync(zipPath);
  const zip = await JSZip.loadAsync(data);

  let fileCount = 0;

  for (const [filePath, file] of Object.entries(zip.files)) {
    if (file.dir) continue;

    // Check if it's a lang file
    const isJson = filePath.match(/lang\/en_us\.json$/i);
    const isLang = filePath.match(/lang\/en_US\.lang$/i);
    const isSnbt = filePath.match(/lang\/en_us\.snbt$/i);
    const isRuSnbt = filePath.match(/lang\/ru_ru\.snbt$/i);

    if (!isJson && !isLang && !isSnbt && !isRuSnbt) continue;

    fileCount++;
    const content = await file.async('string');

    let parsed;
    if (isJson) {
      parsed = parseJson(content);
    } else if (isSnbt || isRuSnbt) {
      parsed = parseSnbt(content);
    } else {
      parsed = parseLang(content);
    }

    if (parsed) {
      for (const [key, value] of Object.entries(parsed)) {
        if (value && typeof value === 'string' && value.trim()) {
          entries.set(key, value.trim());
        }
      }
    }
  }

  console.log(`   Found ${fileCount} lang files, ${entries.size} entries`);
  return entries;
}

/**
 * Main execution
 */
async function main() {
  console.log('='.repeat(60));
  console.log('Fragment Extractor - Extract from Original + Translated Files');
  console.log('='.repeat(60));
  console.log();

  // Get file paths from arguments
  const originalPath = process.argv[2] || 'modsfortranslate/servers.zip';
  const translatedPath = process.argv[3] || 'modsfortranslate/servers_translated.zip';

  if (!fs.existsSync(originalPath)) {
    console.error('❌ Original file not found:', originalPath);
    process.exit(1);
  }

  if (!fs.existsSync(translatedPath)) {
    console.error('❌ Translated file not found:', translatedPath);
    process.exit(1);
  }

  console.log('📁 Original file:', originalPath);
  console.log('📁 Translated file:', translatedPath);
  console.log();

  // Extract entries from both files
  const originalEntries = await extractLangEntries(originalPath);
  const translatedEntries = await extractLangEntries(translatedPath);
  console.log();

  // Create extractor
  const extractor = new FragmentExtractor();

  // Match and learn
  console.log('🔍 Matching and extracting fragments...');
  let matched = 0;
  let learned = 0;

  for (const [key, originalValue] of originalEntries.entries()) {
    // Try to find in translated (same key)
    const translatedValue = translatedEntries.get(key);

    if (translatedValue) {
      matched++;
      extractor.learn(originalValue, translatedValue);
      learned++;

      if (learned % 100 === 0) {
        process.stdout.write(`\r   Matched: ${matched}, Learned: ${learned}`);
      }
    }
  }

  console.log(`\r   Matched: ${matched}, Learned: ${learned}`);
  console.log();

  // Get statistics
  const stats = extractor.getStats();
  console.log('📊 Extraction Results:');
  console.log(`   Total fragments: ${stats.total}`);
  console.log(`   High confidence (≥80%): ${stats.highConfidence}`);
  console.log(`   Low confidence (<80%): ${stats.lowConfidence}`);
  console.log();

  // Save fragments
  console.log('💾 Saving fragments to disk...');
  extractor.save();
  console.log(`   Saved to: ${FRAGMENT_CACHE_FILE}`);
  console.log();

  console.log('✅ Done!');
  console.log();
  console.log('Next steps:');
  console.log('1. Restart dev server to load new fragments');
  console.log('2. Check fragment stats: curl http://localhost:3000/api/fragment-stats');
  console.log('3. Translate a new file to see fragment cache in action');
}

// Run
main().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
