// ============================================================
// BLOCK: Translation Cache
// Caches translations to save API quota and speed up repeated translations
// ============================================================

import path from 'path';
import crypto from 'crypto';
import { BaseCache } from './BaseCache';
import { createLogger } from './logger';

const CACHE_DIR = path.join(process.cwd(), '.translation-cache');
const CACHE_VERSION = 'v1';

interface CacheEntry {
  hash: string;
  original: string;
  translated: string;
  timestamp: number;
}

interface CacheData {
  version: string;
  entries: CacheEntry[];
}

class TranslationCache extends BaseCache<CacheData> {
  private memoryCache = new Map<string, string>();
  protected logger = createLogger('cache');

  constructor() {
    super({
      cacheDir: CACHE_DIR,
      fileName: `cache-${CACHE_VERSION}.json`,
      version: CACHE_VERSION,
      autoSaveDelay: 5000,
    });
  }

  /**
   * Generate hash for text (case-insensitive, trimmed)
   */
  private getHash(text: string): string {
    return crypto
      .createHash('sha256')
      .update(text.toLowerCase().trim())
      .digest('hex');
  }

  /**
   * Get cached translation for a single text
   */
  get(text: string): string | null {
    const hash = this.getHash(text);
    const cached = this.memoryCache.get(hash);

    if (cached) {
      this.logger.debug('HIT:', text.substring(0, 50) + (text.length > 50 ? '...' : ''));
      return cached;
    }

    return null;
  }

  /**
   * Cache a single translation
   */
  set(original: string, translated: string): void {
    const hash = this.getHash(original);
    this.memoryCache.set(hash, translated);
    this.isDirty = true;

    // Debounced save to disk (don't save on every set)
    this.scheduleSave();
  }

  /**
   * Get cached translations for multiple texts
   * Returns Map with only the texts that were found in cache
   */
  getMany(texts: string[]): Map<string, string> {
    const results = new Map<string, string>();

    for (const text of texts) {
      const cached = this.get(text);
      if (cached) {
        results.set(text, cached);
      }
    }

    if (results.size > 0) {
      this.logger.info(`Batch lookup: ${results.size}/${texts.length} hits (${Math.round(results.size / texts.length * 100)}%)`);
    }

    return results;
  }

  /**
   * Cache multiple translations
   */
  setMany(pairs: Array<{ original: string; translated: string }>): void {
    for (const { original, translated } of pairs) {
      const hash = this.getHash(original);
      this.memoryCache.set(hash, translated);
    }

    this.isDirty = true;
    this.scheduleSave();

    this.logger.info(`Cached ${pairs.length} new translations`);
  }

  /**
   * Load cache from disk
   */
  protected loadFromDisk(): void {
    const cacheData = this.readJsonFile<CacheData>(this.cacheFile);

    if (!cacheData) {
      this.logger.info('No cache file found, starting fresh');
      return;
    }

    // Check version compatibility
    if (cacheData.version !== this.version) {
      this.logger.info('Cache version mismatch, clearing old cache');
      return;
    }

    // Load entries into memory
    for (const entry of cacheData.entries) {
      this.memoryCache.set(entry.hash, entry.translated);
    }

    this.logger.info(`Loaded ${cacheData.entries.length} entries from disk`);
  }

  /**
   * Save cache to disk immediately
   */
  protected saveToDisk(): void {
    if (!this.isDirty) {
      return;
    }

    const entries: CacheEntry[] = [];

    // Convert memory cache to array
    for (const [hash, translated] of this.memoryCache.entries()) {
      entries.push({
        hash,
        original: '', // Don't store original to save space
        translated,
        timestamp: Date.now()
      });
    }

    const cacheData: CacheData = {
      version: this.version,
      entries
    };

    this.writeJsonFile(this.cacheFile, cacheData);
    this.isDirty = false;

    this.logger.info(`Saved ${entries.length} entries to disk`);
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      size: this.memoryCache.size,
      cacheFile: this.cacheFile,
      cacheDir: this.cacheDir
    };
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.memoryCache.clear();
    this.isDirty = true;
    this.saveToDisk();
    this.logger.info('Cache cleared');
  }
}

// Singleton instance
let cacheInstance: TranslationCache | null = null;

/**
 * Get or create cache instance
 */
export function getTranslationCache(): TranslationCache {
  if (!cacheInstance) {
    cacheInstance = new TranslationCache();
  }
  return cacheInstance;
}
