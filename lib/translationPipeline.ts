/**
 * Translation Pipeline - Integrates all translation components
 * Order: TranslationCache → FragmentCache → TemplateCache → DeepL/OpenRouter
 *
 * FragmentCache works with both DeepL and OpenRouter providers
 */

import { getTranslationCache } from './translationCache';
import { getFragmentCache } from './fragmentCache';
import { getTemplateCache } from './templateCache';
import { translator } from './translator';

export interface TranslationResult {
  text: string;
  source: 'cache' | 'fragment' | 'template' | 'morphological' | 'deepl' | 'openrouter';
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

  // Step 4: Fallback to DeepL/OpenRouter (provider-agnostic)
  const translated = await translator.translate(text, { targetLang: 'RU' });
  translationCache.set(text, translated);

  // Learn from result for future use (works with both DeepL and OpenRouter)
  fragmentCache.learn(text, translated);
  templateCache.learn(text, translated);

  // Determine which provider was used
  const provider = translator.getProvider();
  const source = provider === 'openrouter' ? 'openrouter' : 'deepl';

  return { text: translated, source };
}

/**
 * Translate multiple strings through the pipeline
 * Uses real batching for efficiency
 */
export async function translateBatchThroughPipeline(
  texts: string[],
  targetLang: string = 'RU'
): Promise<TranslationResult[]> {
  if (texts.length === 0) return [];

  const translationCache = getTranslationCache();
  const fragmentCache = getFragmentCache();
  const templateCache = getTemplateCache();

  // Step 1: Check caches for all texts
  const results: TranslationResult[] = new Array(texts.length);
  const uncachedIndices: number[] = [];
  const uncachedTexts: string[] = [];

  for (let i = 0; i < texts.length; i++) {
    const text = texts[i];

    // Check TranslationCache
    const cached = translationCache.get(text);
    if (cached) {
      results[i] = { text: cached, source: 'cache' };
      continue;
    }

    // Check FragmentCache
    const fragmented = fragmentCache.tryTranslate(text);
    if (fragmented) {
      translationCache.set(text, fragmented);
      results[i] = { text: fragmented, source: 'fragment' };
      continue;
    }

    // Check TemplateCache
    const templated = templateCache.tryTranslate(text);
    if (templated) {
      translationCache.set(text, templated);
      results[i] = { text: templated, source: 'template' };
      continue;
    }

    // Mark as needing translation
    uncachedIndices.push(i);
    uncachedTexts.push(text);
  }

  // Step 2: If all cached, return immediately
  if (uncachedTexts.length === 0) {
    return results;
  }

  console.log(`[pipeline] Batch: ${texts.length} texts, ${uncachedTexts.length} need API translation`);

  // Step 3: Translate uncached texts in batch via API
  const translated = await translator.translateBatch(uncachedTexts, { targetLang: 'RU' });

  // Step 4: Learn from new translations
  for (let i = 0; i < uncachedTexts.length; i++) {
    const original = uncachedTexts[i];
    const translation = translated[i];

    // Save to cache
    translationCache.set(original, translation);

    // Learn fragments and templates
    fragmentCache.learn(original, translation);
    templateCache.learn(original, translation);

    // Store result
    const provider = translator.getProvider();
    const source = provider === 'openrouter' ? 'openrouter' : 'deepl';
    results[uncachedIndices[i]] = { text: translation, source };
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
