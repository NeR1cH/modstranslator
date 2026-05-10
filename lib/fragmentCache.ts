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
  private hits = 0;
  private misses = 0;

  // Stop words - articles, prepositions, conjunctions that should not be saved as fragments
  private readonly STOP_WORDS = new Set([
    'the', 'a', 'an', 'in', 'of', 'to', 'for', 'with', 'and', 'or',
    'at', 'by', 'from', 'on', 'is', 'are', 'was', 'were', 'be',
    'this', 'that', 'these', 'those', 'it', 'its', 'as', 'but',
    'if', 'so', 'no', 'not', 'can', 'will', 'has', 'have', 'had',
    'do', 'does', 'did', 'am', 'been', 'being', 'may', 'might',
    'must', 'shall', 'should', 'would', 'could'
  ]);

  // Dynamic noun gender dictionary - learned from translations
  private nounGenders: Map<string, 'masculine' | 'feminine' | 'neuter'> = new Map();
  private nounGendersFile: string;

  // Minimum word length to consider for fragments
  private readonly MIN_WORD_LENGTH = 3;

  // Minimum phrase length (in words) to consider
  private readonly MIN_PHRASE_WORDS = 2;
  private readonly MAX_PHRASE_WORDS = 8;

  constructor(cacheDir?: string) {
    // Use test cache directory when running tests
    const defaultDir = process.env.NODE_ENV === 'test'
      ? path.join(process.cwd(), '.translation-cache-test')
      : path.join(process.cwd(), '.translation-cache');

    this.cacheDir = cacheDir || defaultDir;
    this.cacheFile = path.join(this.cacheDir, 'fragments-v1.json');
    this.nounGendersFile = path.join(this.cacheDir, 'noun-genders.json');
    this.loadFromDisk();
    this.loadNounGenders();
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

  private loadNounGenders(): void {
    try {
      if (!fs.existsSync(this.nounGendersFile)) return;
      const data: Record<string, 'masculine' | 'feminine' | 'neuter'> = JSON.parse(
        fs.readFileSync(this.nounGendersFile, 'utf-8')
      );
      Object.entries(data).forEach(([noun, gender]) => {
        this.nounGenders.set(noun, gender);
      });
      console.log(`[fragment-cache] Loaded ${this.nounGenders.size} noun genders from disk`);
    } catch (error) {
      console.error('[fragment-cache] Failed to load noun genders:', error);
    }
  }

  private saveNounGenders(): void {
    try {
      if (!fs.existsSync(this.cacheDir)) {
        fs.mkdirSync(this.cacheDir, { recursive: true });
      }
      const data = Object.fromEntries(this.nounGenders);
      fs.writeFileSync(this.nounGendersFile, JSON.stringify(data, null, 2), 'utf-8');
      console.log(`[fragment-cache] Saved ${this.nounGenders.size} noun genders to disk`);
    } catch (error) {
      console.error('[fragment-cache] Failed to save noun genders:', error);
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

    // Apply masculine ending - default to "ый"
    // Special case: if stem ends with 'г', 'к', 'х', 'ж', 'ш', 'щ', 'ч' → use "ий"
    const lastChar = stem.charAt(stem.length - 1);
    if ('гкхжшщч'.includes(lastChar)) {
      return stem + 'ий';
    }

    return stem + 'ый';
  }

  /**
   * Apply gender agreement to adjective
   */
  private applyGenderAgreement(adjective: string, gender: 'masculine' | 'feminine' | 'neuter'): string {
    const isCapitalized = adjective.charAt(0) === adjective.charAt(0).toUpperCase();
    let stem = adjective;

    // Remove existing endings
    if (stem.endsWith('ый') || stem.endsWith('ой') || stem.endsWith('ий') ||
        stem.endsWith('ая') || stem.endsWith('яя') ||
        stem.endsWith('ое') || stem.endsWith('ее')) {
      stem = stem.slice(0, -2);
    }

    // Apply correct ending
    let result: string;
    const lastChar = stem.charAt(stem.length - 1);

    if (gender === 'masculine') {
      // Use "ий" for stems ending in г, к, х, ж, ш, щ, ч
      if ('гкхжшщч'.includes(lastChar)) {
        result = stem + 'ий';
      } else {
        result = stem + 'ый';
      }
    } else if (gender === 'feminine') {
      result = stem + 'ая';
    } else {
      result = stem + 'ое';
    }

    // Preserve capitalization
    if (isCapitalized && result.charAt(0) === result.charAt(0).toLowerCase()) {
      result = result.charAt(0).toUpperCase() + result.slice(1);
    }

    return result;
  }

  /**
   * Check if two adjectives are the same word with different gender endings
   */
  private isSameAdjectiveDifferentGender(adj1: string, adj2: string): boolean {
    // Get stems by removing gender endings
    const getStem = (word: string): string => {
      let stem = word;
      if (stem.endsWith('ый') || stem.endsWith('ой') || stem.endsWith('ий') ||
          stem.endsWith('ая') || stem.endsWith('яя') ||
          stem.endsWith('ое') || stem.endsWith('ее') ||
          stem.endsWith('ые') || stem.endsWith('ие')) {
        stem = stem.slice(0, -2);
      }
      return stem.toLowerCase();
    };

    const stem1 = getStem(adj1);
    const stem2 = getStem(adj2);

    // Same stem = same adjective, different gender
    return stem1 === stem2 && stem1.length > 0;
  }

  /**
   * Infer gender of Russian noun from its ending
   * Used as fallback when noun is not in learned dictionary
   */
  private inferGenderFromRussian(russianWord: string): 'masculine' | 'feminine' | 'neuter' {
    const word = russianWord.toLowerCase().trim();

    // Rule 1: -а or -я → feminine (рама, катушка, проволока, кирка)
    if (word.endsWith('а') || word.endsWith('я')) {
      return 'feminine';
    }

    // Rule 2: -о or -е → neuter (окно, поле, устройство)
    if (word.endsWith('о') || word.endsWith('е')) {
      return 'neuter';
    }

    // Rule 3: -ь → check suffix patterns
    if (word.endsWith('ь')) {
      // Special cases (exceptions):
      if (word === 'соль') {
        return 'feminine';
      }

      // Masculine patterns (check first, more specific):
      // -тель, -арь, -ырь (переключатель, словарь, пузырь)
      if (word.endsWith('тель') || word.endsWith('арь') || word.endsWith('ырь')) {
        return 'masculine';
      }
      // -ель after б, в, п, м (кабель, корабель, щебель)
      if (word.endsWith('бель') || word.endsWith('вель') || word.endsWith('пель') || word.endsWith('мель')) {
        return 'masculine';
      }
      // -ень, -онь, -оль (корень, огонь, уголь)
      if (word.endsWith('ень') || word.endsWith('онь') || word.endsWith('оль')) {
        return 'masculine';
      }

      // Feminine patterns:
      // -ость, -есть, -ность (абстрактные существительные)
      if (word.endsWith('ость') || word.endsWith('есть') || word.endsWith('ность')) {
        return 'feminine';
      }
      // -овь, -евь (кровь, морковь)
      if (word.endsWith('овь') || word.endsWith('евь')) {
        return 'feminine';
      }
      // -очь, -ночь (ночь, полночь)
      if (word.endsWith('очь') || word.endsWith('ночь')) {
        return 'feminine';
      }
      // -ерь (дверь, теперь)
      if (word.endsWith('ерь')) {
        return 'feminine';
      }
      // -епь (цепь, степь)
      if (word.endsWith('епь')) {
        return 'feminine';
      }
      // -ань, -знь (ткань, жизнь, болезнь)
      if (word.endsWith('ань') || word.endsWith('знь')) {
        return 'feminine';
      }
      // -ыль, -иль (пыль, быль)
      if (word.endsWith('ыль') || word.endsWith('иль')) {
        return 'feminine';
      }
      // -аль (сталь)
      if (word.endsWith('аль')) {
        return 'feminine';
      }
      // -ель after other consonants (панель, печать)
      if (word.endsWith('ель')) {
        return 'feminine';
      }
      // -ать (печать, тетрадь, площадь)
      if (word.endsWith('ать')) {
        return 'feminine';
      }

      // Default to masculine for other -ь words
      return 'masculine';
    }

    // Rule 4: Everything else (consonant ending) → masculine (корпус, блок, вал, ключ)
    return 'masculine';
  }

  /**
   * Check if a Russian word is an adjective based on its ending
   */
  private isRussianAdjective(word: string): boolean {
    const normalized = word.toLowerCase().trim();
    return normalized.endsWith('ый') || normalized.endsWith('ой') || normalized.endsWith('ий') ||
           normalized.endsWith('ая') || normalized.endsWith('яя') ||
           normalized.endsWith('ое') || normalized.endsWith('ее');
  }

  /**
   * Learn noun gender from translation pair
   */
  private learnNounGender(englishNoun: string, russianTranslation: string): void {
    const normalized = this.normalizeText(englishNoun);

    // Skip if already learned
    if (this.nounGenders.has(normalized)) return;

    // Infer gender from Russian translation
    const gender = this.inferGenderFromRussian(russianTranslation);

    // Save to dictionary
    this.nounGenders.set(normalized, gender);
    console.log(`[fragment-cache] Learned gender: "${englishNoun}" → "${russianTranslation}" = ${gender}`);

    // Save to disk
    this.saveNounGenders();
  }
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
          // Different translation - check if it's a gender variation of adjective
          const isGenderVariation = existing.isAdjective && isAdjective &&
            this.isSameAdjectiveDifferentGender(existing.translation, translation);

          if (isGenderVariation) {
            // Same adjective, different gender - NOT a conflict
            // Keep the normalized (masculine) form
            existing.confidence = Math.min(100, existing.confidence + 1);
          } else {
            // Real conflict - different translations
            existing.confidence = Math.max(30, existing.confidence - 10);
            console.log(`[fragment-cache] Conflict: "${fragment}" → "${existing.translation}" vs "${translation}"`);
          }
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
      this.hits++;
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

        // Check if word is a learned noun
        const learnedGender = this.nounGenders.get(wordNormalized);
        if (learnedGender) {
          nounGender = learnedGender;
          break;
        }
      }

      // Fallback: if noun gender is still unknown, try to infer from Russian translation
      if (!nounGender) {
        // Look for the last word's translation (likely the noun)
        const lastWord = words[words.length - 1];
        const lastWordNormalized = this.normalizeText(lastWord);
        const lastFragment = this.fragments.get(lastWordNormalized);

        if (lastFragment && lastFragment.translation) {
          nounGender = this.inferGenderFromRussian(lastFragment.translation);
          console.log(`[fragment-cache] Inferred gender for "${lastWord}" → "${lastFragment.translation}": ${nounGender}`);
        }
      }

      // Second pass: translate with gender agreement
      for (let i = 0; i < words.length; i++) {
        const word = words[i];
        const wordNormalized = this.normalizeText(word);
        const fragment = this.fragments.get(wordNormalized);

        // ИСПРАВЛЕНИЕ 3: Require minimum 2 occurrences for reliability
        if (fragment && fragment.confidence >= 60 && fragment.count >= 2) {
          let translation = fragment.translation;

          // Apply gender agreement if this is an adjective and we know the noun gender
          if (fragment.isAdjective && nounGender) {
            translation = this.applyGenderAgreement(translation, nounGender);
          }

          // Capitalize first word, lowercase others
          if (i === 0) {
            // First word - ensure it starts with uppercase
            translation = translation.charAt(0).toUpperCase() + translation.slice(1);
          } else {
            // Other words - ensure they start with lowercase
            translation = translation.charAt(0).toLowerCase() + translation.slice(1);
          }

          translatedWords.push(translation);
          totalConfidence += fragment.confidence;
          foundCount++;
        } else {
          // Word not found or insufficient data - cannot translate
          return null;
        }
      }

      // Need at least 70% average confidence
      const avgConfidence = totalConfidence / foundCount;
      if (avgConfidence >= 70) {
        this.hits++;
        const result = translatedWords.join(' ');
        console.log(`[fragment-cache] Word-by-word: "${text}" → "${result}" (confidence: ${avgConfidence.toFixed(0)}%)`);
        return result;
      }
    }

    this.misses++;
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

    // Pattern: Individual words only (1:1 mapping)
    if (originalWords.length === translatedWords.length) {
      // 1:1 mapping - extract all valid words
      for (let i = 0; i < originalWords.length; i++) {
        const word = originalWords[i].trim();
        const trans = translatedWords[i].trim();

        if (this.isValidWord(word)) {
          const wordLower = this.normalizeText(word);

          // ИСПРАВЛЕНИЕ 1: Clean punctuation from translation
          const cleanedTranslation = trans.replace(/[.,!?;:'"()\-]/g, '').trim();

          // Detect if this is an adjective by checking Russian ending
          const isAdjective = this.isRussianAdjective(cleanedTranslation);

          // Detect gender from Russian translation
          const adjectiveGender = this.detectAdjectiveGender(cleanedTranslation);

          // Normalize adjectives to masculine form
          const normalizedTrans = isAdjective && adjectiveGender ? this.normalizeToMasculine(cleanedTranslation) : cleanedTranslation;

          // Infer gender for nouns (non-adjectives)
          let inferredGender: 'masculine' | 'feminine' | 'neuter' | undefined;
          if (!isAdjective) {
            inferredGender = this.inferGenderFromRussian(cleanedTranslation);
            // Learn this noun gender for future use
            this.learnNounGender(word, cleanedTranslation);
          }

          results.push({
            fragment: word,
            translation: normalizedTrans,
            context: 'word',
            confidence: 80,
            gender: inferredGender,
            isAdjective
          });
        }
      }
    } else if (originalWords.length === 1 && this.isValidWord(originalWords[0])) {
      // Single word
      const wordLower = this.normalizeText(originalWords[0]);

      // ИСПРАВЛЕНИЕ 1: Clean punctuation from translation
      const cleanedTranslation = translated.replace(/[.,!?;:'"()\-]/g, '').trim();

      // Detect if this is an adjective
      const isAdjective = this.isRussianAdjective(cleanedTranslation);

      // Infer gender for nouns (non-adjectives)
      let inferredGender: 'masculine' | 'feminine' | 'neuter' | undefined;
      if (!isAdjective) {
        inferredGender = this.inferGenderFromRussian(cleanedTranslation);
        // Learn this noun gender for future use
        this.learnNounGender(originalWords[0].trim(), cleanedTranslation);
      }

      results.push({
        fragment: originalWords[0].trim(),
        translation: cleanedTranslation,
        context: 'word',
        confidence: 85,
        gender: inferredGender,
        isAdjective
      });
    }

    return results;
  }

  /**
   * Get statistics
   */
  getStats(): { total: number; words: number; phrases: number; highConfidence: number; lowConfidence: number; hits: number; misses: number; hitRate: string } {
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

    const total = this.hits + this.misses;
    const hitRate = total > 0 ? (this.hits / total * 100).toFixed(1) : '0.0';

    return {
      total: this.fragments.size,
      words,
      phrases,
      highConfidence,
      lowConfidence,
      hits: this.hits,
      misses: this.misses,
      hitRate
    };
  }

  /**
   * Force save to disk
   */
  flush(): void {
    if (this.isDirty) {
      this.saveToDisk();
    }
    this.saveNounGenders();
  }
}

// Singleton instance
let instance: FragmentCache | null = null;

export function getFragmentCache(cacheDir?: string): FragmentCache {
  if (!instance) {
    instance = new FragmentCache(cacheDir);
  }
  return instance;
}

export function resetFragmentCache(): void {
  if (instance) {
    instance.flush();
  }
  instance = null;
}

export function flushFragmentCache(): void {
  if (instance) {
    instance.flush();
  }
}
