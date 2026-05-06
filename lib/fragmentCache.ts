/**
 * Fragment Cache - Smart caching system for reusable translation fragments
 * Automatically extracts and reuses common patterns like "Diamond Sword" → "Diamond" + "Sword"
 * Works transparently in the background, no user configuration needed
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

interface Fragment {
  text: string;
  translation: string;
  context: 'prefix' | 'suffix' | 'standalone';
  gender?: 'masculine' | 'feminine' | 'neuter';
  count: number; // How many times seen
  confidence: number; // 0-100
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

  // Common Minecraft material patterns
  private readonly MATERIALS = [
    'diamond', 'iron', 'gold', 'golden', 'stone', 'wooden', 'wood',
    'netherite', 'leather', 'chainmail', 'steel', 'bronze', 'silver',
    'copper', 'tin', 'brass', 'aluminum', 'titanium', 'obsidian',
    'emerald', 'ruby', 'sapphire', 'amethyst', 'quartz',
    // Added materials from modpacks
    'zinc', 'lead', 'uranium', 'nickel', 'osmium', 'platinum',
    'iridium', 'tungsten', 'chromium', 'cobalt', 'invar', 'electrum',
    'constantan', 'signalum', 'lumium', 'enderium'
  ];

  // Common Minecraft item types
  private readonly ITEM_TYPES = [
    'sword', 'pickaxe', 'axe', 'shovel', 'hoe', 'helmet', 'chestplate',
    'leggings', 'boots', 'bow', 'arrow', 'shield', 'dagger', 'spear',
    'pike', 'lance', 'mace', 'hammer', 'scythe', 'katana', 'rapier',
    'stiletto', 'saber', 'cutlass', 'claymore', 'greatsword',
    // Added item types from modpacks
    'ore', 'dust', 'plate', 'gear', 'rod', 'sheet', 'nugget',
    'ingot', 'block', 'chunk', 'clump', 'shard', 'crystal',
    'wire', 'coil', 'casing', 'frame'
  ];

  // Common prefixes for materials
  private readonly PREFIXES = [
    'raw', 'crushed', 'molten', 'refined', 'processed', 'purified',
    'enriched', 'compressed', 'dense', 'dirty'
  ];

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
   * Learn fragments from a successful translation
   */
  learn(original: string, translated: string): void {
    const patterns = this.extractPatterns(original, translated);
    patterns.forEach(({ fragment, translation, context, confidence }) => {
      const key = fragment.toLowerCase();
      const existing = this.fragments.get(key);

      if (existing) {
        // Update existing fragment
        existing.count++;
        existing.confidence = Math.min(100, existing.confidence + 5);
        if (existing.translation !== translation) {
          // Conflict detected - lower confidence
          existing.confidence = Math.max(50, existing.confidence - 10);
        }
      } else {
        // New fragment
        this.fragments.set(key, {
          text: fragment,
          translation,
          context,
          count: 1,
          confidence
        });
      }
    });

    this.isDirty = true;
    this.scheduleSave();
  }

  /**
   * Try to translate using fragments
   * Returns null if confidence is too low
   */
  tryTranslate(text: string): string | null {
    const patterns = this.detectPatterns(text);
    if (patterns.length === 0) return null;

    let totalConfidence = 0;
    let translatedParts: string[] = [];
    let allFound = true;

    for (const pattern of patterns) {
      const fragment = this.fragments.get(pattern.toLowerCase());
      if (!fragment || fragment.confidence < 70) {
        allFound = false;
        break;
      }
      translatedParts.push(fragment.translation);
      totalConfidence += fragment.confidence;
    }

    if (!allFound) return null;

    const avgConfidence = totalConfidence / patterns.length;
    if (avgConfidence < 75) return null;

    // Combine parts with proper spacing
    const result = translatedParts.join(' ');
    console.log(`[fragment-cache] Translated "${text}" → "${result}" (confidence: ${avgConfidence.toFixed(0)}%)`);
    return result;
  }

  /**
   * Extract patterns from original and translated text
   */
  private extractPatterns(original: string, translated: string): Array<{
    fragment: string;
    translation: string;
    context: 'prefix' | 'suffix' | 'standalone';
    confidence: number;
  }> {
    const results: Array<{
      fragment: string;
      translation: string;
      context: 'prefix' | 'suffix' | 'standalone';
      confidence: number;
    }> = [];

    // Pattern 1: "Material + Item" (e.g., "Diamond Sword")
    const materialMatch = original.match(/^(\w+)\s+(\w+)$/i);
    if (materialMatch) {
      const [, material, item] = materialMatch;
      const translatedParts = translated.split(/\s+/);

      // Allow 1-3 words in translation (was: exactly 2)
      if (translatedParts.length >= 1 && translatedParts.length <= 3) {
        const isMaterial = this.MATERIALS.includes(material.toLowerCase());
        const isItem = this.ITEM_TYPES.includes(item.toLowerCase());

        if (isMaterial || isItem) {
          // For 2-word translations, extract both parts
          if (translatedParts.length === 2) {
            results.push({
              fragment: material,
              translation: translatedParts[0],
              context: 'prefix',
              confidence: isMaterial ? 90 : 70
            });
            results.push({
              fragment: item,
              translation: translatedParts[1],
              context: 'suffix',
              confidence: isItem ? 90 : 70
            });
          }
          // For 1-word translations, extract as single fragment
          else if (translatedParts.length === 1) {
            results.push({
              fragment: original,
              translation: translated,
              context: 'standalone',
              confidence: (isMaterial && isItem) ? 85 : 75
            });
          }
          // For 3-word translations, try to map intelligently
          else if (translatedParts.length === 3) {
            // Assume first word is material, last word is item type
            if (isMaterial) {
              results.push({
                fragment: material,
                translation: translatedParts[0],
                context: 'prefix',
                confidence: 85
              });
            }
            if (isItem) {
              results.push({
                fragment: item,
                translation: translatedParts[2],
                context: 'suffix',
                confidence: 85
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
        results.push({
          fragment: singleWord,
          translation: translated.trim(),
          context: 'standalone',
          confidence: 85
        });
      }
    }

    // Pattern 3: "Prefix + Material + Item" (e.g., "Raw Iron Ore", "Crushed Gold Dust")
    const prefixMatch = original.match(/^(\w+)\s+(\w+)\s+(\w+)$/i);
    if (prefixMatch) {
      const [, prefix, material, item] = prefixMatch;
      const translatedParts = translated.split(/\s+/);

      const isPrefix = this.PREFIXES.includes(prefix.toLowerCase());
      const isMaterial = this.MATERIALS.includes(material.toLowerCase());
      const isItem = this.ITEM_TYPES.includes(item.toLowerCase());

      // Extract fragments if we recognize at least 2 out of 3 parts
      if ((isPrefix && isMaterial) || (isMaterial && isItem) || (isPrefix && isItem)) {
        // Extract prefix if recognized
        if (isPrefix && translatedParts.length >= 1) {
          results.push({
            fragment: prefix,
            translation: translatedParts[0],
            context: 'prefix',
            confidence: 80
          });
        }

        // Extract material if recognized
        if (isMaterial && translatedParts.length >= 2) {
          const materialIndex = isPrefix ? 1 : 0;
          results.push({
            fragment: material,
            translation: translatedParts[materialIndex],
            context: 'prefix',
            confidence: 85
          });
        }

        // Extract item type if recognized
        if (isItem && translatedParts.length >= 2) {
          results.push({
            fragment: item,
            translation: translatedParts[translatedParts.length - 1],
            context: 'suffix',
            confidence: 85
          });
        }
      }
    }

    return results;
  }

  /**
   * Detect patterns in text that might be translatable via fragments
   */
  private detectPatterns(text: string): string[] {
    const patterns: string[] = [];

    // Pattern 1: "Prefix + Material + Item" (3 words)
    const prefixMatch = text.match(/^(\w+)\s+(\w+)\s+(\w+)$/i);
    if (prefixMatch) {
      const [, prefix, material, item] = prefixMatch;
      const isPrefix = this.PREFIXES.includes(prefix.toLowerCase());
      const isMaterial = this.MATERIALS.includes(material.toLowerCase());
      const isItem = this.ITEM_TYPES.includes(item.toLowerCase());

      // If we recognize at least 2 out of 3 parts, try to use fragments
      if ((isPrefix && isMaterial) || (isMaterial && isItem) || (isPrefix && isItem)) {
        if (isPrefix) patterns.push(prefix);
        if (isMaterial) patterns.push(material);
        if (isItem) patterns.push(item);
        return patterns;
      }
    }

    // Pattern 2: "Material + Item" (2 words)
    const materialMatch = text.match(/^(\w+)\s+(\w+)$/i);
    if (materialMatch) {
      const [, material, item] = materialMatch;
      patterns.push(material, item);
    }

    return patterns;
  }

  /**
   * Get statistics
   */
  getStats(): { total: number; highConfidence: number; lowConfidence: number } {
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
