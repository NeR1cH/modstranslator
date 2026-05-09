/**
 * Fragment Cache - Smart caching system for reusable translation fragments
 * Automatically extracts and reuses common words and phrases from ANY content:
 * - Item names (Diamond Sword)
 * - UI strings (Settings, Options, Enable)
 * - Descriptions (powerful, enchanted, rare)
 * - Quest text (complete, reward, objective)
 * Works transparently in the background, no user configuration needed
 *
 * Provider-agnostic: works with both DeepL and OpenRouter
 */

import fs from 'fs';
import path from 'path';

interface Fragment {
  text: string;
  translation: string;
  context: 'word' | 'phrase';
  count: number; // How many times seen
  confidence: number; // 0-100
  lastSeen: number; // Timestamp
  gender?: 'masculine' | 'feminine' | 'neuter'; // For nouns
  isAdjective?: boolean; // For adjectives that need agreement
}

interface FragmentCacheData {
  version: string;
  fragments: Record<string, Fragment>;
}

class FragmentCache {
  private fragments: Map<string, Fragment> = new Map();
  private cacheDir: string;
  private cacheFile: string;
  private isDirty = false;
  private saveTimer: NodeJS.Timeout | null = null;

  // Stop words - articles, prepositions, conjunctions that should not be saved as fragments
  private readonly STOP_WORDS = new Set([
    'the', 'a', 'an', 'in', 'of', 'to', 'for', 'with', 'and', 'or',
    'at', 'by', 'from', 'on', 'is', 'are', 'was', 'were', 'be',
    'this', 'that', 'these', 'those', 'it', 'its', 'as', 'but',
    'if', 'so', 'no', 'not', 'can', 'will', 'has', 'have', 'had',
    'do', 'does', 'did', 'am', 'been', 'being', 'may', 'might',
    'must', 'shall', 'should', 'would', 'could'
  ]);

  // Gender dictionary for Russian nouns
  private readonly NOUN_GENDERS: Record<string, 'masculine' | 'feminine' | 'neuter'> = {
    // Masculine (мужской род)
    'sword': 'masculine', 'axe': 'masculine', 'helmet': 'masculine',
    'bow': 'masculine', 'shield': 'masculine', 'dagger': 'masculine',
    'hammer': 'masculine', 'stiletto': 'masculine', 'cutlass': 'masculine',
    'claymore': 'masculine', 'greatsword': 'masculine',
    'ingot': 'masculine', 'block': 'masculine', 'rod': 'masculine',
    'nugget': 'masculine', 'chunk': 'masculine', 'clump': 'masculine',
    'shard': 'masculine', 'crystal': 'masculine', 'casing': 'masculine',
    'frame': 'masculine', 'boots': 'masculine', 'sheet': 'masculine',

    // Feminine (женский род)
    'scythe': 'feminine', 'katana': 'feminine', 'rapier': 'feminine',
    'saber': 'feminine', 'chestplate': 'feminine', 'leggings': 'feminine',
    'arrow': 'feminine', 'ore': 'feminine', 'dust': 'feminine',
    'plate': 'feminine', 'gear': 'feminine', 'wire': 'feminine',
    'pickaxe': 'feminine', 'shovel': 'feminine', 'hoe': 'feminine',
    'pike': 'feminine', 'mace': 'feminine', 'coil': 'feminine',

    // Neuter (средний род)
    'spear': 'neuter', 'lance': 'neuter'
  };

  // Common Minecraft materials (adjectives)
  private readonly MATERIALS = new Set([
    'diamond', 'iron', 'gold', 'golden', 'stone', 'wooden', 'wood',
    'netherite', 'leather', 'chainmail', 'steel', 'bronze', 'silver',
    'copper', 'tin', 'brass', 'aluminum', 'titanium', 'obsidian',
    'emerald', 'ruby', 'sapphire', 'amethyst', 'quartz',
    'zinc', 'lead', 'uranium', 'nickel', 'osmium', 'platinum',
    'iridium', 'tungsten', 'chromium', 'cobalt', 'invar', 'electrum',
    'constantan', 'signalum', 'lumium', 'enderium'
  ]);

  // Common prefixes (adjectives)
  private readonly PREFIXES = new Set([
    'raw', 'crushed', 'molten', 'refined', 'processed', 'purified',
    'enriched', 'compressed', 'dense', 'dirty'
  ]);

  // Minimum word length to consider for fragments
  private readonly MIN_WORD_LENGTH = 3;

