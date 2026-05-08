/**
 * Universal translator interface
 * Hybrid system: OpenRouter (primary) → DeepL (fallback)
 * With translation caching and graceful shutdown
 */

import { translateTexts as deeplTranslate } from './deepl';
import { openrouterTranslator } from './openrouter';
import { getTranslationCache } from './translationCache';
import { scheduleShutdown, cancelShutdown } from './serverShutdown';

type TranslationProvider = 'deepl' | 'openrouter' | 'hybrid';

interface TranslateOptions {
  targetLang?: string;
  sourceLang?: string;
  preserveFormatting?: boolean;
}

class UniversalTranslator {
  private provider: TranslationProvider;
  private currentProvider: 'deepl' | 'openrouter' = 'openrouter';
  private openrouterFailed = false;

  constructor() {
    const envProvider = process.env.TRANSLATION_PROVIDER?.toLowerCase();
    this.provider = (envProvider as TranslationProvider) || 'hybrid';

    console.log(`🔧 [Translator] Initializing with provider: ${this.provider}`);

    // Если OpenRouter не настроен, используем DeepL
    if (!process.env.OPENROUTER_API_KEY) {
      console.log('⚠️ [Translator] OPENROUTER_API_KEY not set, using DeepL only');
      this.currentProvider = 'deepl';
    } else {
      console.log(`✅ [Translator] OpenRouter configured with model: ${process.env.OPENROUTER_MODEL}`);
    }
  }

  /**
   * Translate single text with automatic fallback
   */
  async translate(text: string, options: TranslateOptions = {}): Promise<string> {
    const { targetLang = 'RU', preserveFormatting = true } = options;

    // Check cache first
    const cache = getTranslationCache();
    const cached = cache.get(text);
    if (cached) {
      console.log(`💾 [Translator] Cache hit for: ${text.substring(0, 50)}...`);
      return cached;
    }

    let result: string;

    // Режим hybrid: пробуем OpenRouter, при ошибке → DeepL
    if (this.provider === 'hybrid') {
      // Если OpenRouter недоступен с самого начала, используем DeepL напрямую
      if (this.currentProvider === 'deepl') {
        const results = await deeplTranslate([text], targetLang);
        result = results[0];
      } else {
        result = await this.translateWithFallback(text, targetLang, preserveFormatting);
      }
    }
    // Фиксированный провайдер
    else if (this.provider === 'openrouter') {
      result = await openrouterTranslator.translate(text, {
        targetLang: this.mapLangCode(targetLang),
        preserveFormatting
      });
    }
    // DeepL
    else {
      const results = await deeplTranslate([text], targetLang);
      result = results[0];
    }

    // Save to cache
    cache.set(text, result);
    console.log(`💾 [Translator] Cached translation for: ${text.substring(0, 50)}...`);

    return result;
  }

  /**
   * Translate multiple texts with automatic fallback
   */
  async translateBatch(texts: string[], options: TranslateOptions = {}): Promise<string[]> {
    const { targetLang = 'RU', preserveFormatting = true } = options;

    // Check cache first
    const cache = getTranslationCache();
    const cachedResults = cache.getMany(texts);

    // Separate cached and uncached texts
    const uncachedTexts: string[] = [];
    const uncachedIndices: number[] = [];

    for (let i = 0; i < texts.length; i++) {
      if (!cachedResults.has(texts[i])) {
        uncachedTexts.push(texts[i]);
        uncachedIndices.push(i);
      }
    }

    console.log(`💾 [Translator] Cache: ${cachedResults.size}/${texts.length} hits (${uncachedTexts.length} need translation)`);

    // If all cached, return immediately
    if (uncachedTexts.length === 0) {
      return texts.map(text => cachedResults.get(text)!);
    }

    // Translate uncached texts
    let translatedUncached: string[];

    // Режим hybrid: пробуем OpenRouter, при ошибке → DeepL
    if (this.provider === 'hybrid') {
      // Если OpenRouter недоступен с самого начала, используем DeepL напрямую
      if (this.currentProvider === 'deepl') {
        translatedUncached = await deeplTranslate(uncachedTexts, targetLang);
      } else {
        translatedUncached = await this.translateBatchWithFallback(uncachedTexts, targetLang, preserveFormatting);
      }
    }
    // Фиксированный провайдер
    else if (this.provider === 'openrouter') {
      translatedUncached = await openrouterTranslator.translateBatch(uncachedTexts, {
        targetLang: this.mapLangCode(targetLang),
        preserveFormatting
      });
    }
    // DeepL
    else {
      translatedUncached = await deeplTranslate(uncachedTexts, targetLang);
    }

    // Save new translations to cache
    const newPairs = uncachedTexts.map((original, i) => ({
      original,
      translated: translatedUncached[i]
    }));
    cache.setMany(newPairs);

    // Merge cached and newly translated results
    const results: string[] = [];
    let uncachedIndex = 0;

    for (let i = 0; i < texts.length; i++) {
      const cached = cachedResults.get(texts[i]);
      if (cached !== undefined) {
        results.push(cached);
      } else {
        results.push(translatedUncached[uncachedIndex]);
        uncachedIndex++;
      }
    }

    return results;
  }

