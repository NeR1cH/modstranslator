/**
 * Word Cache - Stores translations of individual words with their forms
 * This is different from WordLibrary (which has predefined words)
 * WordCache learns from actual translations and grows over time
 */

import * as fs from 'fs';
import * as path from 'path';

export interface WordTranslation {
  word: string;              // Original word (lowercase)
  pos?: string;              // Part of speech: noun, verb, adjective, etc.
  gender?: 'm' | 'f' | 'n';  // Gender for nouns/adjectives

  // All known forms of this word
  forms: Record<string, string>;

  // Metadata
  count: number;             // How many times seen
  confidence: number;        // 0-100, how confident we are
  lastUsed: number;          // Timestamp
}

export class WordCache {
  private words: Map<string, WordTranslation> = new Map();
  private cacheFile: string;
  private isDirty: boolean = false;
  private saveTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.cacheFile = path.join(process.cwd(), 'cache', 'word-cache.json');
    this.loadFromDisk();
  }

  /**
   * Get translation for a word
   */
  getWord(word: string): WordTranslation | null {
    const key = word.toLowerCase().trim();
    const entry = this.words.get(key);

    if (entry) {
      // Update last used timestamp
      entry.lastUsed = Date.now();
      this.isDirty = true;
      return entry;
    }

    return null;
  }

  /**
   * Add or update a word translation
   */
  addWord(word: string, translation: string, context?: {
    pos?: string;
    gender?: 'm' | 'f' | 'n';
    form?: string;  // e.g., "nom", "gen", "acc", "m_sg", "f_sg", etc.
  }): void {
    const key = word.toLowerCase().trim();
    const existing = this.words.get(key);

    if (existing) {
      // Update existing word
      existing.count++;
      existing.lastUsed = Date.now();
      existing.confidence = Math.min(100, existing.confidence + 5);

      // Add new form if provided
      if (context?.form) {
        existing.forms[context.form] = translation;
      } else {
        // Default form
        existing.forms['default'] = translation;
      }

      // Update metadata if provided
      if (context?.pos && !existing.pos) {
        existing.pos = context.pos;
      }
      if (context?.gender && !existing.gender) {
        existing.gender = context.gender;
      }
    } else {
      // New word
      const forms: Record<string, string> = {};
      if (context?.form) {
        forms[context.form] = translation;
      } else {
        forms['default'] = translation;
      }

      this.words.set(key, {
        word: key,
        pos: context?.pos,
        gender: context?.gender,
        forms,
        count: 1,
        confidence: 80,
        lastUsed: Date.now()
      });
    }

    this.isDirty = true;
    this.scheduleSave();
  }

  /**
   * Get translation for a specific form
   */
  getForm(word: string, form: string): string | null {
    const entry = this.getWord(word);
    if (!entry) return null;

    // Try exact form
    if (entry.forms[form]) {
      return entry.forms[form];
    }

    // Fallback to default
    if (entry.forms['default']) {
      return entry.forms['default'];
    }

    // Return any available form
    const forms = Object.values(entry.forms);
    return forms.length > 0 ? forms[0] : null;
  }

  /**
   * Check if word exists in cache
   */
  hasWord(word: string): boolean {
    return this.words.has(word.toLowerCase().trim());
  }

  /**
   * Get all known forms for a word
   */
  getAllForms(word: string): Record<string, string> | null {
    const entry = this.getWord(word);
    return entry ? entry.forms : null;
  }

  /**
   * Learn from a translation pair
   * Extracts individual words and their translations
   */
  learnFromTranslation(original: string, translated: string): void {
    // Simple word extraction (will be improved in SentenceSplitter)
    // Note: \w doesn't match Cyrillic in some JS engines, so we use Unicode properties
    const originalWords = original.toLowerCase().split(/\s+/).map(w => w.replace(/[^\p{L}\p{N}]/gu, '')).filter(w => w.length > 0);
    const translatedWords = translated.toLowerCase().split(/\s+/).map(w => w.replace(/[^\p{L}\p{N}]/gu, '')).filter(w => w.length > 0);

    // Filter out common articles and short words from English
    const skipWords = ['the', 'a', 'an', 'to', 'of', 'for', 'and', 'or', 'but'];
    const filteredOriginal = originalWords.filter(w => !skipWords.includes(w) && w.length >= 3);

    // For Russian, filter out only very common single-letter prepositions
    const skipWordsRU = ['в', 'к', 'с', 'у', 'о'];
    const filteredTranslated = translatedWords.filter(w => !skipWordsRU.includes(w) && w.length >= 2);

    let learnedCount = 0;

    // Simple alignment: if same number of words after filtering, map 1-to-1
    if (filteredOriginal.length === filteredTranslated.length && filteredOriginal.length > 0) {
      for (let i = 0; i < filteredOriginal.length; i++) {
        this.addWord(filteredOriginal[i], filteredTranslated[i]);
        learnedCount++;
      }
    } else if (filteredOriginal.length > 0 && filteredTranslated.length > 0) {
      // Different lengths - use smarter alignment
      // Skip first EN word if it's a preposition (inside, from, etc.)
      const prepositions = ['inside', 'from', 'into', 'onto', 'upon', 'within'];
      let startIdx = 0;
      if (prepositions.includes(filteredOriginal[0])) {
        startIdx = 1;
      }

      const alignableEN = filteredOriginal.slice(startIdx);

      if (alignableEN.length === filteredTranslated.length) {
        // Perfect match after skipping preposition
        for (let i = 0; i < alignableEN.length; i++) {
          this.addWord(alignableEN[i], filteredTranslated[i]);
          learnedCount++;
        }
      } else {
        // Fallback: ratio-based alignment
        for (let i = 0; i < filteredOriginal.length; i++) {
          const ratio = i / (filteredOriginal.length - 1 || 1);
          const targetIndex = Math.round(ratio * (filteredTranslated.length - 1));

          if (targetIndex < filteredTranslated.length) {
            this.addWord(filteredOriginal[i], filteredTranslated[targetIndex]);
            learnedCount++;
          }
        }
      }
    }

    if (learnedCount > 0) {
      console.log(`[word-cache] Learned ${learnedCount} words from translation`);
    }
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalWords: number;
    byPos: Record<string, number>;
    avgConfidence: number;
  } {
    const byPos: Record<string, number> = {};
    let totalConfidence = 0;

    for (const entry of this.words.values()) {
      if (entry.pos) {
        byPos[entry.pos] = (byPos[entry.pos] || 0) + 1;
      }
      totalConfidence += entry.confidence;
    }

    return {
      totalWords: this.words.size,
      byPos,
      avgConfidence: this.words.size > 0 ? totalConfidence / this.words.size : 0
    };
  }

  /**
   * Load cache from disk
   */
  private loadFromDisk(): void {
    try {
      if (fs.existsSync(this.cacheFile)) {
        const data = fs.readFileSync(this.cacheFile, 'utf-8');
        const parsed = JSON.parse(data);

        if (Array.isArray(parsed)) {
          for (const entry of parsed) {
            this.words.set(entry.word, entry);
          }
          console.log(`[word-cache] Loaded ${this.words.size} words from disk`);
        }
      }
    } catch (error) {
      console.error('[word-cache] Failed to load from disk:', error);
    }
  }

  /**
   * Save cache to disk
   */
  private saveToDisk(): void {
    if (!this.isDirty) return;

    try {
      const dir = path.dirname(this.cacheFile);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const data = Array.from(this.words.values());
      fs.writeFileSync(this.cacheFile, JSON.stringify(data, null, 2), 'utf-8');

      this.isDirty = false;
      console.log(`[word-cache] Saved ${this.words.size} words to disk`);
    } catch (error) {
      console.error('[word-cache] Failed to save to disk:', error);
    }
  }

  /**
   * Schedule save (debounced)
   */
  private scheduleSave(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
    }

    this.saveTimer = setTimeout(() => {
      this.saveToDisk();
    }, 5000); // Save after 5 seconds of inactivity
  }

  /**
   * Force immediate save
   */
  flush(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    this.saveToDisk();
  }

  /**
   * Alias for getWord - for compatibility with grammarAssembler
   */
  get(word: string): WordTranslation | null {
    return this.getWord(word);
  }

  /**
   * Simplified set method - for compatibility with grammarAssembler
   * @param word - The word to store
   * @param forms - Object with form keys (nom_sg, gen_sg, etc.)
   */
  set(word: string, forms: Record<string, string>): void {
    const key = word.toLowerCase().trim();

    // If word already exists, merge forms
    const existing = this.words.get(key);
    if (existing) {
      existing.forms = { ...existing.forms, ...forms };
      existing.count++;
      existing.lastUsed = Date.now();
    } else {
      // Create new entry
      this.words.set(key, {
        word: key,
        forms,
        count: 1,
        confidence: 50, // Low confidence for manually added words
        lastUsed: Date.now()
      });
    }

    this.isDirty = true;
    this.scheduleSave();
  }
}

// Singleton instance
let instance: WordCache | null = null;

export function getWordCache(): WordCache {
  if (!instance) {
    instance = new WordCache();
  }
  return instance;
}
