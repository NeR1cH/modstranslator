/**
 * Translation Pipeline - Integrates all translation components
 * Order: TranslationCache → FragmentCache → TemplateCache → WordBased → MorphologicalTranslate → DeepL/OpenRouter
 */

import { getTranslationCache } from './translationCache';
import { getFragmentCache } from './fragmentCache';
import { getTemplateCache } from './templateCache';
import { translateWordBased } from './wordBasedTranslator';
import { translator } from './translator';

export interface TranslationResult {
  text: string;
  source: 'cache' | 'fragment' | 'template' | 'word-based' | 'morphological' | 'deepl';
}

/**
 * Translate a single string through the pipeline
 */
export async function translateThroughPipeline(
  text: string,
  targetLang: string = 'RU'
): Promise<TranslationResult> {
  // Step 1: Check TranslationCache
  const translationCache = getTranslationCache();
  const cached = translationCache.get(text);
  if (cached) {
    return { text: cached, source: 'cache' };
  }

  // Step 2: Try FragmentCache
  const fragmentCache = getFragmentCache();
  const fragmented = fragmentCache.tryTranslate(text);
  if (fragmented) {
    translationCache.set(text, fragmented);
    return { text: fragmented, source: 'fragment' };
  }

  // Step 3: Try TemplateCache
  const templateCache = getTemplateCache();
  const templated = templateCache.tryTranslate(text);
  if (templated) {
    translationCache.set(text, templated);
    return { text: templated, source: 'template' };
  }

  // Step 4: Try WordBased translation
  try {
    const wordBased = await translateWordBased(text, targetLang);
    if (wordBased && wordBased.text && wordBased.text.length > 0) {
      translationCache.set(text, wordBased.text);
      return { text: wordBased.text, source: 'word-based' };
    }
  } catch (error) {
    console.error('[pipeline] Word-based translation failed:', error);
  }

  // Step 5: TODO - MorphologicalTranslate (not implemented yet)
  // This would handle simple phrases like "iron ingot" → "железный слиток"

  // Step 6: Fallback to DeepL/OpenRouter
  const translated = await translator.translate(text, { targetLang: 'RU' });
  translationCache.set(text, translated);

  // Learn from result for future use
  fragmentCache.learn(text, translated);
  templateCache.learn(text, translated);

  return { text: translated, source: 'deepl' };
}

/**
 * Translate multiple strings through the pipeline
 */
export async function translateBatchThroughPipeline(
  texts: string[],
  targetLang: string = 'RU'
): Promise<TranslationResult[]> {
  const results: TranslationResult[] = [];

  for (const text of texts) {
    const result = await translateThroughPipeline(text, targetLang);
    results.push(result);
  }

  return results;
}

/**
 * Get pipeline statistics
 */
export function getPipelineStats() {
  const translationCache = getTranslationCache();
  const fragmentCache = getFragmentCache();
  const templateCache = getTemplateCache();

  return {
    translationCache: translationCache.getStats(),
    fragmentCache: fragmentCache.getStats(),
    templateCache: templateCache.getStats()
  };
}
