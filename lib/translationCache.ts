// ============================================================
// BLOCK: Translation Cache
// Caches translations to save API quota and speed up repeated translations
// ============================================================

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const CACHE_DIR = path.join(process.cwd(), '.translation-cache');
const CACHE_VERSION = 'v1';
const CACHE_FILE = path.join(CACHE_DIR, `cache-${CACHE_VERSION}.json`);

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

class TranslationCache {
  private memoryCache = new Map<string, string>();
  private isDirty = false;
  private saveTimeout: NodeJS.Timeout | null = null;

  constructor() {
    this.init();
  }

  /**
   * Initialize cache directory and load from disk
   */
  private init(): void {
    try {
      // Create cache directory if it doesn't exist
      if (!fs.existsSync(CACHE_DIR)) {
        fs.mkdirSync(CACHE_DIR, { recursive: true });
        console.log('[cache] Created cache directory:', CACHE_DIR);
      }

      // Load existing cache
      this.loadFromDisk();
    } catch (error) {
      console.error('[cache] Init error:', error);
    }
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
      console.log('[cache] HIT:', text.substring(0, 50) + (text.length > 50 ? '...' : ''));
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
      console.log(`[cache] Batch lookup: ${results.size}/${texts.length} hits (${Math.round(results.size / texts.length * 100)}%)`);
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

    console.log(`[cache] Cached ${pairs.length} new translations`);
  }

  /**
   * Load cache from disk
   */
  private loadFromDisk(): void {
    try {
      if (!fs.existsSync(CACHE_FILE)) {
        console.log('[cache] No cache file found, starting fresh');
        return;
      }

      const data = fs.readFileSync(CACHE_FILE, 'utf8');
      const cacheData: CacheData = JSON.parse(data);

      // Check version compatibility
      if (cacheData.version !== CACHE_VERSION) {
        console.log('[cache] Cache version mismatch, clearing old cache');
        return;
      }

      // Load entries into memory
      for (const entry of cacheData.entries) {
        this.memoryCache.set(entry.hash, entry.translated);
      }

      console.log(`[cache] Loaded ${cacheData.entries.length} entries from disk`);
    } catch (error) {
      console.error('[cache] Failed to load from disk:', error);
    }
  }

  /**
   * Schedule a debounced save to disk
   */
  private scheduleSave(): void {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }

    // Save after 5 seconds of inactivity
    this.saveTimeout = setTimeout(() => {
      this.saveToDisk();
    }, 5000);
  }

  /**
   * Save cache to disk immediately
   */
  private saveToDisk(): void {
    if (!this.isDirty) {
      return;
    }

    try {
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
        version: CACHE_VERSION,
        entries
      };

      fs.writeFileSync(CACHE_FILE, JSON.stringify(cacheData, null, 2), 'utf8');
      this.isDirty = false;

      console.log(`[cache] Saved ${entries.length} entries to disk`);
    } catch (error) {
      console.error('[cache] Failed to save to disk:', error);
    }
  }

  /**
   * Force save to disk (call before process exit)
   */
  flush(): void {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }
    this.saveToDisk();
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      size: this.memoryCache.size,
      cacheFile: CACHE_FILE,
      cacheDir: CACHE_DIR
    };
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.memoryCache.clear();
    this.isDirty = true;
    this.saveToDisk();
    console.log('[cache] Cache cleared');
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