  // Minimum phrase length (in words) to consider
  private readonly MIN_PHRASE_WORDS = 2;
  private readonly MAX_PHRASE_WORDS = 4;

  constructor() {
    this.cacheDir = path.join(process.cwd(), '.translation-cache');
    this.cacheFile = path.join(this.cacheDir, 'fragments-v1.json');
    this.loadFromDisk();
  }

  private loadFromDisk(): void {
    try {
      if (!fs.existsSync(this.cacheFile)) return;
      const data: FragmentCacheData = JSON.parse(fs.readFileSync(this.cacheFile, 'utf-8'));
      if (data.version === 'v1' && data.fragments) {
        Object.entries(data.fragments).forEach(([key, fragment]) => {
          this.fragments.set(key, fragment);
        });
        console.log(`[fragment-cache] Loaded ${this.fragments.size} fragments from disk`);
      }
    } catch (error) {
      console.error('[fragment-cache] Failed to load from disk:', error);
    }
  }

  private saveToDisk(): void {
    try {
      if (!fs.existsSync(this.cacheDir)) {
        fs.mkdirSync(this.cacheDir, { recursive: true });
      }
      const data: FragmentCacheData = {
        version: 'v1',
        fragments: Object.fromEntries(this.fragments)
      };
      fs.writeFileSync(this.cacheFile, JSON.stringify(data, null, 2), 'utf-8');
      this.isDirty = false;
      console.log(`[fragment-cache] Saved ${this.fragments.size} fragments to disk`);
    } catch (error) {
      console.error('[fragment-cache] Failed to save to disk:', error);
    }
  }

