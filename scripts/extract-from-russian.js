/**
 * Fragment Extractor from Russian Translations
 *
 * This script analyzes Russian translations from cache
 * and extracts common patterns (adjective + noun).
 *
 * Usage: node scripts/extract-from-russian.js
 */

const fs = require('fs');
const path = require('path');

// Paths
const CACHE_DIR = path.join(process.cwd(), '.translation-cache');
const TRANSLATION_CACHE_FILE = path.join(CACHE_DIR, 'cache-v1.json');
const FRAGMENT_CACHE_FILE = path.join(CACHE_DIR, 'fragments-v1.json');

// Russian material adjectives (with endings)
const RUSSIAN_MATERIALS = {
  // Masculine endings: -ый, -ой, -ий
  'алмазный': 'diamond',
  'железный': 'iron',
  'золотой': 'gold',
  'каменный': 'stone',
  'деревянный': 'wooden',
  'незеритовый': 'netherite',
  'кожаный': 'leather',
  'стальной': 'steel',
  'бронзовый': 'bronze',
  'серебряный': 'silver',
  'медный': 'copper',
  'оловянный': 'tin',
  'латунный': 'brass',
  'алюминиевый': 'aluminum',
  'титановый': 'titanium',
  'обсидиановый': 'obsidian',
  'изумрудный': 'emerald',
  'рубиновый': 'ruby',
  'сапфировый': 'sapphire',
  'аметистовый': 'amethyst',
  'кварцевый': 'quartz',
  'цинковый': 'zinc',
  'свинцовый': 'lead',
  'урановый': 'uranium',
  'никелевый': 'nickel',
  'осмиевый': 'osmium',
  'платиновый': 'platinum',
  'иридиевый': 'iridium',
  'вольфрамовый': 'tungsten',
  'хромовый': 'chromium',
  'кобальтовый': 'cobalt',
  'инваровый': 'invar',
  'электрумовый': 'electrum',
  'константановый': 'constantan',
  'сигналумовый': 'signalum',
  'люмиевый': 'lumium',
  'эндериевый': 'enderium',

  // Feminine endings: -ая, -яя
  'алмазная': 'diamond',
  'железная': 'iron',
  'золотая': 'gold',
  'каменная': 'stone',
  'деревянная': 'wooden',
  'незеритовая': 'netherite',
  'кожаная': 'leather',
  'стальная': 'steel',
  'бронзовая': 'bronze',
  'серебряная': 'silver',
  'медная': 'copper',
  'оловянная': 'tin',
  'латунная': 'brass',
  'алюминиевая': 'aluminum',
  'титановая': 'titanium',
  'обсидиановая': 'obsidian',
  'изумрудная': 'emerald',
  'рубиновая': 'ruby',
  'сапфировая': 'sapphire',
  'аметистовая': 'amethyst',
  'кварцевая': 'quartz',
  'цинковая': 'zinc',
  'свинцовая': 'lead',
  'урановая': 'uranium',
  'никелевая': 'nickel',
  'осмиевая': 'osmium',
  'платиновая': 'platinum',
  'иридиевая': 'iridium',
  'вольфрамовая': 'tungsten',
  'хромовая': 'chromium',
  'кобальтовая': 'cobalt',
  'инваровая': 'invar',
  'электрумовая': 'electrum',
  'константановая': 'constantan',
  'сигналумовая': 'signalum',
  'люмиевая': 'lumium',
  'эндериевая': 'enderium',

  // Neuter endings: -ое, -ее
  'алмазное': 'diamond',
  'железное': 'iron',
  'золотое': 'gold',
  'каменное': 'stone',
  'деревянное': 'wooden',
  'незеритовое': 'netherite',
  'кожаное': 'leather',
  'стальное': 'steel',
  'бронзовое': 'bronze',
  'серебряное': 'silver',
  'медное': 'copper',
  'оловянное': 'tin',
  'латунное': 'brass',
  'алюминиевое': 'aluminum',
  'титановое': 'titanium',
  'обсидиановое': 'obsidian',
  'изумрудное': 'emerald',
  'рубиновое': 'ruby',
  'сапфировое': 'sapphire',
  'аметистовое': 'amethyst',
  'кварцевое': 'quartz',
  'цинковое': 'zinc',
  'свинцовое': 'lead',
  'урановое': 'uranium',
  'никелевое': 'nickel',
  'осмиевое': 'osmium',
  'платиновое': 'platinum',
  'иридиевое': 'iridium',
  'вольфрамовое': 'tungsten',
  'хромовое': 'chromium',
  'кобальтовое': 'cobalt',
  'инваровое': 'invar',
  'электрумовое': 'electrum',
  'константановое': 'constantan',
  'сигналумовое': 'signalum',
  'люмиевое': 'lumium',
  'эндериевое': 'enderium'
};