  /**
   * Translate with automatic fallback (single text)
   */
  private async translateWithFallback(
    text: string,
    targetLang: string,
    preserveFormatting: boolean
  ): Promise<string> {
    // Если OpenRouter уже упал, сразу используем DeepL
    if (this.openrouterFailed) {
      console.log('🔄 [Translator] Using DeepL (OpenRouter previously failed)');
      try {
        const results = await deeplTranslate([text], targetLang);
        // Успешный перевод через DeepL - отменяем shutdown если был запланирован
        cancelShutdown();
        return results[0];
      } catch (error: any) {
        console.error('❌ [Translator] DeepL also failed:', error.message);
        // Оба провайдера недоступны - планируем shutdown
        scheduleShutdown(`OpenRouter недоступен, DeepL ошибка: ${error.message}`);
        throw error;
      }
    }

    // Пробуем OpenRouter
    console.log('🚀 [Translator] Attempting translation with OpenRouter...');
    try {
      const result = await openrouterTranslator.translate(text, {
        targetLang: this.mapLangCode(targetLang),
        preserveFormatting
      });
      this.currentProvider = 'openrouter';
      console.log('✅ [Translator] OpenRouter translation successful');
      return result;
    } catch (error: any) {
      console.warn('⚠️ [Translator] OpenRouter failed, falling back to DeepL');
      console.warn(`   Error: ${error.message}`);

      // Помечаем OpenRouter как недоступный
      this.openrouterFailed = true;
      this.currentProvider = 'deepl';

      // Fallback на DeepL
      console.log('🔄 [Translator] Switching to DeepL...');
      try {
        const results = await deeplTranslate([text], targetLang);
        console.log('✅ [Translator] DeepL translation successful');
        return results[0];
      } catch (deeplError: any) {
        console.error('❌ [Translator] DeepL also failed:', deeplError.message);
        // Оба провайдера недоступны - планируем shutdown
        scheduleShutdown(`OpenRouter: ${error.message}, DeepL: ${deeplError.message}`);
        throw deeplError;
      }
    }
  }

  /**
   * Translate batch with automatic fallback
   */
  private async translateBatchWithFallback(
    texts: string[],
    targetLang: string,
    preserveFormatting: boolean
  ): Promise<string[]> {
    // Если OpenRouter уже упал, сразу используем DeepL
    if (this.openrouterFailed) {
      console.log('🔄 [Translator] Using DeepL for batch (OpenRouter previously failed)');
      try {
        const results = await deeplTranslate(texts, targetLang);
        // Успешный перевод через DeepL - отменяем shutdown если был запланирован
        cancelShutdown();
        return results;
      } catch (error: any) {
        console.error('❌ [Translator] DeepL batch failed:', error.message);
        // Оба провайдера недоступны - планируем shutdown
        scheduleShutdown(`OpenRouter недоступен, DeepL ошибка: ${error.message}`);
        throw error;
      }
    }

    // Пробуем OpenRouter
    console.log(`🚀 [Translator] Attempting batch translation with OpenRouter (${texts.length} texts)...`);
    try {
      const results = await openrouterTranslator.translateBatch(texts, {
        targetLang: this.mapLangCode(targetLang),
        preserveFormatting
      });
      this.currentProvider = 'openrouter';
      console.log(`✅ [Translator] OpenRouter batch translation successful (${results.length} results)`);
      return results;
    } catch (error: any) {
      console.warn('⚠️ [Translator] OpenRouter batch failed, falling back to DeepL');
      console.warn(`   Error: ${error.message}`);

      // Помечаем OpenRouter как недоступный
      this.openrouterFailed = true;
      this.currentProvider = 'deepl';

      // Fallback на DeepL
      console.log(`🔄 [Translator] Switching to DeepL for batch (${texts.length} texts)...`);
      try {
        const results = await deeplTranslate(texts, targetLang);
        console.log(`✅ [Translator] DeepL batch translation successful (${results.length} results)`);
        return results;
      } catch (deeplError: any) {
        console.error('❌ [Translator] DeepL batch also failed:', deeplError.message);
        // Оба провайдера недоступны - планируем shutdown
        scheduleShutdown(`OpenRouter: ${error.message}, DeepL: ${deeplError.message}`);
        throw deeplError;
      }
    }
  }

  /**
   * Get current active provider
   */
  getProvider(): 'deepl' | 'openrouter' {
    return this.currentProvider;
  }

  /**
   * Get provider display name
   */
  getProviderName(): string {
    if (this.currentProvider === 'openrouter') {
      const model = openrouterTranslator.getModel();
      return `OpenRouter (${model})`;
    }
    return 'DeepL';
  }

  /**
   * Reset OpenRouter failed flag (для повторной попытки)
   */
  resetFailedState(): void {
    this.openrouterFailed = false;
    this.currentProvider = 'openrouter';
  }

  /**
   * Map language codes (DeepL uses 'RU', OpenRouter uses 'Russian')
   */
  private mapLangCode(code: string): string {
    const map: Record<string, string> = {
      'RU': 'Russian',
      'EN': 'English',
      'DE': 'German',
      'FR': 'French',
      'ES': 'Spanish',
      'IT': 'Italian',
      'JA': 'Japanese',
      'ZH': 'Chinese'
    };
    return map[code.toUpperCase()] || code;
  }
}

// Singleton instance
export const translator = new UniversalTranslator();

// Export class for testing
export { UniversalTranslator };