  private scheduleSave(): void {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.saveToDisk(), 5000);
  }

  /**
   * Clear all fragments (for testing)
   */
  clear(): void {
    this.fragments.clear();
    console.log('[fragment-cache] Cleared all fragments');
  }

  /**
   * Normalize text for comparison (lowercase, trim)
   */
  private normalizeText(text: string): string {
    return text.toLowerCase().trim();
  }

  /**
   * Detect if a Russian word is an adjective and extract its gender
   */
  private detectAdjectiveGender(word: string): 'masculine' | 'feminine' | 'neuter' | null {
    if (word.endsWith('ый') || word.endsWith('ой') || word.endsWith('ий')) {
      return 'masculine';
    } else if (word.endsWith('ая') || word.endsWith('яя')) {
      return 'feminine';
    } else if (word.endsWith('ое') || word.endsWith('ее')) {
      return 'neuter';
    }
    return null;
  }

  /**
   * Normalize adjective to masculine form (base form)
   */
  private normalizeToMasculine(adjective: string): string {
    let stem = adjective;

    if (stem.endsWith('ый') || stem.endsWith('ой') || stem.endsWith('ий')) {
      return stem; // Already masculine
    } else if (stem.endsWith('ая') || stem.endsWith('яя')) {
      stem = stem.slice(0, -2);
    } else if (stem.endsWith('ое') || stem.endsWith('ее')) {
      stem = stem.slice(0, -2);
    }

    // Apply masculine ending
    return stem + 'ый';
  }

  /**
   * Apply gender agreement to adjective
   */
  private applyGenderAgreement(adjective: string, gender: 'masculine' | 'feminine' | 'neuter'): string {
    let stem = adjective;

    // Remove existing endings
    if (stem.endsWith('ый') || stem.endsWith('ой') || stem.endsWith('ий') ||
        stem.endsWith('ая') || stem.endsWith('яя') ||
        stem.endsWith('ое') || stem.endsWith('ее')) {
      stem = stem.slice(0, -2);
    }

    // Apply correct ending
    if (gender === 'masculine') {
      return stem + 'ый';
    } else if (gender === 'feminine') {
      return stem + 'ая';
    } else {
      return stem + 'ое';
    }
  }

  /**
   * Check if a word should be saved as a fragment
   */
  private isValidWord(word: string): boolean {
    const normalized = this.normalizeText(word);

    // Skip stop words
    if (this.STOP_WORDS.has(normalized)) return false;

    // Skip too short words
    if (normalized.length < this.MIN_WORD_LENGTH) return false;

    // Skip numbers
    if (/^\d+$/.test(normalized)) return false;

    // Skip single characters
    if (normalized.length === 1) return false;

    return true;
  }

  /**
   * Check if a phrase should be saved as a fragment
   */
  private isValidPhrase(phrase: string): boolean {
    const words = phrase.split(/\s+/);

    // Check word count
    if (words.length < this.MIN_PHRASE_WORDS || words.length > this.MAX_PHRASE_WORDS) {
      return false;
    }

    // At least one word must be valid (not a stop word)
    return words.some(word => this.isValidWord(word));
  }

  /**
   * Learn fragments from a successful translation
   * Extracts individual words and common phrases
   */
  learn(original: string, translated: string): void {
    const now = Date.now();
    const patterns = this.extractPatterns(original, translated);

    if (patterns.length === 0) return;

    console.log(`[fragment-cache] Learning ${patterns.length} fragments from: "${original}"`);

    patterns.forEach(({ fragment, translation, context, confidence, gender, isAdjective }) => {
      const key = this.normalizeText(fragment);
      const existing = this.fragments.get(key);

      if (existing) {
        // Update existing fragment
        existing.count++;
        existing.lastSeen = now;

        if (existing.translation === translation) {
          // Same translation - increase confidence
          existing.confidence = Math.min(100, existing.confidence + 3);
        } else {
          // Different translation - conflict detected
          existing.confidence = Math.max(30, existing.confidence - 10);
          console.log(`[fragment-cache] Conflict: "${fragment}" → "${existing.translation}" vs "${translation}"`);
        }

        // Update gender and isAdjective if not set
        if (gender && !existing.gender) {
          existing.gender = gender;
        }
        if (isAdjective && !existing.isAdjective) {
          existing.isAdjective = isAdjective;
        }
      } else {
        // New fragment
        this.fragments.set(key, {
          text: fragment,
          translation,
          context,
          count: 1,
          confidence,
          lastSeen: now,
          gender,
          isAdjective
        });
        console.log(`[fragment-cache] New fragment: "${fragment}" → "${translation}" (${context}, confidence: ${confidence})`);
      }
    });

    if (patterns.length > 0) {
      this.isDirty = true;
      this.scheduleSave();
    }
  }

  /**
   * Try to translate using fragments
   * Returns null if confidence is too low or no fragments found
   */
  tryTranslate(text: string): string | null {
    const normalized = this.normalizeText(text);

    // Try exact match first (for phrases)
    const exactMatch = this.fragments.get(normalized);
    if (exactMatch && exactMatch.confidence >= 70) {
      console.log(`[fragment-cache] Exact match: "${text}" → "${exactMatch.translation}" (confidence: ${exactMatch.confidence}%)`);
      return exactMatch.translation;
    }

    // Try word-by-word translation with gender agreement
    const words = text.split(/\s+/);
    if (words.length > 1 && words.length <= this.MAX_PHRASE_WORDS) {
      const translatedWords: string[] = [];
      let totalConfidence = 0;
      let foundCount = 0;
      let nounGender: 'masculine' | 'feminine' | 'neuter' | null = null;

      // First pass: find noun and its gender
      for (let i = words.length - 1; i >= 0; i--) {
        const word = words[i];
        const wordNormalized = this.normalizeText(word);
        const fragment = this.fragments.get(wordNormalized);

        if (fragment && fragment.gender) {
          nounGender = fragment.gender;
          break;
        }

        // Check if word is a known noun
        const knownGender = this.NOUN_GENDERS[wordNormalized];
        if (knownGender) {
          nounGender = knownGender;
          break;
        }
      }

      // Second pass: translate with gender agreement
      for (const word of words) {
        const wordNormalized = this.normalizeText(word);
        const fragment = this.fragments.get(wordNormalized);

        if (fragment && fragment.confidence >= 60) {
          let translation = fragment.translation;

          // Apply gender agreement if this is an adjective and we know the noun gender
          if (fragment.isAdjective && nounGender) {
            translation = this.applyGenderAgreement(translation, nounGender);
          }

          translatedWords.push(translation);
          totalConfidence += fragment.confidence;
          foundCount++;
        } else {
          // Word not found - cannot translate
          return null;
        }
      }

      // Need at least 70% average confidence
      const avgConfidence = totalConfidence / foundCount;
      if (avgConfidence >= 70) {
        const result = translatedWords.join(' ');
        console.log(`[fragment-cache] Word-by-word: "${text}" → "${result}" (confidence: ${avgConfidence.toFixed(0)}%)`);
        return result;
      }
    }

    return null;
  }

  /**
   * Extract patterns from original and translated text
   * Extracts both individual words and phrases
   */
  private extractPatterns(original: string, translated: string): Array<{
    fragment: string;
    translation: string;
    context: 'word' | 'phrase';
    confidence: number;
    gender?: 'masculine' | 'feminine' | 'neuter';
    isAdjective?: boolean;
  }> {
    const results: Array<{
      fragment: string;
      translation: string;
      context: 'word' | 'phrase';
      confidence: number;
      gender?: 'masculine' | 'feminine' | 'neuter';
      isAdjective?: boolean;
    }> = [];

    const originalWords = original.split(/\s+/);
    const translatedWords = translated.split(/\s+/);

    // Pattern 1: Exact phrase (if valid)
    if (this.isValidPhrase(original)) {
      results.push({
        fragment: original.trim(),
        translation: translated.trim(),
        context: 'phrase',
        confidence: 75
      });
    }

    // Pattern 2: Individual words (if word counts match or are close)
    if (originalWords.length === translatedWords.length) {
      // 1:1 mapping - extract all valid words
      for (let i = 0; i < originalWords.length; i++) {
        const word = originalWords[i].trim();
        const trans = translatedWords[i].trim();

        if (this.isValidWord(word)) {
          const wordLower = this.normalizeText(word);

          // Detect if this is a material/prefix (adjective)
          const isAdjective = this.MATERIALS.has(wordLower) || this.PREFIXES.has(wordLower);

          // Detect gender from Russian translation
          const adjectiveGender = this.detectAdjectiveGender(trans);

          // Get noun gender if this is a known noun
          const nounGender = this.NOUN_GENDERS[wordLower];

          // Normalize adjectives to masculine form
          const normalizedTrans = isAdjective && adjectiveGender ? this.normalizeToMasculine(trans) : trans;

          results.push({
            fragment: word,
            translation: normalizedTrans,
            context: 'word',
            confidence: 80,
            gender: nounGender,
            isAdjective
          });
        }
      }
    } else if (originalWords.length === 1 && this.isValidWord(originalWords[0])) {
      // Single word - save regardless of translation word count
      const wordLower = this.normalizeText(originalWords[0]);
      const isAdjective = this.MATERIALS.has(wordLower) || this.PREFIXES.has(wordLower);
      const nounGender = this.NOUN_GENDERS[wordLower];

      results.push({
        fragment: originalWords[0].trim(),
        translation: translated.trim(),
        context: 'word',
        confidence: 85,
        gender: nounGender,
        isAdjective
      });
    } else if (translatedWords.length === 1 && originalWords.length > 1) {
      // Multiple English words → single Russian word
      // Save as phrase
      if (this.isValidPhrase(original)) {
        results.push({
          fragment: original.trim(),
          translation: translated.trim(),
          context: 'phrase',
          confidence: 70
        });
      }
    }

    // Pattern 3: Sub-phrases (2-3 word combinations)
    if (originalWords.length >= 3 && translatedWords.length >= 3) {
      for (let len = 2; len <= Math.min(3, originalWords.length); len++) {
        for (let i = 0; i <= originalWords.length - len; i++) {
          const subPhrase = originalWords.slice(i, i + len).join(' ');
          if (this.isValidPhrase(subPhrase)) {
            // Try to find corresponding translation
            const subTrans = translatedWords.slice(i, i + len).join(' ');
            results.push({
              fragment: subPhrase,
              translation: subTrans,
              context: 'phrase',
              confidence: 65
            });
          }
        }
      }
    }

    return results;
  }

  /**
   * Get statistics
   */
  getStats(): { total: number; words: number; phrases: number; highConfidence: number; lowConfidence: number } {
    let words = 0;
    let phrases = 0;
    let highConfidence = 0;
    let lowConfidence = 0;

    this.fragments.forEach(fragment => {
      if (fragment.context === 'word') words++;
      else if (fragment.context === 'phrase') phrases++;

      if (fragment.confidence >= 80) highConfidence++;
      else lowConfidence++;
    });

    return {
      total: this.fragments.size,
      words,
      phrases,
      highConfidence,
      lowConfidence
    };
  }

  /**
   * Force save to disk
   */
  flush(): void {
    if (this.isDirty) {
      this.saveToDisk();
    }
  }
}

// Singleton instance
let instance: FragmentCache | null = null;

export function getFragmentCache(): FragmentCache {
  if (!instance) {
    instance = new FragmentCache();
  }
  return instance;
}

export function flushFragmentCache(): void {
  if (instance) {
    instance.flush();
  }
}