// Russian item nouns
const RUSSIAN_ITEMS = {
  // Masculine
  'меч': 'sword',
  'топор': 'axe',
  'шлем': 'helmet',
  'лук': 'bow',
  'щит': 'shield',
  'слиток': 'ingot',
  'блок': 'block',
  'стержень': 'rod',
  'самородок': 'nugget',
  'кусок': 'chunk',
  'кристалл': 'crystal',
  'лист': 'sheet',

  // Feminine
  'руда': 'ore',
  'пыль': 'dust',
  'пластина': 'plate',
  'шестерня': 'gear',
  'проволока': 'wire',
  'кирка': 'pickaxe',
  'стрела': 'arrow',
  'лопата': 'shovel',
  'мотыга': 'hoe',
  'кольчуга': 'chainmail',
  'оболочка': 'casing',
  'рама': 'frame',

  // Neuter
  'копье': 'spear',
  'ведро': 'bucket'
};

// Fragment extractor
class RussianFragmentExtractor {
  constructor() {
    this.fragments = new Map();
    this.stats = {
      total: 0,
      matched: 0,
      twoWord: 0,
      threeWord: 0
    };
  }

  /**
   * Extract patterns from Russian translation
   */
  extractPatterns(translated) {
    const results = [];
    const words = translated.toLowerCase().split(/\s+/);

    // Pattern 1: "Adjective + Noun" (2 words)
    if (words.length === 2) {
      const [adj, noun] = words;

      const material = RUSSIAN_MATERIALS[adj];
      const item = RUSSIAN_ITEMS[noun];

      if (material && item) {
        results.push({
          fragment: material,
          translation: adj,
          context: 'prefix',
          confidence: 90
        });
        results.push({
          fragment: item,
          translation: noun,
          context: 'suffix',
          confidence: 90
        });
        this.stats.twoWord++;
      }
    }

    // Pattern 2: "Prefix + Adjective + Noun" (3 words)
    if (words.length === 3) {
      const [prefix, adj, noun] = words;

      const material = RUSSIAN_MATERIALS[adj];
      const item = RUSSIAN_ITEMS[noun];

      if (material && item) {
        results.push({
          fragment: 'prefix',
          translation: prefix,
          context: 'prefix',
          confidence: 75
        });
        results.push({
          fragment: material,
          translation: adj,
          context: 'prefix',
          confidence: 85
        });
        results.push({
          fragment: item,
          translation: noun,
          context: 'suffix',
          confidence: 85
        });
        this.stats.threeWord++;
      }
    }

    return results;
  }

  /**
   * Learn fragments from translation
   */
  learn(translated) {
    this.stats.total++;
    const patterns = this.extractPatterns(translated);

    if (patterns.length > 0) {
      this.stats.matched++;
    }

    patterns.forEach(({ fragment, translation, context, confidence }) => {
      const key = fragment.toLowerCase();
      const existing = this.fragments.get(key);

      if (existing) {
        existing.count++;
        existing.confidence = Math.min(100, existing.confidence + 2);

        // Track all translations
        if (!existing.translations) {
          existing.translations = new Set([existing.translation]);
        }
        existing.translations.add(translation);
      } else {
        this.fragments.set(key, {
          text: fragment,
          translation,
          context,
          count: 1,
          confidence
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
      lowConfidence,
      processed: this.stats.total,
      matched: this.stats.matched,
      twoWord: this.stats.twoWord,
      threeWord: this.stats.threeWord
    };
  }

  /**
   * Save fragments to disk
   */
  save() {
    // Convert Sets to arrays for JSON
    const fragmentsObj = {};
    for (const [key, fragment] of this.fragments.entries()) {
      const { translations, ...rest } = fragment;
      fragmentsObj[key] = rest;
    }

    const data = {
      version: 'v1',
      fragments: fragmentsObj
    };

    if (!fs.existsSync(CACHE_DIR)) {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
    }

    fs.writeFileSync(FRAGMENT_CACHE_FILE, JSON.stringify(data, null, 2), 'utf-8');
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('='.repeat(60));
  console.log('Fragment Extractor - Extract from Russian Translations');
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

  // Create extractor
  const extractor = new RussianFragmentExtractor();

  // Process each translation entry
  console.log('🔍 Analyzing Russian translations...');
  let processed = 0;

  for (const entry of translationCache.entries) {
    if (!entry.translated || entry.translated.trim() === '') {
      continue;
    }

    extractor.learn(entry.translated);
    processed++;

    if (processed % 1000 === 0) {
      process.stdout.write(`\r   Processed: ${processed}`);
    }
  }

  console.log(`\r   Processed: ${processed}`);
  console.log();

  // Get statistics
  const stats = extractor.getStats();
  console.log('📊 Extraction Results:');
  console.log(`   Total translations analyzed: ${stats.processed}`);
  console.log(`   Matched patterns: ${stats.matched} (${Math.round(stats.matched / stats.processed * 100)}%)`);
  console.log(`   2-word patterns: ${stats.twoWord}`);
  console.log(`   3-word patterns: ${stats.threeWord}`);
  console.log();
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
  console.log('2. Check fragment stats: curl http://localhost:3001/api/fragment-stats');
  console.log('3. Translate a new file to see fragment cache in action');
}

// Run
main().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
